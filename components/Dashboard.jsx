'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import {
  Plus,
  Search,
  Download,
  Upload,
  LogOut,
  Map as MapIcon,
  MapPin,
  Layers,
  BarChart3,
  User,
  Eye,
  Pencil,
  Trash2,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dashboard({
  user,
  onLogout,
  onAddMapping,
  onViewMappings,
  onViewProfile,
  onViewMapping = () => {},
  onEditMapping = () => {},
  onDeleteMapping = () => {},
  externalAlert = null,
  externalAlertTick = 0,
  onClearExternalAlert = () => {},
  mappings = [],
  onImportMappings = () => {},
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [fabOpen, setFabOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [isClosingViewModal, setIsClosingViewModal] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isClosingDeleteModal, setIsClosingDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isClosingExportModal, setIsClosingExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [alert, setAlert] = useState(null);
  const [alertTick, setAlertTick] = useState(0);
  const fileInputRef = useRef(null);
  const itemsPerPage = 15;

  const REGION_SHEETS = [
    'CAR',
    'Region I',
    'Region II',
    'Region III',
    'Region IV-A',
    'Region IV-B',
    'Region V',
    'Region VI',
    'Region VII',
    'Region VIII',
    'Region IX',
    'Region X',
    'Region XI',
    'Region XII',
    'Region XIII',
  ];

  const REGION_KEYWORDS = [
    { sheet: 'Region I', keywords: ['ILOCOS'] },
    { sheet: 'Region II', keywords: ['CAGAYAN VALLEY'] },
    { sheet: 'Region III', keywords: ['CENTRAL LUZON'] },
    { sheet: 'Region IV-A', keywords: ['CALABARZON'] },
    { sheet: 'Region IV-B', keywords: ['MIMAROPA'] },
    { sheet: 'Region V', keywords: ['BICOL'] },
    { sheet: 'Region VI', keywords: ['WESTERN VISAYAS'] },
    { sheet: 'Region VII', keywords: ['CENTRAL VISAYAS'] },
    { sheet: 'Region VIII', keywords: ['EASTERN VISAYAS'] },
    { sheet: 'Region IX', keywords: ['ZAMBOANGA'] },
    { sheet: 'Region X', keywords: ['NORTHERN MINDANAO'] },
    { sheet: 'Region XI', keywords: ['DAVAO'] },
    { sheet: 'Region XII', keywords: ['SOCCSKSARGEN'] },
    { sheet: 'Region XIII', keywords: ['CARAGA'] },
  ];

  const detectRegionSheet = (regionValue) => {
    const value = String(regionValue || '').toUpperCase();
    if (!value) return null;
    if (value.includes('CORDILLERA') || value.includes('CAR')) return 'CAR';

    const match = value.match(/REGION\s*(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII)(?:\s*[-–]\s*(A|B))?/i);
    if (match) {
      const numeral = match[1].toUpperCase();
      const suffix = match[2] ? match[2].toUpperCase() : null;
      if (numeral === 'IV' && suffix) return `Region IV-${suffix}`;
      return `Region ${numeral}`;
    }

    for (const entry of REGION_KEYWORDS) {
      if (entry.keywords.some((k) => value.includes(k))) return entry.sheet;
    }

    return null;
  };

  const formatMunicipalitiesExport = (mapping) => (
    mapping.municipality || (Array.isArray(mapping.municipalities) ? mapping.municipalities.join(', ') : '')
  );

  const formatBarangaysExport = (mapping) => (
    Array.isArray(mapping.barangays) ? mapping.barangays.join(', ') : (mapping.barangays || '')
  );

  const applyHeaderStyle = (ws, columnCount) => {
    const headerStyle = {
      font: { bold: true },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFE699' } },
    };
    for (let c = 0; c < columnCount; c += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[cellAddress]) ws[cellAddress].s = headerStyle;
    }
  };

  const formatListPreview = (value) => {
    if (!value) return '';
    const items = Array.isArray(value)
      ? value
      : String(value)
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
    if (items.length <= 2) return items.join(', ');
    return `${items.slice(0, 2).join(', ')}...`;
  };

  const getMunicipalities = (mapping) => (
    formatListPreview(mapping.municipality || mapping.municipalities)
  );

  const getBarangays = (mapping) => (
    formatListPreview(mapping.barangays)
  );

  const formatListFull = (value) => {
    if (!value) return '';
    const items = Array.isArray(value)
      ? value
      : String(value)
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
    return items.join(', ');
  };

  const getMunicipalitiesFull = (mapping) => (
    formatListFull(mapping.municipality || mapping.municipalities)
  );

  const getBarangaysFull = (mapping) => (
    formatListFull(mapping.barangays)
  );

  useEffect(() => {
    if (!alert) return;
    const timeoutId = setTimeout(() => setAlert(null), 10_000);
    return () => clearTimeout(timeoutId);
  }, [alertTick, alert]);

  useEffect(() => {
    if (!externalAlert) return;
    const timeoutId = setTimeout(() => onClearExternalAlert(), 10_000);
    return () => clearTimeout(timeoutId);
  }, [externalAlert, externalAlertTick, onClearExternalAlert]);

  // Filter mappings based on search query
  const filteredMappings = mappings.filter((mapping) => {
    const query = searchQuery.toLowerCase();
    return (
      mapping.surveyNumber?.toLowerCase().includes(query) ||
      mapping.region?.toLowerCase().includes(query) ||
      mapping.province?.toLowerCase().includes(query) ||
      mapping.municipality?.toLowerCase().includes(query) ||
      mapping.municipalities?.join(', ').toLowerCase().includes(query) ||
      mapping.barangays?.join(', ').toLowerCase().includes(query) ||
      mapping.icc?.join(', ').toLowerCase().includes(query) ||
      mapping.remarks?.toLowerCase().includes(query)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredMappings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMappings = filteredMappings.slice(startIndex, endIndex);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Reset to page 1 when search query changes
  const handleSearch = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const normalizeHeader = (value) => (
    String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  );

  const compactHeader = (value) => normalizeHeader(value).replace(/[^a-z0-9]/g, '');

  const splitListValue = (value) => {
    if (!value) return [];
    return String(value)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  };

  const splitIccValue = (value) => {
    if (!value) return [];
    return String(value)
      .split(/[;,/]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  };

  const splitLocationList = (value) => (
    String(value || '')
      .split(/,|&|\band\b/gi)
      .map((v) => v.trim())
      .filter(Boolean)
  );

  const parseLocationLine = (text) => {
    const normalized = String(text || '').trim();
    const lower = normalized.toLowerCase();
    const colonIndex = normalized.indexOf(':');
    const payload = colonIndex !== -1 ? normalized.slice(colonIndex + 1).trim() : normalized;

    if (lower.startsWith('barangay')) {
      return { type: 'barangay', items: splitLocationList(payload) };
    }
    if (lower.startsWith('municipality')) {
      return { type: 'municipality', items: splitLocationList(payload) };
    }
    if (lower.startsWith('province')) {
      return { type: 'province', items: splitLocationList(payload) };
    }

    return { type: 'unknown', items: [] };
  };

  const parseAreaValue = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    const parsed = Number(String(value).replace(/,/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const headerKeywords = [
        'survey',
        'number',
        'location',
        'province',
        'municipality',
        'barangay',
        'area',
        'icc',
        'remarks',
        'region',
        'sheet',
      ];

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

      const buildRecordsFromRows = (rows, sheetName) => {
        const headerRowIndex = findHeaderRowIndex(rows);
        if (headerRowIndex === -1) return { records: [], error: 'no-header', sheetName };

        const headerRow = rows[headerRowIndex].map(normalizeHeader);
        const colIndex = (candidates) => headerRow.findIndex((h) => {
          const compact = compactHeader(h);
          return candidates.some((c) => {
            const cNorm = normalizeHeader(c);
            const cCompact = compactHeader(c);
            return h === cNorm || h.includes(cNorm) || compact.includes(cCompact);
          });
        });

        let surveyIdx = colIndex(['survey number', 'survey no', 'survey #']);
        let locationIdx = colIndex(['location']);
        let provinceIdx = colIndex(['province']);
        let municipalityIdx = colIndex(['municipality', 'municipality/ies']);
        let barangayIdx = colIndex(['barangays', 'barangay/s']);
        let areaIdx = colIndex(['total area', 'area', 'area (ha)']);
        let iccIdx = colIndex(['icc', 'iccs/ips', 'iccs', 'icc/ips']);
        let remarksIdx = colIndex(['remarks']);
        let regionIdx = colIndex(['region', 'sheet']);

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
          return { records: [], error: 'invalid-headers', sheetName, found: rows[headerRowIndex] };
        }

        if (hasLocationFormat && [surveyIdx, locationIdx, areaIdx, iccIdx, remarksIdx].some((idx) => idx === -1)) {
          return { records: [], error: 'invalid-headers', sheetName, found: rows[headerRowIndex] };
        }

        const records = [];
        const fallbackRegion = detectRegionSheet(sheetName) || sheetName || '';

        if (hasLocationFormat) {
          let current = null;

          const flushCurrent = () => {
            if (!current) return;
            const municipalities = Array.from(new Set(current.municipalities));
            const barangays = Array.from(new Set(current.barangays));
            const provinces = Array.from(new Set(current.provinces));
            records.push({
              surveyNumber: current.surveyNumber,
              province: provinces.join(', '),
              municipality: municipalities.join(', '),
              municipalities,
              barangays,
              totalArea: current.totalArea,
              icc: current.icc,
              remarks: current.remarks,
              region: fallbackRegion,
            });
          };

          rows.slice(headerRowIndex + 1).forEach((row) => {
            const surveyCell = String(row[surveyIdx] || '').trim();
            const locationCell = String(row[locationIdx] || '').trim();
            const areaCell = row[areaIdx];
            const iccCellRaw = String(row[iccIdx] || '').trim();
            const remarksCellRaw = String(row[remarksIdx] || '').trim();

            if (surveyCell) {
              flushCurrent();
              const iccValue = iccCellRaw.toLowerCase() === 'void' ? '' : iccCellRaw;
              const remarksValue = remarksCellRaw.toLowerCase() === 'void' ? '' : remarksCellRaw;
              current = {
                surveyNumber: surveyCell,
                provinces: [],
                municipalities: [],
                barangays: [],
                totalArea: parseAreaValue(areaCell),
                icc: splitIccValue(iccValue),
                remarks: remarksValue,
              };
            } else if (!current) {
              return;
            }

            if (areaCell && current.totalArea === 0) {
              current.totalArea = parseAreaValue(areaCell);
            }

            if (iccCellRaw && current.icc.length === 0) {
              const iccValue = iccCellRaw.toLowerCase() === 'void' ? '' : iccCellRaw;
              current.icc = splitIccValue(iccValue);
            }

            if (remarksCellRaw && !current.remarks) {
              current.remarks = remarksCellRaw.toLowerCase() === 'void' ? '' : remarksCellRaw;
            }

            if (locationCell) {
              const parsed = parseLocationLine(locationCell);
              if (parsed.type === 'barangay') current.barangays.push(...parsed.items);
              if (parsed.type === 'municipality') current.municipalities.push(...parsed.items);
              if (parsed.type === 'province') current.provinces.push(...parsed.items);
            }
          });

          flushCurrent();
        } else {
          rows.slice(headerRowIndex + 1).forEach((row) => {
            const surveyNumber = String(row[surveyIdx] || '').trim();
            if (!surveyNumber) return;

            const province = String(row[provinceIdx] || '').trim();
            const municipalityRaw = String(row[municipalityIdx] || '').trim();
            const barangayRaw = String(row[barangayIdx] || '').trim();
            const totalArea = parseAreaValue(row[areaIdx]);
            const icc = splitIccValue(row[iccIdx]);
            const remarks = String(row[remarksIdx] || '').trim();
            const regionCell = regionIdx !== -1 ? String(row[regionIdx] || '').trim() : '';

            const municipalities = splitListValue(municipalityRaw);
            const barangays = splitListValue(barangayRaw);

            records.push({
              surveyNumber,
              province,
              municipality: municipalities.join(', '),
              municipalities,
              barangays,
              totalArea,
              icc,
              remarks,
              region: regionCell || fallbackRegion,
            });
          });
        }

        return { records, error: null, sheetName };
      };

      const allRecords = [];
      const invalidSheets = [];

      wb.SheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;
        const wsRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const hasData = wsRows.some((row) => row.some((cell) => String(cell || '').trim() !== ''));
        if (!hasData) return;

        const { records, error } = buildRecordsFromRows(wsRows, sheetName);
        if (error) {
          invalidSheets.push(sheetName);
          return;
        }
        allRecords.push(...records);
      });

      if (allRecords.length === 0) {
        const sheetNote = invalidSheets.length > 0 ? ` Sheets without headers: ${invalidSheets.join(', ')}.` : '';
        setAlertTick((t) => t + 1);
        setAlert({ type: 'error', message: `No valid rows found to import.${sheetNote}` });
        return;
      }

      await onImportMappings(allRecords);
    } catch (error) {
      console.error('Import failed:', error);
      setAlertTick((t) => t + 1);
      setAlert({ type: 'error', message: error?.message || 'Failed to import Excel file.' });
    } finally {
      event.target.value = '';
    }
  };

  const buildExportWorkbook = () => {
    const headers = ['Survey Number', 'Province', 'Municipality', 'Barangays', 'Total Area', 'ICC', 'Remarks', 'Sheet'];
    const rowsBySheet = new globalThis.Map();

    mappings.forEach((m) => {
      const sheet = detectRegionSheet(m.region) || 'Unknown';
      const rows = rowsBySheet.get(sheet) || [];
      rows.push([
        m.surveyNumber || '',
        m.province || '',
        formatMunicipalitiesExport(m) || '',
        formatBarangaysExport(m) || '',
        m.totalArea || '',
        m.icc?.join('; ') || '',
        m.remarks || '',
        sheet,
      ]);
      rowsBySheet.set(sheet, rows);
    });

    const wb = XLSX.utils.book_new();
    const orderedSheets = [...REGION_SHEETS, ...(rowsBySheet.has('Unknown') ? ['Unknown'] : [])];

    orderedSheets.forEach((sheetName) => {
      const rows = rowsBySheet.get(sheetName);
      if (!rows || rows.length === 0) return;
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      applyHeaderStyle(ws, headers.length);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    return wb;
  };

  const handleOpenExportModal = () => {
    const defaultName = `mappings-${new Date().toISOString().split('T')[0]}.xlsx`;
    setExportFileName(defaultName);
    setShowExportModal(true);
  };

  const handleCloseExportModal = () => {
    if (isExporting) return;
    setIsClosingExportModal(true);
    setTimeout(() => {
      setShowExportModal(false);
      setIsClosingExportModal(false);
    }, 200);
  };

  const handleConfirmExport = async () => {
    const wb = buildExportWorkbook();
    const safeName = (exportFileName || 'mappings.xlsx').replace(/\s+/g, ' ').trim();
    const fileName = safeName.endsWith('.xlsx') ? safeName : `${safeName}.xlsx`;
    setIsExporting(true);

    try {
      if (typeof window !== 'undefined' && window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'Excel Workbook',
              accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
        await writable.write(data);
        await writable.close();
      } else {
        XLSX.writeFile(wb, fileName, { compression: true });
      }
      handleCloseExportModal();
      setFabOpen(false);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setAlertTick((t) => t + 1);
        setAlert({ type: 'error', message: error?.message || 'Failed to export Excel file.' });
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Handle modal close with animation
  const handleCloseModal = () => {
    if (isLoggingOut) return;
    setIsClosingModal(true);
    setTimeout(() => {
      setShowLogoutModal(false);
      setIsClosingModal(false);
    }, 200);
  };

  const handleViewMapping = (mapping) => {
    setSelectedMapping(mapping);
    setShowViewModal(true);
    onViewMapping(mapping);
  };

  const handleCloseViewModal = () => {
    setIsClosingViewModal(true);
    setTimeout(() => {
      setShowViewModal(false);
      setSelectedMapping(null);
      setIsClosingViewModal(false);
    }, 200);
  };

  const handleOpenDeleteModal = (mapping) => {
    setDeleteTarget(mapping);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    if (isDeleting) return;
    setIsClosingDeleteModal(true);
    setTimeout(() => {
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setIsClosingDeleteModal(false);
    }, 200);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setAlert(null);
    setIsDeleting(true);
    try {
      await onDeleteMapping(deleteTarget.id);
      setAlertTick((t) => t + 1);
      setAlert({ type: 'success', message: 'Mapping deleted successfully.' });
      handleCloseDeleteModal();
    } catch (error) {
      setAlertTick((t) => t + 1);
      setAlert({ type: 'error', message: error?.message || 'Failed to delete mapping.' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculate statistics
  const stats = {
    totalMappings: mappings.length,
    totalArea: mappings.reduce((sum, m) => sum + (m.totalArea || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    regions: new Set(mappings.map((m) => m.region)).size,
  };

  return (
    <div className="min-h-screen bg-[#071A2C]/30">
      {/* Alert (login-style) */}
      {(externalAlert || alert) && (
        <div className="fixed z-[120] right-4 top-4 w-[min(92vw,360px)] sm:w-96">
          <div
            key={externalAlert ? externalAlertTick : alertTick}
            role="alert"
            className={[
              'ncip-animate-alert-in rounded-xl border p-3 text-xs sm:text-sm backdrop-blur-xl shadow-2xl shadow-black/30',
              (externalAlert || alert).type === 'error'
                ? 'ncip-animate-shake bg-red-500/15 border-red-500/30 text-red-50'
                : 'bg-emerald-400/15 border-emerald-300/30 text-emerald-50',
            ].join(' ')}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                <Bell className="h-4 w-4 text-current" aria-hidden />
              </div>
              <p className="leading-snug">{(externalAlert || alert).message}</p>
            </div>
          </div>
        </div>
      )}
      {/* Header — enlarged logo, enhanced */}
      <header className="bg-gradient-to-r from-[#0A2D55] via-[#0C3B6E] to-[#0A2D55] text-white shadow-lg sticky top-0 z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0 ring-2 ring-white/25 shadow-xl shadow-black/20 overflow-hidden backdrop-blur-md">
              <img
                src="/ncip-logo-removebg-preview.png"
                alt="NCIP"
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain drop-shadow-lg"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl md:text-[1.6rem] font-bold truncate tracking-tight">ADO Mapping Inventory System</h1>
              <p className="text-xs sm:text-sm text-white/80 truncate mt-0.5">
                {user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'User'} • {user?.email || user?.username || 'Unknown'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/20 active:scale-95 px-3 sm:px-4 py-2.5 rounded-xl transition font-medium text-xs sm:text-sm flex-shrink-0 ring-1 ring-white/20 backdrop-blur-md"
          >
            <LogOut size={18} className="sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Logout</span>
            <span className="sm:hidden">Out</span>
          </button>
        </div>
      </header>

      {/* Welcome Banner — margin + rounded, no logo */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-4 sm:mt-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-xl shadow-black/15">
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              backgroundImage: `
                radial-gradient(circle at 20% 20%, rgba(255, 215, 0, 0.18), transparent 34%),
                radial-gradient(circle at 85% 10%, rgba(255, 215, 0, 0.10), transparent 30%),
                linear-gradient(135deg, #0A2D55 0%, #0C3B6E 40%, #0A2D55 100%)
              `,
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0 rounded-2xl opacity-[0.08]"
            style={{ backgroundImage: 'radial-gradient(#d9e4ff 1px, transparent 1px)', backgroundSize: '34px 34px' }}
            aria-hidden
          />

          <div className="relative px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-white/70 font-semibold tracking-wide uppercase">
                  Welcome
                </p>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight truncate mt-0.5">
                  {user.username}
                </h2>
                <p className="text-xs sm:text-sm text-white/80 mt-1.5 text-balance max-w-xl">
                  You are logged in as <span className="font-semibold text-[#F2C94C]">{user.role}</span>. Manage Indigenous Cultural Community mappings below.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-white/25 transition active:scale-95"
                >
                  <Upload size={16} className="sm:w-4.5 sm:h-4.5" />
                  Upload Excel
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Tabs Banner — margin + rounded, login palette */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-4 sm:mt-6">
        <nav
          className="bg-white/95 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl shadow-black/10 overflow-hidden sticky top-14 sm:top-16 z-40"
          aria-label="Main navigation"
        >
          <div className="flex gap-0 min-w-0 overflow-x-auto scrollbar-thin">
            <button
              onClick={() => {
                setActiveTab('overview');
                setMobileMenuOpen(false);
              }}
              className={`flex-1 min-w-0 sm:flex-none px-3 sm:px-5 py-3 sm:py-3.5 font-medium text-xs sm:text-base border-b-2 transition whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'overview'
                  ? 'border-[#F2C94C] text-[#0A2D55] bg-[#F2C94C]/10'
                  : 'border-transparent text-[#0A2D55]/70 hover:text-[#0A2D55] hover:bg-[#0A2D55]/5'
              }`}
            >
              <BarChart3 size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('mappings');
                setMobileMenuOpen(false);
              }}
              className={`flex-1 min-w-0 sm:flex-none px-3 sm:px-5 py-3 sm:py-3.5 font-medium text-xs sm:text-base border-b-2 transition whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'mappings'
                  ? 'border-[#F2C94C] text-[#0A2D55] bg-[#F2C94C]/10'
                  : 'border-transparent text-[#0A2D55]/70 hover:text-[#0A2D55] hover:bg-[#0A2D55]/5'
              }`}
            >
              <MapIcon size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
              <span>Mappings</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6 animate-section-1">
            {/* Stats Cards — login palette: navy #0A2D55, #0C3B6E, gold #F2C94C */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-4 sm:p-6 border-l-4 border-[#0A2D55] hover:shadow-xl hover:border-[#0C3B6E] transition animate-header">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[#0A2D55]/70 text-xs sm:text-sm font-medium truncate">Total Mappings</p>
                    <p className="text-2xl sm:text-4xl font-bold text-[#0A2D55] mt-1 sm:mt-2">{stats.totalMappings}</p>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-[#0A2D55]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#0A2D55]" />
                  </div>
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-4 sm:p-6 border-l-4 border-[#F2C94C] hover:shadow-xl transition animate-section-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[#0A2D55]/70 text-xs sm:text-sm font-medium truncate">Total Mapped Area</p>
                    <p className="text-2xl sm:text-4xl font-bold text-[#0C3B6E] mt-1 sm:mt-2">{stats.totalArea}</p>
                    <p className="text-xs text-[#0A2D55]/60 mt-1">hectares</p>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-[#F2C94C]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-[#0C3B6E]" />
                  </div>
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-4 sm:p-6 border-l-4 border-[#0C3B6E] hover:shadow-xl transition animate-section-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[#0A2D55]/70 text-xs sm:text-sm font-medium truncate">Regions Covered</p>
                    <p className="text-2xl sm:text-4xl font-bold text-[#0C3B6E] mt-1 sm:mt-2">{stats.regions}</p>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-[#0C3B6E]/15 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-[#0A2D55]" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'mappings' && (
          <div className="animate-section-1">
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-header">
              <h2 className="text-lg sm:text-2xl font-bold text-[#0A2D55]">All Mappings</h2>
              <div className="w-full sm:w-auto flex items-center gap-2 bg-white border-2 border-[#0A2D55]/10 rounded-xl px-4 py-2.5 hover:border-[#F2C94C]/40 focus-within:border-[#F2C94C] focus-within:ring-2 focus-within:ring-[#F2C94C]/40 transition-all shadow-sm hover:shadow-md">
                <Search size={18} className="text-[#0A2D55]/40 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search survey number, location, ICC..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-[#0A2D55] placeholder-[#0A2D55]/50 min-w-0"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearch('')}
                    className="text-[#0A2D55]/50 hover:text-[#0A2D55] transition flex-shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {filteredMappings.length === 0 ? (
              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg border border-white/20 p-8 sm:p-12 text-center animate-section-2">
                <MapIcon className="w-12 h-12 sm:w-16 sm:h-16 text-[#0A2D55]/30 mx-auto mb-4" />
                <p className="text-[#0A2D55]/70 text-sm sm:text-lg">
                  {searchQuery ? 'No mappings found matching your search.' : 'No mappings yet. Create your first mapping to get started.'}
                </p>
              </div>
            ) : (
              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg border border-white/20 overflow-hidden animate-section-2">
                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-hidden">
                  <table className="w-full table-fixed">
                    <thead className="bg-[#0A2D55]/5 border-b border-[#0A2D55]/15">
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Survey Number</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Region</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Province</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Municipality/ies</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Barangay/s</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Area (ha)</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">ICCs/IPs</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Remarks</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide w-[120px] sticky right-0 bg-[#F4F7FA] shadow-[-6px_0_10px_rgba(7,26,44,0.06)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMappings.map((mapping, idx) => (
                        <tr 
                          key={idx} 
                          className="border-b border-[#0A2D55]/10 hover:bg-[#F2C94C]/5 transition fade-in-up"
                          style={{ 
                            animationDelay: `${idx * 100 + 400}ms`,
                            opacity: 0
                          }}
                        >
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-[#0A2D55]">{mapping.surveyNumber}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-xs truncate">{mapping.region || '-'}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-[140px] truncate" title={mapping.province || ''}>{mapping.province || '-'}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-[180px] truncate" title={getMunicipalities(mapping) || ''}>{getMunicipalities(mapping) || '-'}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-[200px] truncate" title={getBarangays(mapping) || ''}>{getBarangays(mapping) || '-'}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 font-mono">
                            {mapping.totalArea?.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-xs truncate">{mapping.icc?.join(', ') || '-'}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-xs truncate">
                            {mapping.remarks || '-'}
                          </td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm w-[120px] sticky right-0 bg-white shadow-[-6px_0_10px_rgba(7,26,44,0.06)]">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleViewMapping(mapping)}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#0A2D55]/15 text-[#0A2D55] hover:bg-[#0A2D55]/5 transition"
                                title="View"
                                aria-label="View"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditMapping(mapping)}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#F2C94C]/40 text-[#8B6F1C] hover:bg-[#F2C94C]/15 transition"
                                title="Edit"
                                aria-label="Edit"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteModal(mapping)}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition"
                                title="Delete"
                                aria-label="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3 p-3 sm:p-4 max-h-[60vh] overflow-y-auto hide-scrollbar">
                  {paginatedMappings.map((mapping, idx) => (
                    <div 
                      key={idx} 
                      className="bg-[#0A2D55]/5 border border-[#0A2D55]/15 rounded-xl p-4 space-y-3 fade-in-up"
                      style={{ 
                        animationDelay: `${idx * 100 + 400}ms`,
                        opacity: 0
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#0A2D55]/60 font-medium">Survey Number</p>
                          <p className="text-sm font-bold text-[#0A2D55] truncate">{mapping.surveyNumber}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-[#0A2D55]/60 font-medium">Region</p>
                          <p className="text-xs text-[#0A2D55]/90 truncate">{mapping.region || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#0A2D55]/60 font-medium">Area (ha)</p>
                          <p className="text-xs text-[#0A2D55]/90 font-mono">
                            {mapping.totalArea?.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">Province</p>
                        <p className="text-xs text-[#0A2D55]/90 line-clamp-2">{mapping.province || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">Municipality/ies</p>
                        <p className="text-xs text-[#0A2D55]/90 line-clamp-2">{getMunicipalities(mapping) || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">Barangay/s</p>
                        <p className="text-xs text-[#0A2D55]/90 line-clamp-2">{getBarangays(mapping) || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">ICCs/IPs</p>
                        <p className="text-xs text-[#0A2D55]/90 line-clamp-2">{mapping.icc?.join(', ') || '-'}</p>
                      </div>
                      {mapping.remarks && (
                        <div>
                          <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">Remarks</p>
                          <p className="text-xs text-[#0A2D55]/90 line-clamp-2">{mapping.remarks}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleViewMapping(mapping)}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[#0A2D55]/15 text-[#0A2D55] text-xs hover:bg-[#0A2D55]/5 transition"
                          title="View"
                          aria-label="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditMapping(mapping)}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[#F2C94C]/40 text-[#8B6F1C] text-xs hover:bg-[#F2C94C]/15 transition"
                          title="Edit"
                          aria-label="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(mapping)}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-red-200 text-red-600 text-xs hover:bg-red-50 transition"
                          title="Delete"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-t border-[#0A2D55]/10 bg-[#0A2D55]/2">
                  <div className="text-xs sm:text-sm text-[#0A2D55]/70 font-medium">
                    Showing <span className="font-bold text-[#0A2D55]">{startIndex + 1}</span> to <span className="font-bold text-[#0A2D55]">{Math.min(endIndex, filteredMappings.length)}</span> of <span className="font-bold text-[#0A2D55]">{filteredMappings.length}</span> records
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={!canGoPrevious}
                      className={cn(
                        'flex items-center gap-1 px-3 sm:px-4 py-2 rounded-lg font-semibold text-sm transition',
                        canGoPrevious
                          ? 'bg-[#0A2D55] text-white hover:bg-[#0C3B6E] active:scale-95 shadow-md'
                          : 'bg-[#0A2D55]/20 text-[#0A2D55]/50 cursor-not-allowed'
                      )}
                    >
                      ← Previous
                    </button>
                    <div className="text-xs sm:text-sm text-[#0A2D55] font-semibold px-2 py-1">
                      Page <span className="text-[#F2C94C]">{currentPage}</span> of <span className="text-[#F2C94C]">{totalPages || 1}</span>
                    </div>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={!canGoNext}
                      className={cn(
                        'flex items-center gap-1 px-3 sm:px-4 py-2 rounded-lg font-semibold text-sm transition',
                        canGoNext
                          ? 'bg-[#0A2D55] text-white hover:bg-[#0C3B6E] active:scale-95 shadow-md'
                          : 'bg-[#0A2D55]/20 text-[#0A2D55]/50 cursor-not-allowed'
                      )}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button with Menu */}
      <div className="fixed bottom-8 right-8 z-50">
        {/* Profile Button - Top */}
        <button
          onClick={() => {
            onViewProfile();
            setFabOpen(false);
          }}
          className={cn(
            "absolute w-14 h-14 bg-[#0A2D55] hover:bg-[#0C3B6E] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-out active:scale-95 flex items-center justify-center",
            fabOpen
              ? "opacity-100 bottom-20 right-0"
              : "opacity-0 bottom-0 right-0 pointer-events-none"
          )}
          title="Profile"
        >
          <User size={24} strokeWidth={2.5} />
        </button>

        {/* Add Mapping Button - Directly Left */}
        <button
          onClick={() => {
            onAddMapping();
            setFabOpen(false);
          }}
          className={cn(
            "absolute w-14 h-14 bg-white hover:bg-gray-100 text-[#0A2D55] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-out active:scale-95 flex items-center justify-center",
            fabOpen
              ? "opacity-100 bottom-0 right-20"
              : "opacity-0 bottom-0 right-0 pointer-events-none"
          )}
          title="Add Mapping"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>

        {/* Export Excel Button - Top Left (YELLOW) */}
        <button
          onClick={handleOpenExportModal}
          className={cn(
            "absolute w-14 h-14 bg-[#F2C94C] hover:bg-yellow-400 text-[#0A2D55] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-out active:scale-95 flex items-center justify-center",
            fabOpen
              ? "opacity-100 bottom-20 right-20"
              : "opacity-0 bottom-0 right-0 pointer-events-none"
          )}
          title="Export to Excel"
        >
          <Download size={24} strokeWidth={2.5} />
        </button>

        {/* Main FAB Button */}
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className="relative w-16 h-16 bg-[#0A2D55] hover:bg-[#0C3B6E] text-white rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center z-50"
          title="Menu"
        >
          <Plus
            size={28}
            strokeWidth={3}
            className={`transition-transform duration-300 ${fabOpen ? 'rotate-45' : ''}`}
          />
        </button>
      </div>

      {/* Overlay to close FAB menu */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* Export Confirmation Modal */}
      {showExportModal && (
        <>
          <div
            className={cn(
              "fixed inset-0 z-[100] transition-all duration-200",
              isClosingExportModal ? "animate-out fade-out" : "animate-in fade-in"
            )}
            style={{
              backgroundImage: `
                radial-gradient(circle at 20% 20%, rgba(255, 215, 0, 0.08), transparent 30%),
                radial-gradient(circle at 80% 80%, rgba(255, 215, 0, 0.05), transparent 28%),
                linear-gradient(135deg, rgba(10, 45, 85, 0.7) 0%, rgba(12, 59, 110, 0.8) 100%)
              `,
              backdropFilter: 'blur(12px)',
            }}
            onClick={handleCloseExportModal}
          />

          <div className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[90%] max-w-md transition-all duration-200",
            isClosingExportModal ? "animate-out zoom-out fade-out" : "animate-in zoom-in fade-in"
          )}>
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 overflow-hidden">
              {isExporting && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#071A2C]/20 backdrop-blur-md">
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full border border-white/20 bg-white/10 backdrop-blur-xl shadow-xl shadow-black/30 p-4">
                      <div className="h-12 w-12 rounded-full border-2 border-white/25 border-t-[#F2C94C] animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-white/90">Exporting...</p>
                  </div>
                </div>
              )}

              <div
                className="px-6 py-5"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #0A2D55 0%, #0C3B6E 40%, #0A2D55 100%)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center ring-2 ring-white/25 shadow-xl">
                    <Download size={22} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Export Excel</h3>
                </div>
              </div>

              <div className="px-6 py-5 text-white/90">
                <p className="text-sm">Choose a file name and location to save the Excel workbook.</p>
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-white/70 mb-2">File name</label>
                  <input
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    disabled={isExporting}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-[#F2C94C]/40 focus:border-transparent transition"
                    placeholder="mappings.xlsx"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-white/15 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseExportModal}
                  disabled={isExporting}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExport}
                  disabled={isExporting}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-[#0A2D55] to-[#0C3B6E] text-white hover:shadow-xl hover:shadow-black/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-white/20"
                >
                  Save Excel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <>
          <div
            className={cn(
              "fixed inset-0 z-[100] transition-all duration-200",
              isClosingDeleteModal ? "animate-out fade-out" : "animate-in fade-in"
            )}
            style={{
              backgroundImage: `
                radial-gradient(circle at 20% 20%, rgba(255, 215, 0, 0.08), transparent 30%),
                radial-gradient(circle at 80% 80%, rgba(255, 215, 0, 0.05), transparent 28%),
                linear-gradient(135deg, rgba(10, 45, 85, 0.7) 0%, rgba(12, 59, 110, 0.8) 100%)
              `,
              backdropFilter: 'blur(12px)',
            }}
            onClick={handleCloseDeleteModal}
          />

          <div className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[90%] max-w-md transition-all duration-200",
            isClosingDeleteModal ? "animate-out zoom-out fade-out" : "animate-in zoom-in fade-in"
          )}>
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 overflow-hidden">
              {isDeleting && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#071A2C]/20 backdrop-blur-md">
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full border border-white/20 bg-white/10 backdrop-blur-xl shadow-xl shadow-black/30 p-4">
                      <div className="h-12 w-12 rounded-full border-2 border-white/25 border-t-[#F2C94C] animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-white/90">Deleting...</p>
                  </div>
                </div>
              )}

              <div
                className="px-6 py-5"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #0A2D55 0%, #0C3B6E 40%, #0A2D55 100%)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center ring-2 ring-white/25 shadow-xl">
                    <Trash2 size={22} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Confirm Delete</h3>
                </div>
              </div>

              <div className="px-6 py-5 text-white/90">
                <p className="text-sm">Are you sure you want to delete this mapping? This action cannot be undone.</p>
                <div className="mt-4 rounded-xl border border-white/15 bg-white/10 p-3 text-xs">
                  <p className="font-semibold text-white">{deleteTarget.surveyNumber || 'Untitled Mapping'}</p>
                  <p className="text-white/70 mt-1">{deleteTarget.region || '-'} • {deleteTarget.province || '-'}</p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-white/15 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseDeleteModal}
                  className="px-4 py-2 rounded-lg border border-white/20 text-white/90 hover:bg-white/10 transition"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-lg bg-red-500/90 text-white hover:bg-red-500 transition"
                  disabled={isDeleting}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* View Mapping Modal */}
      {showViewModal && selectedMapping && (
        <>
          <div
            className={cn(
              "fixed inset-0 z-[98] transition-all duration-200",
              isClosingViewModal ? "animate-out fade-out" : "animate-in fade-in"
            )}
            style={{
              backgroundImage: `
                radial-gradient(circle at 15% 20%, rgba(255, 215, 0, 0.08), transparent 30%),
                radial-gradient(circle at 85% 80%, rgba(255, 215, 0, 0.06), transparent 28%),
                linear-gradient(135deg, rgba(10, 45, 85, 0.65) 0%, rgba(12, 59, 110, 0.75) 100%)
              `,
              backdropFilter: 'blur(10px)',
            }}
            onClick={handleCloseViewModal}
          />

          <div
            className={cn(
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[99] w-[92%] max-w-2xl transition-all duration-200",
              isClosingViewModal ? "animate-out zoom-out fade-out" : "animate-in zoom-in fade-in"
            )}
          >
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 overflow-hidden">
              <div
                className="px-6 py-5"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #0A2D55 0%, #0C3B6E 40%, #0A2D55 100%)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center ring-2 ring-white/25 shadow-xl">
                      <Eye size={22} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">Mapping Details</h3>
                      <p className="text-xs text-white/70 mt-0.5">Saved record from the form</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseViewModal}
                    className="w-9 h-9 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="px-6 py-5 text-white/90">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-white/70">Survey Number</p>
                    <p className="text-white font-semibold mt-1">{selectedMapping.surveyNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/70">Total Area (ha)</p>
                    <p className="text-white font-mono mt-1">
                      {selectedMapping.totalArea?.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/70">Region</p>
                    <p className="text-white mt-1">{selectedMapping.region || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/70">Province</p>
                    <p className="text-white mt-1">{selectedMapping.province || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/70">Municipality/ies</p>
                    <p className="text-white mt-1">{getMunicipalitiesFull(selectedMapping) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/70">Barangay/s</p>
                    <p className="text-white mt-1">{getBarangaysFull(selectedMapping) || '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-white/70">ICCs/IPs</p>
                    <p className="text-white mt-1">{selectedMapping.icc?.join(', ') || '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-white/70">Remarks</p>
                    <p className="text-white mt-1">{selectedMapping.remarks || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-white/15 flex justify-end">
                <button
                  type="button"
                  onClick={handleCloseViewModal}
                  className="px-4 py-2 rounded-lg border border-white/20 text-white/90 hover:bg-white/10 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <>
          {/* Enhanced backdrop with blur */}
          <div 
            className={cn(
              "fixed inset-0 z-[100] transition-all duration-200",
              isClosingModal ? "animate-out fade-out" : "animate-in fade-in"
            )}
            style={{
              backgroundImage: `
                radial-gradient(circle at 20% 20%, rgba(255, 215, 0, 0.08), transparent 30%),
                radial-gradient(circle at 80% 80%, rgba(255, 215, 0, 0.05), transparent 28%),
                linear-gradient(135deg, rgba(10, 45, 85, 0.7) 0%, rgba(12, 59, 110, 0.8) 100%)
              `,
              backdropFilter: 'blur(12px)',
            }}
            onClick={handleCloseModal} 
          />
          
          {/* Modal Card */}
          <div className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[90%] max-w-md transition-all duration-200",
            isClosingModal ? "animate-out zoom-out fade-out" : "animate-in zoom-in fade-in"
          )}>
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 overflow-hidden">
              {/* Loading overlay */}
              {isLoggingOut && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#071A2C]/20 backdrop-blur-md">
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full border border-white/20 bg-white/10 backdrop-blur-xl shadow-xl shadow-black/30 p-4">
                      <div className="h-12 w-12 rounded-full border-2 border-white/25 border-t-[#F2C94C] animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-white/90">Logging out...</p>
                  </div>
                </div>
              )}

              {/* Header with gradient */}
              <div 
                className="px-6 py-5"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #0A2D55 0%, #0C3B6E 40%, #0A2D55 100%)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center ring-2 ring-white/25 shadow-xl">
                    <LogOut size={22} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Confirm Logout</h3>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-8">
                <p className="text-white/90 text-sm leading-relaxed">
                  Are you sure you want to log out? Any unsaved changes will be lost.
                </p>
              </div>

              {/* Actions */}
              <div className="px-6 py-5 bg-white/5 backdrop-blur-sm flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  onClick={handleCloseModal}
                  disabled={isLoggingOut}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsLoggingOut(true);
                    await new Promise((r) => setTimeout(r, 800));
                    onLogout();
                  }}
                  disabled={isLoggingOut}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-[#0A2D55] to-[#0C3B6E] text-white hover:shadow-xl hover:shadow-black/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-white/20"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
