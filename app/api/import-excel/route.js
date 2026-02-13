import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { addMappingToCollection } from '@/lib/firebaseDB.js';

// Helpers copied/adapted from Dashboard parsing logic
const normalizeHeader = (value) => (
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
);

const sanitizeFieldName = (s) => (
  String(s || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '_')
);

const compactHeader = (value) => normalizeHeader(value).replace(/[^a-z0-9]/g, '');

const parseAreaValue = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const splitListValue = (value) => {
  if (!value) return [];
  return String(value)
    .split(/,|&|\band\b/gi)
    .map((v) => v.trim())
    .filter(Boolean);
};

const canonicalRegion = (regionValue) => {
  const raw = String(regionValue || '').trim();
  if (!raw) return '';
  const v = raw.toUpperCase();
  if (v.includes('CORDILLERA') || v === 'CAR') return 'CAR';
  const romanMatch = v.match(/REGION\s*(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?:\s*[-–]\s*(A|B))?/i);
  if (romanMatch) {
    const numeral = romanMatch[1].toUpperCase();
    const suffix = romanMatch[2] ? romanMatch[2].toUpperCase() : null;
    if (numeral === 'IV' && suffix) return `Region IV-${suffix}`;
    return `Region ${numeral}`;
  }
  const numericMatch = v.match(/REGION\s*(\d{1,2})(?:\s*[-–]?\s*([AB]))?/i) || v.match(/\b(\d{1,2})(?:\s*[-–]?\s*([AB]))?\b/);
  if (numericMatch) {
    const numberValue = Number(numericMatch[1]);
    const suffix = numericMatch[2] ? numericMatch[2].toUpperCase() : null;
    if (numberValue === 4 && suffix) return `Region IV-${suffix}`;
    if (numberValue >= 1 && numberValue <= 13) {
      const romanMap = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
      return `Region ${romanMap[numberValue - 1]}`;
    }
  }
  return raw;
};

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const collectionNameField = formData.get('collection') || '';

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(Buffer.from(buffer), { type: 'buffer' });
    const sheetNames = wb.SheetNames || [];

    const targetCollection = String(collectionNameField).trim() || 'mappings_import_upload';

    let uploaded = 0;
    const errors = [];

    const headerKeywords = ['survey', 'number', 'location', 'province', 'municipality', 'municipalities', 'barangay', 'area', 'icc', 'remarks', 'region', 'sheet'];

    const scoreHeaderRow = (row) => {
      const normalizedCells = row.map((cell) => normalizeHeader(cell)).filter(Boolean);
      const nonEmpty = normalizedCells.length;
      let matches = 0;
      normalizedCells.forEach((cell) => {
        headerKeywords.forEach((key) => {
          if (cell.includes(key)) matches += 1;
        });
      });
      return { matches, nonEmpty };
    };

    const findHeaderRowIndex = (allRows) => {
      let bestIndex = -1;
      let bestMatches = -1;
      let bestNonEmpty = -1;
      const maxScan = Math.min(allRows.length, 200);

      for (let i = 0; i < maxScan; i += 1) {
        const row = allRows[i] || [];
        const { matches, nonEmpty } = scoreHeaderRow(row);
        if (matches > bestMatches || (matches === bestMatches && nonEmpty > bestNonEmpty)) {
          bestIndex = i;
          bestMatches = matches;
          bestNonEmpty = nonEmpty;
        }
      }

      if (bestMatches > 0) return bestIndex;

      let fallbackIndex = -1;
      let fallbackNonEmpty = -1;
      for (let i = 0; i < maxScan; i += 1) {
        const row = allRows[i] || [];
        const nonEmpty = row.filter((cell) => String(cell || '').trim() !== '').length;
        if (nonEmpty > fallbackNonEmpty) {
          fallbackIndex = i;
          fallbackNonEmpty = nonEmpty;
        }
      }

      return fallbackNonEmpty >= 2 ? fallbackIndex : -1;
    };

    const sheetResults = [];
    for (const sheetName of sheetNames) {
      const sheetResult = { sheetName, headers: [], headerMap: null, parsed: 0, error: null };
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!Array.isArray(allRows) || allRows.length === 0) continue;

      const headerRowIndex = findHeaderRowIndex(allRows);
      if (headerRowIndex === -1) {
        // skip sheet if cannot find header
        sheetResult.error = 'no-header';
        sheetResults.push(sheetResult);
        continue;
      }

      const headerRow = allRows[headerRowIndex].map(normalizeHeader);
      const headerRowOriginal = allRows[headerRowIndex].map((h) => String(h || '').trim());
      sheetResult.headers = headerRowOriginal;

      // Map header strings to canonical field names when possible
      const mapHeaderToField = (h) => {
        const n = normalizeHeader(h);
        const c = compactHeader(n);
        if (!n) return null;
        if (n.includes('survey') && n.includes('number')) return 'surveyNumber';
        if (n === 'survey' || n.startsWith('survey')) return 'surveyNumber';
        if (n.includes('location')) return 'location';
        if (n.includes('province')) return 'province';
        if (n.includes('municipality') || n.includes('municipalities') || c.includes('municipality')) return 'municipalities';
        if (n.includes('barangay') || n.includes('barangays')) return 'barangays';
        if (n.includes('area')) return 'totalArea';
        if (n.includes('icc') || n.includes('ips')) return 'icc';
        if (n.includes('remark')) return 'remarks';
        if (n.includes('region') || n === 'sheet') return 'region';
        return null;
      };

      const headerMap = headerRowOriginal.map((h) => mapHeaderToField(h));
      sheetResult.headerMap = headerMap;

      const colIndex = (candidates) => headerRow.findIndex((h) => {
        const compact = compactHeader(h);
        return candidates.some((c) => {
          const cNorm = normalizeHeader(c);
          const cCompact = compactHeader(c);
          return h === cNorm || h.includes(cNorm) || compact.includes(cCompact);
        });
      });

      // Prefer explicit headerMap matches when available
      let surveyIdx = headerMap.indexOf('surveyNumber');
      let locationIdx = headerMap.indexOf('location');
      let provinceIdx = headerMap.indexOf('province');
      let municipalityIdx = headerMap.indexOf('municipalities');
      let barangayIdx = headerMap.indexOf('barangays');
      let areaIdx = headerMap.indexOf('totalArea');
      let iccIdx = headerMap.indexOf('icc');
      let remarksIdx = headerMap.indexOf('remarks');
      let regionIdx = headerMap.indexOf('region');

      // Fallback to fuzzy matching if headerMap didn't find indexes
      if (surveyIdx === -1) surveyIdx = colIndex(['survey number', 'survey no', 'survey #', 'survey']);
      if (locationIdx === -1) locationIdx = colIndex(['location']);
      if (provinceIdx === -1) provinceIdx = colIndex(['province']);
      if (municipalityIdx === -1) municipalityIdx = colIndex(['municipality', 'municipality/ies', 'municipalities']);
      if (barangayIdx === -1) barangayIdx = colIndex(['barangays', 'barangay/s', 'barangay']);
      if (areaIdx === -1) areaIdx = colIndex(['total area', 'area', 'area (ha)', 'area (ha)']);
      if (iccIdx === -1) iccIdx = colIndex(['icc', 'iccs/ips', 'iccs', 'icc/ips']);
      if (remarksIdx === -1) remarksIdx = colIndex(['remarks']);
      if (regionIdx === -1) regionIdx = colIndex(['region', 'sheet']);

      // Determine if location-style rows are used
      let hasLocationFormat = locationIdx !== -1 && provinceIdx === -1 && municipalityIdx === -1 && barangayIdx === -1;

      if (!hasLocationFormat && locationIdx === -1 && headerRow.length >= 5) {
        const mergedHeader = compactHeader(headerRow.join(' '));
        if (mergedHeader.includes('survey') && mergedHeader.includes('location') && mergedHeader.includes('area')) {
          locationIdx = 1;
          provinceIdx = -1;
          municipalityIdx = -1;
          barangayIdx = -1;
          areaIdx = 2;
          iccIdx = 3;
          remarksIdx = 4;
          regionIdx = -1;
          hasLocationFormat = true;
        }
      }

      if (!hasLocationFormat && surveyIdx === -1) {
        if (headerRow.length >= 8) {
          surveyIdx = 0;
          provinceIdx = 1;
          municipalityIdx = 2;
          barangayIdx = 3;
          areaIdx = 4;
          iccIdx = 5;
          remarksIdx = 6;
          regionIdx = 7;
        } else if (headerRow.length >= 7) {
          surveyIdx = 0;
          provinceIdx = 1;
          municipalityIdx = 2;
          barangayIdx = 3;
          areaIdx = 4;
          iccIdx = 5;
          remarksIdx = 6;
          regionIdx = -1;
        } else if (headerRow.length >= 5) {
          surveyIdx = 0;
          locationIdx = 1;
          areaIdx = 2;
          iccIdx = 3;
          remarksIdx = 4;
          regionIdx = -1;
          hasLocationFormat = true;
        }
      }

      if (!hasLocationFormat && [surveyIdx, provinceIdx, municipalityIdx, barangayIdx, areaIdx, iccIdx, remarksIdx].some((idx) => idx === -1)) {
        // invalid headers for this sheet — skip
        sheetResult.error = 'invalid-headers';
        // attach what we found for debugging
        sheetResult.found = headerRowOriginal;
        sheetResult.fieldMap = headerMap;
        // store result and continue
        // eslint-disable-next-line no-continue
        sheetResults.push(sheetResult);
        continue;
      }

      // Build records
      if (hasLocationFormat) {
        let current = null;
        const flushCurrent = async () => {
          if (!current) return;
          const municipalities = Array.from(new Set(current.municipalities || []));
          const barangays = Array.from(new Set(current.barangays || []));
          const provinces = Array.from(new Set(current.provinces || []));
          const doc = {
            surveyNumber: current.surveyNumber,
            province: provinces.join(', '),
            municipality: municipalities.join(', '),
            municipalities,
            barangays,
            totalArea: current.totalArea,
            icc: current.icc,
            remarks: current.remarks,
            region: canonicalRegion(sheetName),
          };
          try {
            // eslint-disable-next-line no-await-in-loop
            await addMappingToCollection(targetCollection, doc);
            uploaded += 1;
            sheetResult.parsed += 1;
          } catch (err) {
            errors.push({ sheet: sheetName, row: current, message: String(err?.message || err) });
          }
        };

        const dataRows = allRows.slice(headerRowIndex + 1);
        for (const row of dataRows) {
          const surveyCell = String(row[surveyIdx] || '').trim();
          const locationCell = String(row[locationIdx] || '').trim();
          const areaCell = row[areaIdx];
          const iccCellRaw = String(row[iccIdx] || '').trim();
          const remarksCellRaw = String(row[remarksIdx] || '').trim();

          if (surveyCell) {
            await flushCurrent();
            const iccValue = iccCellRaw.toLowerCase() === 'void' ? '' : iccCellRaw;
            const remarksValue = remarksCellRaw.toLowerCase() === 'void' ? '' : remarksCellRaw;
            current = {
              surveyNumber: surveyCell,
              provinces: [],
              municipalities: [],
              barangays: [],
              totalArea: parseAreaValue(areaCell),
              icc: iccValue ? String(iccValue).split(/[;,/]+/).map((v) => v.trim()).filter(Boolean) : [],
              remarks: remarksValue,
            };
          } else if (!current) {
            continue;
          }

          if (areaCell && current.totalArea === 0) current.totalArea = parseAreaValue(areaCell);
          if (iccCellRaw && current.icc.length === 0) current.icc = String(iccCellRaw).split(/[;,/]+/).map((v) => v.trim()).filter(Boolean);
          if (remarksCellRaw && !current.remarks) current.remarks = remarksCellRaw.toLowerCase() === 'void' ? '' : remarksCellRaw;

          if (locationCell) {
            // parse location line: simple heuristics
            const lower = locationCell.toLowerCase();
            const colonIndex = locationCell.indexOf(':');
            const payload = colonIndex !== -1 ? locationCell.slice(colonIndex + 1).trim() : locationCell;
            if (lower.startsWith('barangay')) current.barangays.push(...splitListValue(payload));
            else if (lower.startsWith('municipality')) current.municipalities.push(...splitListValue(payload));
            else if (lower.startsWith('province')) current.provinces.push(...splitListValue(payload));
          }
        }

        await flushCurrent();
      } else {
        const dataRows = allRows.slice(headerRowIndex + 1);
        for (const row of dataRows) {
          const surveyNumber = String(row[surveyIdx] || '').trim();
          if (!surveyNumber) continue;

          const province = String(row[provinceIdx] || '').trim();
          const municipalityRaw = String(row[municipalityIdx] || '').trim();
          const barangayRaw = String(row[barangayIdx] || '').trim();
          const totalArea = parseAreaValue(row[areaIdx]);
          const icc = String(row[iccIdx] || '').trim() ? String(row[iccIdx] || '').trim().split(/[;,/]+/).map((v) => v.trim()).filter(Boolean) : [];
          const remarks = String(row[remarksIdx] || '').trim();
          const regionCell = regionIdx !== -1 ? String(row[regionIdx] || '').trim() : '';

          const municipalities = splitListValue(municipalityRaw);
          const barangays = splitListValue(barangayRaw);

          const doc = {
            surveyNumber,
            province,
            municipality: municipalities.join(', '),
            municipalities,
            barangays,
            totalArea,
            icc,
            remarks,
            region: canonicalRegion(regionCell || sheetName),
          };

          try {
            // eslint-disable-next-line no-await-in-loop
            await addMappingToCollection(targetCollection, doc);
            uploaded += 1;
            sheetResult.parsed += 1;
          } catch (err) {
            errors.push({ sheet: sheetName, row: doc, message: String(err?.message || err) });
          }
        }
        sheetResults.push(sheetResult);
      }
    }

    return NextResponse.json({ uploaded, errors, targetCollection, sheets: sheetResults }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
