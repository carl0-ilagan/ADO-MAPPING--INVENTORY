'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  buildFirestoreDocument,
  isValidRow,
  mapHeadersToFields,
} from '@/lib/firestoreSchema';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Map as MapIcon,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  User
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx-js-style';

function Dashboard({
  user,
  onLogout,
  onAddMapping,
  onViewMappings,
  onViewProfile,
  onViewMapping = () => { },
  onEditMapping = () => { },
  onDeleteMapping = () => { },
  onDeleteAllByStatus = () => Promise.resolve({ deleted: 0 }),
  externalAlert = null,
  externalAlertTick = 0,
  onClearExternalAlert = () => { },
  mappings = [],
  onImportMappings = () => { },
  onPreviewImport = () => { },
  availableCollections = [{ id: 'mappings', collectionName: 'mappings' }],
  selectedCollection = 'cp_projects',
  onSelectCollection = () => { },
  mainMappings = undefined,
  treatStatusAsOngoing = false,
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [deleteAllDialog, setDeleteAllDialog] = useState(null); // { status, label } or null
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [remarksFilter, setRemarksFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [fabOpen, setFabOpen] = useState(false);
  const [fabMounted, setFabMounted] = useState(false);
  const [fabRightPx, setFabRightPx] = useState(32);
  const [ongoingSubTab, setOngoingSubTab] = useState('summary');
  const [pendingSubTab, setPendingSubTab] = useState('summary');
  const [approvedSubTab, setApprovedSubTab] = useState('summary');

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
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showImportChoiceModal, setShowImportChoiceModal] = useState(false);
  const [importPreviewRecords, setImportPreviewRecords] = useState([]);
  const [importPreparedDocs, setImportPreparedDocs] = useState([]);
  const [importInvalidSheets, setImportInvalidSheets] = useState([]);
  const [importRawSheets, setImportRawSheets] = useState([]);
  const [importSourceFileName, setImportSourceFileName] = useState('');
  const [importCollectionName, setImportCollectionName] = useState('');
  const [showInvalidDetails, setShowInvalidDetails] = useState(false);

  const [isClearingOngoingFlags, setIsClearingOngoingFlags] = useState(false);
  const [isBatchTagging, setIsBatchTagging] = useState(false);
  const fileInputRef = useRef(null);
  const itemsPerPage = 15;
  const shouldShowFab = activeTab !== 'overview';

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

  const isPendingMapping = (m) => {
    if (!m) return false;
    try {
      // Fast path: explicit pending flag takes priority
      if (m._pending === true) return true;

      const status = String(m.status || m.state || m.statusText || '').toLowerCase();
      if (status.includes('pend')) return true;
      if (status.includes('ongoing') || status.includes('approved') || status.includes('complete') || status.includes('done')) return false;

      if (String(m.pending || '').toLowerCase() === 'true') return true;

      const rawStatus = String(
        m.raw_fields?.status ||
        m.raw_fields?.state ||
        m.raw_fields?.statusText ||
        m.raw_fields?.workflow_status ||
        m.raw_fields?.workflowStatus ||
        m.raw_fields?.['STATUS'] ||
        m.raw_fields?.['Status'] ||
        m.raw_fields?.['STATUS OF APPLICATION'] ||
        m.raw_fields?.['Status of Application'] ||
        m.raw_fields?.['REMARKS'] ||
        m.raw_fields?.['Remarks'] ||
        ''
      ).toLowerCase();
      if (rawStatus.includes('pend')) return true;
      if (rawStatus.includes('ongoing') || rawStatus.includes('approved') || rawStatus.includes('complete') || rawStatus.includes('done')) return false;

      const worksheetNo = String(
        m.worksheet_no ||
        m.worksheetNo ||
        m.no ||
        m.raw_fields?.NO ||
        m.raw_fields?.No ||
        m.raw_fields?.no ||
        ''
      ).trim();
      const hasPendingWorksheetNo = /^\d+$/.test(worksheetNo) || /^[-—]$/.test(worksheetNo);

      const regionSource = deriveRawRegion(m) || m.region || m.province || m.raw_fields?.PROVINCE || m.raw_fields?.Province || m.raw_fields?.province || '';
      const regionBucket = toPendingRegionBucket(regionSource) || toPendingRegionBucket(canonicalRegion(regionSource));

      // Accept rows that are explicitly pending, or rows that still have the
      // workbook-style structure of a pending row (worksheet number + region).
      // Manual pending entries are saved with _pending/status='Pending', so they
      // still pass the early returns above.
      return Boolean(hasPendingWorksheetNo && regionBucket);
    } catch (e) {
      return false;
    }
  };

  const getStatusBlob = (m) => {
    const rf = m?.raw_fields || {};
    return String([
      m?.status,
      m?.statusText,
      m?.workflowStatus,
      m?.workflow_status,
      m?.cadtStatus,
      m?.cadt_status,
      rf?.status,
      rf?.statusText,
      rf?.workflow_status,
      rf?.workflowStatus,
      rf?.STATUS,
      rf?.Status,
      rf?.status_of_application,
      rf?.['STATUS OF APPLICATION'],
    ].filter((v) => v !== null && typeof v !== 'undefined').join(' | ')).toLowerCase();
  };

  const isExplicitlyOngoingOrApproved = (m) => {
    const s = getStatusBlob(m);
    return s.includes('ongoing') || s.includes('on process') || s.includes('processing') || s.includes('approved') || s.includes('complete') || s.includes('done');
  };

  const isExplicitlyOngoing = (m) => {
    const s = getStatusBlob(m);
    return s.includes('ongoing') || s.includes('on process') || s.includes('processing');
  };

  const detectRegionSheet = (regionValue) => {
    const value = String(regionValue || '').toUpperCase();
    if (!value) return null;
    if (value.includes('CORDILLERA') || value.includes('CAR')) return 'CAR';

    const romanMatch = value.match(/REGION\s*(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?:\s*[-–]\s*(A|B))?/i);
    if (romanMatch) {
      const numeral = romanMatch[1].toUpperCase();
      const suffix = romanMatch[2] ? romanMatch[2].toUpperCase() : null;
      if (numeral === 'IV' && suffix) return `Region IV-${suffix}`;
      return `Region ${numeral}`;
    }

    const numericMatch = value.match(/REGION\s*(\d{1,2})(?:\s*[-–]?\s*([AB]))?/i) || value.match(/\b(\d{1,2})(?:\s*[-–]?\s*([AB]))?\b/);
    if (numericMatch) {
      const numberValue = Number(numericMatch[1]);
      const suffix = numericMatch[2] ? numericMatch[2].toUpperCase() : null;
      if (numberValue === 4 && suffix) return `Region IV-${suffix}`;
      if (numberValue >= 1 && numberValue <= 13) {
        const romanMap = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
        return `Region ${romanMap[numberValue - 1]}`;
      }
    }

    for (const entry of REGION_KEYWORDS) {
      if (entry.keywords.some((k) => value.includes(k))) return entry.sheet;
    }

    return null;
  };



  // Return a canonical region label for UI grouping/display.
  // Uses detectRegionSheet() then falls back to a trimmed version of the input.
  const canonicalRegion = (regionValue) => {
    const raw = String(regionValue || '').trim();
    if (!raw) return '';
    const detected = detectRegionSheet(raw);
    if (detected) return detected;
    // Normalize common short forms like '1' -> 'Region I', '4A' -> 'Region IV-A'
    const numMatch = raw.match(/^\s*(\d{1,2})(?:\s*[-–]?\s*([ABab]))?\s*$/);
    if (numMatch) {
      const n = Number(numMatch[1]);
      const suffix = numMatch[2] ? numMatch[2].toUpperCase() : null;
      const romanMap = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
      if (n >= 1 && n <= 13) {
        if (n === 4 && suffix) return `Region IV-${suffix}`;
        return `Region ${romanMap[n - 1]}`;
      }
    }
    // return trimmed original as last-resort
    return raw;
  };

  const isPlaceholderValue = (value) => {
    const s = String(value || '').trim().toUpperCase();
    return !s || s === '-' || s === '—' || s === 'N/A' || s === 'NA' || s === 'NONE' || s === 'NULL';
  };

  // Derive a best-effort raw region string from a mapping document
  const deriveRawRegion = (m) => {
    if (!m) return '';
    try {
      // Prefer source sheet when available; this is the most reliable region
      // origin for workbook imports and helps recover legacy mis-mapped rows.
      const sourceSheet =
        m.source_sheet ||
        m.sourceSheet ||
        (m.raw_fields && (m.raw_fields.source_sheet || m.raw_fields.sheet_name || m.raw_fields.sheetName));
      if (!isPlaceholderValue(sourceSheet)) {
        // Keep source sheet even when it is a province name (e.g. APAYAO).
        return String(sourceSheet);
      }

      if (m.raw_fields && !isPlaceholderValue(m.raw_fields.region || m.raw_fields.sheet)) return String(m.raw_fields.region || m.raw_fields.sheet);
      if (m.raw_fields && typeof m.raw_fields === 'object') {
        for (const k of Object.keys(m.raw_fields || {})) {
          try {
            const lk = String(k || '').toLowerCase();
            if (lk.includes('region') || lk === 'ro' || lk.includes('regional office')) {
              const v = m.raw_fields[k];
              if (!isPlaceholderValue(v)) return String(v);
            }
          } catch (e) { }
        }
      }
      if (!isPlaceholderValue(m.region)) return String(m.region);
      if (m.ongoing && !isPlaceholderValue(m.ongoing.region)) return String(m.ongoing.region);
      if (!isPlaceholderValue(m.province)) return String(m.province);
      if (m.raw_fields) {
        const rawProvince = m.raw_fields.PROVINCE || m.raw_fields.Province || m.raw_fields.province;
        if (!isPlaceholderValue(rawProvince)) return String(rawProvince);
      }
      // scan top-level for any key that contains 'region' or 'sheet'
      for (const k of Object.keys(m || {})) {
        try {
          const lk = String(k || '').toLowerCase();
          if (lk.includes('region') || lk === 'sheet') {
            const v = m[k];
            if (!isPlaceholderValue(v)) return String(v);
          }
        } catch (e) { }
      }
      // scan nested ongoing keys
      if (m.ongoing && typeof m.ongoing === 'object') {
        for (const k of Object.keys(m.ongoing || {})) {
          try {
            const lk = String(k || '').toLowerCase();
            if (lk.includes('region')) {
              const v = m.ongoing[k];
              if (!isPlaceholderValue(v)) return String(v);
            }
          } catch (e) { }
        }
      }
    } catch (e) {
      // ignore
    }
    return '';
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

  const displayValue = (val) => {
    const isFirestoreTimestampLikeString = (s) => {
      if (typeof s !== 'string') return null;
      const m = s.match(/Timestamp\(seconds=(\d+),\s*nanoseconds=(\d+)\)/);
      if (m) return { seconds: Number(m[1]), nanoseconds: Number(m[2]) };
      return null;
    };

    const toDateFromTs = (ts) => {
      try {
        if (!ts) return null;
        if (typeof ts.toDate === 'function') return ts.toDate();
        if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6));
      } catch (e) { }
      return null;
    };

    if (val === null || typeof val === 'undefined') return '-';
    if (Array.isArray(val)) {
      const out = val.map((v) => displayValue(v)).filter((v) => v && v !== '-');
      return out.length ? out.join(', ') : '-';
    }
    if (typeof val === 'string') {
      const tsLike = isFirestoreTimestampLikeString(val);
      if (tsLike) {
        const d = toDateFromTs(tsLike);
        return d ? d.toLocaleString() : '-';
      }
      const s = val.trim();
      if (!s) return '-';
      const low = s.toLowerCase();
      if (low === 'null' || low === 'undefined') return '-';
      // Treat Firestore-like document IDs or long alphanumeric tokens as missing
      if (/^[A-Za-z0-9_-]{16,40}$/.test(s)) return '-';
      return s;
    }
    if (typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
      // Firestore Timestamp object or similar
      const d = toDateFromTs(val);
      if (d) return d.toLocaleString();
      if (val instanceof Date) return val.toLocaleString();
      if (val.name) return String(val.name);
      if (val.label) return String(val.label);
      try {
        const s = JSON.stringify(val);
        if (s && s !== '{}' && s !== '[]') return s;
      } catch (e) { }
      return '-';
    }
    return '-';
  };

  const formatAreaValue = (v) => {
    if (v === null || typeof v === 'undefined' || v === '') return '-';
    if (typeof v === 'number') return v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    const n = parseFloat(String(v).replace(/,/g, ''));
    if (isNaN(n)) return '-';
    return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  };

  const getRemarksText = (mapping) => {
    if (!mapping) return '';
    const raw = mapping.raw_fields || {};
    const values = [
      mapping.remarks,
      mapping.remark,
      mapping.notes,
      mapping.statusOfApplication,
      mapping.status_of_application,
      mapping.application_status,
      mapping.workflowStatus,
      mapping.workflow_status,
      raw.remarks,
      raw.remark,
      raw.notes,
      raw['STATUS OF APPLICATION'],
      raw.status_of_application,
      raw['ADO REMARKS STATUS'],
      raw.ado_remarks_status,
    ];
    const picked = values.find((v) => {
      const s = String(v || '').trim();
      if (!s) return false;
      const up = s.toUpperCase();
      return !(up === '-' || up === '—' || up === 'N/A' || up === 'NA' || up === 'NONE' || up === 'NULL');
    });
    return String(picked || '').trim();
  };

  const isInventoryUser = (user?.email || '').toLowerCase() === 'ncip@inventory.gov.ph';
  const NCIP_TABLE_HEADERS = [
    'No.',
    'Region',
    'Control number',
    'Proponent',
    'Name of Project',
    'Location',
    'Nature of Project',
    'CADT Status',
    'Affected ICC',
    'Year Approved',
    'MOA Duration',
    'Community Benefits',
    'Remarks',
  ];
  const DEFAULT_TABLE_HEADERS = ['SURVEY NUMBER', 'REGION', 'PROVINCE', 'MUNICIPALITY/IES', 'BARANGAY/S', 'AREA (HA)', 'ICCS/IPS', 'REMARKS', 'ACTIONS'];

  const APPROVED_SUMMARY_HEADERS = [
    'Region',
    'Mining/ Mineral Processing Projects',
    'Energy Projects',
    'DAM Projects',
    'EPR',
    'Quarry Projects',
    'Agro-Industrial & Tourism Project Agro-Industrial (Plantation & Livelihood project and Tourism Project)',
    'Infrastructure Projects Telecommunication, Irrigation project, Water System, Road and Bridge Project',
    'Other Projects: Bioprospecting, Feasibility Studies, Reaserch, Treasure Hunting & Tree Cutting Activities',
    'TOTAL APROVED CPs',
    'TOTAL PROJECT COST',
  ];

  const getTableHeaders = () => {
    // When viewing the Approved tab and the first subtab (Summary) is active,
    // show the approved-summary headers.
    if (activeTab === 'mappings' && String(approvedSubTab || '').toLowerCase() === 'summary') {
      return APPROVED_SUMMARY_HEADERS;
    }
    return isInventoryUser ? NCIP_TABLE_HEADERS : DEFAULT_TABLE_HEADERS;
  };

  const renderCellForHeader = (mapping, header) => {
    const h = String(header || '').toLowerCase();

    const getField = (keys) => {
      for (const k of keys) {
        if (!k) continue;
        const val = mapping[k];
        if (val === null || typeof val === 'undefined') continue;
        if (typeof val === 'string') {
          const s = val.trim();
          if (!s) continue;
          const low = s.toLowerCase();
          if (low === 'null' || low === 'undefined') continue;
          return s;
        }
        if (Array.isArray(val)) return val.length ? val.join(', ') : null;
        if (typeof val === 'number' || typeof val === 'boolean') return String(val);
        if (typeof val === 'object') {
          if (val === null) continue;
          if (val.name) return String(val.name);
          if (val.label) return String(val.label);
          // try to stringify small objects
          try {
            const s = JSON.stringify(val);
            if (s && s !== '{}' && s !== '[]') return s;
          } catch (e) {
            // ignore
          }
          continue;
        }
        return String(val);
      }
      return null;
    };

    // If not found on top-level, attempt to find under nested `ongoing` or `raw_fields`
    const tryNested = (keys) => {
      for (const k of keys) {
        if (!k) continue;
        // try as-is in ongoing
        try {
          if (mapping && mapping.ongoing && typeof mapping.ongoing === 'object') {
            const v = mapping.ongoing[k];
            if (v !== null && typeof v !== 'undefined' && String(v).trim() !== '') return String(v);
          }
        } catch (e) { }
        // try safe key in raw_fields (normalized during import)
        try {
          if (mapping && mapping.raw_fields && typeof mapping.raw_fields === 'object') {
            const safe = String(k || '').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '_').toLowerCase();
            const vv = mapping.raw_fields[k] || mapping.raw_fields[safe] || mapping.raw_fields[safe.toLowerCase()];
            if (vv !== null && typeof vv !== 'undefined' && String(vv).trim() !== '') return String(vv);
          }
        } catch (e) { }
      }
      return null;
    };

    const getBest = (keys) => {
      const a = getField(keys);
      if (a !== null && typeof a !== 'undefined') return a;
      const b = tryNested(keys);
      if (b !== null && typeof b !== 'undefined') return b;
      return null;
    };

    // For pending form entries, try raw_fields keys directly and by normalized header shape.
    const tryExcelHeaders = (excelHeaders) => {
      if (!mapping || !mapping.raw_fields || typeof mapping.raw_fields !== 'object') return null;
      const raw = mapping.raw_fields;
      const normalizeHeaderKey = (s) => String(s || '')
        .trim()
        .toUpperCase()
        .replace(/[\u00A0\t\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[^A-Z0-9]+/g, '');

      for (const excelKey of excelHeaders) {
        const direct = raw[excelKey];
        if (direct !== null && typeof direct !== 'undefined' && String(direct).trim() !== '') return String(direct).trim();
      }

      const normalizedTarget = new Set((excelHeaders || []).map((k) => normalizeHeaderKey(k)));
      for (const [rawKey, rawValue] of Object.entries(raw)) {
        if (rawValue === null || typeof rawValue === 'undefined') continue;
        const s = String(rawValue).trim();
        if (!s || s === '-' || s === '—') continue;
        const nk = normalizeHeaderKey(rawKey);
        if (normalizedTarget.has(nk)) return s;
      }
      return null;
    };

    if (h === 'no.' || h === 'no' || h === '#') return displayValue(getBest(['worksheetNo', 'worksheet_no', 'surveyNumber', 'survey_number', 'controlNumber', 'control_number']) || tryExcelHeaders(['NO', 'No', 'no', 'NO.']));
    if (h === 'region') {
      const raw = getBest(['region', 'regionName', 'region_name']) || tryExcelHeaders(['REGION', 'Region']) || mapping.region;
      const canon = canonicalRegion(raw);
      return displayValue(canon || raw);
    }
    if (h === 'control number') return displayValue(getBest(['controlNumber', 'control_number', 'surveyNumber', 'survey_number']));
    if (h.includes('applicant') || h.includes('proponent')) return displayValue(getBest(['proponent', 'applicantProponent', 'applicant_proponent', 'applicant', 'applicant_name', 'applicantName']) || tryExcelHeaders(['NAME OF PROPONENT', 'Name of Proponent', 'PROPONENT']));
    if (h.includes('name of project') || (h.includes('name') && !h.includes('region') && !h.includes('proponent'))) return displayValue(getBest(['nameOfProject', 'name_of_project', 'projectName', 'project_name', 'name', 'title']) || tryExcelHeaders(['NAME OF PROJECT', 'Name of Project', 'PROJECT']));
    if (h.includes('type of project') || h.includes('nature')) return displayValue(getBest(['typeOfProject', 'type_of_project', 'natureOfProject', 'nature_of_project', 'nature', 'projectNature', 'projectType']) || tryExcelHeaders(['Type of Project', 'TYPE OF PROJECT', 'Type of project']));
    if (h.includes('project location') || h === 'location') return displayValue(getBest(['location', 'projectLocation', 'project_location', 'province', 'provinceName', 'province_name', 'location_full']) || tryExcelHeaders(['LOCATION', 'Location', 'Project Location']));
    if (h.includes('ancestral domain')) return displayValue(getBest(['ancestralDomain', 'affected_ancestral_domain', 'affectedAncestralDomain', 'ancestral_domains']));
    if (h.includes('date of application') || h.includes('date of filing')) {
      const raw = getBest(['dateOfApplication', 'date_of_application', 'date_filed', 'dateFiled', 'date_of_filing']) || tryExcelHeaders(['DATE OF FILING OF CP APPLICATION', 'Date of Filing of CP Application', 'DATE OF APPLICATION', 'Date of Application']);
      if (!raw) return '-';
      // Handle Firestore timestamp serialized as JSON string: {"seconds":...,"nanoseconds":...}
      try {
        const parsed = typeof raw === 'string' && raw.includes('seconds') ? JSON.parse(raw) : null;
        if (parsed && parsed.seconds) {
          const d = new Date(parsed.seconds * 1000);
          return displayValue(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'));
        }
      } catch(e) { /* ignore */ }
      // Handle Date objects
      if (raw instanceof Date) return displayValue(raw.getFullYear() + '-' + String(raw.getMonth()+1).padStart(2,'0') + '-' + String(raw.getDate()).padStart(2,'0'));
      // Handle ISO date strings — show just the year if it's a plain year number
      const s = String(raw);
      const yearOnly = s.match(/^(19|20)\d{2}(-01-01.*)?$/);
      if (yearOnly) return displayValue(s.slice(0, 4));
      return displayValue(s);
    }
    if (h.includes('project cost') || h === 'cost') return displayValue(getBest(['projectCost', 'project_cost', 'cost']) || tryExcelHeaders(['Project Cost', 'PROJECT COST', 'Cost']));
    if (h.includes('status of application') || h === 'status of application') return displayValue(getBest(['statusOfApplication', 'status_of_application', 'remarks', 'application_status']) || tryExcelHeaders(['STATUS OF APPLICATION', 'Status of Application', 'Status']));
    if (h === 'status') return displayValue(getBest(['workflowStatus', 'workflow_status', 'cadtStatus', 'cadt_status', 'status']));
    if ((h.includes('ongoing fpic') || h.includes('for cp with')) && !h.includes('affected') && !h.includes('ad/icc') && h !== 'icc') {
      return displayValue(getBest(['hasOngoingFpic', 'has_ongoing_fpic', 'ongoingFpic', 'ongoing_fpic']));
    }

    if (h.includes('cadt')) return displayValue(getBest(['cadtStatus', 'cadt_status', 'cadt']));
    if (h === 'icc' || h.includes('icc') || h.includes('ad/icc') || h.includes('affected ad')) {
      const explicit = getBest([
        'icc',
        'iccs',
        'affectedICC',
        'affected_icc',
        'affected_iccs',
        'affectedIccsIps',
        'affected_iccs_ips',
        'affected_icc_ips',
        'affected_ad_icc_ip_for_cp_with_ongoing_fpic',
        'affected_ad_icc_ip_for_cp_with_ongoing_fpic_',
        'affected_ad_icc_ip',
        'for_cp_with_ongoing_fpic',
        'for_cp_with_ongoing_fpic_',
        'AFFECTED AD/ICC/IP (for CP with ongoing FPIC)',
        'Affected AD/ICC/IP (for CP with ongoing FPIC)',
        '(for CP with ongoing FPIC)',
        'AFFECTED ICCs/IPs',
        'Affected ICCs/IPs',
      ]);
      if (explicit !== null && typeof explicit !== 'undefined' && String(explicit).trim() !== '') {
        return displayValue(explicit);
      }

      try {
        if (mapping && typeof mapping === 'object') {
          const topLevelKey = Object.keys(mapping).find((k) => {
            const key = String(k || '');
            const affectedIccLike = /affected/i.test(key) && /(icc|ip|ad)/i.test(key);
            const ongoingFpicLike = /ongoing/i.test(key) && /fpic/i.test(key);
            return affectedIccLike || ongoingFpicLike;
          });
          if (topLevelKey) {
            const topLevelValue = mapping[topLevelKey];
            if (topLevelValue !== null && typeof topLevelValue !== 'undefined' && String(topLevelValue).trim() !== '') {
              return displayValue(topLevelValue);
            }
          }
        }
      } catch (e) {
        // ignore
      }

      try {
        if (mapping && mapping.raw_fields && typeof mapping.raw_fields === 'object') {
          const rawKeys = Object.keys(mapping.raw_fields);
          const rawKey = rawKeys.find((k) => {
            const key = String(k || '');
            const affectedIccLike = /affected/i.test(key) && /(icc|ip|ad)/i.test(key);
            const ongoingFpicLike = /ongoing/i.test(key) && /fpic/i.test(key);
            return affectedIccLike || ongoingFpicLike;
          });
          if (rawKey) {
            const rawValue = mapping.raw_fields[rawKey];
            if (rawValue !== null && typeof rawValue !== 'undefined' && String(rawValue).trim() !== '') {
              return displayValue(rawValue);
            }
          }
        }
      } catch (e) {
        // ignore
      }
      return '-';
    }
    if (h.includes('year')) return displayValue(getBest(['yearApproved', 'year_approved', 'year', 'approvedYear']));
    if (h.includes('moa duration') || h === 'moa duration') return displayValue(getBest(['moaDuration', 'moa_duration', 'moa']));
    if (h.includes('province')) return displayValue(getBest(['province', 'provinceName', 'province_name']));
    if (h.includes('municipality')) return displayValue(getBest(['municipality', 'municipalities']));
    if (h.includes('barangay')) return displayValue(getBest(['barangays']));
    if (h.includes('area')) return displayValue(getBest(['totalArea', 'area', 'area_ha']));
    if (h.includes('community')) return displayValue(getBest(['communityBenefits', 'community_benefits', 'community']));
    if (h.includes('remark')) return displayValue(getBest(['remarks', 'remark', 'notes']));
    return '-';
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

  // Ongoing subtabs configuration and helpers (moved out of JSX to avoid parsing issues)
  const ONGOING_SUBTABS = [
    { id: 'summary', label: 'Summary' },
    { id: 'summary-per-project', label: 'Summary per project' },
    { id: 'denied-by-mgb', label: 'Denied by MGB' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'car', label: 'CAR' },
    { id: 'region1', label: 'Region 1' },
    { id: 'region2', label: 'Region 2' },
    { id: 'region3', label: 'Region 3' },
    { id: 'region4a', label: 'Region 4A' },
    { id: 'region4b', label: 'Region 4B' },
    { id: 'region5', label: 'Region 5' },
    { id: 'region6-7', label: 'Region 6/7' },
    { id: 'region8', label: 'Region 8' },
    { id: 'region9', label: 'Region 9' },
    { id: 'region10', label: 'Region 10' },
    { id: 'region11', label: 'Region 11' },
    { id: 'region12', label: 'Region 12' },
    { id: 'region13', label: 'Region 13' },
  ].map((s) => ({
    ...s,
    headers: s.id === 'denied-by-mgb' ? [
      'Name of Proponent',
      'Name of Project',
      'Type of project',
      'Project Location',
      'Project Area (in hectares)',
      'Affected Ancestral Domain/s',
      'Affected ICCs/IPs',
      'Date of Application',
      'Review of Application Documents',
      'Need for FBI?',
      'Issuance of Work Order',
      'Pre-FBI Conference',
      'Approval/ Concurrence of WFP',
      'Payment of FBI Fee',
      'Conduct of FBI',
      'Preparation of FBI Report',
      'Review of FBI Report',
      'Issuance of Work Order of FPIC Team',
      'Pre-FPIC Conference',
      'Approval of WFP',
      'Payment of FPIC Fee',
      'Posting of Notices',
      '1st Community Assembly',
      '2nd Community Assembly',
      'Consensus Building & Decision Meeting',
      'Proceed to MOA Negotiation?',
      '(If yes) Issuance of Resolution to proceed to MOA Negotiation',
      'MOA Negotiation & Preparation',
      'MOA Validation, Ratification & Signing',
      'Issuance of Resolution of Consent',
      'Submission of FPIC Report',
      'Review of the FPIC Report by RRT',
      'Review of the FPIC Report by ADO & LAO',
      'For compliance of FPIC Team/ RO',
      'CEB Deliberation',
      'CEB Approved?',
      '(If yes) Preparation & Signing of CEB Resolution & CP',
      'Release of CP to the Proponent',
      'REMARKS'
    ] : [
      'Name of Proponent', 'Name of Project', 'Type of project', 'Project Location', 'Project Area (in hectares)', 'Affected Ancestral Domain/s', 'Affected ICCs/IPs', 'Date of Application', 'Review of Application Documents', 'Need for FBI?', 'Issuance of Work Order', 'Pre-FBI Conference', 'Approval/ Concurrence of WFP', 'Payment of FBI Fee', 'Conduct of FBI', 'Preparation of FBI Report', 'Review of FBI Report', 'Issuance of Work Order of FPIC Team', 'Pre-FPIC Conference', 'Approval of WFP', 'Payment of FPIC Fee', 'Posting of Notices', '1st Community Assembly', '2nd Community Assembly', 'Consensus Building & Decision Meeting', 'Proceed to MOA Negotiation?', '(If yes) Issuance of Resolution to proceed to MOA Negotiation', 'MOA Negotiation & Preparation', 'MOA Validation, Ratification & Signing', 'Issuance of Resolution of Consent', 'Submission of FPIC Report', 'Review of the FPIC Report by RRT', 'Review of the FPIC Report by ADO & LAO', 'For compliance of FPIC Team/ RO', 'CEB Deliberation', 'CEB Approved?', '(If yes) Preparation & Signing of CEB Resolution & CP', 'Release of CP to the Proponent', 'REMARKS'
    ],
    keys: ['proponent', 'nameOfProject', 'typeOfProject', 'location', 'area', 'ancestral', 'iccs', 'dateOfApplication', 'reviewOfApplicationDocuments', 'needForFBI', 'issuanceOfWorkOrder', 'preFBIConference', 'approvalOfWFP', 'paymentOfFBIFee', 'conductOfFBI', 'preparationOfFBIReport', 'reviewOfFBIReport', 'issuanceOfWorkOrderOfFPICTeam', 'preFPICConference', 'approvalOfWFP', 'paymentOfFPICFee', 'postingOfNotices', 'firstCommunityAssembly', 'secondCommunityAssembly', 'consensusBuildingDecision', 'proceedToMOANegotiation', 'issuanceResolutionToProceedToMOA', 'moaNegotiationPreparation', 'moaValidationRatificationSigning', 'issuanceResolutionOfConsent', 'submissionOfFPICReport', 'reviewByRRT', 'reviewByADOorLAO', 'forComplianceOfFPICTeam', 'cebDeliberation', 'cebApproved', 'preparationSigningCEBResolutionCP', 'releaseOfCPToProponent', 'remarks']
  }));

  // Approved subtabs: only regions + extractive company lists as requested
  const APPROVED_SUBTABS = [
    { id: 'summary', label: 'Summary' },
    { id: 'car', label: 'CAR' },
    { id: 'region1', label: 'Region 1' },
    { id: 'region2', label: 'Region 2' },
    { id: 'region3', label: 'Region 3' },
    { id: 'region4a', label: 'Region 4A' },
    { id: 'region4b', label: 'Region 4B' },
    { id: 'region5', label: 'Region 5' },
    { id: 'region6-7', label: 'Region 6/7' },
    { id: 'region8', label: 'Region 8' },
    { id: 'region9', label: 'Region 9' },
    { id: 'region10', label: 'Region 10' },
    { id: 'region11', label: 'Region 11' },
    { id: 'region12', label: 'Region 12' },
    { id: 'region13', label: 'Region 13' },
    { id: 'extractive-copy', label: 'Copy of Extractive mining Companies' },
    { id: 'extractive-companies', label: 'Extractive mining Companies' },
  ];

  // Pending subtabs (user-provided list)
  const PENDING_SUBTABS = [
    { id: 'summary', label: 'Summary' },
    { id: 'summary-per-project', label: 'Summary per project' },
    { id: 'car', label: 'CAR' },
    { id: 'region1', label: 'Region 1' },
    { id: 'region2', label: 'Region 2' },
    { id: 'region3', label: 'Region 3' },
    { id: 'region4a', label: 'Region 4A' },
    { id: 'region4b', label: 'Region 4B' },
    { id: 'region5', label: 'Region 5' },
    { id: 'region6-7', label: 'Region 6/7' },
    { id: 'region9', label: 'Region 9' },
    { id: 'region10', label: 'Region 10' },
    { id: 'region11', label: 'Region 11' },
    { id: 'region12', label: 'Region 12' },
    { id: 'region13', label: 'Region 13' },
    { id: 'road-projects', label: 'Road Projects' },
  ];

  const computeSummaryRows = (records = []) => {
    const regionMap = new Map();
    records.forEach((m) => {
      // Derive a best-effort raw region value from several possible places
      let rawRegion = '';
      try {
        if (m) {
          if (m.region) rawRegion = m.region;
          else if (m.ongoing && m.ongoing.region) rawRegion = m.ongoing.region;
          else if (m.raw_fields && (m.raw_fields.region || m.raw_fields.sheet)) rawRegion = m.raw_fields.region || m.raw_fields.sheet;
        }
      } catch (e) {
        rawRegion = m && m.region ? m.region : '';
      }
      // If still empty, try to find any top-level or nested key that looks like a region
      try {
        if (!rawRegion || String(rawRegion).trim() === '') {
          // search top-level keys
          for (const k of Object.keys(m || {})) {
            try {
              const lk = String(k || '').toLowerCase();
              if (lk.includes('region') || lk === 'sheet') {
                const v = m[k];
                if (v && String(v).trim() !== '') { rawRegion = v; break; }
              }
            } catch (e) { }
          }
        }
        if (!rawRegion || String(rawRegion).trim() === '') {
          // search nested ongoing
          if (m && m.ongoing && typeof m.ongoing === 'object') {
            for (const k of Object.keys(m.ongoing || {})) {
              try {
                const lk = String(k || '').toLowerCase();
                if (lk.includes('region')) {
                  const v = m.ongoing[k];
                  if (v && String(v).trim() !== '') { rawRegion = v; break; }
                }
              } catch (e) { }
            }
          }
        }
      } catch (e) {
        // ignore
      }
      // Use short canonical forms ("2", "CAR", "4A") to match the approved summary style.
      // canonicalRegion() converts to long form ("Region II") which we do NOT want here.
      const normalizeShort = (raw) => {
        if (!raw) return 'Unknown';
        const v = String(raw).trim();
        const up = v.toUpperCase().replace(/[\u2013\u2014]/g, '-');
        if (up.includes('CORDILLERA') || up === 'CAR' || up.startsWith('CAR')) return 'CAR';
        if (/6\s*[-&/]?\s*7|VI\s*[-/&]\s*VII/.test(up)) return '6&7';
        const romanToNum = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13 };
        const rs = up.match(/(?:REGION\s*)?(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\s*-?\s*(A|B)\b/);
        if (rs) { const n = romanToNum[rs[1]]; return n ? `${n}${rs[2]}` : v; }
        const r2 = up.match(/(?:REGION\s*)?(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/);
        if (r2) { const n = romanToNum[r2[1]]; return n ? String(n) : v; }
        const ar = up.match(/(?:REGION\s+|\bR)(\d{1,2})\s*-?\s*(A|B)?$/) || up.match(/^(\d{1,2})\s*-?\s*(A|B)?$/);
        if (ar) { const n = Number(ar[1]); if (n >= 1 && n <= 13) return ar[2] ? `${n}${ar[2]}` : String(n); }
        return v;
      };
      const region = (normalizeShort(rawRegion) || 'Unknown').toString();
      if (!regionMap.has(region)) {
        regionMap.set(region, {
          region,
          total: 0,
          issuanceOfWorkOrder: 0,
          preFBIConference: 0,
          conductOfFBI: 0,
          reviewOfFBIReport: 0,
          preFPICConference: 0,
          firstCommunityAssembly: 0,
          secondCommunityAssembly: 0,
          consensusBuildingDecision: 0,
          moaValidationRatificationSigning: 0,
          issuanceResolutionOfConsent: 0,
          reviewByRRT: 0,
          reviewByADOorLAO: 0,
          forComplianceOfFPICTeam: 0,
          cebDeliberation: 0,
        });
      }
      const obj = regionMap.get(region);
      obj.total += 1;

      // Robust field lookup to support imported header variants.
      // Tries direct key, underscored key, normalized/compact matches against existing keys,
      // and a fuzzy fallback that searches any key containing meaningful words from keyName.
      const lookupVal = (record, keyName) => {
        if (!record || !keyName) return null;

        const isNonEmpty = (v) => (v !== null && typeof v !== 'undefined' && String(v).trim() !== '');

        // direct property match
        if (Object.prototype.hasOwnProperty.call(record, keyName) && isNonEmpty(record[keyName])) return record[keyName];

        // underscored variant
        const underscored = String(keyName).trim().replace(/\s+/g, '_');
        if (Object.prototype.hasOwnProperty.call(record, underscored) && isNonEmpty(record[underscored])) return record[underscored];

        // compact comparator: letters+digits only
        const compact = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetNorm = compact(keyName);

        for (const orig of Object.keys(record || {})) {
          const on = String(orig || '').toLowerCase();
          const oc = compact(on);
          if (oc === targetNorm || on.includes(keyName.toLowerCase()) || keyName.toLowerCase().includes(on) || oc.includes(targetNorm) || targetNorm.includes(oc)) {
            const v = record[orig];
            if (isNonEmpty(v)) return v;
          }
        }

        // raw_fields (preserved CSV columns) can contain canonical names
        try {
          if (record && record.raw_fields && typeof record.raw_fields === 'object') {
            for (const rk of Object.keys(record.raw_fields)) {
              const rv = record.raw_fields[rk];
              if (!isNonEmpty(rv)) continue;
              const rkc = compact(rk);
              if (rkc === targetNorm || rkc.includes(targetNorm) || targetNorm.includes(rkc) || String(rk).toLowerCase().includes(String(keyName).toLowerCase())) {
                return rv;
              }
            }
          }
        } catch (e) {
          // ignore
        }

        // Fuzzy fallback: split camelCase and punctuation and try to match substantial words (>3 chars)
        const words = String(keyName || '')
          .replace(/([A-Z])/g, ' $1')
          .replace(/[^a-zA-Z0-9\s]/g, ' ')
          .toLowerCase()
          .split(/\s+/)
          .map((w) => w.trim())
          .filter(Boolean)
          .filter((w) => w.length > 3);

        if (words.length > 0) {
          for (const orig of Object.keys(record || {})) {
            const on = String(orig || '').toLowerCase();
            for (const w of words) {
              if (on.includes(w)) {
                const v = record[orig];
                if (isNonEmpty(v)) return v;
              }
            }
          }
        }

        return null;
      };



      // FIELD_SNAKE maps camelCase key → snake_case Firestore field name
      const FIELD_SNAKE = {
        issuanceOfWorkOrder: 'issuance_of_work_order',
        preFBIConference: 'pre_fbi_conference',
        conductOfFBI: 'conduct_of_fbi',
        reviewOfFBIReport: 'review_of_fbi_report',
        preFPICConference: 'pre_fpic_conference',
        firstCommunityAssembly: 'first_community_assembly',
        secondCommunityAssembly: 'second_community_assembly',
        consensusBuildingDecision: 'consensus_building_decision',
        moaValidationRatificationSigning: 'moa_validation_ratification_signing',
        issuanceResolutionOfConsent: 'issuance_resolution_of_consent',
        reviewByRRT: 'review_by_rrt',
        reviewByADOorLAO: 'review_by_ado_or_lao',
        forComplianceOfFPICTeam: 'for_compliance_of_fpic_team',
        cebDeliberation: 'ceb_deliberation',
      };

      // Returns true only if the step is actually COMPLETED (Done / a date / complied).
      // "Pending", "Ongoing", "For compliance" mean NOT done — do NOT count them.
      const isStepValue = (v) => {
        if (v === null || v === undefined) return false;
        const s = String(v).trim().toLowerCase();
        if (!s) return false;
        // Completion words only — "pending" / "ongoing" are NOT done
        if (['done', 'completed', 'finished', 'complied', 'yes'].some(w => s === w || s.startsWith(w))) return true;
        // Date-like: contains digits with separators (e.g. 2024-01-15, 01/15/2024, Jan 15 2024)
        if (/\d{1,4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,4}/.test(s)) return true;
        if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(s) && /\d/.test(s)) return true;
        // Excel serial-like number (date serial range ~2010-2050)
        if (/^\d+$/.test(s)) {
          const n = Number(s);
          if (n > 40000 && n < 55000) return true;
        }
        return false;
      };

      const inc = (keyName) => {
        // 1. Direct camelCase key (set by App.jsx mappingsFormat)
        const direct = m[keyName];
        if (isStepValue(direct)) { obj[keyName] += 1; return; }
        // 2. Snake_case directly on the document root (cp_projects Firestore docs)
        const snake = FIELD_SNAKE[keyName];
        if (snake) {
          if (isStepValue(m[snake])) { obj[keyName] += 1; return; }
          // 3. Snake_case inside raw_fields (legacy import fallback)
          if (m.raw_fields && isStepValue(m.raw_fields[snake])) { obj[keyName] += 1; return; }
        }
      };

      inc('issuanceOfWorkOrder');
      inc('preFBIConference');
      inc('conductOfFBI');
      inc('reviewOfFBIReport');
      inc('preFPICConference');
      inc('firstCommunityAssembly');
      inc('secondCommunityAssembly');
      inc('consensusBuildingDecision');
      inc('moaValidationRatificationSigning');
      inc('issuanceResolutionOfConsent');
      inc('reviewByRRT');
      inc('reviewByADOorLAO');
      inc('forComplianceOfFPICTeam');
      inc('cebDeliberation');
    });
    const ONGOING_REGION_ORDER = ['CAR','1','2','3','4A','4B','5','6&7','7','8','9','10','11','12','13'];
    const ongoingRegionSortKey = (r) => { const i = ONGOING_REGION_ORDER.indexOf(r); return i >= 0 ? i : 99; };
    const rows = Array.from(regionMap.values()).sort((a, b) => ongoingRegionSortKey(a.region) - ongoingRegionSortKey(b.region));
    
    // Debug: show how many records are in each group
    try {
      const unknownCount = regionMap.get('Unknown')?.total || 0;
      if (unknownCount > 0) {
        const unknownRecords = records.filter((m) => {
          let rawRegion = '';
          if (m?.region) rawRegion = m.region;
          else if (m?.ongoing?.region) rawRegion = m.ongoing.region;
          else if (m?.raw_fields?.region) rawRegion = m.raw_fields.region;
          else if (m?.raw_fields?.sheet) rawRegion = m.raw_fields.sheet;
          return !rawRegion || String(rawRegion).trim() === '';
        });
        console.debug('Dashboard: computeSummaryRows Unknown group ->', { unknownCount, sampleRecords: unknownRecords.slice(0, 3).map((m) => ({ survey: m.surveyNumber, project: m.nameOfProject, region: m.region, sheet: m?.raw_fields?.sheet })) });
      }
      console.debug('Dashboard: computeSummaryRows ->', { inputCount: records.length, rows });
    } catch (e) { /* ignore */ }
    return rows;
  };

  const currentOngoingTab = ONGOING_SUBTABS.find((s) => s.id === ongoingSubTab) || ONGOING_SUBTABS[0];
  const currentPendingTab = PENDING_SUBTABS.find((s) => s.id === pendingSubTab) || PENDING_SUBTABS[0];
  const currentApprovedTab = APPROVED_SUBTABS.find((s) => s.id === approvedSubTab) || APPROVED_SUBTABS[0];

  // Compute summary rows grouped by year applied with counts per region
  const PENDING_YEAR_MIN = 1990;
  const PENDING_YEAR_MAX = 2025;

  const getYearFromMapping = (m) => {
    if (!m) return 'Unknown';
    const raw = m.raw_fields && typeof m.raw_fields === 'object' ? m.raw_fields : {};
    const rawNested = raw.raw_fields && typeof raw.raw_fields === 'object' ? raw.raw_fields : {};

    // Convert an Excel serial date number to a calendar year
    const excelSerialToYear = (n) => {
      // Excel epoch: Jan 1 1900 = serial 1 (with leap-year bug: serial 60 = Feb 29 1900, doesn't exist)
      // Modern Excel serials for 1990-2030 are roughly 32874-47849
      if (n < 25569 || n > 60000) return null; // out of plausible range
      const msPerDay = 86400000;
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(excelEpoch.getTime() + n * msPerDay);
      const y = d.getUTCFullYear();
      return (y >= PENDING_YEAR_MIN && y <= PENDING_YEAR_MAX) ? String(y) : null;
    };

    const candidates = [
      m.yearApplied, m.year_applied, m.year, m.DateApplied, m.dateApplied, m.date_of_application, m.dateOfApplication,
      m.date_filed, m.dateFiled, m.date_of_filing_of_cp_application,
      raw.year_applied,
      raw.yearApplied,
      raw.YEAR,
      raw['YEAR APPLIED'],
      raw.date_filed,
      raw.date_of_filing_of_cp_application,
      raw.date_of_application,
      raw.dateFiled,
      raw['DATE FILED'],
      raw['DATE OF FILING OF CP APPLICATION'],
      raw['DATE OF APPLICATION'],
      raw['DATE APPLIED'],
      rawNested.year_applied,
      rawNested.yearApplied,
      rawNested.YEAR,
      rawNested['YEAR APPLIED'],
      rawNested.date_filed,
      rawNested.date_of_filing_of_cp_application,
      rawNested.date_of_application,
      rawNested.dateFiled,
      rawNested['DATE FILED'],
      rawNested['DATE OF FILING OF CP APPLICATION'],
      rawNested['DATE OF APPLICATION'],
      rawNested['DATE APPLIED'],
    ];

    // Include any raw_fields key that looks like a filing/application date.
    try {
      const scanObjects = [raw, rawNested];
      scanObjects.forEach((obj) => {
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach((k) => {
          const key = String(k || '').toLowerCase();
          if (key.includes('date') && (key.includes('fil') || key.includes('application') || key.includes('applied'))) {
            candidates.push(obj[k]);
          }
        });
      });
    } catch (e) {
      // ignore
    }
    for (const c of candidates) {
      if (c === null || c === undefined || c === '') continue;
      try {
        // Handle Firestore Timestamp object (has .toDate() method)
        if (typeof c === 'object' && c !== null && typeof c.toDate === 'function') {
          const d = c.toDate();
          if (d instanceof Date && !isNaN(d.getTime()) && d.getFullYear() >= PENDING_YEAR_MIN && d.getFullYear() <= PENDING_YEAR_MAX) return String(d.getFullYear());
          continue;
        }
        // Handle Firestore timestamp JSON string: {"seconds":...,"nanoseconds":...}
        if (typeof c === 'string' && c.includes('seconds')) {
          const parsed = JSON.parse(c);
          if (parsed && parsed.seconds) {
            const y = new Date(parsed.seconds * 1000).getFullYear();
            if (y >= PENDING_YEAR_MIN && y <= PENDING_YEAR_MAX) return String(y);
          }
          continue;
        }
        if (typeof c === 'number' && c > 0) {
          // If it's already a 4-digit year range, use it directly
          if (c >= PENDING_YEAR_MIN && c <= PENDING_YEAR_MAX) return String(Math.round(c));
          // Try to interpret as Excel serial date
          const y = excelSerialToYear(c);
          if (y) return y;
          // Otherwise skip — not a usable year
          continue;
        }
        const s = String(c).trim();
        // Explicit dd-mm-yyyy / dd/mm/yyyy parsing to avoid locale ambiguity.
        const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (dmy) {
          const day = Number(dmy[1]);
          const month = Number(dmy[2]);
          const year = Number(dmy[3]);
          if (year >= PENDING_YEAR_MIN && year <= PENDING_YEAR_MAX && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return String(year);
          }
        }
        // Try direct date parse first
        const d = new Date(s);
        if (!isNaN(d.getTime()) && d.getFullYear() >= PENDING_YEAR_MIN && d.getFullYear() <= PENDING_YEAR_MAX) return String(d.getFullYear());
        // Fallback: extract 4-digit year
        const mMatch = s.match(/\b(19\d{2}|20\d{2})\b/);
        if (mMatch) {
          const y = Number(mMatch[1]);
          if (y >= PENDING_YEAR_MIN && y <= PENDING_YEAR_MAX) return mMatch[1];
        }
      } catch (e) {
        // ignore
      }
    }
    return 'Unknown';
  };

  const toPendingRegionBucket = (rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw || isPlaceholderValue(raw)) return '';

    const up = raw.toUpperCase().replace(/[\u2013\u2014]/g, '-');
    if (up.includes('CORDILLERA') || up === 'CAR' || up.startsWith('CAR')) return 'CAR';

    // Map provinces to their regions (CAR and others)
    const provinceToRegion = {
      'APAYAO': 'CAR', 'BENGUET': 'CAR', 'IFUGAO': 'CAR', 'KALINGA': 'CAR', 'MOUNTAIN PROVINCE': 'CAR', 'ABRA': 'CAR',
      'ILOCOS NORTE': 'I', 'ILOCOS SUR': 'I', 'LA UNION': 'I', 'PANGASINAN': 'I',
      'BATANES': 'II', 'CAGAYAN': 'II', 'ISABELA': 'II', 'NUEVA VIZCAYA': 'II', 'QUIRINO': 'II',
      'BATAAN': 'III', 'BULACAN': 'III', 'NUEVA ECIJA': 'III', 'PAMPANGA': 'III', 'TARLAC': 'III', 'ZAMBALES': 'III',
      'LAGUNA': 'IVA', 'CAVITE': 'IVA', 'BATANGAS': 'IVA', 'QUEZON': 'IVA',
      'MARINDUQUE': 'IVB', 'PALAWAN': 'IVB', 'ROMBLON': 'IVB', 'ORIENTAL MINDORO': 'IVB', 'OCCIDENTAL MINDORO': 'IVB',
      'ALBAY': 'V', 'CAMARINES NORTE': 'V', 'CAMARINES SUR': 'V', 'CATANDUANES': 'V', 'SORSOGON': 'V',
      'AKLAN': 'VI/VII', 'ANTIQUE': 'VI/VII', 'CAPIZ': 'VI/VII', 'ILOILO': 'VI/VII', 'GUIMARAS': 'VI/VII',
      'CEBU': 'VI/VII', 'BOHOL': 'VI/VII', 'SIQUIJOR': 'VI/VII', 'NEGROS ORIENTAL': 'VI/VII',
      'ZAMBOANGA DEL NORTE': 'IX', 'ZAMBOANGA DEL SUR': 'IX', 'ZAMBOANGA SIBUGAY': 'IX',
      'MISAMIS OCCIDENTAL': 'X', 'MISAMIS ORIENTAL': 'X', 'LANAO DEL NORTE': 'X', 'LANAO DEL SUR': 'X', 'BUKIDNON': 'X',
      'DAVAO OCCIDENTAL': 'XI', 'DAVAO ORIENTAL': 'XI', 'DAVAO DEL NORTE': 'XI', 'DAVAO DEL SUR': 'XI', 'DAVAO DE ORO': 'XI',
      'NORTH COTABATO': 'XII', 'COTABATO': 'XII', 'SOUTH COTABATO': 'XII', 'SULTAN KUDARAT': 'XII', 'SARANGANI': 'XII',
      'SURIGAO DEL NORTE': 'XIII', 'SURIGAO DEL SUR': 'XIII', 'AGUSAN DEL NORTE': 'XIII', 'AGUSAN DEL SUR': 'XIII', 'DINAGAT ISLANDS': 'XIII'
    };

    if (provinceToRegion[up]) return provinceToRegion[up];

    // Explicit 6/7 combined bucket used by pending workbook
    if (/VI\s*[/&-]\s*VII|6\s*[/&-]\s*7|REGION\s*67/.test(up)) return 'VI/VII';

    const romanToBucket = {
      I: 'I', II: 'II', III: 'III', IV: '', V: 'V', VI: 'VI/VII', VII: 'VI/VII',
      VIII: '', IX: 'IX', X: 'X', XI: 'XI', XII: 'XII', XIII: 'XIII'
    };

    // Region IV with suffix
    const ivSuffix = up.match(/(?:REGION\s*)?IV\s*-?\s*(A|B)\b/);
    if (ivSuffix) return ivSuffix[1] === 'A' ? 'IVA' : 'IVB';

    // Roman region labels
    const roman = up.match(/(?:REGION\s*)?(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/);
    if (roman && romanToBucket[roman[1]]) return romanToBucket[roman[1]];

    // Arabic with optional A/B suffix
    const arabic = up.match(/(?:REGION\s+|\bR)(\d{1,2})\s*-?\s*(A|B)?\b/) || up.match(/^(\d{1,2})\s*-?\s*(A|B)?$/);
    if (arabic) {
      const n = Number(arabic[1]);
      const suffix = arabic[2] ? arabic[2].toUpperCase() : '';
      if (n === 4 && suffix === 'A') return 'IVA';
      if (n === 4 && suffix === 'B') return 'IVB';
      if (n === 6 || n === 7) return 'VI/VII';
      if (n === 1) return 'I';
      if (n === 2) return 'II';
      if (n === 3) return 'III';
      if (n === 5) return 'V';
      if (n === 9) return 'IX';
      if (n === 10) return 'X';
      if (n === 11) return 'XI';
      if (n === 12) return 'XII';
      if (n === 13) return 'XIII';
    }

    return '';
  };

  const computeYearSummaryRows = (records = []) => {
    const yearMap = new Map();

    const ensureRow = (year) => {
      if (!yearMap.has(year)) {
        yearMap.set(year, {
          year,
          CAR: 0, I: 0, II: 0, III: 0, IVA: 0, IVB: 0, V: 0, 'VI/VII': 0, IX: 0, X: 0, XI: 0, XII: 0, XIII: 0,
        });
      }
      return yearMap.get(year);
    };

    records.forEach((m) => {
      const year = getYearFromMapping(m) || 'Unknown';
      const row = ensureRow(year);
      const candidate = deriveRawRegion(m) || m.region || m?.province || m?.raw_fields?.PROVINCE || m?.raw_fields?.Province || m?.raw_fields?.province || m?.location || '';
      const normalizedDetected = detectRegionSheet(candidate);
      const bucket =
        toPendingRegionBucket(normalizedDetected) ||
        toPendingRegionBucket(canonicalRegion(candidate)) ||
        toPendingRegionBucket(candidate) ||
        toPendingRegionBucket(m?.source_sheet || m?.raw_fields?.source_sheet || '') ||
        toPendingRegionBucket(m?.province || m?.raw_fields?.PROVINCE || m?.raw_fields?.Province || '');

      if (!bucket) {
        console.debug('⚠️ No bucket for record:', {
          year, 
          candidate, 
          normalizedDetected,
          canonical: canonicalRegion(candidate),
          name: m.nameOfProject || m.name_of_project || 'N/A',
          proponent: m.proponent || m.name_of_proponent || 'N/A'
        });
      }

      if (bucket && Object.prototype.hasOwnProperty.call(row, bucket)) {
        row[bucket] += 1;
      }
    });

    // Always seed every year from 1990 to max data year with zero rows (matches Excel)
    const numericYears = Array.from(yearMap.keys()).filter(y => y !== 'Unknown' && !isNaN(Number(y))).map(Number);
    const maxYear = numericYears.length > 0 ? Math.min(PENDING_YEAR_MAX, Math.max(...numericYears)) : PENDING_YEAR_MAX;
    for (let y = PENDING_YEAR_MIN; y <= maxYear; y++) {
      const ys = String(y);
      if (!yearMap.has(ys)) {
        yearMap.set(ys, { year: ys, CAR: 0, I: 0, II: 0, III: 0, IVA: 0, IVB: 0, V: 0, 'VI/VII': 0, IX: 0, X: 0, XI: 0, XII: 0, XIII: 0 });
      }
    }

    const rows = Array.from(yearMap.values()).sort((a, b) => {
      if (a.year === 'Unknown') return 1;
      if (b.year === 'Unknown') return -1;
      return Number(a.year || 0) - Number(b.year || 0); // ascending: oldest year first (matches Excel)
    });
    // compute totals per row
    rows.forEach((r) => {
      r.TOTAL = (
        Number(r.CAR || 0) + Number(r.I || 0) + Number(r.II || 0) + Number(r.III || 0) + Number(r.IVA || 0) + Number(r.IVB || 0) + Number(r.V || 0) + Number(r['VI/VII'] || 0) + Number(r.IX || 0) + Number(r.X || 0) + Number(r.XI || 0) + Number(r.XII || 0) + Number(r.XIII || 0)
      );
    });
    return rows;
  };

  // Compute counts by project type for 'Summary per project'
  // Categories match the Excel file: "Summary per project" sheet columns
  const computeProjectTypeSummaryRows = (records = []) => {
    const categories = [
      'Mining Project',
      'Energy Project',
      'Agro Industrial Project',
      'Road Project',
      'EPR',
      'Irrigation Project',
      'Others',
    ];
    const totals = categories.reduce((acc, c) => ({ ...acc, [c]: 0 }), {});
    const countsByRegion = {};

    const detectProjectCategory = (m) => {
      if (!m) return 'Others';
      const candidates = [
        m.typeOfProject, m.type_of_project, m.type, m.projectType,
        m.natureOfProject, m.nature_of_project,
        (m.raw_fields && (
          m.raw_fields.type_of_project ||
          m.raw_fields['Type of project'] ||
          m.raw_fields.typeOfProject ||
          m.raw_fields.type
        )) || null,
      ];
      const text = String(candidates.find((c) => c) || '').toLowerCase().trim();
      if (!text) return 'Others';
      if (text.includes('mining') || text.includes('mineral') || text.includes('quarry')) return 'Mining Project';
      if (text.includes('energy') || text.includes('power') || text.includes('hydro') || text.includes('solar') || text.includes('geothermal') || text.includes('wind')) return 'Energy Project';
      if (text.includes('agro') || text.includes('industrial') || text.includes('agri') || text.includes('plantation') || text.includes('farm')) return 'Agro Industrial Project';
      if (text.includes('road') || text.includes('highway') || text.includes('bridge') || text.includes('infrastructure')) return 'Road Project';
      if (text.includes('epr')) return 'EPR';
      if (text.includes('irrig') || text.includes('water') || text.includes('dam') || text.includes('river')) return 'Irrigation Project';
      return 'Others';
    };

    (records || []).forEach((m) => {
      const cat = detectProjectCategory(m);
      const regionRaw = m.region || deriveRawRegion(m) || 'Unknown';
      const region = String(canonicalRegion(regionRaw) || regionRaw || 'Unknown');
      if (!countsByRegion[region]) {
        countsByRegion[region] = categories.reduce((acc, c) => ({ ...acc, [c]: 0 }), { TOTAL: 0 });
      }
      if (totals.hasOwnProperty(cat)) totals[cat] += 1;
      else totals['Others'] += 1;

      if (countsByRegion[region].hasOwnProperty(cat)) countsByRegion[region][cat] += 1;
      else countsByRegion[region]['Others'] += 1;
      countsByRegion[region].TOTAL = Object.keys(countsByRegion[region]).filter((k) => k !== 'TOTAL').reduce((s, k) => s + Number(countsByRegion[region][k] || 0), 0);
    });

    totals.TOTAL = Object.keys(totals).filter((k) => k !== 'TOTAL').reduce((s, k) => s + Number(totals[k] || 0), 0);
    return { categories, countsByRegion, totals };
  };

  // Pending-specific project type summary — categories match "Final List of All Pending CP Applications.xlsx"
  // Summary per project sheet: Government Projects | Mining/Mineral | Energy | Forest Management |
  // EPR | Research | Road projects | Sand and Gravel | Irrigation | Livelihood | Eco-Tourism | FLGMA | Telecom | Carbon Trading
  const computePendingProjectTypeSummaryRows = (records = []) => {
    const categories = [
      'Government Projects',
      'Mining/ Mineral processing project',
      'Energy Project',
      'Forest Management project',
      'EPR',
      'Research project',
      'Road projects',
      'Sand and Gravel',
      'Irrigation project',
      'Livelihood Programs',
      'Eco-Tourism Project',
      'FLGMA',
      'Telecommunication',
      'Carbon Trading',
      'Tree Cutting project',
      'Plantation/Pearl project',
      'Water System Project',
      'Others',
    ];
    const totals = categories.reduce((acc, c) => ({ ...acc, [c]: 0 }), {});
    const countsByRegion = {};

    const detectPendingCategory = (m) => {
      if (!m) return 'Others';
      const candidates = [
        m.typeOfProject, m.type_of_project, m.type, m.projectType,
        m.natureOfProject, m.nature_of_project,
        (m.raw_fields && (
          m.raw_fields.type_of_project ||
          m.raw_fields['Type of Project'] ||
          m.raw_fields.typeOfProject
        )) || null,
      ];
      const text = String(candidates.find((c) => c) || '').toLowerCase().trim();
      if (!text) return 'Others';
      if (text.includes('government') || text.includes('gov')) return 'Government Projects';
      if (text.includes('sand') || text.includes('gravel') || text.includes('quarry') && !text.includes('mining')) return 'Sand and Gravel';
      if (text.includes('mining') || text.includes('mineral')) return 'Mining/ Mineral processing project';
      if (text.includes('carbon') || text.includes('carbon trading')) return 'Carbon Trading';
      if (text.includes('telecommun') || text.includes('telecom') || text.includes('tower')) return 'Telecommunication';
      if (text.includes('flgma') || text.includes('grazing management')) return 'FLGMA';
      if (text.includes('tree cutting')) return 'Tree Cutting project';
      if (text.includes('pearl') || text.includes('plantation')) return 'Plantation/Pearl project';
      if (text.includes('water system')) return 'Water System Project';
      if (text.includes('eco-tourism') || text.includes('ecotourism') || text.includes('eco tourism') || text.includes('resort') || text.includes('tourism')) return 'Eco-Tourism Project';
      if (text.includes('livelihood') || text.includes('livestock') || text.includes('agri') && !text.includes('agro') || text.includes('organic') || text.includes('crops')) return 'Livelihood Programs';
      if (text.includes('irrig') || text.includes('dam') || text.includes('multipurpose')) return 'Irrigation project';
      if (text.includes('road') || text.includes('highway') || text.includes('bridge') || text.includes('infrastructure')) return 'Road projects';
      if (text.includes('research') || text.includes('study') || text.includes('feasibility')) return 'Research project';
      if (text.includes('epr') || text.includes('priority right')) return 'EPR';
      if (text.includes('forest') || text.includes('ifma') || text.includes('flgm') || text.includes('timber')) return 'Forest Management project';
      if (text.includes('energy') || text.includes('power') || text.includes('hydro') || text.includes('solar') || text.includes('geothermal') || text.includes('wind') || text.includes('electric')) return 'Energy Project';
      return 'Others';
    };

    (records || []).forEach((m) => {
      const cat = detectPendingCategory(m);
      const regionRaw = m.region || deriveRawRegion(m) || 'Unknown';
      const region = String(canonicalRegion(regionRaw) || regionRaw || 'Unknown');
      if (!countsByRegion[region]) {
        countsByRegion[region] = categories.reduce((acc, c) => ({ ...acc, [c]: 0 }), { TOTAL: 0 });
      }
      if (totals.hasOwnProperty(cat)) totals[cat] += 1;
      else totals['Others'] += 1;
      if (countsByRegion[region].hasOwnProperty(cat)) countsByRegion[region][cat] += 1;
      else countsByRegion[region]['Others'] += 1;
      countsByRegion[region].TOTAL = Object.keys(countsByRegion[region]).filter((k) => k !== 'TOTAL').reduce((s, k) => s + Number(countsByRegion[region][k] || 0), 0);
    });

    totals.TOTAL = Object.keys(totals).filter((k) => k !== 'TOTAL').reduce((s, k) => s + Number(totals[k] || 0), 0);
    return { categories, countsByRegion, totals };
  };

  const tabsHeader = (
    <div className="mb-4 -mx-3 px-3 py-2 overflow-x-auto scrollbar-thin">
      <div className="flex items-center gap-3 min-w-max">
        {ONGOING_SUBTABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setOngoingSubTab(t.id); setCurrentPage(1); }}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap',
              ongoingSubTab === t.id ? 'bg-[#0A2D55] text-white shadow-sm' : 'bg-white/10 text-[#0A2D55] hover:bg-white/20'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );

  const isOngoingMapping = (m) => {
    if (!m) return false;
    // explicit flag
    if (m._ongoing === true || String(m._ongoing || '').toLowerCase() === 'true') return true;
    // import collection marker
    if (String(m.importCollection || '').toLowerCase().includes('ongoing')) return true;

    // Robust status-based fallback: edited records may update textual status
    // before/without setting _ongoing consistently in legacy collections.
    const rf = m?.raw_fields || {};
    const statusBlob = String([
      m?.status,
      m?.statusText,
      m?.workflowStatus,
      m?.workflow_status,
      m?.cadtStatus,
      m?.cadt_status,
      rf?.status,
      rf?.statusText,
      rf?.workflow_status,
      rf?.workflowStatus,
      rf?.STATUS,
      rf?.Status,
      rf?.status_of_application,
      rf?.['STATUS OF APPLICATION'],
    ].filter((v) => v !== null && typeof v !== 'undefined').join(' | ')).toLowerCase();

    if (statusBlob.includes('ongoing') || statusBlob.includes('on process') || statusBlob.includes('for processing') || statusBlob.includes('processing') || statusBlob.includes('in progress')) {
      return true;
    }

    // Keep optional legacy switch behavior for older CADT status-only records.
    if (treatStatusAsOngoing) {
      const status = String(m.cadtStatus || m.cadt_status || '').toLowerCase();
      if (status.includes('on process') || status.includes('for processing') || status.includes('processing')) return true;
    }
    return false;
  };

  // Always derive ongoing records by filtering the available `mappings` for
  // items that are explicitly marked as ongoing or come from an ongoing
  // import collection. This is more robust than assuming `selectedCollection`
  // guarantees the mapping contents.
  // If the currently selected collection is an ongoing import collection,
  // treat all loaded mappings as ongoing (the background tagging may not have
  // completed yet). Otherwise, filter by explicit ongoing flags/import markers.
  const isSelectedCollectionOngoing = selectedCollection && String(selectedCollection).toLowerCase().includes('ongoing');
  const isSelectedCollectionPending = selectedCollection && String(selectedCollection).toLowerCase().includes('pending');
  const isSelectedCollectionCPProjects = selectedCollection && String(selectedCollection).toLowerCase() === 'cp_projects';

  // Some imports may include summary/header rows in the same collection.
  // Keep only rows that look like real project entries for summary/table counts.
  const isProjectLikeRecord = (m) => {
    if (!m || typeof m !== 'object') return false;
    const pick = (...vals) => vals.find((v) => v !== null && v !== undefined && String(v).trim() !== '');
    const proponent = pick(
      m.proponent,
      m.nameOfProponent,
      m.name_of_proponent,
      m.applicant,
      m.ongoing && (m.ongoing.proponent || m.ongoing.nameOfProponent || m.ongoing.name_of_proponent),
      m.raw_fields && (
        m.raw_fields.proponent ||
        m.raw_fields.name_of_proponent ||
        m.raw_fields['NAME OF PROPONENT'] ||
        m.raw_fields['Name of Proponent'] ||
        m.raw_fields.applicant
      )
    );
    const projectName = pick(
      m.nameOfProject,
      m.name_of_project,
      m.projectName,
      m.project_name,
      m.ongoing && (m.ongoing.nameOfProject || m.ongoing.name_of_project || m.ongoing.projectName || m.ongoing.project_name),
      m.raw_fields && (
        m.raw_fields.name_of_project ||
        m.raw_fields.project_name ||
        m.raw_fields['NAME OF PROJECT'] ||
        m.raw_fields['Name of Project'] ||
        m.raw_fields.project
      )
    );
    const location = pick(
      m.location,
      m.province,
      m.municipality,
      m.municipalities,
      m.barangays,
      m.raw_fields && (
        m.raw_fields.location ||
        m.raw_fields.province ||
        m.raw_fields.municipality ||
        m.raw_fields['Project Location'] ||
        m.raw_fields['LOCATION'] ||
        m.raw_fields['PROVINCE']
      )
    );
    const dateFiled = pick(
      m.date_filed,
      m.dateFiled,
      m.dateOfApplication,
      m.yearApplied,
      m.raw_fields && (
        m.raw_fields.date_filed ||
        m.raw_fields.dateFiled ||
        m.raw_fields['DATE OF FILING OF CP APPLICATION'] ||
        m.raw_fields['DATE OF APPLICATION'] ||
        m.raw_fields['DATE APPLIED']
      )
    );
    const remarks = pick(
      m.remarks,
      m.statusOfApplication,
      m.workflowStatus,
      m.raw_fields && (
        m.raw_fields.remarks ||
        m.raw_fields['STATUS OF APPLICATION'] ||
        m.raw_fields.status_of_application ||
        m.raw_fields['ADO REMARKS STATUS']
      )
    );
    const icc = pick(
      m.icc,
      m.iccs,
      m.raw_fields && (
        m.raw_fields.icc ||
        m.raw_fields.iccs ||
        m.raw_fields['AFFECTED AD/ICC/IP (for CP with ongoing FPIC)'] ||
        m.raw_fields['Affected AD/ICC/IP (for CP with ongoing FPIC)'] ||
        m.raw_fields['AFFECTED ICCs/IPs'] ||
        m.raw_fields['Affected ICCs/IPs']
      )
    );
    return Boolean(proponent || projectName || location || dateFiled || remarks || icc);
  };

  // Filter out summary/filler rows that are just region name repeats with no real data
  const isSummaryFiller = (m) => {
    if (!m) return false;
    const region = String(m.region || m.raw_fields?.region || '').trim();
    const projectName = String(m.nameOfProject || m.name_of_project || m.projectName || m.project_name || m.raw_fields?.['NAME OF PROJECT'] || '').trim();
    
    // If region and project name are identical and both are non-standard region names (not CAR, I-XIII, etc), 
    // it's likely a summary row like "APAYAO | APAYAO" or "BENGUET | BENGUET"
    if (region && projectName && region === projectName) {
      const standardRegions = ['CAR', 'I', 'II', 'III', 'IV', 'IVA', 'IVB', 'V', 'VI', 'VII', 'VI/VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
      if (!standardRegions.includes(region.toUpperCase())) {
        return true; // This is likely a filler row
      }
    }
    return false;
  };
  
  const ongoingRecords = Array.isArray(mappings)
    ? (isSelectedCollectionCPProjects 
        ? mappings.filter((m) => (m._ongoing === true || isExplicitlyOngoing(m)) && isProjectLikeRecord(m))
        : isSelectedCollectionOngoing 
        ? mappings.filter((m) => isProjectLikeRecord(m))
        : mappings.filter((m) => isOngoingMapping(m) && isProjectLikeRecord(m)))
    : [];

  const ongoingSummaryRows = computeSummaryRows(ongoingRecords || []);
  const { categories: ongoingProjectCategories, countsByRegion: ongoingProjectCountsByRegion, totals: ongoingProjectCounts } = computeProjectTypeSummaryRows(ongoingRecords || []);
  const ongoingSummaryTotals = React.useMemo(() => {
    const totals = {
      region: 'Total',
      total: 0,
      issuanceOfWorkOrder: 0,
      preFBIConference: 0,
      conductOfFBI: 0,
      reviewOfFBIReport: 0,
      preFPICConference: 0,
      firstCommunityAssembly: 0,
      secondCommunityAssembly: 0,
      consensusBuildingDecision: 0,
      moaValidationRatificationSigning: 0,
      issuanceResolutionOfConsent: 0,
      reviewByRRT: 0,
      reviewByADOorLAO: 0,
      forComplianceOfFPICTeam: 0,
      cebDeliberation: 0,
    };
    (ongoingSummaryRows || []).forEach((r) => {
      totals.total += Number(r.total || 0);
      totals.issuanceOfWorkOrder += Number(r.issuanceOfWorkOrder || 0);
      totals.preFBIConference += Number(r.preFBIConference || 0);
      totals.conductOfFBI += Number(r.conductOfFBI || 0);
      totals.reviewOfFBIReport += Number(r.reviewOfFBIReport || 0);
      totals.preFPICConference += Number(r.preFPICConference || 0);
      totals.firstCommunityAssembly += Number(r.firstCommunityAssembly || 0);
      totals.secondCommunityAssembly += Number(r.secondCommunityAssembly || 0);
      totals.consensusBuildingDecision += Number(r.consensusBuildingDecision || 0);
      totals.moaValidationRatificationSigning += Number(r.moaValidationRatificationSigning || 0);
      totals.issuanceResolutionOfConsent += Number(r.issuanceResolutionOfConsent || 0);
      totals.reviewByRRT += Number(r.reviewByRRT || 0);
      totals.reviewByADOorLAO += Number(r.reviewByADOorLAO || 0);
      totals.forComplianceOfFPICTeam += Number(r.forComplianceOfFPICTeam || 0);
      totals.cebDeliberation += Number(r.cebDeliberation || 0);
    });

    return totals;
  }, [ongoingSummaryRows, selectedCollection]);

  // Filter ongoing records according to the active ongoing subtab (region tabs)
  const filteredOngoingRecords = React.useMemo(() => {
    if (!Array.isArray(ongoingRecords)) return [];
    const id = String(ongoingSubTab || '').toLowerCase();
    const unfilteredTabs = ['summary', 'summary-per-project', 'denied-by-mgb', 'inactive'];

    // Apply search / region / remarks filtering first (same rules as main list)
    const normalizeSearch = (value) => String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokenVariants = (token) => {
      const t = String(token || '').trim();
      if (!t) return [];
      const variants = new Set([t]);
      if (t.endsWith('ing') && t.length > 4) variants.add(t.slice(0, -3));
      if (t.endsWith('ed') && t.length > 3) variants.add(t.slice(0, -2));
      if (t.endsWith('es') && t.length > 3) variants.add(t.slice(0, -2));
      if (t.endsWith('s') && t.length > 2) variants.add(t.slice(0, -1));
      if (t === 'electric') variants.add('electri');
      if (t === 'pumped') variants.add('pump');
      return Array.from(variants).filter(Boolean);
    };

    const matchesLoose = (value, queryNorm) => {
      const hay = normalizeSearch(value);
      if (!queryNorm) return true;
      if (!hay) return false;
      if (hay.includes(queryNorm)) return true;

      const hayTokens = hay.split(' ').filter(Boolean);
      const qTokens = queryNorm.split(' ').filter((t) => t.length >= 2);
      if (qTokens.length === 0) return hay.includes(queryNorm);

      return qTokens.every((qt) => {
        const variants = tokenVariants(qt);
        return hayTokens.some((ht) => variants.some((v) => ht.includes(v) || v.includes(ht)));
      });
    };

    const query = normalizeSearch(searchQuery);
    console.log('🔍 Ongoing Tab - Search query:', `"${query}"`, 'Records before filter:', ongoingRecords.length);
    
    const prefiltered = ongoingRecords.filter((mapping) => {
      if (!mapping) return false;
      const remarksText = getRemarksText(mapping);
      if (regionFilter !== 'all') {
        const canon = canonicalRegion(mapping.region || '');
        if (canon !== regionFilter) return false;
      }
      if (remarksFilter === 'with' && remarksText === '') return false;
      if (remarksFilter === 'none' && remarksText !== '') return false;
      if (!query) return true;
      const rawFields = mapping?.raw_fields || {};
      const rawSearchText = Object.entries(rawFields)
        .filter(([k]) => /project|proponent|applicant|location|region|province|municipal|barangay|icc|status|application|survey|control|name/i.test(String(k || '')))
        .map(([, v]) => (Array.isArray(v) ? v.join(', ') : String(v || '')))
        .join(' ');

      const rawFieldValuesText = Object.values(rawFields)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .map((v) => String(v || '').trim())
        .filter((v) => v && v !== '-' && v !== '—' && v.toLowerCase() !== 'n/a' && v.toLowerCase() !== 'na')
        .join(' ');

      const topLevelSearchText = Object.entries(mapping)
        .filter(([k, v]) => k !== 'raw_fields' && k !== 'ongoing' && v !== null && typeof v !== 'undefined')
        .map(([, v]) => {
          if (Array.isArray(v)) return v.join(', ');
          if (typeof v === 'object') return '';
          return String(v || '');
        })
        .filter(Boolean)
        .join(' ');

      const candidates = [
        mapping.surveyNumber,
        mapping.controlNumber,
        mapping.region,
        mapping.province,
        mapping.municipality,
        Array.isArray(mapping.municipalities) ? mapping.municipalities.join(', ') : '',
        Array.isArray(mapping.barangays) ? mapping.barangays.join(', ') : '',
        Array.isArray(mapping.icc) ? mapping.icc.join(', ') : '',
        remarksText,
        mapping.proponent || mapping.applicant || mapping.applicantProponent || '',
        mapping.nameOfProject || mapping.projectName || mapping.project_name || '',
        rawSearchText,
        rawFieldValuesText,
        topLevelSearchText,
      ];

      return candidates.some((value) => matchesLoose(value, query));
    });

    console.log('🔍 Ongoing Tab - After search filter:', prefiltered.length);
    if (query && prefiltered.length > 0) {
      console.log('🔍 Ongoing Tab - Sample match:', {
        surveyNumber: prefiltered[0].surveyNumber,
        proponent: prefiltered[0].proponent || prefiltered[0].applicant,
        region: prefiltered[0].region
      });
    }

    // If tab is unfiltered global view, return prefiltered list
    if (unfilteredTabs.includes(id)) return prefiltered;

    const getPendingBucketStrict = (rec) => {
      const explicitRegion =
        rec?.region ||
        rec?.raw_fields?.REGION ||
        rec?.raw_fields?.Region ||
        rec?.raw_fields?.region ||
        deriveRawRegion(rec) ||
        '';

      const explicitBucket =
        toPendingRegionBucket(detectRegionSheet(explicitRegion)) ||
        toPendingRegionBucket(canonicalRegion(explicitRegion)) ||
        toPendingRegionBucket(explicitRegion);

      if (explicitBucket) return explicitBucket;

      // Use province fallback only when explicit region is missing.
      const provinceFallback = rec?.province || rec?.raw_fields?.PROVINCE || rec?.raw_fields?.Province || rec?.raw_fields?.province || '';
      return (
        toPendingRegionBucket(detectRegionSheet(provinceFallback)) ||
        toPendingRegionBucket(canonicalRegion(provinceFallback)) ||
        toPendingRegionBucket(provinceFallback) ||
        ''
      );
    };

    // Handle CAR explicitly
    if (id === 'car') {
      return prefiltered.filter((rec) => {
        const candidate = deriveRawRegion(rec) || rec.region || '';
        const d = detectRegionSheet(candidate);
        const bucket =
          toPendingRegionBucket(d) ||
          toPendingRegionBucket(canonicalRegion(candidate)) ||
          toPendingRegionBucket(candidate) ||
          toPendingRegionBucket(rec?.province || rec?.raw_fields?.PROVINCE || rec?.raw_fields?.Province || '');
        return bucket === 'CAR';
      });
    }

    // Handle combined region 6/7
    if (id === 'region6-7') {
      return prefiltered.filter((rec) => {
        const candidate = deriveRawRegion(rec) || rec.region || '';
        const d = detectRegionSheet(candidate);
        const bucket =
          toPendingRegionBucket(d) ||
          toPendingRegionBucket(canonicalRegion(candidate)) ||
          toPendingRegionBucket(candidate) ||
          toPendingRegionBucket(rec?.province || rec?.raw_fields?.PROVINCE || rec?.raw_fields?.Province || '');
        return bucket === 'VI/VII';
      });
    }

    // Generic Region N tabs (e.g. region1 -> Region I, region4a -> Region IV-A)
    const m = id.match(/^region(\d{1,2})([abAB])?$/);
    if (m) {
      const n = Number(m[1]);
      const suffix = m[2] ? String(m[2]).toUpperCase() : null;
      const romanMap = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
      const label = (n === 4 && suffix) ? `Region IV-${suffix}` : `Region ${romanMap[n - 1]}`;
      return prefiltered.filter((rec) => {
        const candidate = deriveRawRegion(rec) || '';
        const recCanon = canonicalRegion(candidate) || '';
        if (recCanon === label) return true;
        const dTop = detectRegionSheet(rec.region || candidate);
        const dOngoing = rec && rec.ongoing ? detectRegionSheet(rec.ongoing.region || candidate) : null;
        if (dTop === label || dOngoing === label) return true;
        const raw = String(candidate || '').toUpperCase();
        if (!raw) return false;
        try {
          const labelUpper = label.toUpperCase();
          const esc = labelUpper.replace(/[\\^$.*+?()\[\]{}|]/g, '\\$&');
          const re = new RegExp(`\\b${esc}\\b`);
          if (re.test(raw)) return true;
        } catch (e) {
          if (raw === label.toUpperCase()) return true;
        }
        const numMatch = raw.match(/\\b(\\d{1,2})(?:\\s*[-–]?\\s*[ABab])?\\b/);
        if (numMatch) return Number(numMatch[1]) === n;
        return false;
      });
    }

    // Fallback: return prefiltered
    return prefiltered;
  }, [ongoingRecords, ongoingSubTab, searchQuery, regionFilter, remarksFilter]);

  // Helper: return a single-line compact header (truncate if too long)
  const compactHeaderDisplay = (text) => {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (s.length <= 40) return s;
    return `${s.slice(0, 37).trim()}...`;
  };

  const getOngoingField = (m, key) => {
    const formatVal = (val) => {
      if (val === null || typeof val === 'undefined' || val === '') return null;
      if (Array.isArray(val)) return val.length ? val.join(', ') : null;
      return String(val);
    };

    // Fast-path: if the App attached a canonical `_display` object, prefer those values
    try {
      if (m && m._display && typeof m._display === 'object') {
        if (key === 'location' && m._display.location) return formatVal(m._display.location);
        if ((key === 'iccs' || key === 'icc') && m._display.iccs) return formatVal(m._display.iccs);
        if ((key === 'proponent' || key === 'applicant') && m._display.proponent) return formatVal(m._display.proponent);
        if (key === 'surveyNumber' && m._display.surveyNumber) return formatVal(m._display.surveyNumber);
      }
    } catch (e) {
      // ignore display fallback errors
    }

    const tryGet = (obj, k) => {
      if (!obj || !k) return null;
      if (Object.prototype.hasOwnProperty.call(obj, k)) return formatVal(obj[k]);
      return null;
    };

    // Debugging helper: when resolving proponent/applicant, collect candidate checks
    const probeKeys = new Set(['proponent', 'applicant']);

    const tryGetFromOngoing = (mobj, k) => {
      try {
        if (!mobj || !mobj.ongoing) return null;
        const od = mobj.ongoing;
        if (Object.prototype.hasOwnProperty.call(od, k)) return formatVal(od[k]);
        return null;
      } catch (e) {
        return null;
      }
    };

    // Build normalized lookup from mapping keys -> values, including nested `ongoing` keys
    const normalizedMap = {};
    Object.keys(m || {}).forEach((orig) => {
      try {
        normalizedMap[normalizeHeader(orig)] = m[orig];
      } catch (e) {
        // ignore
      }
    });
    try {
      if (m && m.ongoing && typeof m.ongoing === 'object') {
        Object.keys(m.ongoing).forEach((orig) => {
          try {
            const nk = normalizeHeader(orig);
            if (!normalizedMap[nk]) normalizedMap[nk] = m.ongoing[orig];
          } catch (e) {
            // ignore
          }
        });
      }
    } catch (e) {
      // ignore
    }

    // Quick heuristic: if resolving `proponent` prefer explicit name variants
    // from nested `ongoing`, top-level name fields, or raw_fields before
    // falling back to shorter tokens that may be import artifacts.
    try {
      if ((key === 'proponent' || key === 'applicant')) {
        const preferCandidates = [];
        if (m && m.ongoing && typeof m.ongoing === 'object') {
          preferCandidates.push(m.ongoing.nameOfProponent || m.ongoing.name_of_proponent || m.ongoing.name_of_proponent || m.ongoing.nameOfProponent);
        }
        preferCandidates.push(m && (m.nameOfProponent || m.name_of_proponent || m.applicantProponent || m.applicant_proponent || m.applicantName || m.applicant_name));
        // raw_fields may contain original CSV header variants
        try {
          if (m && m.raw_fields && typeof m.raw_fields === 'object') {
            const rf = m.raw_fields;
            const candidateKeys = ['name_of_proponent', 'name of proponent', 'name_of_proponent', 'proponent', 'applicantproponent', 'applicant_proponent'];
            for (const ck of candidateKeys) {
              if (!ck) continue;
              const safe = String(ck).trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '_').toLowerCase();
              if (Object.prototype.hasOwnProperty.call(rf, safe) && rf[safe]) preferCandidates.push(rf[safe]);
            }
          }
        } catch (e) {
          // ignore
        }

        for (const pc of preferCandidates) {
          try {
            const s = formatVal(pc);
            if (s && typeof s === 'string' && s.length > 2 && !/^[A-Za-z0-9_-]{20}$/.test(s)) return s;
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore heuristic errors
    }

    const seek = (desiredKeys) => {
      const probe = probeKeys.has(key);
      const tested = [];
      const isShort = (v) => (typeof v === 'string' && String(v || '').trim().length <= 2);
      const logReturn = (stage, val) => {
        if (probe) console.log('getOngoingField probe', { id: m && m.id, key, stage, val, tested, normalizedKeys: Object.keys(normalizedMap || {}), raw_fields: m && m.raw_fields });
        return val;
      };
      for (const dk of desiredKeys) {
        if (!dk) continue;
        // direct
        const v1 = tryGet(m, dk);
        if (v1) {
          // skip values that are exactly the document id or look like a doc id
          tested.push({ stage: 'direct', dk, value: v1 });
          if (typeof v1 === 'string' && m && m.id && String(v1) === String(m.id)) {
            // ignore accidental id values
          } else if (typeof v1 === 'string' && /^[A-Za-z0-9_-]{20}$/.test(v1)) {
            // likely a Firestore doc id or random token; ignore
          } else if (isShort(v1)) {
            // ignore very short tokens (import artifacts)
          } else {
            return logReturn('direct', v1);
          }
        }
        // nested ongoing object
        const v1ongo = tryGetFromOngoing(m, dk);
        if (v1ongo) {
          tested.push({ stage: 'ongoing', dk, value: v1ongo });
          if (typeof v1ongo === 'string' && m && m.id && String(v1ongo) === String(m.id)) {
            // ignore
          } else if (typeof v1ongo === 'string' && /^[A-Za-z0-9_-]{20}$/.test(v1ongo)) {
            // ignore
          } else if (isShort(v1ongo)) {
            // ignore very short tokens
          } else {
            return logReturn('ongoing', v1ongo);
          }
        }
        // sanitized variant (underscored)
        const s = sanitizeFieldName(dk);
        const v2 = tryGet(m, s);
        if (v2) {
          tested.push({ stage: 'sanitized', dk: s, value: v2 });
          if (typeof v2 === 'string' && m && m.id && String(v2) === String(m.id)) {
            // ignore
          } else if (typeof v2 === 'string' && /^[A-Za-z0-9_-]{20}$/.test(v2)) {
            // ignore
          } else if (isShort(v2)) {
            // ignore
          } else {
            return logReturn('sanitized', v2);
          }
        }
        const v2ongo = tryGetFromOngoing(m, s);
        if (v2ongo) {
          tested.push({ stage: 'sanitized_ongoing', dk: s, value: v2ongo });
          if (typeof v2ongo === 'string' && m && m.id && String(v2ongo) === String(m.id)) {
            // ignore
          } else if (typeof v2ongo === 'string' && /^[A-Za-z0-9_-]{20}$/.test(v2ongo)) {
            // ignore
          } else if (isShort(v2ongo)) {
            // ignore
          } else {
            return logReturn('sanitized_ongoing', v2ongo);
          }
        }
        // normalized header match
        const nk = normalizeHeader(dk);
        if (normalizedMap[nk]) {
          const candidate = formatVal(normalizedMap[nk]);
          tested.push({ stage: 'normalized', dk: nk, value: candidate });
          if (candidate) {
            if (typeof candidate === 'string' && m && m.id && String(candidate) === String(m.id)) {
              // ignore doc id values
            } else if (typeof candidate === 'string' && /^[A-Za-z0-9_-]{20}$/.test(candidate)) {
              // likely a UID or doc id, ignore
            } else if (isShort(candidate)) {
              // ignore short tokens
            } else {
              return logReturn('normalized', candidate);
            }
          }
        }
        // Check preserved raw_fields if present (exact CSV column values)
        try {
          if (m && m.raw_fields && typeof m.raw_fields === 'object') {
            // also try a snake_case variant of the desired key (e.g. typeOfProject -> type_of_project)
            const snake = String(dk || '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/\s+/g, '_').toLowerCase();
            const candidateKeys = [
              dk,
              s,
              nk,
              dk.replace(/\s+/g, '_').toLowerCase(),
              snake,
            ];
            for (const ck of candidateKeys) {
              if (!ck) continue;
              const safe = String(ck).trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '_').toLowerCase();
              if (Object.prototype.hasOwnProperty.call(m.raw_fields, safe) && m.raw_fields[safe]) {
                const cand = String(m.raw_fields[safe] || '').trim();
                if (cand.length <= 2) continue;
                return cand;
              }
            }
          }
        } catch (e) {
          // ignore raw_fields lookup errors
        }
        // Additional heuristic: some imports use unexpected headers like
        // 'project location', 'project_location', 'affected_iccs', etc.
        try {
          if (m && m.raw_fields && typeof m.raw_fields === 'object') {
            const rfKeys = Object.keys(m.raw_fields || {}).map((k) => String(k || '').toLowerCase());
            // project location variants — only for location keys
            const isLocationKey = dk.toLowerCase().includes('location') || key === 'location';
            if (isLocationKey && rfKeys.some((k) => k.includes('project') && k.includes('location'))) {
              const k = rfKeys.find((k) => k.includes('project') && k.includes('location'));
              if (k && m.raw_fields[k]) return String(m.raw_fields[k]);
            }
            // icc variants — only for icc/iccs keys
            const isIccKey = dk.toLowerCase().includes('icc') || key === 'iccs' || key === 'icc';
            if (isIccKey && rfKeys.some((k) => k.includes('icc') || k.includes('affected_icc') || k.includes('affected_iccs') || k.includes('affected_iccs/ips') || k.includes('affected_iccs_ips'))) {
              const matches = rfKeys.filter((k) => k.includes('icc') || k.includes('affected_icc') || k.includes('affected_iccs') || k.includes('affected_iccs/ips') || k.includes('affected_iccs_ips'));
              const vals = [];
              matches.forEach((mk) => {
                const v = m.raw_fields[mk];
                if (v) vals.push(String(v));
              });
              if (vals.length) return vals.join(', ');
            }
            // region fallback — only for region keys
            const isRegionKey = dk.toLowerCase().includes('region') || key === 'region';
            if (isRegionKey && rfKeys.some((k) => k === 'region' || k === 'sheet' || k.includes('region'))) {
              const k = rfKeys.find((k) => k === 'region' || k === 'sheet' || k.includes('region'));
              if (k && m.raw_fields[k]) return String(m.raw_fields[k]);
            }
          }
        } catch (e) {
          // ignore
        }
        // try compacted key (letters+digits only)
        const ck = compactHeader(dk);
        for (const orig of Object.keys(m || {})) {
          if (compactHeader(orig) === ck) return formatVal(m[orig]);
        }
        // also check nested ongoing compacted keys
        try {
          if (m && m.ongoing && typeof m.ongoing === 'object') {
            for (const orig of Object.keys(m.ongoing || {})) {
              if (compactHeader(orig) === ck) return formatVal(m.ongoing[orig]);
            }
          }
        } catch (e) {
          // ignore
        }
      }
      return null;
    };

    // Common mappings for friendly keys
    switch (key) {
      case 'proponent': return seek(['proponent', 'applicant', 'applicantProponent', 'applicant_proponent']) || '-';
      case 'nameOfProject': return seek(['nameOfProject', 'projectName', 'name', 'title']) || '-';
      case 'typeOfProject': return seek(['typeOfProject', 'type_of_project', 'Type of project', 'Type_of_project', 'type of project', 'natureOfProject', 'nature', 'projectType']) || '-';
      case 'location': return seek(['location', 'projectLocation', 'project_location', 'project location', 'location_full', 'province', 'provinceName']) || '-';
      case 'area': {
        // Prefer ongoing-specific project area fields if present
        try {
          if (m && m.ongoing && typeof m.ongoing === 'object') {
            const od = m.ongoing;
            const areaCandidates = ['project_area_in_hectares', 'projectAreaInHectares', 'project_area', 'projectArea', 'project area', 'project_area_ha', 'area_in_hectares'];
            for (const c of areaCandidates) {
              if (Object.prototype.hasOwnProperty.call(od, c) && od[c] !== null && typeof od[c] !== 'undefined' && String(od[c]).trim() !== '') return formatVal(od[c]);
            }
          }
        } catch (e) {
          // ignore
        }
        return seek(['totalArea', 'area', 'area_ha', 'projectArea']) || '-';
      }
      case 'ancestral': return seek(['affectedAncestralDomain', 'affected_ancestral_domain_s', 'affected_ancestral_domains', 'Affected Ancestral Domain/s', 'ancestralDomain', 'ancestral_domains']) || '-';
      case 'iccs': return seek(['iccs', 'icc', 'affectedICC', 'affected_icc', 'Affected ICCs/IPs', 'affected_iccs', 'affected_iccs_ips', 'affected_iccs/ips', 'affectedIccsIps', 'affectedIccs', 'affected_icc_ips']) || '-';
      case 'dateOfApplication': return seek(['dateOfApplication', 'date_of_application', 'date']) || '-';
      default: {
        // try direct, then normalized/compacted matches
        const v = seek([key]);
        if (v) return v;
        const nk = normalizeHeader(key);
        if (normalizedMap[nk]) return formatVal(normalizedMap[nk]);
        // fallback: find any mapping key that includes the desired normalized key
        for (const orig of Object.keys(m || {})) {
          const on = normalizeHeader(orig);
          if (on.includes(nk) || nk.includes(on)) {
            const fv = formatVal(m[orig]);
            if (fv) return fv;
          }
        }

        // FINAL FALLBACK: return the first non-empty raw field value from the document
        // (exclude internal/meta fields) so the UI shows the actual CSV content.
        const metaKeys = new Set(['id', '_ongoing', 'importCollection', 'import_batch_id', 'import_batch', 'imported_at', 'source_sheet']);
        for (const orig of Object.keys(m || {})) {
          if (metaKeys.has(orig)) continue;
          const fv = formatVal(m[orig]);
          if (!fv) continue;
          if (typeof fv === 'string' && m && m.id && String(fv) === String(m.id)) continue;
          if (typeof fv === 'string' && /^[A-Za-z0-9_-]{20}$/.test(fv)) continue;
          return fv;
        }

        // Additional explicit fallbacks for common top-level variants not caught above
        try {
          if (key === 'location') {
            const candidates = ['projectLocation', 'project_location', 'project location', 'location_full', 'locationFull'];
            for (const c of candidates) {
              if (Object.prototype.hasOwnProperty.call(m, c) && m[c]) return formatVal(m[c]);
              if (m.ongoing && Object.prototype.hasOwnProperty.call(m.ongoing, c) && m.ongoing[c]) return formatVal(m.ongoing[c]);
            }
          }
          if (key === 'iccs') {
            const candidates = ['affectedIccsIps', 'affected_iccs_ips', 'affected_iccs', 'affectedIccs', 'affected_icc_ips', 'affected_icc'];
            const vals = [];
            for (const c of candidates) {
              if (Object.prototype.hasOwnProperty.call(m, c) && m[c]) vals.push(formatVal(m[c]));
              if (m.ongoing && Object.prototype.hasOwnProperty.call(m.ongoing, c) && m.ongoing[c]) vals.push(formatVal(m.ongoing[c]));
            }
            if (vals.length) return vals.join(', ');
          }
        } catch (e) {
          // ignore
        }

        return '-';
      }
    }
  };

  const getBarangaysFull = (mapping) => (
    formatListFull(mapping.barangays)
  );

  useEffect(() => {
    // Mount a portal target for the FAB so it stays fixed to the viewport
    setFabMounted(true);

    if (!alert) return;
    const timeoutId = setTimeout(() => setAlert(null), 10_000);
    return () => clearTimeout(timeoutId);
  }, [alertTick, alert]);

  // Refs to table containers so we can align the FAB
  const ongoingContainerRef = useRef(null);
  const approvedContainerRef = useRef(null);

  // Compute a right offset so the FAB visually aligns with the ongoing table's right edge
  useEffect(() => {
    const updateFabOffset = () => {
      try {
        const containerRef = activeTab === 'ongoing' ? ongoingContainerRef : approvedContainerRef;
        if (activeTab === 'ongoing' || activeTab === 'mappings') {
          if (containerRef && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const desiredRight = Math.max(8, Math.round(window.innerWidth - rect.right) + 16);
            setFabRightPx(desiredRight);
            return;
          }
        }
        setFabRightPx(32);
      } catch (e) {
        setFabRightPx(32);
      }
    };

    // Attach listeners to window and any scrollable descendants inside the ongoing container
    const scrollableEls = [];
    const addScrollListeners = () => {
      // window
      window.addEventListener('resize', updateFabOffset);
      window.addEventListener('scroll', updateFabOffset, true);

      // find scrollable descendants (overflow auto/scroll)
      try {
        const activeContainer = (activeTab === 'ongoing' ? ongoingContainerRef : approvedContainerRef);
        if (activeContainer && activeContainer.current) {
          const descendants = Array.from(activeContainer.current.querySelectorAll('*'));
          descendants.forEach((el) => {
            try {
              const style = window.getComputedStyle(el);
              const overflowX = style.getPropertyValue('overflow-x');
              const overflowY = style.getPropertyValue('overflow-y');
              if (overflowX === 'auto' || overflowX === 'scroll' || overflowY === 'auto' || overflowY === 'scroll') {
                el.addEventListener('scroll', updateFabOffset, { passive: true });
                scrollableEls.push(el);
              }
            } catch (e) {
              // ignore
            }
          });
        }
      } catch (e) {
        // ignore
      }
    };

    updateFabOffset();
    addScrollListeners();

    return () => {
      window.removeEventListener('resize', updateFabOffset);
      window.removeEventListener('scroll', updateFabOffset, true);
      scrollableEls.forEach((el) => {
        try { el.removeEventListener('scroll', updateFabOffset); } catch (e) { /* ignore */ }
      });
    };
  }, [activeTab, ongoingSubTab, mappings]);

  useEffect(() => {
    if (!externalAlert) return;
    const timeoutId = setTimeout(() => onClearExternalAlert(), 10_000);
    return () => clearTimeout(timeoutId);
  }, [externalAlert, externalAlertTick, onClearExternalAlert]);

  useEffect(() => {
    if (!shouldShowFab && fabOpen) {
      setFabOpen(false);
    }
  }, [shouldShowFab, fabOpen]);

  // If the selected import collection appears to be an 'ongoing' collection,
  // switch the active tab so the collection's records are displayed in Ongoing.
  useEffect(() => {
    try {
      if (selectedCollection) {
        const lower = String(selectedCollection).toLowerCase();
        // If the collection name contains 'ongoing' switch to ongoing
        if (lower.includes('ongoing')) {
          console.log('Dashboard: selectedCollection indicates ongoing -> switching activeTab to ongoing');
          setActiveTab('ongoing');
        } else {
          // Otherwise, check availableCollections metadata to see if this
          // collection is marked as an ongoing import (type === 'ongoing')
          try {
            const meta = (Array.isArray(availableCollections) && availableCollections.find((c) => c.collectionName === selectedCollection)) || null;
            if (meta && String(meta.type || '').toLowerCase() === 'ongoing') {
              console.log('Dashboard: selectedCollection metadata indicates ongoing -> switching activeTab to ongoing', selectedCollection);
              setActiveTab('ongoing');
            }
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }, [selectedCollection]);

  // Filter mappings based on search query
  const regionOptions = React.useMemo(() => {
    const set = new Set();
    mappings.forEach((m) => {
      if (m.region) set.add(canonicalRegion(m.region) || m.region);
    });
    const ordered = REGION_SHEETS.filter((r) => set.has(r));
    const extras = Array.from(set).filter((r) => !REGION_SHEETS.includes(r)).sort();
    return [{ value: 'all', label: 'All Regions' }, ...ordered.map((r) => ({ value: r, label: r })), ...extras.map((r) => ({ value: r, label: r }))];
  }, [mappings]);

  const remarksOptions = React.useMemo(() => ([
    { value: 'all', label: 'All Remarks' },
    { value: 'with', label: 'With Remarks' },
    { value: 'none', label: 'No Remarks' },
  ]), []);

  console.log('🔍 Approved/Records Tab - Total records:', mappings.length, 'Search query:', `"${searchQuery}"`);
  
  const filteredMappings = mappings.filter((mapping) => {
    // Special handling for cp_projects unified table
    if (isSelectedCollectionCPProjects && activeTab === 'mappings') {
      // For cp_projects, 'mappings' tab shows Approved status
      const status = String(mapping.status || '').toLowerCase();
      if (status !== 'approved') return false;
    }
    
    // Hide mappings marked as ongoing or imported into an 'ongoing' collection
    // from the main mappings (Approved) view
    if (activeTab === 'mappings' && mapping && !isSelectedCollectionCPProjects) {
      if (mapping._ongoing === true || String(mapping._ongoing || '').toLowerCase() === 'true') return false;
      const ic = String(mapping.importCollection || '').toLowerCase();
      if (ic && ic.includes('ongoing')) return false;
    }
    const query = searchQuery.toLowerCase();
    // If an approved subtab is active and is region-specific, apply subtab filtering
    const approvedId = String(approvedSubTab || '').toLowerCase();
    const unfilteredApprovedTabs = ['summary', 'summary-per-project', 'denied-by-mgb', 'inactive'];
    if (!unfilteredApprovedTabs.includes(approvedId)) {
      // Handle CAR
      if (approvedId === 'car') {
        const candidate = deriveRawRegion(mapping) || mapping.region || '';
        const d = detectRegionSheet(candidate);
        const v = String(candidate || '').toUpperCase();
        if (!(d === 'CAR' || v.includes('CORDILLERA') || v.includes('CAR'))) return false;
      } else if (approvedId === 'region6-7') {
        const candidate = deriveRawRegion(mapping) || mapping.region || '';
        const d = detectRegionSheet(candidate);
        if (!(d === 'Region VI' || d === 'Region VII')) return false;
      } else if (approvedId.startsWith('region')) {
        // map regionN to Region N or Region IV-A/IV-B
        const regionMap = {
          region1: 'Region I', region2: 'Region II', region3: 'Region III', region4a: 'Region IV-A', region4b: 'Region IV-B', region5: 'Region V', region9: 'Region IX', region10: 'Region X', region11: 'Region XI', region12: 'Region XII', region13: 'Region XIII'
        };
        if (Object.prototype.hasOwnProperty.call(regionMap, approvedId)) {
          const candidate = deriveRawRegion(mapping) || mapping.region || '';
          const d = detectRegionSheet(candidate);
          if (d !== regionMap[approvedId]) return false;
        }
      }
    } else {
      if (regionFilter !== 'all' && canonicalRegion(mapping.region) !== regionFilter) return false;
    }
    const remarksText = getRemarksText(mapping);
    if (remarksFilter === 'with' && remarksText === '') return false;
    if (remarksFilter === 'none' && remarksText !== '') return false;
    const safe = (v) => {
      if (v === null || typeof v === 'undefined') return '';
      if (Array.isArray(v)) return v.join(', ');
      return String(v);
    };

    return (
      safe(mapping.surveyNumber).toLowerCase().includes(query) ||
      safe(mapping.region).toLowerCase().includes(query) ||
      safe(mapping.province).toLowerCase().includes(query) ||
      safe(mapping.municipality).toLowerCase().includes(query) ||
      safe(mapping.municipalities).toLowerCase().includes(query) ||
      safe(mapping.barangays).toLowerCase().includes(query) ||
      safe(mapping.icc).toLowerCase().includes(query) ||
      safe(remarksText).toLowerCase().includes(query) ||
      safe(mapping.proponent || mapping.applicant || mapping.applicantProponent || mapping.nameOfProject || mapping.projectName).toLowerCase().includes(query)
    );
  });

  console.log('🔍 Approved/Records Tab - Filtered results:', filteredMappings.length);
  if (searchQuery && filteredMappings.length > 0) {
    console.log('🔍 Approved/Records Tab - Sample match:', {
      surveyNumber: filteredMappings[0].surveyNumber,
      proponent: filteredMappings[0].proponent || filteredMappings[0].applicant,
      region: filteredMappings[0].region
    });
  }

  // Pagination calculations
  const totalPages = Math.ceil(filteredMappings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMappings = filteredMappings.slice(startIndex, endIndex);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Reset page when switching tabs so pagination stays consistent
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Paginate ongoing records separately (use the same `currentPage` and itemsPerPage)
  const ongoingTotalPages = Math.max(1, Math.ceil(((filteredOngoingRecords && filteredOngoingRecords.length) || 0) / itemsPerPage));
  const ongoingStart = (currentPage - 1) * itemsPerPage;
  const ongoingEnd = ongoingStart + itemsPerPage;
  const paginatedOngoing = Array.isArray(filteredOngoingRecords) ? filteredOngoingRecords.slice(ongoingStart, ongoingEnd) : [];

  // Approved Summary aggregation helper
  const computeApprovedSummaryRows = (mappings) => {
    if (!Array.isArray(mappings)) return [];

    // Normalize any region string to the canonical short form used in the Excel summary
    // e.g. "R13", "Region XIII", "Region 13", "REGION 13" → "13"
    //      "Region IV-A", "IVA", "4-A" → "4A"
    //      "Region VI/VII", "6&7", "R6/7" → "6&7"
    //      "CORDILLERA", "CAR" → "CAR"
    const normalizeRegion = (raw) => {
      if (!raw) return 'Unknown';
      const v = String(raw).trim();
      const up = v.toUpperCase().replace(/[\u2013\u2014]/g, '-');
      if (up.includes('CORDILLERA') || up === 'CAR' || up.startsWith('CAR')) return 'CAR';
      // Region 6&7 / 6/7 variants
      if (/6\s*[&/|]\s*7|VI\s*[/|&]\s*VII/.test(up)) return '6&7';
      // Roman numeral with A/B suffix: Region IV-A, IVA, 4-A, 4A
      const romanToNum = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13 };
      const romanSuffix = up.match(/(?:REGION\s*)?(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\s*-?\s*(A|B)\b/);
      if (romanSuffix) { const n = romanToNum[romanSuffix[1]]; return n ? `${n}${romanSuffix[2]}` : v; }
      // Roman numeral without suffix
      const roman = up.match(/(?:REGION\s*)?(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/);
      if (roman) { const n = romanToNum[roman[1]]; return n ? String(n) : v; }
      // Arabic: "Region 13", "R13", "13", "4A", "4-A"
      const arabic = up.match(/(?:REGION\s+|\bR)(\d{1,2})\s*-?\s*(A|B)?$/) || up.match(/^(\d{1,2})\s*-?\s*(A|B)?$/);
      if (arabic) {
        const n = Number(arabic[1]);
        if (n >= 1 && n <= 13) return arabic[2] ? `${n}${arabic[2]}` : String(n);
      }
      return v;
    };

    // Deduplicate by control/survey number to remove records imported multiple times.
    // Each re-import creates new Firestore docs with different auto-IDs but same content.
    // No dedup needed — extra non-region sheets (ExtractiveMining Companies, etc.)
    // are now blocked at import time in cpProjectsService.js, so all records in
    // Firestore are clean and unique. Using all records directly.
    const uniqueMappings = mappings;
    console.debug('[CP Summary] Total records:', mappings.length);
    const regionMap = {};

    const parseCost = (raw) => {
      if (raw === null || typeof raw === 'undefined') return 0;
      try {
        const s = String(raw || '').replace(/[^0-9.\-]/g, '');
        if (!s) return 0;
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : 0;
      } catch (e) { return 0; }
    };

    const getTypeString = (m) => {
      try {
        // Check top-level mapped fields first (from App.jsx mappingsFormat)
        const topCandidates = ['typeOfProject', 'type_of_project', 'natureOfProject', 'type', 'projectType'];
        for (const c of topCandidates) {
          if (m && m[c]) return String(m[c]);
        }
        // Then check raw_fields
        if (m && m.raw_fields) {
          const rf = m.raw_fields;
          const candidates = ['Type of project', 'typeOfProject', 'type_of_project', 'type', 'natureOfProject', 'nature', 'projectType'];
          for (const c of candidates) {
            if (Object.prototype.hasOwnProperty.call(rf, c) && rf[c]) return String(rf[c]);
            if (Object.prototype.hasOwnProperty.call(rf, c.toLowerCase()) && rf[c.toLowerCase()]) return String(rf[c.toLowerCase()]);
          }
        }
      } catch (e) { }
      try { return String(renderCellForHeader(m, 'Type of project') || ''); } catch (e) { return ''; }
    };

    const getRegionString = (m) => {
      try {
        if (m && m.region) return normalizeRegion(String(m.region));
        if (m && m.raw_fields) {
          const rf = m.raw_fields;
          if (rf.region) return normalizeRegion(String(rf.region));
          const keys = Object.keys(rf || {});
          const k = keys.find(k => String(k).toLowerCase().includes('region'));
          if (k) return normalizeRegion(String(rf[k]));
        }
      } catch (e) { }
      return 'Unknown';
    };

    for (const m of uniqueMappings) {
      const region = String(getRegionString(m) || 'Unknown').trim() || 'Unknown';
      if (!Object.prototype.hasOwnProperty.call(regionMap, region)) {
        regionMap[region] = { mining: 0, energy: 0, dam: 0, epr: 0, quarry: 0, agro: 0, infra: 0, other: 0, total: 0, cost: 0 };
      }
      const row = regionMap[region];
      const typeRaw = String(getTypeString(m) || '').toLowerCase();
      // Try all sources for cost and pick the first non-zero result.
      // Some records have project_cost only in raw_fields; others only at top level.
      const costCandidates = [
        m.projectCost,
        m['Project Cost'],
        m && m.raw_fields && m.raw_fields['project_cost'],
        m && m.raw_fields && m.raw_fields['Project Cost'],
        m && m.raw_fields && m.raw_fields['project cost'],
      ];
      const cost = costCandidates.reduce((best, raw) => {
        if (best !== 0) return best;
        const v = parseCost(raw);
        return v !== 0 ? v : 0;
      }, 0);

      if (/mining|mineral/.test(typeRaw)) { row.mining += 1; }
      else if (/energy|power|solar|wind|geothermal|hydro|electric|renewable|biomass|biogas|run.of.river|mini.hydro|natural.gas|lng|coal|petroleum|transmission|generation|photovoltaic|pv.plant|wpp|hpp|gpp/.test(typeRaw)) { row.energy += 1; }
      else if (/\bdam\b/.test(typeRaw)) { row.dam += 1; }
      else if (/\bepr\b|environmental/.test(typeRaw)) { row.epr += 1; }
      else if (/quarry/.test(typeRaw)) { row.quarry += 1; }
      else if (/agro|plantation|livelihood|tourism/.test(typeRaw)) { row.agro += 1; }
      else if (/infrastructure|road|bridge|irrigation|telecom|\bwater\b|telecommunication/.test(typeRaw)) { row.infra += 1; }
      else { row.other += 1; console.debug('[CP Summary] unmatched type →', JSON.stringify(typeRaw), 'region:', region); }

      row.total += 1;
      row.cost += Number(cost || 0);
    }

    // Fixed order matching the Excel file: CAR first, then regions 1-13 numerically
    const REGION_ORDER = ['CAR','1','2','3','4A','4B','5','6&7','7','8','9','10','11','12','13'];
    const regionSortKey = (r) => {
      const idx = REGION_ORDER.indexOf(r);
      return idx >= 0 ? idx : 99 + r.charCodeAt(0);
    };
    const rows = Object.keys(regionMap).sort((a, b) => regionSortKey(a) - regionSortKey(b)).map((region) => ({ Region: region, ...regionMap[region] }));
    // totals row
    const totals = rows.reduce((acc, r) => {
      acc.mining += r.mining; acc.energy += r.energy; acc.dam += r.dam; acc.epr += r.epr; acc.quarry += r.quarry; acc.agro += r.agro; acc.infra += r.infra; acc.other += r.other; acc.total += r.total; acc.cost += r.cost; return acc;
    }, { Region: 'TOTAL', mining: 0, energy: 0, dam: 0, epr: 0, quarry: 0, agro: 0, infra: 0, other: 0, total: 0, cost: 0 });
    rows.push(totals);

    // Map to objects keyed by the header labels so rendering is simple
    const mapped = rows.map((r) => ({
      [APPROVED_SUMMARY_HEADERS[0]]: r.Region,
      [APPROVED_SUMMARY_HEADERS[1]]: r.mining,
      [APPROVED_SUMMARY_HEADERS[2]]: r.energy,
      [APPROVED_SUMMARY_HEADERS[3]]: r.dam,
      [APPROVED_SUMMARY_HEADERS[4]]: r.epr,
      [APPROVED_SUMMARY_HEADERS[5]]: r.quarry,
      [APPROVED_SUMMARY_HEADERS[6]]: r.agro,
      [APPROVED_SUMMARY_HEADERS[7]]: r.infra,
      [APPROVED_SUMMARY_HEADERS[8]]: r.other,
      [APPROVED_SUMMARY_HEADERS[9]]: r.total,
      [APPROVED_SUMMARY_HEADERS[10]]: Number(r.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    }));

    return mapped;
  };

  const isApprovedSummaryView = (activeTab === 'mappings' && String(approvedSubTab || '').toLowerCase() === 'summary');
  const approvedSummaryRows = isApprovedSummaryView ? computeApprovedSummaryRows(filteredMappings) : [];
  const rowsToRender = isApprovedSummaryView ? approvedSummaryRows : paginatedMappings;

  // Pending records (detection by status/_pending/pending flag) with subtabs
  // Track which records get filtered out
  const pendingRecordsAll = Array.isArray(mappings)
    ? (isSelectedCollectionCPProjects
        ? (() => {
            const filtered = mappings.filter((m) => {
            const worksheetNo = String(
              m?.worksheet_no ||
              m?.worksheetNo ||
              m?.no ||
              m?.raw_fields?.NO ||
              m?.raw_fields?.No ||
              m?.raw_fields?.no ||
              ''
            ).trim();
            const hasLegacyControlNo = /[A-Za-z]/.test(worksheetNo);
            if (!isPendingMapping(m)) return false;
            if (isExplicitlyOngoingOrApproved(m)) return false;
            if (hasLegacyControlNo) return false;
            if (isSummaryFiller(m)) return false;
            return isProjectLikeRecord(m);
          });
            return filtered;
          })()
        : isSelectedCollectionPending 
        ? (() => {
            const filtered = mappings.filter((m) => {
            const worksheetNo = String(
              m?.worksheet_no ||
              m?.worksheetNo ||
              m?.no ||
              m?.raw_fields?.NO ||
              m?.raw_fields?.No ||
              m?.raw_fields?.no ||
              ''
            ).trim();
            const isPendingWorkbookNo = /^(\d+|[-—])$/.test(worksheetNo);
            const hasLegacyControlNo = /[A-Za-z]/.test(worksheetNo);
            if (hasLegacyControlNo) return false;

            const rawRegion = deriveRawRegion(m) || m?.region || m?.province || m?.raw_fields?.PROVINCE || m?.raw_fields?.Province || m?.raw_fields?.province || '';
            const detectedRegion = String(
              detectRegionSheet(rawRegion) ||
              canonicalRegion(rawRegion) ||
              rawRegion ||
              ''
            ).toUpperCase().trim();

            const validPendingRegion = [
              'CAR', 'REGION I', 'REGION II', 'REGION III', 'REGION IV-A', 'REGION IV-B',
              'REGION V', 'REGION VI', 'REGION VII', 'REGION IX', 'REGION X', 'REGION XI',
              'REGION XII', 'REGION XIII', 'I', 'II', 'III', 'IVA', 'IVB', 'V', 'VI/VII',
              'IX', 'X', 'XI', 'XII', 'XIII', '1', '2', '3', '4A', '4B', '5', '6', '7', '6&7', '9', '10', '11', '12', '13'
            ].includes(detectedRegion) || Boolean(toPendingRegionBucket(detectedRegion) || toPendingRegionBucket(rawRegion));

            if (isSummaryFiller(m)) return false;
            return (isPendingWorkbookNo && validPendingRegion) || (validPendingRegion && isProjectLikeRecord(m));
          });
            return filtered;
          })()
        : mappings.filter((m) => isPendingMapping(m) && !isSummaryFiller(m) && isProjectLikeRecord(m)))
    : [];

  const filteredPendingRecords = React.useMemo(() => {
    if (!Array.isArray(pendingRecordsAll)) return [];
    const id = String(pendingSubTab || '').toLowerCase();
    const unfilteredTabs = ['summary', 'summary-per-project'];

    const normalizeSearch = (value) => String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokenVariants = (token) => {
      const t = String(token || '').trim();
      if (!t) return [];
      const variants = new Set([t]);
      if (t.endsWith('ing') && t.length > 4) variants.add(t.slice(0, -3));
      if (t.endsWith('ed') && t.length > 3) variants.add(t.slice(0, -2));
      if (t.endsWith('es') && t.length > 3) variants.add(t.slice(0, -2));
      if (t.endsWith('s') && t.length > 2) variants.add(t.slice(0, -1));
      if (t === 'electric') variants.add('electri');
      if (t === 'pumped') variants.add('pump');
      return Array.from(variants).filter(Boolean);
    };

    const matchesLoose = (value, queryNorm) => {
      const hay = normalizeSearch(value);
      if (!queryNorm) return true;
      if (!hay) return false;
      if (hay.includes(queryNorm)) return true;

      const hayTokens = hay.split(' ').filter(Boolean);
      const qTokens = queryNorm.split(' ').filter((t) => t.length >= 2);
      if (qTokens.length === 0) return hay.includes(queryNorm);

      return qTokens.every((qt) => {
        const variants = tokenVariants(qt);
        return hayTokens.some((ht) => variants.some((v) => ht.includes(v) || v.includes(ht)));
      });
    };

    const query = normalizeSearch(searchQuery);
    const prefiltered = pendingRecordsAll.filter((mapping) => {
      if (!mapping) return false;
      const remarksText = getRemarksText(mapping);
      if (regionFilter !== 'all') {
        const canon = canonicalRegion(mapping.region || '');
        if (canon !== regionFilter) return false;
      }
      if (remarksFilter === 'with' && remarksText === '') return false;
      if (remarksFilter === 'none' && remarksText !== '') return false;
      if (!query) return true;
      const rawFields = mapping?.raw_fields || {};
      const pendingProjectText = String(
        mapping.nameOfProject ||
        mapping.name_of_project ||
        mapping.projectName ||
        mapping.project_name ||
        rawFields['NAME OF PROJECT'] ||
        rawFields['Name of Project'] ||
        rawFields.name_of_project ||
        rawFields.project_name ||
        ''
      ).toLowerCase();
      const pendingProponentText = String(
        mapping.proponent ||
        mapping.applicant ||
        mapping.applicantProponent ||
        rawFields['NAME OF PROPONENT'] ||
        rawFields['Name of Proponent'] ||
        rawFields.name_of_proponent ||
        rawFields.proponent ||
        ''
      );

      const rawSearchText = Object.entries(rawFields)
        .filter(([k]) => /project|proponent|applicant|location|region|province|municipal|barangay|icc|status|application|survey|control|name/i.test(String(k || '')))
        .map(([, v]) => (Array.isArray(v) ? v.join(', ') : String(v || '')))
        .join(' ');

      const rawFieldValuesText = Object.values(rawFields)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .map((v) => String(v || '').trim())
        .filter((v) => v && v !== '-' && v !== '—' && v.toLowerCase() !== 'n/a' && v.toLowerCase() !== 'na')
        .join(' ');

      const topLevelSearchText = Object.entries(mapping)
        .filter(([k, v]) => k !== 'raw_fields' && k !== 'ongoing' && v !== null && typeof v !== 'undefined')
        .map(([, v]) => {
          if (Array.isArray(v)) return v.join(', ');
          if (typeof v === 'object') return '';
          return String(v || '');
        })
        .filter(Boolean)
        .join(' ');

      const candidates = [
        mapping.surveyNumber,
        mapping.controlNumber,
        mapping.region,
        mapping.province,
        mapping.municipality,
        Array.isArray(mapping.municipalities) ? mapping.municipalities.join(', ') : '',
        Array.isArray(mapping.barangays) ? mapping.barangays.join(', ') : '',
        Array.isArray(mapping.icc) ? mapping.icc.join(', ') : '',
        remarksText,
        pendingProponentText,
        pendingProjectText,
        rawSearchText,
        rawFieldValuesText,
        topLevelSearchText,
      ];

      return candidates.some((value) => matchesLoose(value, query));
    });

    const getPendingBucketStrict = (rec) => {
      const explicitRegion =
        rec?.region ||
        rec?.raw_fields?.REGION ||
        rec?.raw_fields?.Region ||
        rec?.raw_fields?.region ||
        deriveRawRegion(rec) ||
        '';

      const explicitBucket =
        toPendingRegionBucket(detectRegionSheet(explicitRegion)) ||
        toPendingRegionBucket(canonicalRegion(explicitRegion)) ||
        toPendingRegionBucket(explicitRegion);

      if (explicitBucket) return explicitBucket;

      const provinceFallback = rec?.province || rec?.raw_fields?.PROVINCE || rec?.raw_fields?.Province || rec?.raw_fields?.province || '';
      return (
        toPendingRegionBucket(detectRegionSheet(provinceFallback)) ||
        toPendingRegionBucket(canonicalRegion(provinceFallback)) ||
        toPendingRegionBucket(provinceFallback) ||
        ''
      );
    };

    console.log('🔍 Pending Tab - After search filter:', prefiltered.length);
    if (query && prefiltered.length > 0) {
      console.log('🔍 Pending Tab - Sample match:', {
        surveyNumber: prefiltered[0].surveyNumber,
        proponent: prefiltered[0].proponent || prefiltered[0].applicant,
        region: prefiltered[0].region,
      });
    }

    // When searching, return global pending matches regardless of selected region subtab.
    if (query) return prefiltered;

    if (unfilteredTabs.includes(id)) return prefiltered;

    // CAR handling
    if (id === 'car') {
      return prefiltered.filter((rec) => {
        const candidate = deriveRawRegion(rec) || rec.region || '';
        const d = detectRegionSheet(candidate);
        if (d === 'CAR') return true;
        const v = String(candidate || '').toUpperCase();
        return v.includes('CORDILLERA') || v.includes('CAR');
      });
    }

    // Combined Region 6/7
    if (id === 'region6-7') {
      return prefiltered.filter((rec) => {
        const bucket = getPendingBucketStrict(rec);
        return bucket === 'VI/VII';
      });
    }

    // Road projects filter
    if (id === 'road-projects') {
      return prefiltered.filter((rec) => {
        const candidate = String(rec.typeOfProject || rec.type_of_project || rec.type || rec.projectType || rec.nameOfProject || rec.projectName || '') || '';
        return candidate.toLowerCase().includes('road');
      });
    }

    // Generic region tabs (region1, region2, ...)
    const regionMap = {
      region1: 'Region I', region2: 'Region II', region3: 'Region III', region4a: 'Region IV-A', region4b: 'Region IV-B', region5: 'Region V', region9: 'Region IX', region10: 'Region X', region11: 'Region XI', region12: 'Region XII', region13: 'Region XIII'
    };
    if (Object.prototype.hasOwnProperty.call(regionMap, id)) {
      const target = regionMap[id]; // e.g. 'Region XI'
      const targetBucketByRegion = {
        'Region I': 'I',
        'Region II': 'II',
        'Region III': 'III',
        'Region IV-A': 'IVA',
        'Region IV-B': 'IVB',
        'Region V': 'V',
        'Region IX': 'IX',
        'Region X': 'X',
        'Region XI': 'XI',
        'Region XII': 'XII',
        'Region XIII': 'XIII',
      };
      const targetBucket = targetBucketByRegion[target] || '';
      return prefiltered.filter((rec) => {
        const bucket = getPendingBucketStrict(rec);
        if (targetBucket && bucket === targetBucket) return true;
        return false;
      });
    }

    return prefiltered;
  }, [pendingRecordsAll, pendingSubTab, searchQuery, regionFilter, remarksFilter]);

  const getPendingWorksheetNo = (m) => String(
    m?.worksheet_no ||
    m?.worksheetNo ||
    m?.no ||
    m?.raw_fields?.NO ||
    m?.raw_fields?.No ||
    m?.raw_fields?.no ||
    ''
  ).trim();

  const pendingSortedRecords = React.useMemo(() => {
    if (!Array.isArray(filteredPendingRecords)) return [];
    const list = [...filteredPendingRecords];
    const dashRank = (v) => (v === '-' || v === '—' ? 1 : 0);

    list.sort((a, b) => {
      const aNo = getPendingWorksheetNo(a);
      const bNo = getPendingWorksheetNo(b);

      const aNum = /^\d+$/.test(aNo) ? Number(aNo) : null;
      const bNum = /^\d+$/.test(bNo) ? Number(bNo) : null;

      if (aNum !== null && bNum !== null && aNum !== bNum) return aNum - bNum;
      if (aNum !== null && bNum === null) return -1;
      if (aNum === null && bNum !== null) return 1;

      const aDash = dashRank(aNo);
      const bDash = dashRank(bNo);
      if (aDash !== bDash) return aDash - bDash;

      if (aNo !== bNo) return aNo.localeCompare(bNo, undefined, { numeric: true, sensitivity: 'base' });

      const aProject = String(a?.nameOfProject || a?.name_of_project || a?.projectName || '').trim();
      const bProject = String(b?.nameOfProject || b?.name_of_project || b?.projectName || '').trim();
      return aProject.localeCompare(bProject, undefined, { numeric: true, sensitivity: 'base' });
    });

    return list;
  }, [filteredPendingRecords]);

  const pendingTotalPages = Math.max(1, Math.ceil(((pendingSortedRecords && pendingSortedRecords.length) || 0) / itemsPerPage));
  const pendingStart = (currentPage - 1) * itemsPerPage;
  const pendingEnd = pendingStart + itemsPerPage;
  const paginatedPending = Array.isArray(pendingSortedRecords) ? pendingSortedRecords.slice(pendingStart, pendingEnd) : [];

  // For summary tabs, exclude filler records and non-project records to show only actual projects
  const projectOnlyPendingRecords = React.useMemo(() => {
    return (filteredPendingRecords || []).filter((m) => !isSummaryFiller(m) && isProjectLikeRecord(m));
  }, [filteredPendingRecords]);

  const pendingSummaryRows = computeSummaryRows(projectOnlyPendingRecords);
  const pendingYearSummaryRows = computeYearSummaryRows(projectOnlyPendingRecords);

  const { categories: pendingProjectCategories, countsByRegion: pendingProjectCountsByRegion, totals: pendingProjectCounts } = computePendingProjectTypeSummaryRows(projectOnlyPendingRecords);
  const pendingYearSummaryRowsDisplay = pendingYearSummaryRows;

  const pendingProjectSummaryDisplay = React.useMemo(() => {
    return {
      categories: pendingProjectCategories,
      countsByRegion: pendingProjectCountsByRegion,
      totals: pendingProjectCounts,
      regionOrder: Object.keys(pendingProjectCountsByRegion || {}).sort(),
    };
  }, [pendingProjectCategories, pendingProjectCountsByRegion, pendingProjectCounts]);

  const pendingSummaryTotals = React.useMemo(() => {
    const totals = {
      region: 'Total',
      total: 0,
      issuanceOfWorkOrder: 0,
      preFBIConference: 0,
      conductOfFBI: 0,
      reviewOfFBIReport: 0,
      preFPICConference: 0,
      firstCommunityAssembly: 0,
      secondCommunityAssembly: 0,
      consensusBuildingDecision: 0,
      moaValidationRatificationSigning: 0,
      issuanceResolutionOfConsent: 0,
      reviewByRRT: 0,
      reviewByADOorLAO: 0,
      forComplianceOfFPICTeam: 0,
      cebDeliberation: 0,
    };
    (pendingSummaryRows || []).forEach((r) => {
      totals.total += Number(r.total || 0);
      totals.issuanceOfWorkOrder += Number(r.issuanceOfWorkOrder || 0);
      totals.preFBIConference += Number(r.preFBIConference || 0);
      totals.conductOfFBI += Number(r.conductOfFBI || 0);
      totals.reviewOfFBIReport += Number(r.reviewOfFBIReport || 0);
      totals.preFPICConference += Number(r.preFPICConference || 0);
      totals.firstCommunityAssembly += Number(r.firstCommunityAssembly || 0);
      totals.secondCommunityAssembly += Number(r.secondCommunityAssembly || 0);
      totals.consensusBuildingDecision += Number(r.consensusBuildingDecision || 0);
      totals.moaValidationRatificationSigning += Number(r.moaValidationRatificationSigning || 0);
      totals.issuanceResolutionOfConsent += Number(r.issuanceResolutionOfConsent || 0);
      totals.reviewByRRT += Number(r.reviewByRRT || 0);
      totals.reviewByADOorLAO += Number(r.reviewByADOorLAO || 0);
      totals.forComplianceOfFPICTeam += Number(r.forComplianceOfFPICTeam || 0);
      totals.cebDeliberation += Number(r.cebDeliberation || 0);
    });
    return totals;
  }, [pendingSummaryRows]);

  const filteredCollectionsForDropdown = React.useMemo(() => {
    if (!Array.isArray(availableCollections)) return [];
    const isOngoingMarker = (c) => {
      try {
        const type = String(c?.type || '').toLowerCase();
        const name = String(c?.collectionName || '').toLowerCase();
        const display = String(c?.displayName || '').toLowerCase();
        return type === 'ongoing' || name.includes('ongoing') || display.includes('(ongoing)');
      } catch (e) {
        return false;
      }
    };

    if (activeTab === 'ongoing') {
      return availableCollections.filter((c) => c && c.collectionName && isOngoingMarker(c));
    }
    // For Approved (mappings) and other tabs, exclude any 'ongoing' collections
    return availableCollections.filter((c) => c && c.collectionName && !isOngoingMarker(c));
  }, [availableCollections, activeTab]);
  // Debug: log what collections are available for this tab
  useEffect(() => {
    try {
      console.debug('Dashboard: activeTab=', activeTab, 'selectedCollection=', selectedCollection, 'filteredCollectionsForDropdown=', filteredCollectionsForDropdown);
    } catch (e) {
      // ignore
    }
  }, [activeTab, selectedCollection, filteredCollectionsForDropdown]);


  // Keep separate dropdown selections per tab so choosing a collection in Approved
  // doesn't change the visible selection in Ongoing and vice-versa.
  const [dropdownSelections, setDropdownSelections] = useState(() => ({
    mappings: selectedCollection || 'mappings',
    ongoing: (selectedCollection && String(selectedCollection).toLowerCase().includes('ongoing')) ? selectedCollection : '__none__',
    pending: (selectedCollection && String(selectedCollection).toLowerCase().includes('pending')) ? selectedCollection : '__none__',
  }));

  const currentSelectionKey = activeTab === 'ongoing' ? 'ongoing' : (activeTab === 'pending' ? 'pending' : 'mappings');
  const currentSelectionValue = (dropdownSelections && dropdownSelections[currentSelectionKey]) || '';
  const currentSelectionDisplay = (Array.isArray(availableCollections) && availableCollections.find((c) => c.collectionName === currentSelectionValue)?.displayName) || (currentSelectionValue && currentSelectionValue !== '__none__' ? currentSelectionValue : 'Select collection');

  useEffect(() => {
    try {
      if (!selectedCollection) return;
      if (String(selectedCollection).toLowerCase().includes('ongoing')) {
        setDropdownSelections((s) => ({ ...s, ongoing: selectedCollection }));
      } else {
        setDropdownSelections((s) => ({ ...s, mappings: selectedCollection }));
      }
    } catch (e) {
      // ignore
    }
  }, [selectedCollection]);

  // Ensure dropdown shows a sensible default when collections are available
  useEffect(() => {
    try {
      // If ongoing dropdown has no selection but there are ongoing collections, pick the first
      if (Array.isArray(filteredCollectionsForDropdown)) {
        if (filteredCollectionsForDropdown.length > 0 && (!dropdownSelections || !dropdownSelections.ongoing || dropdownSelections.ongoing === '__none__')) {
          const first = filteredCollectionsForDropdown[0];
          if (first && first.collectionName) setDropdownSelections((s) => ({ ...s, ongoing: first.collectionName }));
        }
        // For mappings dropdown, default to 'mappings' if unset
        if (!dropdownSelections || !dropdownSelections.mappings) {
          setDropdownSelections((s) => ({ ...s, mappings: selectedCollection || 'mappings' }));
        }
      }
    } catch (e) {
      // ignore
    }
  }, [filteredCollectionsForDropdown]);

  // When the active tab changes, load the stored dropdown selection for that tab.
  useEffect(() => {
    try {
      const key = activeTab === 'ongoing' ? 'ongoing' : (activeTab === 'pending' ? 'pending' : 'mappings');
      const value = dropdownSelections[key];
      if (!value || value === '__none__') return;
      if (typeof onSelectCollection === 'function') {
        // Only trigger load if App hasn't already selected the same collection
        // Defensive: don't call onSelectCollection('mappings') when switching to ongoing
        if ((activeTab === 'ongoing' || activeTab === 'pending') && String(value) === 'mappings') {
          console.log('Dashboard: skipping invalid selection value="mappings" for ongoing/pending tab');
          return;
        }

        if (!selectedCollection || String(selectedCollection) !== String(value)) {
          console.log('Dashboard: activeTab changed -> calling onSelectCollection with', value, { activeTab, selectedCollection });
          onSelectCollection(value);
        } else {
          console.log('Dashboard: activeTab changed -> selectedCollection already matches', selectedCollection);
        }
      }
    } catch (e) {
      // ignore
    }
  }, [activeTab]);

  // If user switches to Ongoing but no mappings are loaded yet, try to load
  // the stored ongoing collection (or the first available) so the table isn't empty.
  useEffect(() => {
    try {
      if (activeTab !== 'ongoing' && activeTab !== 'pending') return;
      // If there are already mappings loaded, do nothing
      if (Array.isArray(mappings) && mappings.length > 0) return;

      let desired = null;
      if (activeTab === 'ongoing') {
        desired = (dropdownSelections && dropdownSelections.ongoing && dropdownSelections.ongoing !== '__none__')
          ? dropdownSelections.ongoing
          : (Array.isArray(filteredCollectionsForDropdown) && filteredCollectionsForDropdown[0] ? filteredCollectionsForDropdown[0].collectionName : null);

        // If the desired/current selection is the generic 'mappings' but no mappings
        // are loaded, prefer any available ongoing collection (first in list).
        if (String(desired).toLowerCase() === 'mappings' && Array.isArray(filteredCollectionsForDropdown) && filteredCollectionsForDropdown.length > 0) {
          const firstOngoing = filteredCollectionsForDropdown.find((c) => String(c.collectionName || '').toLowerCase().includes('ongoing')) || filteredCollectionsForDropdown[0];
          if (firstOngoing && firstOngoing.collectionName) desired = firstOngoing.collectionName;
        }
      } else if (activeTab === 'pending') {
        desired = (dropdownSelections && dropdownSelections.pending && dropdownSelections.pending !== '__none__')
          ? dropdownSelections.pending
          : (Array.isArray(filteredCollectionsForDropdown) && filteredCollectionsForDropdown[0] ? filteredCollectionsForDropdown[0].collectionName : null);
      }

      if (!desired) return;

      if (!selectedCollection || String(selectedCollection) !== String(desired)) {
        console.log(`Dashboard: activeTab is ${activeTab} and no mappings loaded — loading`, desired);
        if (typeof onSelectCollection === 'function') onSelectCollection(desired);
      } else {
        console.log(`Dashboard: activeTab is ${activeTab} but selectedCollection already matches`, selectedCollection);
        // If selectedCollection is 'mappings' but there are no mappings yet, and we're on ongoing,
        // try to load a real ongoing collection if available.
        if (activeTab === 'ongoing' && Array.isArray(mappings) && mappings.length === 0 && String(selectedCollection).toLowerCase() === 'mappings' && Array.isArray(filteredCollectionsForDropdown) && filteredCollectionsForDropdown.length > 0) {
          const fallback = filteredCollectionsForDropdown.find((c) => String(c.collectionName || '').toLowerCase().includes('ongoing')) || filteredCollectionsForDropdown[0];
          if (fallback && fallback.collectionName && typeof onSelectCollection === 'function' && String(fallback.collectionName) !== String(selectedCollection)) {
            console.log('Dashboard: fallback loading ongoing collection ->', fallback.collectionName);
            onSelectCollection(fallback.collectionName);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }, [activeTab, dropdownSelections, filteredCollectionsForDropdown, mappings, selectedCollection]);

  // Reset to page 1 when search query changes
  const handleSearch = (value) => {
    console.log('🔍 Dashboard Search:', `"${value}"`, 'Length:', value.length);
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

  const sanitizeFieldName = (s) => (
    String(s || '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9_]/g, '_')
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

  // Return true if the mapping's region should show action buttons
  const isActionableRegion = (regionValue) => {
    if (!regionValue) return false;
    const detected = detectRegionSheet(regionValue) || String(regionValue || '').trim();
    // Allow CAR explicitly
    if (String(detected).toUpperCase().includes('CAR')) return true;

    // Try to extract numeral and optional suffix (A/B)
    const m = String(detected).match(/([IVXLCM]+)(?:\s*[-–]?\s*([AB]))?/i);
    const romanToNumber = (r) => {
      const map = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13 };
      return map[String(r || '').toUpperCase()] || null;
    };
    if (m) {
      const roman = m[1];
      const suffix = m[2] ? m[2].toUpperCase() : null;
      const num = romanToNumber(roman);
      if (num) {
        const key = suffix ? `${num}${suffix}` : String(num);
        const allowed = new Set(['1', '2', '3', '4A', '4B', '5', '6', '7', '8', '9', '10', '11', '12', '13']);
        return allowed.has(key);
      }
    }

    // Fallback: check numeric digits in the region string
    const digits = String(regionValue).match(/(\d{1,2})/);
    if (digits) {
      const n = Number(digits[1]);
      if (n >= 1 && n <= 13) return true;
    }
    return false;
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

    let parsedRecordsCount = 0;
    try {
      setIsImporting(true);
      setImportProgress(5);
      const fileName = String(file.name || '').toLowerCase();
      setImportSourceFileName(String(file.name || ''));
      const isCsv = fileName.endsWith('.csv') || String(file.type || '').toLowerCase() === 'text/csv';
      let wb;
      if (isCsv) {
        // Read CSV as text and parse into a workbook using XLSX.read
        // (xlsx-js-style doesn't expose csv_to_sheet; read CSV as string instead)
        const text = await file.text();
        wb = XLSX.read(text, { type: 'string', cellDates: true });
      } else {
        const buffer = await file.arrayBuffer();
        wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      }
      const headerKeywords = [
        'survey',
        'number',
        'no.',
        'control',
        'control number',
        'applicant',
        'proponent',
        'applicant/proponent',
        'name of project',
        'project',
        'location',
        'province',
        'municipality',
        'barangay',
        'area',
        'icc',
        'iccs',
        'cadt',
        'remarks',
        'region',
        'sheet',
        'year',
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

        console.log(`🔍 Header detection - Best match: row ${bestIndex}, matches: ${bestMatches}, nonEmpty: ${bestNonEmpty}`);
        if (bestIndex >= 0 && bestIndex < 10) {
          console.log(`🔍 Header row candidates (first 10 rows):`, allRows.slice(0, 10).map((r, i) => ({
            row: i,
            score: scoreHeaderRow(r),
            cells: r.slice(0, 5)
          })));
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

      const buildRecordsFromRows = (rows, sheetName, sourceName) => {
        const headerRowIndex = findHeaderRowIndex(rows);
        if (headerRowIndex === -1) return { records: [], rawRecords: [], error: 'no-header', sheetName };

        const headerRowOriginal = rows[headerRowIndex].map((h) => String(h || '').trim());

        console.log(`📋 Sheet "${sheetName}" - Header row found at index ${headerRowIndex}`);
        console.log(`📋 Sheet "${sheetName}" - Headers:`, headerRowOriginal);

        // Build rawRecords and records in a single pass for performance
        const rawRecords = [];

        // Use schema-based field mapping (header tokens, not indexes)
        const fieldMap = mapHeadersToFields(headerRowOriginal);

        // Require at least one core field to be mapped. If none are found,
        // attempt a safe fallback: build documents using the raw headers as keys
        // so differently-formatted sheets still produce previewable records.
        const hasCoreField = (
          fieldMap.control_number !== undefined ||
          fieldMap.survey_number !== undefined ||
          fieldMap.applicant_proponent !== undefined ||
          fieldMap.name_of_project !== undefined
        );

        if (!hasCoreField) {
          console.warn(`⚠️ Sheet "${sheetName}" - No core fields mapped, applying raw-header fallback.`, { fieldMap, headers: headerRowOriginal });
          // Build fallback documents directly from rawRecords, mapping sanitized header names
          const fallbackRecords = rawRecords.map((r) => {
            const doc = { rawFallback: true };
            for (let i = 0; i < headerRowOriginal.length; i += 1) {
              const key = sanitizeFieldName(headerRowOriginal[i] || `col_${i}`);
              const val = r[key];
              // preserve arrays/strings as-is
              doc[key] = (typeof val === 'string' && val.indexOf(',') >= 0) ? val.split(',').map((s) => s.trim()).filter(Boolean) : val;
            }
            // include sheet metadata so UI can show sensible region/source
            try {
              doc.source_sheet = sheetName;
              const detected = detectRegionSheet(sheetName);
              doc.region = detected || sheetName;
            } catch (e) {
              /* ignore */
            }
            return doc;
          }).filter((d) => Object.keys(d).length > 0);

          if (fallbackRecords.length === 0) {
            return { records: [], rawRecords, error: 'invalid-headers', sheetName, found: headerRowOriginal };
          }

          console.log(`✅ Sheet "${sheetName}" - Fallback created ${fallbackRecords.length} records from raw headers`);
          return { records: fallbackRecords, rawRecords, error: null, sheetName, fallback: true };
        }

        console.log(`✅ Sheet "${sheetName}" - Core fields found, proceeding with import`);

        // Detect region from sheet name, source filename, or by scanning the first rows
        let fallbackRegion = '';
        try {
          const sheetDetected = detectRegionSheet(sheetName);
          const sourceDetected = sourceName ? detectRegionSheet(sourceName) : null;
          if (sheetDetected) fallbackRegion = sheetDetected;
          else if (sourceDetected) fallbackRegion = sourceDetected;
          else {
            // Scan first few rows for any cell that looks like a region label
            outer: for (let r = 0; r < Math.min(10, rows.length); r += 1) {
              const row = rows[r] || [];
              for (let c = 0; c < row.length; c += 1) {
                const cell = String(row[c] || '').trim();
                if (!cell) continue;
                const d = detectRegionSheet(cell);
                if (d) { fallbackRegion = d; break outer; }
              }
            }
          }
        } catch (e) {
          fallbackRegion = '';
        }
        if (!fallbackRegion) fallbackRegion = (sheetName && sheetName.toLowerCase() !== 'sheet1') ? sheetName : '';

        // Generate batch ID for this import
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const records = [];
        for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
          const row = rows[r] || [];
          const rawObj = {};
          for (let i = 0; i < headerRowOriginal.length; i += 1) {
            const key = headerRowOriginal[i];
            if (row[i] instanceof Date) {
              rawObj[key] = row[i]; // keep as Date; parseDate in schema will handle it
            } else {
              rawObj[key] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
            }
          }
          rawRecords.push(rawObj);

          // Build Firestore document using schema; also pass original header names
          // so the document contains a `raw_fields` object with exact CSV values.
          const doc = buildFirestoreDocument(row, fieldMap, sheetName, batchId, headerRowOriginal);
          if (!doc.region) doc.region = fallbackRegion;
          if (isValidRow(doc)) records.push(doc);
        }

        console.log(`✅ Sheet "${sheetName}" - Imported ${records.length} records`);

        return { records, rawRecords, headers: headerRowOriginal, error: null, sheetName };
      };

      const allRecords = [];
      const invalidSheets = [];
      const skipSheets = new Set(['summary', 'summary per year', 'summary per project']);
      const dataSheets = wb.SheetNames.filter((sheetName) => {
        if (!sheetName) return false;
        const sn = String(sheetName || '').trim().toLowerCase();
        // Skip exact matches or any sheet containing "summary"
        if (skipSheets.has(sn) || sn.includes('summary')) return false;
        const ws = wb.Sheets[sheetName];
        if (!ws) return false;
        const wsRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        return wsRows.some((row) => row.some((cell) => String(cell || '').trim() !== ''));
      });

      const totalSheets = dataSheets.length || 1;

      const rawSheets = [];
      dataSheets.forEach((sheetName, index) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;
        const wsRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        const { records, error, rawRecords, headers: sheetHeaders } = buildRecordsFromRows(wsRows, sheetName);
        if (error) {
          invalidSheets.push(sheetName);
        } else {
          allRecords.push(...records);
          if (rawRecords && rawRecords.length) rawSheets.push({ sheetName, rawRecords, headers: sheetHeaders || [] });
        }

        const progress = 10 + Math.round(((index + 1) / totalSheets) * 70);
        setImportProgress(progress);
      });

      // Keep summary sheets in raw import payload so cp_projects importer can
      // read pending caps from the Summary sheet, while still skipping these
      // sheets for direct row parsing into preview/import docs.
      const summarySheetNames = wb.SheetNames.filter((sheetName) => String(sheetName || '').toLowerCase().includes('summary'));
      summarySheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;
        const wsRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!Array.isArray(wsRows) || wsRows.length === 0) return;

        const maxScan = Math.min(wsRows.length, 80);
        let headerRowIndex = 0;
        let bestNonEmpty = -1;
        for (let i = 0; i < maxScan; i += 1) {
          const row = wsRows[i] || [];
          const nonEmpty = row.filter((cell) => String(cell || '').trim() !== '').length;
          if (nonEmpty > bestNonEmpty) {
            bestNonEmpty = nonEmpty;
            headerRowIndex = i;
          }
        }

        const headerRowOriginal = (wsRows[headerRowIndex] || []).map((h, idx) => {
          const label = String(h || '').trim();
          return label || `__col_${idx}`;
        });

        const rawRecords = [];
        for (let r = headerRowIndex + 1; r < wsRows.length; r += 1) {
          const row = wsRows[r] || [];
          const rawObj = {};
          for (let i = 0; i < headerRowOriginal.length; i += 1) {
            const key = headerRowOriginal[i];
            const value = row[i];
            rawObj[key] = value !== undefined && value !== null ? value : '';
          }
          rawRecords.push(rawObj);
        }

        if (rawRecords.length > 0 && !rawSheets.some((s) => s.sheetName === sheetName)) {
          rawSheets.push({ sheetName, rawRecords, headers: headerRowOriginal });
        }
      });

      parsedRecordsCount = allRecords.length;
      if (parsedRecordsCount === 0) {
        const sheetNote = invalidSheets.length > 0 ? ` Sheets without headers: ${invalidSheets.join(', ')}.` : '';
        setAlertTick((t) => t + 1);
        setAlert({ type: 'error', message: `No valid rows found to import.${sheetNote}` });
        return;
      }

      setImportProgress(100);
      // parsing finished — show completed progress and hide parsing indicator
      setIsImporting(false);
      // Store prepared Firestore-ready docs so confirmation doesn't re-parse
      setImportPreparedDocs(allRecords);
      // Keep preview records for compatibility/legacy UI (count-only)
      setImportPreviewRecords(allRecords.map((r) => ({ surveyNumber: r.surveyNumber || '', region: r.region || '' })));
      setImportInvalidSheets(invalidSheets);
      setImportRawSheets(rawSheets);
      // suggest a default collection name
      try {
        const uid = user?.uid || 'anon';
        const safeTs = new Date().toISOString().replace(/[:.]/g, '-');
        setImportCollectionName(`mappings_import_${uid}_${safeTs}`);
      } catch (e) {
        setImportCollectionName('mappings_import');
      }
      setShowImportChoiceModal(true);
    } catch (error) {
      console.error('Import failed:', error);
      setAlertTick((t) => t + 1);
      setAlert({ type: 'error', message: error?.message || 'Failed to import Excel file.' });
    } finally {
      setTimeout(() => {
        // keep isImporting true while waiting for user decision; only reset UI if parse failed
        if (parsedRecordsCount === 0) {
          setIsImporting(false);
          setImportProgress(0);
        }
      }, 600);
      event.target.value = '';
    } 
  };

  const handleConfirmImport = async (mode = 'add', collectionName = '') => {
    // mode: 'add' -> merge into existing; 'replace' -> create new set (replace existing)
    const prepared = (importPreparedDocs && importPreparedDocs.length) ? importPreparedDocs : importPreviewRecords;
    if (!prepared || prepared.length === 0) {
      setShowImportChoiceModal(false);
      setIsImporting(false);
      setImportProgress(0);
      return;
    }

    try {
      // Start actual import phase
      setIsImporting(true);
      setImportProgress(1);
      const sourceName = String(importSourceFileName || '').toLowerCase();
      let effectiveActiveTab = activeTab;
      if (sourceName.includes('pending')) {
        effectiveActiveTab = 'pending';
      } else if (sourceName.includes('approved')) {
        effectiveActiveTab = 'mappings';
      } else if (sourceName.includes('ongoing')) {
        effectiveActiveTab = 'ongoing';
      }
      // If user is the NCIP inventory user and is currently on the Ongoing tab,
      // force the import into a dedicated ongoing collection so Approved and
      // Ongoing are stored separately in Firestore.
      let options = { mode, onProgress: (p) => setImportProgress(p), targetTab: effectiveActiveTab, rawImport: importRawSheets, targetCollection: 'cp_projects' };
      try {
        // For unified cp_projects table, just pass activeTab for status assignment.
        // No need to force separate collections - status field handles tab routing.
        if (effectiveActiveTab === 'ongoing') {
          options.forceOngoing = true;
        }
      } catch (e) {
        // ignore
      }
      await onImportMappings(prepared, { ...options, activeTab: effectiveActiveTab }); // Pass effective tab for status assignment
      // If we imported into a dedicated ongoing collection, switch UI to show it
      try {
        const col = options && options.collectionName;
        if (col) {
          const lower = String(col).toLowerCase();
          if (lower.includes('ongoing')) {
            setActiveTab('ongoing');
            if (typeof onSelectCollection === 'function') onSelectCollection(col);
          } else if (lower.includes('pending')) {
            setActiveTab('pending');
            if (typeof onSelectCollection === 'function') onSelectCollection(col);
          }
        }
      } catch (e) {
        // ignore
      }
      setSearchQuery('');
      setRegionFilter('all');
      setRemarksFilter('all');
      setCurrentPage(1);
      const modeMsg = options.mode === 'add' ? 'added' : options.mode === 'replace' ? 'replaced' : (options.mode === 'newCollection' ? 'imported into new collection' : 'processed');
      setAlertTick((t) => t + 1);
      setAlert({ type: 'success', message: `Import successful. ${prepared.length} records ${modeMsg}.` });
    } catch (err) {
      setAlertTick((t) => t + 1);
      setAlert({ type: 'error', message: err?.message || 'Failed to import Excel file.' });
    } finally {
      setShowImportChoiceModal(false);
      setImportPreviewRecords([]);
      setImportInvalidSheets([]);
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
      }, 600);
    }
  };

  const buildExportWorkbook = () => {
    const headers = isInventoryUser
      ? [...NCIP_TABLE_HEADERS, 'Sheet']
      : ['Survey Number', 'Province', 'Municipality', 'Barangays', 'Total Area', 'ICC', 'Remarks', 'Sheet'];
    const rowsBySheet = new globalThis.Map();

    mappings.forEach((m) => {
      const sheet = detectRegionSheet(m.region) || 'Unknown';
      const rows = rowsBySheet.get(sheet) || [];
      if (isInventoryUser) {
        rows.push([
          m.surveyNumber || m.controlNumber || '',
          m.region || '',
          m.controlNumber || m.surveyNumber || '',
          m.proponent || m.applicant || m.applicantProponent || '',
          m.nameOfProject || m.projectName || '',
          m.location || m.province || '',
          m.natureOfProject || m.nature || '',
          m.cadtStatus || m.cadt || '',
          (m.icc && m.icc.length) ? m.icc.join('; ') : '',
          m.yearApproved || m.year || '',
          m.moaDuration || m.moa_duration || '',
          m.communityBenefits || '',
          m.remarks || '',
          sheet,
        ]);
      } else {
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
      }
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
    const defaultName = `records-${new Date().toISOString().split('T')[0]}.xlsx`;
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
    try {
      console.log('Dashboard: handleViewMapping ->', mapping);
    } catch (e) {
      // ignore
    }
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

  const handleNoPendingAction = (action) => {
    try {
      setAlertTick((t) => t + 1);
      setAlert({ type: 'info', message: `No pending record to ${action}.` });
    } catch (e) {
      // ignore
    }
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

  // For the Overview stats, prefer `mainMappings` (the main 'mappings' collection)
  // when supplied by the App. Otherwise fall back to the currently loaded `mappings`.
  const overviewSource = (Array.isArray(mainMappings) && mainMappings.length > 0) ? mainMappings : mappings;

  // Treat any mapping explicitly flagged as ongoing as Ongoing; everything else is Approved.
  // This is a sensible default when imported rows don't include explicit approval/status columns.
  const statsSource = (activeTab === 'overview') ? overviewSource : mappings;
  const ongoingCount = Array.isArray(statsSource) ? statsSource.filter((m) => isOngoingMapping(m)).length : 0;
  const pendingCount = Array.isArray(statsSource) ? statsSource.filter((m) => isPendingMapping(m)).length : 0;
  const approvedCount = Array.isArray(statsSource) ? statsSource.filter((m) => String(m.status || '').toLowerCase() === 'approved').length : 0;

  const stats = {
    totalMappings: (activeTab === 'overview' ? overviewSource : mappings).length,
    regions: new Set((activeTab === 'overview' ? overviewSource : mappings).map((m) => m.region).filter(Boolean)).size,
    approved: approvedCount,
    ongoing: ongoingCount,
    pending: pendingCount,
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


      {/* Import Choice Modal */}
      {showImportChoiceModal && (
        <>
          <div
            className={cn(
              "fixed inset-0 z-[100] transition-all duration-200",
              isImporting ? "" : "animate-in fade-in"
            )}
            style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(3,6,23,0.45)' }}
            onClick={() => {
              // don't close by clicking backdrop to avoid accidental dismissal
            }}
          />

          <div className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[92vw] max-w-md transition-all duration-200",
            "animate-in zoom-in fade-in"
          )}>
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 max-h-[84vh] overflow-hidden">
              <div className="px-4 sm:px-6 py-4 sm:py-5" style={{ backgroundImage: 'linear-gradient(135deg, #0A2D55 0%, #0C3B6E 40%, #0A2D55 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center ring-2 ring-white/25 shadow-xl">
                    <Upload size={22} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Import Excel</h3>
                </div>
              </div>

              <div className="px-4 sm:px-6 py-4 sm:py-5 text-white/90 overflow-y-auto">
                <p className="text-sm mb-2">Found <strong>{(importPreparedDocs && importPreparedDocs.length) || importPreviewRecords.length}</strong> record(s) across the uploaded sheets.</p>
                {importInvalidSheets.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-yellow-200">
                      <div>Sheets with unrecognized format: <strong>{importInvalidSheets.length}</strong></div>
                      <button
                        type="button"
                        onClick={() => setShowInvalidDetails((s) => !s)}
                        className="text-white/70 underline text-[0.7rem]"
                      >
                        {showInvalidDetails ? 'Hide details' : 'Show details'}
                      </button>
                    </div>
                    {showInvalidDetails && (
                      <div className="mt-2 text-[0.75rem] text-yellow-200 leading-snug max-h-28 overflow-auto border border-yellow-200/10 rounded-md p-2 bg-white/2">
                        {importInvalidSheets.join(', ')}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-sm mb-2">Click <strong>Import</strong> to add these records into the existing database.</p>
                <p className="text-xs text-white/70 mb-2">This action appends imported rows and does not overwrite existing records.</p>

 
              </div>

              <div className="px-4 sm:px-6 py-3 border-t border-white/15 flex flex-col items-stretch gap-3 bg-white/5">
                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportChoiceModal(false);
                      setImportPreviewRecords([]);
                      setImportInvalidSheets([]);
                      setIsImporting(false);
                      setImportProgress(0);
                      fileInputRef.current && (fileInputRef.current.value = '');
                    }}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/20 text-white/90 hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConfirmImport('add')}
                    className="flex-1 px-4 py-2 rounded-lg bg-[#0A2D55] text-white hover:bg-[#0C3B6E] transition"
                  >
                    Import
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {isImporting && (
        <div className="fixed z-[119] right-4 top-[88px] w-[min(92vw,360px)] sm:w-96">
          <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl p-3 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between text-xs text-white/80">
              <span>Importing Excel...</span>
              <span>{importProgress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#F2C94C] transition-all"
                style={{ width: `${importProgress}%` }}
              />
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
              <h1 className="text-base sm:text-2xl md:text-[1.6rem] font-bold truncate tracking-tight">CP Inventory System</h1>
              {!isInventoryUser && (
                <p className="text-xs sm:text-sm text-white/80 truncate mt-0.5">
                  {user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'User'} • {user?.email || user?.username || 'Unknown'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onLogout}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition"
            >
              Logout
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="sm:hidden inline-flex items-center justify-center w-10 h-10 bg-white/10 text-white rounded-full transition"
              aria-label="Logout"
            >
              ⎋
            </button>
          </div>

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
                  You are logged in as <span className="font-semibold text-[#F2C94C]">{user.role}</span>. Manage Indigenous Cultural Community records below.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {/* Collection dropdown removed - using unified cp_projects table */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-white/25 transition active:scale-95"
                >
                  <Upload size={16} className="sm:w-4.5 sm:h-4.5" />
                  Upload Excel
                </button>

                {/* Delete All button — shown per active tab */}
                {(activeTab === 'ongoing' || activeTab === 'pending' || activeTab === 'mappings') && (
                  <button
                    type="button"
                    onClick={() => {
                      const status = activeTab === 'ongoing' ? 'Ongoing' : activeTab === 'pending' ? 'Pending' : 'Approved';
                      const label = activeTab === 'ongoing' ? 'Ongoing' : activeTab === 'pending' ? 'Pending' : 'Approved';
                      setDeleteAllDialog({ status, label });
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white ring-1 ring-red-300/30 backdrop-blur-md hover:bg-red-600 transition active:scale-95"
                  >
                    <Trash2 size={16} className="sm:w-4.5 sm:h-4.5" />
                    Delete All {activeTab === 'ongoing' ? 'Ongoing' : activeTab === 'pending' ? 'Pending' : 'Approved'}
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>

              {/* Delete All Confirmation Dialog */}
              {deleteAllDialog && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <Trash2 size={20} className="text-red-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">Delete All {deleteAllDialog.label} Records?</h3>
                        <p className="text-sm text-gray-500 mt-0.5">This will permanently delete ALL {deleteAllDialog.label} records from Firestore. This cannot be undone.</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
                      ⚠️ After deleting, you can re-import a fresh Excel file to restore the data.
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        disabled={deleteAllLoading}
                        onClick={() => setDeleteAllDialog(null)}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={deleteAllLoading}
                        onClick={async () => {
                          setDeleteAllLoading(true);
                          try {
                            const result = await onDeleteAllByStatus(deleteAllDialog.status);
                            setDeleteAllDialog(null);
                            setAlertTick((t) => t + 1);
                            setAlert({ type: 'success', message: `Deleted ${result?.deleted ?? 0} ${deleteAllDialog.label} records. You can now re-import.` });
                          } catch (err) {
                            setAlertTick((t) => t + 1);
                            setAlert({ type: 'error', message: err?.message || 'Failed to delete records.' });
                          } finally {
                            setDeleteAllLoading(false);
                          }
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
                      >
                        {deleteAllLoading ? (
                          <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />Deleting...</>
                        ) : (
                          <>Delete All {deleteAllDialog.label}</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}
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
              aria-label="Overview"
              className={`flex-1 min-w-0 sm:flex-none px-3 sm:px-5 py-3 sm:py-3.5 font-medium text-xs sm:text-base border-b-2 transition whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 ${activeTab === 'overview'
                  ? 'border-[#F2C94C] text-[#0A2D55] bg-[#F2C94C]/10'
                  : 'border-transparent text-[#0A2D55]/70 hover:text-[#0A2D55] hover:bg-[#0A2D55]/5'
                }`}
            >
              <BarChart3 size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="hidden sm:inline">Overview</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('mappings');
                setMobileMenuOpen(false);
              }}
              aria-label="Approved Large Scale"
              className={`flex-1 min-w-0 sm:flex-none px-3 sm:px-5 py-3 sm:py-3.5 font-medium text-xs sm:text-base border-b-2 transition whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 ${activeTab === 'mappings'
                  ? 'border-[#F2C94C] text-[#0A2D55] bg-[#F2C94C]/10'
                  : 'border-transparent text-[#0A2D55]/70 hover:text-[#0A2D55] hover:bg-[#0A2D55]/5'
                }`}
            >
              <MapIcon size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="hidden sm:inline">Approved Large Scale</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('ongoing');
                setMobileMenuOpen(false);
              }}
              aria-label="Ongoing Large Scale"
              className={`flex-1 min-w-0 sm:flex-none px-3 sm:px-5 py-3 sm:py-3.5 font-medium text-xs sm:text-base border-b-2 transition whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 ${activeTab === 'ongoing'
                  ? 'border-[#F2C94C] text-[#0A2D55] bg-[#F2C94C]/10'
                  : 'border-transparent text-[#0A2D55]/70 hover:text-[#0A2D55] hover:bg-[#0A2D55]/5'
                }`}
            >
              <Bell size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="hidden sm:inline">Ongoing Large Scale</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('pending');
                setMobileMenuOpen(false);
              }}
              aria-label="Pending"
              className={`flex-1 min-w-0 sm:flex-none px-3 sm:px-5 py-3 sm:py-3.5 font-medium text-xs sm:text-base border-b-2 transition whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 ${activeTab === 'pending'
                  ? 'border-[#F2C94C] text-[#0A2D55] bg-[#F2C94C]/10'
                  : 'border-transparent text-[#0A2D55]/70 hover:text-[#0A2D55] hover:bg-[#0A2D55]/5'
                }`}
            >
              <Clock size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="hidden sm:inline">Pending</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6 animate-section-1">
            {/* Stats Cards — login palette: navy #0A2D55, #0C3B6E, gold #F2C94C */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-4 sm:p-6 border-l-4 border-[#0A2D55] hover:shadow-xl hover:border-[#0C3B6E] transition animate-header">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[#0A2D55]/70 text-xs sm:text-sm font-medium truncate">Total Records</p>
                    <p className="text-2xl sm:text-4xl font-bold text-[#0A2D55] mt-1 sm:mt-2">{stats.totalMappings}</p>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-[#0A2D55]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#0A2D55]" />
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

              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-4 sm:p-6 border-l-4 border-green-600 hover:shadow-xl transition animate-section-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[#0A2D55]/70 text-xs sm:text-sm font-medium truncate">Approved </p>
                    <p className="text-2xl sm:text-4xl font-bold text-green-700 mt-1 sm:mt-2">{stats.approved}</p>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-4 sm:p-6 border-l-4 border-orange-500 hover:shadow-xl transition animate-section-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[#0A2D55]/70 text-xs sm:text-sm font-medium truncate">Ongoing</p>
                    <p className="text-2xl sm:text-4xl font-bold text-orange-600 mt-1 sm:mt-2">{stats.ongoing}</p>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                  </div>
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-4 sm:p-6 border-l-4 border-violet-600 hover:shadow-xl transition animate-section-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[#0A2D55]/70 text-xs sm:text-sm font-medium truncate">Pending</p>
                    <p className="text-2xl sm:text-4xl font-bold text-violet-700 mt-1 sm:mt-2">{stats.pending}</p>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'pending' && (
          <div className="animate-section-1">
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-header">
              <h2 className="text-lg sm:text-2xl font-bold text-[#0A2D55]">Pending</h2>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="w-full sm:w-[320px] flex items-center gap-2 bg-white border-2 border-[#0A2D55]/10 rounded-xl px-4 py-2.5 hover:border-[#F2C94C]/40 focus-within:border-[#F2C94C] focus-within:ring-2 focus-within:ring-[#F2C94C]/40 transition-all shadow-sm hover:shadow-md">
                  <Search size={18} className="text-[#0A2D55]/40 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search survey number, proponent, location, ICC..."
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
                <div className="w-full sm:w-[200px]">
                  <Select
                    value={remarksFilter}
                    onValueChange={(value) => {
                      setRemarksFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full bg-white border-2 border-[#0A2D55]/10 rounded-xl px-4 py-2.5 text-sm text-[#0A2D55] hover:border-[#F2C94C]/40 focus:ring-[#F2C94C]/40 shadow-sm">
                      <SelectValue placeholder="All Remarks" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#0A2D55]/10 rounded-xl shadow-2xl">
                      {remarksOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {/* debug banner removed */}

            <div ref={null} className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-6 overflow-x-auto">
              {/* Pending subtabs */}
              <>
                <div className="mb-4 -mx-3 px-3 py-2 overflow-x-auto scrollbar-thin">
                  <div className="flex items-center gap-3 min-w-max">
                    {PENDING_SUBTABS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setPendingSubTab(t.id); setCurrentPage(1); }}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap',
                          pendingSubTab === t.id ? 'bg-[#0A2D55] text-white shadow-sm' : 'bg-white/10 text-[#0A2D55] hover:bg-white/20'
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {currentPendingTab.id === 'summary' && (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1100px] w-full table-auto">
                      <thead className="bg-[#0A2D55]/5 border-b border-[#0A2D55]/15">
                        <tr>
                          {[
                            'YEAR APPLIED', 'CAR', 'I', 'II', 'III', 'IVA', 'IVB', 'V', 'VI/VII', 'IX', 'X', 'XI', 'XII', 'XIII', 'TOTAL'
                          ].map((h, i) => (
                            <th key={i} title={h} className="px-3 sm:px-4 py-2 text-left text-[11px] sm:text-[12px] font-semibold text-[#0A2D55] normal-case leading-snug whitespace-nowrap truncate max-w-[220px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingYearSummaryRowsDisplay.length === 0 ? (
                          <tr>
                            <td colSpan={15} className="px-4 sm:px-6 py-6 text-center text-[#0A2D55]/60">No pending items yet.</td>
                          </tr>
                        ) : (
                          <>
                            {pendingYearSummaryRowsDisplay.map((r, idx) => (
                              <tr key={r.year || idx} className="border-b border-[#0A2D55]/10">
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.year}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal font-semibold">{r.CAR || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.I || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.II || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.III || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.IVA || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.IVB || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.V || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r['VI/VII'] || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.IX || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.X || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.XI || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.XII || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.XIII || 0}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.TOTAL || 0}</td>
                              </tr>
                            ))}
                            {/* TOTAL row */}
                            {(() => {
                              const cols = ['CAR','I','II','III','IVA','IVB','V','VI/VII','IX','X','XI','XII','XIII','TOTAL'];
                              const totals = {};
                              cols.forEach(c => { totals[c] = pendingYearSummaryRowsDisplay.reduce((s, r) => s + (Number(r[c]) || 0), 0); });
                              return (
                                <tr className="border-t-2 border-[#0A2D55]/30 bg-[#0A2D55]/5 font-bold">
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55] whitespace-normal">TOTAL</td>
                                  {cols.map(c => (
                                    <td key={c} className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55] whitespace-normal">{totals[c]}</td>
                                  ))}
                                </tr>
                              );
                            })()}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                {currentPendingTab.id === 'summary-per-project' && (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1100px] w-full table-auto">
                      <thead className="bg-[#0A2D55]/5 border-b border-[#0A2D55]/15">
                        <tr>
                          <th className="px-3 sm:px-4 py-2 text-left text-[11px] sm:text-[12px] font-semibold text-[#0A2D55] normal-case leading-snug whitespace-nowrap truncate max-w-[220px]">REGION</th>
                          {(pendingProjectSummaryDisplay.categories || []).map((h, i) => (
                            <th key={i} title={h} className="px-3 sm:px-4 py-2 text-left text-[11px] sm:text-[12px] font-semibold text-[#0A2D55] normal-case leading-snug whitespace-nowrap truncate max-w-[220px]">{h}</th>
                          ))}
                          <th className="px-3 sm:px-4 py-2 text-left text-[11px] sm:text-[12px] font-semibold text-[#0A2D55] normal-case leading-snug whitespace-nowrap truncate max-w-[220px]">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const defaultRegions = ['CAR','Region I','Region II','Region III','Region IV-A','Region IV-B','Region V','Region VI','Region VII','Region IX','Region X','Region XI','Region XII','Region XIII'];
                          const regionKeys = (pendingProjectSummaryDisplay.regionOrder && pendingProjectSummaryDisplay.regionOrder.length)
                            ? pendingProjectSummaryDisplay.regionOrder
                            : (Object.keys(pendingProjectSummaryDisplay.countsByRegion || {}).length ? Object.keys(pendingProjectSummaryDisplay.countsByRegion).sort() : defaultRegions);
                          return regionKeys.map((region) => (
                            <tr key={region} className="border-b border-[#0A2D55]/10">
                              <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal font-semibold">{region}</td>
                              {(pendingProjectSummaryDisplay.categories || []).map((cat, i) => (
                                <td key={i} className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal font-semibold">{(pendingProjectSummaryDisplay.countsByRegion[region] && pendingProjectSummaryDisplay.countsByRegion[region][cat]) || 0}</td>
                              ))}
                              <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal font-semibold">{(pendingProjectSummaryDisplay.countsByRegion[region] && pendingProjectSummaryDisplay.countsByRegion[region].TOTAL) || 0}</td>
                            </tr>
                          ));
                        })()}
                        <tr className="font-semibold bg-[#0A2D55]/5">
                          <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">Total</td>
                          {(pendingProjectSummaryDisplay.categories || []).map((cat, i) => (
                            <td key={i} className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{pendingProjectSummaryDisplay.totals[cat] || 0}</td>
                          ))}
                          <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{pendingProjectSummaryDisplay.totals.TOTAL || 0}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                {currentPendingTab.id !== 'summary' && currentPendingTab.id !== 'summary-per-project' && (
                  (() => {
                    const regionTableTabs = ['car', 'region1', 'region2', 'region3', 'region4a', 'region4b', 'region5', 'region6-7', 'region9', 'region10', 'region11', 'region12', 'region13', 'road-projects'];
                    if (regionTableTabs.includes(String(currentPendingTab.id || '').toLowerCase())) {
                      const PENDING_REGION_HEADERS = [
                        'NO', 'REGION', 'DATE OF FILING OF CP APPLICATION', 'NAME OF PROPONENT', 'NAME OF PROJECT', 'Project Cost', 'LOCATION', 'Type of Project', 'AFFECTED AD/ICC/IP (for CP with ongoing FPIC)', 'STATUS OF APPLICATION', 'STATUS'
                      ];
                      return (
                        <div className="overflow-x-auto">
                          <table className="min-w-[1100px] w-full table-auto">
                            <thead className="bg-[#0A2D55]/5 border-b border-[#0A2D55]/15">
                              <tr>
                                {PENDING_REGION_HEADERS.map((h, i) => (
                                  <th key={i} title={h} className="px-3 sm:px-4 py-2 text-left text-[11px] sm:text-[12px] font-semibold text-[#0A2D55] normal-case leading-snug whitespace-nowrap truncate max-w-[220px]">{h}</th>
                                ))}
                                <th className="px-3 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-semibold text-[#0A2D55] normal-case w-[120px] sticky right-0 z-20 bg-[#F4F7FA] shadow-[-6px_0_10px_rgba(7,26,44,0.06)]">ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedPending.length === 0 ? (
                                <tr className="border-b border-[#0A2D55]/10">
                                  <td colSpan={PENDING_REGION_HEADERS.length + 1} className="px-4 sm:px-6 py-8 text-center text-sm text-[#0A2D55]/60">
                                    {searchQuery ? 'No pending records found matching your search.' : 'No pending records available for this tab.'}
                                  </td>
                                </tr>
                              ) : (
                                paginatedPending.map((mapping, idx) => (
                                  <tr key={`${mapping.id || mapping.docId || mapping.controlNumber || mapping.surveyNumber || 'pending'}-${pendingStart + idx}`} className="border-b border-[#0A2D55]/10">
                                    {PENDING_REGION_HEADERS.map((h, j) => (
                                      <td key={j} className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal" title={String(renderCellForHeader(mapping, h) || '')}>{renderCellForHeader(mapping, h)}</td>
                                    ))}
                                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm w-[120px] sticky right-0 z-10 bg-white shadow-[-6px_0_10px_rgba(7,26,44,0.06)]">
                                      <div className="flex items-center gap-1.5">
                                        {isActionableRegion(
                                          deriveRawRegion(mapping) ||
                                          mapping.region ||
                                          mapping.raw_fields?.region ||
                                          mapping.raw_fields?.sheet ||
                                          mapping.province ||
                                          mapping.raw_fields?.PROVINCE ||
                                          mapping.raw_fields?.Province ||
                                          ''
                                        ) ? (
                                          <>
                                            <button type="button" onClick={() => handleViewMapping(mapping)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#0A2D55]/15 text-[#0A2D55] hover:bg-[#0A2D55]/5 transition" title="View" aria-label="View"><Eye size={15} /></button>
                                            <button type="button" onClick={() => onEditMapping(mapping)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#F2C94C]/40 text-[#8B6F1C] hover:bg-[#F2C94C]/15 transition" title="Edit" aria-label="Edit"><Pencil size={15} /></button>
                                            <button type="button" onClick={() => handleOpenDeleteModal(mapping)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition" title="Delete" aria-label="Delete"><Trash2 size={15} /></button>
                                          </>
                                        ) : (
                                          <span className="text-xs text-[#0A2D55]/40">—</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    // Default: fallback list view for other pending subtabs
                    if (!paginatedPending || paginatedPending.length === 0) {
                      return (
                        <div className="mt-3">
                          <div className="border border-[#0A2D55]/10 rounded-lg p-3 flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#0A2D55] truncate">—</div>
                              <div className="text-xs text-[#0A2D55]/60 truncate">No region</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-[#0A2D55]/60 mr-2">—</div>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => handleNoPendingAction('view')} className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[#0A2D55]/15 text-[#0A2D55] text-xs hover:bg-[#0A2D55]/5 transition" title="View"><Eye size={16} /></button>
                                <button type="button" onClick={() => handleNoPendingAction('edit')} className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[#F2C94C]/40 text-[#8B6F1C] text-xs hover:bg-[#F2C94C]/15 transition" title="Edit"><Pencil size={16} /></button>
                                <button type="button" onClick={() => handleNoPendingAction('delete')} className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-red-200 text-red-600 text-xs hover:bg-red-50 transition" title="Delete"><Trash2 size={16} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="mt-3 space-y-2">
                        {paginatedPending.map((m, idx) => (
                          <div key={idx} className="border border-[#0A2D55]/10 rounded-lg p-3 flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#0A2D55] truncate">{m.surveyNumber || m.controlNumber || m.control_number || '—'}</div>
                              <div className="text-xs text-[#0A2D55]/60 truncate">{m.region || m.province || ''}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-[#0A2D55]/60 mr-2">{m.remarks ? 'Has remarks' : ''}</div>
                              <div className="flex items-center gap-1">
                                {isActionableRegion(m.region) ? (
                                  <>
                                    <button type="button" onClick={() => handleViewMapping(m)} className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[#0A2D55]/15 text-[#0A2D55] text-xs hover:bg-[#0A2D55]/5 transition" title="View" aria-label="View"><Eye size={16} /></button>
                                    <button type="button" onClick={() => onEditMapping(m)} className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[#F2C94C]/40 text-[#8B6F1C] text-xs hover:bg-[#F2C94C]/15 transition" title="Edit" aria-label="Edit"><Pencil size={16} /></button>
                                    <button type="button" onClick={() => handleOpenDeleteModal(m)} className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-red-200 text-red-600 text-xs hover:bg-red-50 transition" title="Delete" aria-label="Delete"><Trash2 size={16} /></button>
                                  </>
                                ) : (
                                  <span className="text-xs text-[#0A2D55]/40">—</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </>

              <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-t border-[#0A2D55]/10 bg-[#0A2D55]/2">
                <div className="text-xs sm:text-sm text-[#0A2D55]/70 font-medium">
                  Showing <span className="font-bold text-[#0A2D55]">{(filteredPendingRecords || []).length === 0 ? 0 : pendingStart + 1}</span> to <span className="font-bold text-[#0A2D55]">{Math.min(pendingEnd, (filteredPendingRecords || []).length)}</span> of <span className="font-bold text-[#0A2D55]">{(filteredPendingRecords || []).length}</span> records
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className={cn(
                      'flex items-center justify-center gap-1 px-2.5 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition',
                      currentPage > 1
                        ? 'bg-[#0A2D55] text-white hover:bg-[#0C3B6E] active:scale-95 shadow-md'
                        : 'bg-[#0A2D55]/20 text-[#0A2D55]/50 cursor-not-allowed'
                    )}
                    aria-label="Previous page"
                  >
                    <span className="sm:hidden">←</span>
                    <span className="hidden sm:inline">← Previous</span>
                  </button>
                  <div className="text-xs sm:text-sm text-[#0A2D55] font-semibold px-2 py-1">
                    Page <span className="text-[#F2C94C]">{currentPage}</span> of <span className="text-[#F2C94C]">{pendingTotalPages || 1}</span>
                  </div>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= pendingTotalPages}
                    className={cn(
                      'flex items-center justify-center gap-1 px-2.5 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition',
                      currentPage < pendingTotalPages
                        ? 'bg-[#0A2D55] text-white hover:bg-[#0C3B6E] active:scale-95 shadow-md'
                        : 'bg-[#0A2D55]/20 text-[#0A2D55]/50 cursor-not-allowed'
                    )}
                    aria-label="Next page"
                  >
                    <span className="hidden sm:inline">Next →</span>
                    <span className="sm:hidden">→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'mappings' && (
          <div className="animate-section-1">
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-header">
              <h2 className="text-lg sm:text-2xl font-bold text-[#0A2D55]">CP Application</h2>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="w-full sm:w-[320px] flex items-center gap-2 bg-white border-2 border-[#0A2D55]/10 rounded-xl px-4 py-2.5 hover:border-[#F2C94C]/40 focus-within:border-[#F2C94C] focus-within:ring-2 focus-within:ring-[#F2C94C]/40 transition-all shadow-sm hover:shadow-md">
                  <Search size={18} className="text-[#0A2D55]/40 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search survey number, proponent, location, ICC..."
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

                {/* Region dropdown removed per user request */}

                <div className="w-full sm:w-[200px]">
                  <Select
                    value={remarksFilter}
                    onValueChange={(value) => {
                      setRemarksFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full bg-white border-2 border-[#0A2D55]/10 rounded-xl px-4 py-2.5 text-sm text-[#0A2D55] hover:border-[#F2C94C]/40 focus:ring-[#F2C94C]/40 shadow-sm">
                      <SelectValue placeholder="All Remarks" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#0A2D55]/10 rounded-xl shadow-2xl">
                      {remarksOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-6 overflow-x-auto">
              <div className="mb-3">
                <div className="-mx-3 px-3 py-2 overflow-x-auto scrollbar-thin">
                  <div className="flex items-center gap-3 min-w-max">
                    {APPROVED_SUBTABS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setApprovedSubTab(t.id); setCurrentPage(1); }}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap',
                          approvedSubTab === t.id ? 'bg-[#0A2D55] text-white shadow-sm' : 'bg-white/10 text-[#0A2D55] hover:bg-white/20'
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredMappings.length === 0 ? (
                <div className="p-8 sm:p-12 text-center animate-section-2">
                  <MapIcon className="w-12 h-12 sm:w-16 sm:h-16 text-[#0A2D55]/30 mx-auto mb-4" />
                  <p className="text-[#0A2D55]/70 text-sm sm:text-lg">
                    {searchQuery ? 'No mappings found matching your search.' : 'No mappings yet. Create your first mapping to get started.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden sm:block overflow-x-auto" ref={approvedContainerRef}>
                    <table className={isInventoryUser ? "w-full table-auto min-w-[1600px]" : "w-full table-fixed"}>
                      <thead className="bg-[#0A2D55]/5 border-b border-[#0A2D55]/15">
                        <tr>
                          {getTableHeaders().map((h, idx) => (
                            <th key={idx} className={isInventoryUser ? "px-3 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-semibold text-[#0A2D55] normal-case leading-snug whitespace-normal break-words min-w-[120px]" : "px-3 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-semibold text-[#0A2D55] normal-case leading-snug"}>{h}</th>
                          ))}
                          <th className="px-3 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-semibold text-[#0A2D55] normal-case w-[120px] sticky right-0 bg-[#F4F7FA] shadow-[-6px_0_10px_rgba(7,26,44,0.06)]">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowsToRender.map((mapping, idx) => (
                          <tr key={idx} className="border-b border-[#0A2D55]/10 hover:bg-[#F2C94C]/5 transition fade-in-up" style={{ animationDelay: `${idx * 100 + 400}ms`, opacity: 0 }}>
                            {getTableHeaders().map((h, i) => (
                              <td key={i} className={isInventoryUser ? "px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 whitespace-normal break-words min-w-[140px] text-center" : "px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-xs truncate text-center"} title={String(isApprovedSummaryView ? String(mapping[h] || '') : String(renderCellForHeader(mapping, h) || ''))}>{isApprovedSummaryView ? (mapping[h] ?? '') : renderCellForHeader(mapping, h)}</td>
                            ))}
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm w-[120px] sticky right-0 bg-white shadow-[-6px_0_10px_rgba(7,26,44,0.06)]">
                              {isApprovedSummaryView ? (
                                <div className="text-center text-xs text-[#0A2D55]/60">—</div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {isActionableRegion(mapping.region) ? (
                                    <>
                                      <button type="button" onClick={() => handleViewMapping(mapping)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#0A2D55]/15 text-[#0A2D55] hover:bg-[#0A2D55]/5 transition" title="View" aria-label="View"><Eye size={15} /></button>
                                      <button type="button" onClick={() => onEditMapping(mapping)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#F2C94C]/40 text-[#8B6F1C] hover:bg-[#F2C94C]/15 transition" title="Edit" aria-label="Edit"><Pencil size={15} /></button>
                                      <button type="button" onClick={() => handleOpenDeleteModal(mapping)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition" title="Delete" aria-label="Delete"><Trash2 size={15} /></button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-[#0A2D55]/40">—</span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="sm:hidden space-y-3 p-3 sm:p-4 max-h-[60vh] overflow-y-auto hide-scrollbar">
                    {rowsToRender.map((mapping, idx) => (
                      isApprovedSummaryView ? (
                        <div key={idx} className="bg-[#0A2D55]/5 border border-[#0A2D55]/15 rounded-xl p-4 space-y-3 fade-in-up" style={{ animationDelay: `${idx * 100 + 400}ms`, opacity: 0 }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[#0A2D55]/60 font-medium">Region</p>
                              <p className="text-sm font-bold text-[#0A2D55] truncate">{mapping[APPROVED_SUMMARY_HEADERS[0]]}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">Mining / Mineral</p>
                              <p className="text-xs text-[#0A2D55]/90">{mapping[APPROVED_SUMMARY_HEADERS[1]]}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">Energy</p>
                              <p className="text-xs text-[#0A2D55]/90">{mapping[APPROVED_SUMMARY_HEADERS[2]]}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">DAM</p>
                              <p className="text-xs text-[#0A2D55]/90">{mapping[APPROVED_SUMMARY_HEADERS[3]]}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">EPR</p>
                              <p className="text-xs text-[#0A2D55]/90">{mapping[APPROVED_SUMMARY_HEADERS[4]]}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">Quarry</p>
                              <p className="text-xs text-[#0A2D55]/90">{mapping[APPROVED_SUMMARY_HEADERS[5]]}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">Agro-Industrial & Tourism</p>
                              <p className="text-xs text-[#0A2D55]/90">{mapping[APPROVED_SUMMARY_HEADERS[6]]}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">Infrastructure</p>
                              <p className="text-xs text-[#0A2D55]/90">{mapping[APPROVED_SUMMARY_HEADERS[7]]}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">Other</p>
                              <p className="text-xs text-[#0A2D55]/90">{mapping[APPROVED_SUMMARY_HEADERS[8]]}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">Total Approved CPs</p>
                              <p className="text-xs text-[#0A2D55]/90 font-semibold">{mapping[APPROVED_SUMMARY_HEADERS[9]]}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">Total Project Cost</p>
                              <p className="text-xs text-[#0A2D55]/90 font-mono">{mapping[APPROVED_SUMMARY_HEADERS[10]]}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div key={idx} className="bg-[#0A2D55]/5 border border-[#0A2D55]/15 rounded-xl p-4 space-y-3 fade-in-up" style={{ animationDelay: `${idx * 100 + 400}ms`, opacity: 0 }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[#0A2D55]/60 font-medium">SURVEY NUMBER</p>
                              <p className="text-sm font-bold text-[#0A2D55] truncate">{displayValue(mapping.surveyNumber)}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">REGION</p>
                              <p className="text-xs text-[#0A2D55]/90 truncate">{displayValue(mapping.region)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium">AREA (HA)</p>
                              <p className="text-xs text-[#0A2D55]/90 font-mono">{formatAreaValue(mapping.totalArea)}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">Province</p>
                            <p className="text-xs text-[#0A2D55]/90 line-clamp-2">{displayValue(mapping.province)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">Municipality/ies</p>
                            <p className="text-xs text-[#0A2D55]/90 line-clamp-2">{displayValue(getMunicipalities(mapping) || '')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">Barangay/s</p>
                            <p className="text-xs text-[#0A2D55]/90 line-clamp-2">{displayValue(getBarangays(mapping) || '')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">ICCS/IPS</p>
                            <p className="text-xs text-[#0A2D55]/90 line-clamp-2">{displayValue(mapping.icc?.join(', '))}</p>
                          </div>
                          {displayValue(mapping.remarks) !== '-' && (
                            <div>
                              <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">Remarks</p>
                              <p className="text-xs text-[#0A2D55]/90 line-clamp-2">{displayValue(mapping.remarks)}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <button type="button" onClick={() => handleViewMapping(mapping)} className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[#0A2D55]/15 text-[#0A2D55] text-xs hover:bg-[#0A2D55]/5 transition" title="View" aria-label="View"><Eye size={16} /></button>
                            <button type="button" onClick={() => onEditMapping(mapping)} className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[#F2C94C]/40 text-[#8B6F1C] text-xs hover:bg-[#F2C94C]/15 transition" title="Edit" aria-label="Edit"><Pencil size={16} /></button>
                            <button type="button" onClick={() => handleOpenDeleteModal(mapping)} className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-red-200 text-red-600 text-xs hover:bg-red-50 transition" title="Delete" aria-label="Delete"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      )
                    ))}
                  </div>

                  <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-t border-[#0A2D55]/10 bg-[#0A2D55]/2">
                    <div className="text-xs sm:text-sm text-[#0A2D55]/70 font-medium">
                      Showing <span className="font-bold text-[#0A2D55]">{startIndex + 1}</span> to <span className="font-bold text-[#0A2D55]">{Math.min(endIndex, filteredMappings.length)}</span> of <span className="font-bold text-[#0A2D55]">{filteredMappings.length}</span> records
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button onClick={() => setCurrentPage(currentPage - 1)} disabled={!canGoPrevious} className={cn('flex items-center justify-center gap-1 px-2.5 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition', canGoPrevious ? 'bg-[#0A2D55] text-white hover:bg-[#0C3B6E] active:scale-95 shadow-md' : 'bg-[#0A2D55]/20 text-[#0A2D55]/50 cursor-not-allowed')} aria-label="Previous page">
                        <span className="sm:hidden">←</span>
                        <span className="hidden sm:inline">← Previous</span>
                      </button>
                      <div className="text-xs sm:text-sm text-[#0A2D55] font-semibold px-2 py-1">Page <span className="text-[#F2C94C]">{currentPage}</span> of <span className="text-[#F2C94C]">{totalPages || 1}</span></div>
                      <button onClick={() => setCurrentPage(currentPage + 1)} disabled={!canGoNext} className={cn('flex items-center justify-center gap-1 px-2.5 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition', canGoNext ? 'bg-[#0A2D55] text-white hover:bg-[#0C3B6E] active:scale-95 shadow-md' : 'bg-[#0A2D55]/20 text-[#0A2D55]/50 cursor-not-allowed')} aria-label="Next page">
                        <span className="sm:hidden">→</span>
                        <span className="hidden sm:inline">Next →</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ongoing' && (
          <div className="animate-section-1">
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-header">
              <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-2xl font-bold text-[#0A2D55]">Ongoing</h2>
              </div>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="w-full sm:w-[320px] flex items-center gap-2 bg-white border-2 border-[#0A2D55]/10 rounded-xl px-4 py-2.5 hover:border-[#F2C94C]/40 focus-within:border-[#F2C94C] focus-within:ring-2 focus-within:ring-[#F2C94C]/40 transition-all shadow-sm hover:shadow-md">
                  <Search size={18} className="text-[#0A2D55]/40 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search survey number, proponent, location, ICC..."
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
                <div className="w-full sm:w-[200px]">
                  <Select
                    value={remarksFilter}
                    onValueChange={(value) => {
                      setRemarksFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full bg-white border-2 border-[#0A2D55]/10 rounded-xl px-4 py-2.5 text-sm text-[#0A2D55] hover:border-[#F2C94C]/40 focus:ring-[#F2C94C]/40 shadow-sm">
                      <SelectValue placeholder="All Remarks" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#0A2D55]/10 rounded-xl shadow-2xl">
                      {remarksOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {isInventoryUser ? (
              <div ref={ongoingContainerRef} className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-6 overflow-x-auto">
                {/* Ongoing subtabs */}
                <>
                  {tabsHeader}
                  {currentOngoingTab.id === 'summary' ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-[1100px] w-full table-auto">
                        <thead className="bg-[#0A2D55]/5 border-b border-[#0A2D55]/15">
                          <tr>
                            {[
                              'Region',
                              'No. of Ongoing CP Applications',
                              'Issuance of Work Order',
                              'Pre-FBI Conference',
                              'Conduct of FBI',
                              'Review of FBI Report',
                              'Pre-FPIC Conference',
                              '1st Community Assembly',
                              '2nd Community Assembly',
                              'Consensus Building & Decision Meeting',
                              'MOA Validation, Ratification & Signing',
                              'Issuance of Resolution of Consent',
                              'Review of the FPIC Report by RRT',
                              'Review of the FPIC Report by ADO & LAO',
                              'For compliance of FPIC Team',
                              'CEB Deliberation',
                            ].map((h, i) => (
                              <th key={i} title={h} className="px-3 sm:px-4 py-2 text-left text-[11px] sm:text-[12px] font-semibold text-[#0A2D55] normal-case leading-snug whitespace-nowrap truncate max-w-[220px]">{compactHeaderDisplay(h)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ongoingSummaryRows.length === 0 ? (
                            <tr>
                              <td colSpan={16} className="px-4 sm:px-6 py-6 text-center text-[#0A2D55]/60">No ongoing items yet.</td>
                            </tr>
                          ) : (
                            <>
                              {ongoingSummaryRows.map((r, idx) => (
                                <tr key={r.region || idx} className="border-b border-[#0A2D55]/10">
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.region}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal font-semibold">{r.total}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.issuanceOfWorkOrder}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.preFBIConference}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.conductOfFBI}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.reviewOfFBIReport}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.preFPICConference}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.firstCommunityAssembly}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.secondCommunityAssembly}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.consensusBuildingDecision}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.moaValidationRatificationSigning}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.issuanceResolutionOfConsent}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.reviewByRRT}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.reviewByADOorLAO}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.forComplianceOfFPICTeam}</td>
                                  <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{r.cebDeliberation}</td>
                                </tr>
                              ))}
                              <tr key="_totals" className="border-t border-[#0A2D55]/10 font-semibold bg-[#F8FAFB]">
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">Total</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.total}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.issuanceOfWorkOrder}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.preFBIConference}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.conductOfFBI}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.reviewOfFBIReport}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.preFPICConference}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.firstCommunityAssembly}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.secondCommunityAssembly}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.consensusBuildingDecision}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.moaValidationRatificationSigning}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.issuanceResolutionOfConsent}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.reviewByRRT}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.reviewByADOorLAO}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.forComplianceOfFPICTeam}</td>
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/90 whitespace-normal">{ongoingSummaryTotals.cebDeliberation}</td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>

                    </div>
                  ) : currentOngoingTab.id === 'summary-per-project' ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-[1100px] w-full table-auto">
                        <thead className="bg-[#0A2D55]/5 border-b border-[#0A2D55]/15">
                          <tr>
                            <th className="px-3 sm:px-4 py-2 text-left text-[11px] sm:text-[12px] font-semibold text-[#0A2D55] normal-case leading-snug whitespace-nowrap truncate max-w-[220px]">REGION</th>
                            {(ongoingProjectCategories || []).map((h, i) => (
                              <th key={i} title={h} className="px-3 sm:px-4 py-2 text-left text-[11px] sm:text-[12px] font-semibold text-[#0A2D55] normal-case leading-snug whitespace-nowrap truncate max-w-[220px]">{h}</th>
                            ))}
                            <th className="px-3 sm:px-4 py-2 text-left text-[11px] sm:text-[12px] font-semibold text-[#0A2D55] normal-case leading-snug whitespace-nowrap truncate max-w-[220px]">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const defaultRegions = ['CAR','Region I','Region II','Region III','Region IV-A','Region IV-B','Region V','Region VI','Region VII','Region IX','Region X','Region XI','Region XII','Region XIII'];
                            const regionKeys = (Object.keys(ongoingProjectCountsByRegion || {}).length ? Object.keys(ongoingProjectCountsByRegion).sort() : defaultRegions);
                            return regionKeys.map((region) => (
                              <tr key={region} className="border-b border-[#0A2D55]/10">
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal font-semibold">{region}</td>
                                {(ongoingProjectCategories || []).map((cat, i) => (
                                  <td key={i} className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{(ongoingProjectCountsByRegion[region] && ongoingProjectCountsByRegion[region][cat]) || 0}</td>
                                ))}
                                <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{(ongoingProjectCountsByRegion[region] && ongoingProjectCountsByRegion[region].TOTAL) || 0}</td>
                              </tr>
                            ));
                          })()}
                          <tr className="font-semibold bg-[#0A2D55]/5">
                            <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">Total</td>
                            {(ongoingProjectCategories || []).map((cat, i) => (
                              <td key={i} className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{ongoingProjectCounts[cat] || 0}</td>
                            ))}
                            <td className="px-3 sm:px-4 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{ongoingProjectCounts.TOTAL || 0}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[1100px] w-full table-auto">
                        <thead className="bg-[#0A2D55]/5 border-b border-[#0A2D55]/15">
                          <tr>
                            {currentOngoingTab.headers.map((h, i) => (
                              <th key={i} title={h} className="px-3 sm:px-4 py-2 text-left text-[11px] sm:text-[12px] font-semibold text-[#0A2D55] normal-case leading-snug whitespace-nowrap truncate max-w-[220px]">{compactHeaderDisplay(h)}</th>
                            ))}
                            <th className="px-2 sm:px-2 py-1 text-left text-[10px] sm:text-[11px] font-semibold text-[#0A2D55] normal-case w-[110px] sticky right-0 bg-[#F4F7FA] shadow-[-6px_0_10px_rgba(7,26,44,0.06)]">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!ongoingRecords || ongoingRecords.length === 0) ? (
                            <tr>
                              <td colSpan={currentOngoingTab.headers.length + 1} className="px-4 sm:px-6 py-6 text-center text-[#0A2D55]/60 whitespace-normal">No ongoing items yet.</td>
                            </tr>
                          ) : (
                            paginatedOngoing.map((m, idx) => (
                              <tr key={m.id || idx} className="border-b border-[#0A2D55]/10">
                                {currentOngoingTab.keys.map((k, j) => (
                                  <td key={j} className="px-2.5 sm:px-3 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal text-center">{displayValue(getOngoingField(m, k))}</td>
                                ))}
                                <td className="px-2.5 sm:px-3 py-2 text-[12px] text-[#0A2D55]/80 w-[110px] sticky right-0 bg-white shadow-[-6px_0_10px_rgba(7,26,44,0.06)]">
                                  <div className="flex items-center gap-1.5 justify-end">
                                    {isActionableRegion(m.region) ? (
                                      <>
                                        <button type="button" onClick={() => handleViewMapping(m)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#0A2D55]/15 text-[#0A2D55] hover:bg-[#0A2D55]/5 transition" title="View" aria-label="View"><Eye size={15} /></button>
                                        <button type="button" onClick={() => onEditMapping(m)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#F2C94C]/40 text-[#8B6F1C] hover:bg-[#F2C94C]/15 transition" title="Edit" aria-label="Edit"><Pencil size={15} /></button>
                                        <button type="button" onClick={() => handleOpenDeleteModal(m)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition" title="Delete" aria-label="Delete"><Trash2 size={15} /></button>
                                      </>
                                    ) : (
                                      <span className="text-xs text-[#0A2D55]/40">—</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>

                    </div>
                  )}
                </>
              </div>
            ) : (
              <>
                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
                  <p className="text-sm text-[#0A2D55]/70">Placeholder for ongoing items. Customize as needed.</p>
                </div>
                <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-6">
                  <p className="text-sm text-[#0A2D55]/60">No ongoing items yet.</p>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button with Menu */}
      {(shouldShowFab && fabMounted && typeof document !== 'undefined' && document.body) ? createPortal(
        <div className="fixed z-50 bottom-20 sm:bottom-8 right-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
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
              // If we're on the Ongoing tab and a region subtab is active, pre-fill the region
              let preRegion = null;
              if (activeTab === 'ongoing') {
                const id = String(ongoingSubTab || '').toLowerCase();
                if (id === 'car') preRegion = 'CAR';
                else {
                  // Match either single region (e.g. region4a) or combined like region6-7
                  const m = id.match(/^region(\d{1,2})([abAB])?$/);
                  if (m) {
                    const n = Number(m[1]);
                    const suffix = m[2] ? String(m[2]).toUpperCase() : null;
                    const romanMap = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
                    if (n === 4 && suffix) preRegion = `Region IV-${suffix}`;
                    else preRegion = `Region ${romanMap[n - 1]}`;
                  } else {
                    // Combined range like region6-7 -> prefill to first region (Region VI)
                    const r = id.match(/^region(\d{1,2})-(\d{1,2})$/);
                    if (r) {
                      const n1 = Number(r[1]);
                      const romanMap = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
                      if (n1 >= 1 && n1 <= 13) preRegion = `Region ${romanMap[n1 - 1]}`;
                    }
                  }
                }
              }
              onAddMapping({ ongoing: activeTab === 'ongoing', pending: activeTab === 'pending', region: preRegion });
              setFabOpen(false);
            }}
            className={cn(
              "absolute w-14 h-14 bg-white hover:bg-gray-100 text-[#0A2D55] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-out active:scale-95 flex items-center justify-center",
              fabOpen
                ? "opacity-100 bottom-0 right-20"
                : "opacity-0 bottom-0 right-0 pointer-events-none"
            )}
            title="Add Record"
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
        </div>, document.body
      ) : null}

      {/* Overlay to close FAB menu */}
      {shouldShowFab && fabOpen && (
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
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[92vw] max-w-[420px] sm:w-[90%] transition-all duration-200",
            isClosingExportModal ? "animate-out zoom-out fade-out" : "animate-in zoom-in fade-in"
          )}>
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 max-h-[90vh] overflow-y-auto">
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
                className="px-4 sm:px-6 py-4 sm:py-5"
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

              <div className="px-4 sm:px-6 py-4 sm:py-5 text-white/90">
                <p className="text-sm">Choose a file name and location to save the Excel workbook.</p>
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-white/70 mb-2">File name</label>
                  <input
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    disabled={isExporting}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-[#F2C94C]/40 focus:border-transparent transition"
                    placeholder="records.xlsx"
                  />
                </div>
              </div>

              <div className="px-4 sm:px-6 py-4 border-t border-white/15 flex items-center justify-end gap-3">
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
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[92vw] max-w-[420px] sm:w-[90%] transition-all duration-200",
            isClosingDeleteModal ? "animate-out zoom-out fade-out" : "animate-in zoom-in fade-in"
          )}>
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 max-h-[90vh] overflow-y-auto">
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
                className="px-4 sm:px-6 py-4 sm:py-5"
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

              <div className="px-4 sm:px-6 py-4 sm:py-5 text-white/90">
                <p className="text-sm">Are you sure you want to delete this record? This action cannot be undone.</p>
                <div className="mt-4 rounded-xl border border-white/15 bg-white/10 p-3 text-xs">
                  <p className="font-semibold text-white">{deleteTarget.surveyNumber || 'Untitled Record'}</p>
                  <p className="text-white/70 mt-1">{deleteTarget.region || '-'} • {deleteTarget.province || '-'}</p>
                </div>
              </div>

              <div className="px-4 sm:px-6 py-4 border-t border-white/15 flex items-center justify-end gap-3">
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
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[99] w-[96vw] max-w-[920px] sm:w-[92%] transition-all duration-200",
              isClosingViewModal ? "animate-out zoom-out fade-out" : "animate-in zoom-in fade-in"
            )}
          >
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 max-h-[92vh] flex flex-col overflow-hidden">
              <div
                className="px-4 sm:px-6 py-4 sm:py-5"
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
                      <h3 className="text-xl font-bold text-white tracking-tight">Record Details</h3>
                      <p className="text-xs text-white/70 mt-0.5">Saved record from the form</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => console.log('Dashboard: selectedMapping ->', selectedMapping)}
                      className="px-3 py-1 rounded-md bg-white/10 text-white hover:bg-white/20 text-xs"
                      aria-label="Debug record"
                      title="Log record to console"
                    >
                      Debug
                    </button>
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
              </div>

              <div className="px-4 sm:px-6 py-4 sm:py-5 text-white/90 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {isInventoryUser ? (
                    <>
                      {/* NCIP Inventory User View */}
                      <div>
                        <p className="text-xs font-semibold text-white/70">No. (Survey Number)</p>
                        <p className="text-white font-semibold mt-1">{displayValue(getOngoingField(selectedMapping, 'surveyNumber') || selectedMapping.surveyNumber)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Region</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'region') || selectedMapping.region)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Control Number</p>
                        <p className="text-white font-semibold mt-1">{displayValue(getOngoingField(selectedMapping, 'controlNumber') || selectedMapping.controlNumber)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Proponent</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'proponent') || getOngoingField(selectedMapping, 'applicant') || selectedMapping.proponent)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Name of Project</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'nameOfProject') || selectedMapping.nameOfProject)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Location</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'location') || selectedMapping.location)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Project Area (ha)</p>
                        <p className="text-white font-mono mt-1">{displayValue((() => {
                          const rawArea = getOngoingField(selectedMapping, 'area') || getOngoingField(selectedMapping, 'totalArea') || selectedMapping?.project_area_in_hectares || selectedMapping?.projectAreaInHectares || selectedMapping?.totalArea || '';
                          const num = parseAreaValue(rawArea);
                          return num ? num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '';
                        })())}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Nature of Project</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'typeOfProject') || getOngoingField(selectedMapping, 'natureOfProject') || selectedMapping.natureOfProject)}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-white/70">CADT Status</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'cadtStatus') || getOngoingField(selectedMapping, 'cadt') || selectedMapping.cadtStatus)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Affected ICC</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'iccs') || getOngoingField(selectedMapping, 'icc') || (selectedMapping.icc ? (Array.isArray(selectedMapping.icc) ? selectedMapping.icc.join(', ') : selectedMapping.icc) : ''))}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Year Approved</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'yearApproved') || selectedMapping.yearApproved)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">MOA Duration</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'moaDuration') || selectedMapping.moaDuration)}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold text-white/70">Community Benefits</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'communityBenefits') || selectedMapping.communityBenefits)}</p>
                      </div>
                      {displayValue(getOngoingField(selectedMapping, 'remarks') || selectedMapping.remarks) !== '-' && (
                        <div className="sm:col-span-2">
                          <p className="text-xs font-semibold text-white/70">Remarks</p>
                          <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'remarks') || selectedMapping.remarks)}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Regular User View */}
                      <div>
                        <p className="text-xs font-semibold text-white/70">Survey Number</p>
                        <p className="text-white font-semibold mt-1">{displayValue(getOngoingField(selectedMapping, 'surveyNumber') || selectedMapping.surveyNumber)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Total Area (ha)</p>
                        <p className="text-white font-mono mt-1">{displayValue((() => {
                          const n = parseAreaValue(getOngoingField(selectedMapping, 'totalArea') || selectedMapping.totalArea);
                          return n ? n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '';
                        })())}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Region</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'region') || selectedMapping.region)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Province</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'province') || selectedMapping.province)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Municipality/ies</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'municipality') || getOngoingField(selectedMapping, 'municipalities') || getMunicipalitiesFull(selectedMapping))}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Barangay/s</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'barangay') || getOngoingField(selectedMapping, 'barangays') || getBarangaysFull(selectedMapping))}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold text-white/70">ICCs/IPs</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'iccs') || getOngoingField(selectedMapping, 'icc') || (selectedMapping.icc ? (Array.isArray(selectedMapping.icc) ? selectedMapping.icc.join(', ') : selectedMapping.icc) : ''))}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold text-white/70">Remarks</p>
                        <p className="text-white mt-1">{displayValue(getOngoingField(selectedMapping, 'remarks') || selectedMapping.remarks)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer removed (use header X to close) */}
            </div>
          </div>
        </>
      )}


    </div>
  );
}

// Provide both a named and default export so consumers can import either style
export { Dashboard };
export default Dashboard;
