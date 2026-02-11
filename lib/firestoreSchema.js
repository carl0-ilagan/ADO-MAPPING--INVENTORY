/**
 * Firestore Schema and Field Mapping
 * 
 * This module defines the unified Firestore document structure for all imported Excel sheets.
 * All field names are normalized to lowercase with underscores (Firestore-safe).
 * 
 * Each document has:
 * - Normalized field names (no spaces, quotes, slashes, line breaks)
 * - source_sheet: string (e.g., 'CAR', 'R1', 'Extractive/Mining Companies')
 * - All values initially coerced to strings, then explicitly converted
 */

// Unified Firestore document schema (normalized field names)
export const FIRESTORE_SCHEMA = {
  // Core identification
  control_number: 'string',        // Primary identifier
  survey_number: 'string',         // Alternative identifier
  region: 'string',                // Region name (CAR, Region I, etc.)
  source_sheet: 'string',          // Original Excel sheet name
  
  // Project details
  applicant_proponent: 'string',   // Company/individual name
  name_of_project: 'string',       // Project title
  nature_of_project: 'string',     // Project type/description
  project_cost: 'string',          // Keep as string to preserve formatting
  
  // Location (standardized across all sheets)
  location: 'string',              // Full location string
  province: 'string',              // Province name
  municipality: 'string',          // Comma-separated municipalities
  municipalities: 'array',         // Array of municipality names
  barangay: 'string',              // Comma-separated barangays
  barangays: 'array',              // Array of barangay names
  
  // CADT and ICC
  cadt_status: 'string',           // CADT status
  icc: 'array',                    // Array of ICC numbers/IPs
  
  // Temporal and numeric
  year_approved: 'string',         // Year as string (preserve formatting)
  moa_duration: 'string',          // MOA Duration
  total_area: 'number',            // Area in hectares
  
  // Additional
  remarks: 'string',               // Notes/remarks
  
  // Metadata (auto-added)
  imported_at: 'timestamp',        // When imported
  import_batch_id: 'string',       // Batch identifier
};

// Excel header variants mapped to normalized Firestore field names
// Each array contains possible header text variations (case-insensitive, punctuation-tolerant)
export const HEADER_MAPPINGS = {
  control_number: [
    'cadt calt no',        // REAL: "CADT/CALT NO." in NCIP sheets
    'cadt no',
    'calt no',
    'cadt calt number',
    'cadt number',
    'calt number',
    'control number',      // Mining sheets use this
    'control no',
    'control',
  ],
  survey_number: [
    'survey no',           // REAL: "SURVEY NO." in NCIP sheets (column 32-33)
    'survey number',
    'eccv no',             // "ECCV NO." appears before SURVEY NO
    'eccv number',
    'petition no',         // Some sheets use PETITION NO.
    'petition number',
  ],
  // NOTE: 'region' is NOT mapped from Excel columns - it's auto-detected from sheet name
  applicant_proponent: [
    'applicant/proponent',
    'applicant proponent',
    'applicant',
    'proponent',
    'company',
    'company name',
    'representative',  // NCIP: "REPRESENTATIVE" = contact person
    'claimant representative',  // Some sheets: "CLAIMANT/REPRESENTATIVE"
  ],
  name_of_project: [
    'name of project',
    'project name',
    'project',
    'name of ads iccs ips',  // NCIP: "NAME of ADs/ICCs/IPs" = community name
    'name of ads',
    'name of iccs ips',
  ],
  nature_of_project: [
    'nature of project',
    'nature',
    'project type',
  ],
  project_cost: [
    'project cost',
    'cost',
    'total project cost',
  ],
  location: [
    'location',
    'icc location',  // Some sheets combine ICC and Location
  ],
  province: [
    'province',
    'provinces',
  ],
  municipality: [
    'municipality',
    'municipalities',
    'municipal',
  ],
  barangay: [
    'barangay',
    'barangays',
    'brgy',
  ],
  cadt_status: [
    'cadt status',
    'cadt',
    'type cadt calt',  // Real header: "TYPE\n(CADT/CALT)"
    'type',
    'cadt type',
    'calt type',
    'status',
  ],
  icc: [
    'icc',
    'iccs',
    'iccs ips',
    'icc ips',
    'icc ip',
    'per ip group',  // Real header from Excel
    'ip group',
  ],
  year_approved: [
    'year approved',
    'date approved',  // Real header: "DATE APPROVED\n(DD-MM-YYYY)" 
    'year',
  ],
  moa_duration: [
    'moa duration',
    'moa',
    'duration',
    'memorandum duration',
  ],
  community_benefits: [
    'community benefits',
    'community benefit',
    'benefits',
    'benefits to community',
  ],
  total_area: [
    'total area',
    'area',
    'area hectares',  // Real header: "AREA (Hectares)"
    'area hectares land',  // Real header: "AREA (Hectares)\nLAND"
    'area ha',
  ],
  remarks: [
    'remarks',
    'remark',
    'notes',
    'ado remarks status',  // Real header: "ADO\n(REMARKS/STATUS)"
  ],
};

/**
 * Normalize header text for matching
 * - Lowercase
 * - Replace non-alphanumeric with spaces
 * - Collapse whitespace
 * - Trim
 */
export function normalizeHeaderForMapping(headerText) {
  return String(headerText || '')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')           // Non-breaking space
    .replace(/[\r\n\t]+/g, ' ')        // Line breaks, tabs
    .replace(/["""'''`]/g, '')         // Quotes
    .replace(/[\/\\]/g, ' ')           // Slashes
    .replace(/[^\w\s]/g, ' ')          // Non-word chars except space
    .replace(/\s+/g, ' ')              // Collapse whitespace
    .trim();
}

/**
 * Map Excel headers to normalized Firestore field names
 * Returns { fieldName: columnIndex }
 */
export function mapHeadersToFields(excelHeaders) {
  const normalizedHeaders = excelHeaders.map(normalizeHeaderForMapping);
  const fieldMap = {};

  console.log('🔍 Excel Headers (original):', excelHeaders);
  console.log('🔍 Excel Headers (normalized):', normalizedHeaders);

  // For each Firestore field, find the matching Excel column
  Object.entries(HEADER_MAPPINGS).forEach(([fieldName, variants]) => {
    const normalizedVariants = variants.map(normalizeHeaderForMapping);
    
    const matchIndex = normalizedHeaders.findIndex((header) => {
      return normalizedVariants.some((variant) => {
        // Exact match (highest priority)
        if (header === variant) return true;
        
        // Compact match (no spaces) - second priority
        const compactHeader = header.replace(/\s/g, '');
        const compactVariant = variant.replace(/\s/g, '');
        if (compactHeader === compactVariant) return true;
        
        // Bidirectional contains check - BOTH directions must be true OR variant must be substantial portion
        // REVERSE MATCH: variant contains header (e.g., 'cadt calt no' contains 'cadt calt')
        if (variant.includes(header) && header.length > 3) return true;
        
        // FORWARD MATCH: header contains variant BUT only if variant is long enough to avoid false positives
        // e.g., 'petition no' should NOT match variant 'no' (too short!)
        if (header.includes(variant) && variant.split(/\s+/).length > 1) return true;
        
        return false;
      });
    });

    if (matchIndex !== -1) {
      fieldMap[fieldName] = matchIndex;
      console.log(`  ✓ ${fieldName} → column ${matchIndex} (${excelHeaders[matchIndex]})`);
    }
  });

  // Fallbacks: if some common fields weren't detected by the variants above,
  // try a looser substring match so slightly different header text or placement
  // (e.g. 'Location' after ICC) still maps correctly.
  const fallbackFind = (field, substrings) => {
    if (fieldMap[field] !== undefined) return;
    const idx = normalizedHeaders.findIndex((h) => substrings.some((s) => h.includes(s)));
    if (idx !== -1) {
      fieldMap[field] = idx;
      console.log(`  ↪ fallback ${field} → column ${idx} (${excelHeaders[idx]})`);
    }
  };

  fallbackFind('location', ['location', 'loc']);
  fallbackFind('icc', ['icc', 'ip', 'ip group']);
  fallbackFind('project_cost', ['cost', 'project cost', 'total cost']);
  fallbackFind('applicant_proponent', ['applicant', 'proponent', 'claimant']);

  console.log('✅ Field Map Result:', fieldMap);
  console.log('📊 Mapped', Object.keys(fieldMap).length, 'fields out of', Object.keys(HEADER_MAPPINGS).length, 'possible fields');

  return fieldMap;
}

/**
 * Parse and type-convert a field value
 */
export function parseFieldValue(fieldName, rawValue, schema = FIRESTORE_SCHEMA) {
  // Force to string first
  const strValue = rawValue !== null && rawValue !== undefined 
    ? String(rawValue).trim() 
    : '';

  // Empty values
  if (strValue === '' || strValue.toLowerCase() === 'void') {
    if (schema[fieldName] === 'array') return [];
    if (schema[fieldName] === 'number') return 0;
    return '';
  }

  const fieldType = schema[fieldName];

  // Type-specific conversion
  switch (fieldType) {
    case 'number': {
      const cleaned = strValue.replace(/,/g, '');
      const parsed = Number(cleaned);
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    case 'array': {
      // Arrays are comma/semicolon/slash separated
      if (fieldName === 'icc' || fieldName === 'barangays' || fieldName === 'municipalities') {
        const separators = fieldName === 'icc' ? /[;,/]+/ : /,/;
        return strValue
          .split(separators)
          .map(v => v.trim())
          .filter(Boolean);
      }
      return [strValue];
    }

    case 'timestamp':
      return new Date(strValue);

    case 'string':
    default:
      return strValue;
  }
}

/**
 * Process a combined ICC/Location cell (when they share one column)
 */
export function splitCombinedIccLocation(cellValue) {
  const txt = String(cellValue || '').trim();
  if (!txt) return { icc: [], location: '' };

  // Location markers
  const locMarkers = /(barangay|brgy|municipal|municipality|province|city|town|sitio)/i;

  if (locMarkers.test(txt)) {
    // Split by newlines, double spaces, dashes, semicolons, pipes
    const parts = txt
      .split(/\r?\n|\s{2,}| - |;|\|/)
      .map(p => p.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      // Find the first part with location marker -> that and everything after is location
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        if (locMarkers.test(parts[i])) {
          const locationPart = parts.slice(i).join(', ');
          const iccPart = parts.slice(0, i).join(', ');
          return {
            icc: parseFieldValue('icc', iccPart),
            location: locationPart,
          };
        }
      }
      // Fallback: first part is ICC, rest is location
      return {
        icc: parseFieldValue('icc', parts[0]),
        location: parts.slice(1).join(', '),
      };
    }
  }

  // Fallback: try semicolon-separated with location in last chunk
  const bySemi = txt.split(/;|\|/).map(s => s.trim()).filter(Boolean);
  if (bySemi.length >= 2) {
    const last = bySemi[bySemi.length - 1];
    if (locMarkers.test(last) || last.split(',').length > 1) {
      return {
        icc: parseFieldValue('icc', bySemi.slice(0, -1).join('; ')),
        location: last,
      };
    }
  }

  // Otherwise treat entire cell as ICC
  return {
    icc: parseFieldValue('icc', txt),
    location: '',
  };
}

/**
 * Validate and build a Firestore document from an Excel row
 */
export function buildFirestoreDocument(excelRow, fieldMap, sheetName, batchId = '') {
  const doc = {
    source_sheet: sheetName,
    import_batch_id: batchId,
    imported_at: new Date(),
  };

  // Auto-detect region from sheet name (CAR, REGION 1, REGION 2, etc.)
  if (/^CAR$/i.test(sheetName)) {
    doc.region = 'CAR';
  } else if (/^REGION\s*(\d+[AB]?)$/i.test(sheetName)) {
    const match = sheetName.match(/^REGION\s*(\d+[AB]?)$/i);
    doc.region = match ? `Region ${match[1]}` : '';
  } else if (/^R\s*(\d+[AB]?)$/i.test(sheetName)) {
    const match = sheetName.match(/^R\s*(\d+[AB]?)$/i);
    doc.region = match ? `Region ${match[1]}` : '';
  }

  // Map each field
  Object.entries(fieldMap).forEach(([fieldName, colIndex]) => {
    const rawValue = excelRow[colIndex];
    doc[fieldName] = parseFieldValue(fieldName, rawValue);
  });

  // Handle combined ICC/Location if both mapped to same column
  if (fieldMap.icc !== undefined && 
      fieldMap.location !== undefined && 
      fieldMap.icc === fieldMap.location) {
    const combined = splitCombinedIccLocation(excelRow[fieldMap.icc]);
    doc.icc = combined.icc;
    doc.location = combined.location;
  }

  // Derive municipalities/barangays arrays if not present
  if (!doc.municipalities && doc.municipality) {
    doc.municipalities = doc.municipality
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }

  if (!doc.barangays && doc.barangay) {
    doc.barangays = doc.barangay
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }

  // Ensure arrays exist
  if (!doc.icc) doc.icc = [];
  if (!doc.municipalities) doc.municipalities = [];
  if (!doc.barangays) doc.barangays = [];

  // NCIP-specific data mapping: use community name for both applicant and project if applicant is empty
  if (!doc.applicant_proponent && doc.name_of_project) {
    doc.applicant_proponent = doc.name_of_project;
  }
  // Also use community name as project name if it's the only thing we have
  if (!doc.name_of_project && doc.applicant_proponent) {
    doc.name_of_project = doc.applicant_proponent;
  }

  // Backwards compatibility aliases
  doc.surveyNumber = doc.control_number || doc.survey_number || '';
  doc.controlNumber = doc.control_number || doc.survey_number || '';
  doc.applicant = doc.applicant_proponent || '';
  doc.applicantProponent = doc.applicant_proponent || '';
  doc.proponent = doc.applicant_proponent || '';
  doc.nameOfProject = doc.name_of_project || '';
  doc.projectName = doc.name_of_project || '';
  doc.nature = doc.nature_of_project || '';
  doc.natureOfProject = doc.nature_of_project || '';
  doc.location = doc.location || '';
  doc.projectCost = doc.project_cost || '';
  doc.cadtStatus = doc.cadt_status || '';
  doc.cadt = doc.cadt_status || '';
  doc.affectedICC = doc.icc || [];
  doc.yearApproved = doc.year_approved || '';
  doc.year = doc.year_approved || '';
  doc.moaDuration = doc.moa_duration || '';
  doc.communityBenefits = doc.community_benefits || '';
  doc.totalArea = doc.total_area || 0;

  return doc;
}

/**
 * Validate row is not empty
 */
export function isValidRow(doc) {
  return !!(
    doc.control_number ||
    doc.survey_number ||
    doc.applicant_proponent ||
    doc.name_of_project
  );
}
