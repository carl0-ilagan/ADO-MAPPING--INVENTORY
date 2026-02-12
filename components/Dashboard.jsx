'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import {
  Plus,
  Search,
  Download,
  Upload,
  Map as MapIcon,
  MapPin,
  Layers,
  BarChart3,
  User,
  Eye,
  Pencil,
  Trash2,
  Bell,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  mapHeadersToFields,
  buildFirestoreDocument,
  isValidRow,
} from '@/lib/firestoreSchema';

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
  availableCollections = [{ id: 'mappings', collectionName: 'mappings' }],
  selectedCollection = 'mappings',
  onSelectCollection = () => {},
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [remarksFilter, setRemarksFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [fabOpen, setFabOpen] = useState(false);
  const [ongoingSubTab, setOngoingSubTab] = useState('summary');
  
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
  const [importInvalidSheets, setImportInvalidSheets] = useState([]);
  const [importRawSheets, setImportRawSheets] = useState([]);
  const [importCollectionName, setImportCollectionName] = useState('');
  const [showInvalidDetails, setShowInvalidDetails] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [isClosingClearAllModal, setIsClosingClearAllModal] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
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

  const isInventoryUser = (user?.email || '').toLowerCase() === 'ncip@inventory.gov.ph';
  const NCIP_TABLE_HEADERS = [
    'No.',
    'Region',
    'Control number',
    'Proponent',
    'Name of Project',
    'Location',
    'Nature of Project',
    'Project Cost',
    'CADT Status',
    'Affected ICC',
    'Year Approved',
    'MOA Duration',
    'Community Benefits',
    'Remarks',
  ];
  const DEFAULT_TABLE_HEADERS = ['SURVEY NUMBER', 'REGION', 'PROVINCE', 'MUNICIPALITY/IES', 'BARANGAY/S', 'AREA (HA)', 'ICCS/IPS', 'REMARKS', 'ACTIONS'];

  const getTableHeaders = () => (isInventoryUser ? NCIP_TABLE_HEADERS : DEFAULT_TABLE_HEADERS);

  const renderCellForHeader = (mapping, header) => {
    const h = String(header || '').toLowerCase();

    const getField = (keys) => {
      for (const k of keys) {
        if (!k) continue;
        const val = mapping[k];
        if (val === null || typeof val === 'undefined' || val === '') continue;
        if (Array.isArray(val)) return val.length ? val.join(', ') : null;
        return String(val);
      }
      return null;
    };

    if (h === 'no.' || h === 'survey number') return getField(['surveyNumber', 'survey_number', 'controlNumber', 'control_number']) || '-';
    if (h === 'region') return getField(['region', 'regionName', 'region_name']) || '-';
    if (h === 'control number') return getField(['controlNumber', 'control_number', 'surveyNumber', 'survey_number']) || '-';
    if (h.includes('applicant') || h.includes('proponent')) return getField(['proponent', 'applicantProponent', 'applicant_proponent', 'applicant', 'applicant_name', 'applicantName']) || '-';
    if (h.includes('name of project') || (h.includes('name') && !h.includes('region'))) return getField(['nameOfProject', 'name_of_project', 'projectName', 'project_name', 'name', 'title']) || '-';
    if (h.includes('nature')) return getField(['natureOfProject', 'nature_of_project', 'nature', 'projectNature']) || '-';
    if (h.includes('project cost') || h.includes('cost')) return getField(['projectCost', 'project_cost', 'cost', 'project_cost_php']) || '-';
    if (h.includes('cadt')) return getField(['cadtStatus', 'cadt_status', 'cadt']) || '-';
    if (h === 'icc' || h.includes('icc')) return getField(['icc', 'iccs', 'affectedICC', 'affected_icc', 'affected_iccs']) || '-';
    if (h === 'location') return getField(['location', 'province', 'provinceName', 'province_name', 'location_full']) || '-';
    if (h.includes('year')) return getField(['yearApproved', 'year_approved', 'year', 'approvedYear']) || '-';
    if (h.includes('moa duration') || h === 'moa duration') return getField(['moaDuration', 'moa_duration', 'moa']) || '-';
    if (h.includes('province')) return getField(['province', 'provinceName', 'province_name']) || '-';
    if (h.includes('municipality')) return getField(['municipality', 'municipalities']) || '-';
    if (h.includes('barangay')) return getField(['barangays']) || '-';
    if (h.includes('area')) return getField(['totalArea', 'area', 'area_ha']) || '-';
    if (h.includes('community')) return getField(['communityBenefits', 'community_benefits', 'community']) || '-';
    if (h.includes('remark')) return getField(['remarks', 'remark', 'notes']) || '-';
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
    keys: ['proponent','nameOfProject','typeOfProject','location','area','ancestral','iccs','dateOfApplication','reviewOfApplicationDocuments','needForFBI','issuanceOfWorkOrder','preFBIConference','approvalOfWFP','paymentOfFBIFee','conductOfFBI','preparationOfFBIReport','reviewOfFBIReport','issuanceOfWorkOrderOfFPICTeam','preFPICConference','approvalOfWFP','paymentOfFPICFee','postingOfNotices','firstCommunityAssembly','secondCommunityAssembly','consensusBuildingDecision','proceedToMOANegotiation','issuanceResolutionToProceedToMOA','moaNegotiationPreparation','moaValidationRatificationSigning','issuanceResolutionOfConsent','submissionOfFPICReport','reviewByRRT','reviewByADOorLAO','forComplianceOfFPICTeam','cebDeliberation','cebApproved','preparationSigningCEBResolutionCP','releaseOfCPToProponent','remarks']
  }));

  const computeSummaryRows = (records = []) => {
    const regionMap = new Map();
    records.forEach((m) => {
      const region = (m.region || 'Unknown').toString();
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
      const inc = (k) => {
        const v = m[k];
        if (v !== null && typeof v !== 'undefined' && String(v).trim() !== '') obj[k] += 1;
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
    return Array.from(regionMap.values()).sort((a, b) => (b.total || 0) - (a.total || 0));
  };

  const currentOngoingTab = ONGOING_SUBTABS.find((s) => s.id === ongoingSubTab) || ONGOING_SUBTABS[0];

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
    // status keywords (align with stats.ongoing logic)
    const status = String(m.cadtStatus || m.cadt_status || '').toLowerCase();
    if (status.includes('on process') || status.includes('for processing') || status.includes('processing')) return true;
    return false;
  };

  const ongoingRecords = (selectedCollection && String(selectedCollection).toLowerCase().includes('ongoing'))
    ? (mappings || [])
    : (mappings || []).filter((m) => isOngoingMapping(m));

  const ongoingSummaryRows = computeSummaryRows(ongoingRecords || []);

  // Filter ongoing records according to the active ongoing subtab (region tabs)
  const filteredOngoingRecords = React.useMemo(() => {
    if (!Array.isArray(ongoingRecords)) return [];
    const id = String(ongoingSubTab || '').toLowerCase();
    // Keep summary and other global views unfiltered
    const unfilteredTabs = ['summary', 'summary-per-project', 'denied-by-mgb', 'inactive'];
    if (unfilteredTabs.includes(id)) return ongoingRecords;

    // Handle CAR explicitly
    if (id === 'car') {
      return ongoingRecords.filter((rec) => {
        const d = detectRegionSheet(rec.region);
        if (d === 'CAR') return true;
        const v = String(rec.region || '').toUpperCase();
        return v.includes('CORDILLERA') || v.includes('CAR');
      });
    }

    // Handle combined region 6/7
    if (id === 'region6-7') {
      return ongoingRecords.filter((rec) => {
        const d = detectRegionSheet(rec.region);
        return d === 'Region VI' || d === 'Region VII';
      });
    }

    // Generic Region N tabs (e.g. region1 -> Region I)
    const m = id.match(/^region(\d{1,2})$/);
    if (m) {
      const n = Number(m[1]);
      const romanMap = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII'];
      const label = `Region ${romanMap[n - 1]}`;
      return ongoingRecords.filter((rec) => {
        const d = detectRegionSheet(rec.region);
        if (d === label) return true;
        const v = String(rec.region || '').toUpperCase();
        if (!v) return false;
        return v.includes(label.toUpperCase()) || v.includes(String(n));
      });
    }

    // Fallback: return all
    return ongoingRecords;
  }, [ongoingRecords, ongoingSubTab]);

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

    const tryGet = (obj, k) => {
      if (!obj || !k) return null;
      if (Object.prototype.hasOwnProperty.call(obj, k)) return formatVal(obj[k]);
      return null;
    };

    // Build normalized lookup from mapping keys -> values
    const normalizedMap = {};
    Object.keys(m || {}).forEach((orig) => {
      try {
        normalizedMap[normalizeHeader(orig)] = m[orig];
      } catch (e) {
        // ignore
      }
    });

    const seek = (desiredKeys) => {
      for (const dk of desiredKeys) {
        if (!dk) continue;
        // direct
        const v1 = tryGet(m, dk);
        if (v1) return v1;
        // sanitized variant (underscored)
        const s = sanitizeFieldName(dk);
        const v2 = tryGet(m, s);
        if (v2) return v2;
        // normalized header match
        const nk = normalizeHeader(dk);
        if (normalizedMap[nk]) return formatVal(normalizedMap[nk]);
        // try compacted key (letters+digits only)
        const ck = compactHeader(dk);
        for (const orig of Object.keys(m || {})) {
          if (compactHeader(orig) === ck) return formatVal(m[orig]);
        }
      }
      return null;
    };

    // Common mappings for friendly keys
    switch (key) {
      case 'proponent': return seek(['proponent', 'applicant', 'applicantProponent', 'applicant_proponent']) || '-';
      case 'nameOfProject': return seek(['nameOfProject', 'projectName', 'name', 'title']) || '-';
      case 'typeOfProject': return seek(['natureOfProject', 'nature', 'projectType', 'typeOfProject']) || '-';
      case 'location': return seek(['location', 'province', 'location_full', 'provinceName']) || '-';
      case 'area': return seek(['totalArea', 'area', 'area_ha', 'projectArea']) || '-';
      case 'ancestral': return seek(['affectedAncestralDomain', 'ancestralDomain', 'ancestral_domains']) || '-';
      case 'iccs': return seek(['icc', 'iccs', 'affectedICC', 'affected_icc']) || '-';
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
        return '-';
      }
    }
  };

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

  // If the selected import collection appears to be an 'ongoing' collection,
  // switch the active tab so the collection's records are displayed in Ongoing.
  useEffect(() => {
    try {
      if (selectedCollection && String(selectedCollection).toLowerCase().includes('ongoing')) {
        console.log('Dashboard: selectedCollection indicates ongoing -> switching activeTab to ongoing');
        setActiveTab('ongoing');
      }
    } catch (e) {
      // ignore
    }
  }, [selectedCollection]);

  // Filter mappings based on search query
  const regionOptions = React.useMemo(() => {
    const set = new Set();
    mappings.forEach((m) => {
      if (m.region) set.add(m.region);
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

  const filteredMappings = mappings.filter((mapping) => {
    // Hide mappings marked as ongoing or imported into an 'ongoing' collection
    // from the main mappings (Approved) view
    if (activeTab === 'mappings' && mapping) {
      if (mapping._ongoing === true || String(mapping._ongoing || '').toLowerCase() === 'true') return false;
      const ic = String(mapping.importCollection || '').toLowerCase();
      if (ic && ic.includes('ongoing')) return false;
    }
    const query = searchQuery.toLowerCase();
    if (regionFilter !== 'all' && mapping.region !== regionFilter) return false;
    if (remarksFilter === 'with' && String(mapping.remarks || '').trim() === '') return false;
    if (remarksFilter === 'none' && String(mapping.remarks || '').trim() !== '') return false;
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

  // Reset page when switching tabs so pagination stays consistent
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Paginate ongoing records separately (use the same `currentPage` and itemsPerPage)
  const ongoingTotalPages = Math.max(1, Math.ceil(((filteredOngoingRecords && filteredOngoingRecords.length) || 0) / itemsPerPage));
  const ongoingStart = (currentPage - 1) * itemsPerPage;
  const ongoingEnd = ongoingStart + itemsPerPage;
  const paginatedOngoing = Array.isArray(filteredOngoingRecords) ? filteredOngoingRecords.slice(ongoingStart, ongoingEnd) : [];

  const filteredCollectionsForDropdown = React.useMemo(() => {
    if (!Array.isArray(availableCollections)) return [];
    if (activeTab === 'ongoing') {
      return availableCollections.filter((c) => c && c.collectionName && (String(c.type || '').toLowerCase() === 'ongoing' || String(c.collectionName).toLowerCase().includes('ongoing')));
    }
    // For Approved (mappings) and other tabs, exclude any 'ongoing' collections
    return availableCollections.filter((c) => c && c.collectionName && !(String(c.type || '').toLowerCase() === 'ongoing' || String(c.collectionName).toLowerCase().includes('ongoing')));
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
  }));

  const currentSelectionKey = activeTab === 'ongoing' ? 'ongoing' : 'mappings';
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
      const key = activeTab === 'ongoing' ? 'ongoing' : 'mappings';
      const value = dropdownSelections[key];
      if (!value || value === '__none__') return;
      if (typeof onSelectCollection === 'function') {
        // Only trigger load if App hasn't already selected the same collection
        // Defensive: don't call onSelectCollection('mappings') when switching to ongoing
        if (activeTab === 'ongoing' && String(value) === 'mappings') {
          console.log('Dashboard: skipping invalid ongoing selection value="mappings"');
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
      if (activeTab !== 'ongoing') return;
      // If there are already mappings loaded, do nothing
      if (Array.isArray(mappings) && mappings.length > 0) return;

      let desired = (dropdownSelections && dropdownSelections.ongoing && dropdownSelections.ongoing !== '__none__')
        ? dropdownSelections.ongoing
        : (Array.isArray(filteredCollectionsForDropdown) && filteredCollectionsForDropdown[0] ? filteredCollectionsForDropdown[0].collectionName : null);

      // If the desired/current selection is the generic 'mappings' but no mappings
      // are loaded, prefer any available ongoing collection (first in list).
      if (String(desired).toLowerCase() === 'mappings' && Array.isArray(filteredCollectionsForDropdown) && filteredCollectionsForDropdown.length > 0) {
        const firstOngoing = filteredCollectionsForDropdown.find((c) => String(c.collectionName || '').toLowerCase().includes('ongoing')) || filteredCollectionsForDropdown[0];
        if (firstOngoing && firstOngoing.collectionName) desired = firstOngoing.collectionName;
      }

      if (!desired) return;

      if (!selectedCollection || String(selectedCollection) !== String(desired)) {
        console.log('Dashboard: activeTab is ongoing and no mappings loaded — loading', desired);
        if (typeof onSelectCollection === 'function') onSelectCollection(desired);
      } else {
        console.log('Dashboard: activeTab is ongoing but selectedCollection already matches', selectedCollection);
        // If selectedCollection is 'mappings' but there are no mappings yet, try to load
        // a real ongoing collection if available.
        if (Array.isArray(mappings) && mappings.length === 0 && String(selectedCollection).toLowerCase() === 'mappings' && Array.isArray(filteredCollectionsForDropdown) && filteredCollectionsForDropdown.length > 0) {
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
      const isCsv = fileName.endsWith('.csv') || String(file.type || '').toLowerCase() === 'text/csv';
      let wb;
      if (isCsv) {
        // Read CSV as text and parse into a workbook using XLSX.read
        // (xlsx-js-style doesn't expose csv_to_sheet; read CSV as string instead)
        const text = await file.text();
        wb = XLSX.read(text, { type: 'string' });
      } else {
        const buffer = await file.arrayBuffer();
        wb = XLSX.read(buffer, { type: 'array' });
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

      const buildRecordsFromRows = (rows, sheetName) => {
        const headerRowIndex = findHeaderRowIndex(rows);
        if (headerRowIndex === -1) return { records: [], rawRecords: [], error: 'no-header', sheetName };

        const headerRowOriginal = rows[headerRowIndex].map((h) => String(h || '').trim());

        console.log(`📋 Sheet "${sheetName}" - Header row found at index ${headerRowIndex}`);
        console.log(`📋 Sheet "${sheetName}" - Headers:`, headerRowOriginal);

        // Build rawRecords for diagnostics
        const rawRecords = rows.slice(headerRowIndex + 1).map((row) => {
          const obj = {};
          for (let i = 0; i < headerRowOriginal.length; i += 1) {
            const key = sanitizeFieldName(headerRowOriginal[i] || `col_${i}`);
            obj[key] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
          }
          return obj;
        });

        // Use schema-based field mapping (header tokens, not indexes)
        const fieldMap = mapHeadersToFields(headerRowOriginal);
        
        // Require at least one core field to be mapped
        const hasCoreField = (
          fieldMap.control_number !== undefined ||
          fieldMap.survey_number !== undefined ||
          fieldMap.applicant_proponent !== undefined ||
          fieldMap.name_of_project !== undefined
        );

        if (!hasCoreField) {
          console.error(`❌ Sheet "${sheetName}" - No core fields mapped!`, { fieldMap, headers: headerRowOriginal });
          return { records: [], rawRecords, error: 'invalid-headers', sheetName, found: headerRowOriginal };
        }

        console.log(`✅ Sheet "${sheetName}" - Core fields found, proceeding with import`);

        // Detect region from sheet name
        const fallbackRegion = detectRegionSheet(sheetName) || sheetName || '';
        
        // Generate batch ID for this import
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const records = [];
        const dataRows = rows.slice(headerRowIndex + 1);

        dataRows.forEach((row) => {
          // Build Firestore document using schema
          const doc = buildFirestoreDocument(row, fieldMap, sheetName, batchId);
          
          // Override region if not present in data
          if (!doc.region) {
            doc.region = fallbackRegion;
          }

          // Validate row is not empty
          if (isValidRow(doc)) {
            records.push(doc);
          }
        });

        console.log(`✅ Sheet "${sheetName}" - Imported ${records.length} records`);

        return { records, rawRecords, error: null, sheetName };
      };

      const allRecords = [];
      const invalidSheets = [];
      const skipSheets = new Set(['summary', 'summary per year']);
      const dataSheets = wb.SheetNames.filter((sheetName) => {
        if (!sheetName) return false;
        const sn = String(sheetName || '').trim().toLowerCase();
        if (skipSheets.has(sn)) return false;
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

        const { records, error, rawRecords } = buildRecordsFromRows(wsRows, sheetName);
        if (error) {
          invalidSheets.push(sheetName);
        } else {
          allRecords.push(...records);
          if (rawRecords && rawRecords.length) rawSheets.push({ sheetName, rawRecords });
        }

        const progress = 10 + Math.round(((index + 1) / totalSheets) * 70);
        setImportProgress(progress);
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
      // Instead of importing immediately, ask the user whether to add or create new
      setImportPreviewRecords(allRecords);
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
    if (!importPreviewRecords || importPreviewRecords.length === 0) {
      setShowImportChoiceModal(false);
      setIsImporting(false);
      setImportProgress(0);
      return;
    }

    try {
      // Start actual import phase
      setIsImporting(true);
      setImportProgress(1);
      // If user is the NCIP inventory user and is currently on the Ongoing tab,
      // force the import into a dedicated ongoing collection so Approved and
      // Ongoing are stored separately in Firestore.
      let options = { mode, onProgress: (p) => setImportProgress(p), targetTab: activeTab };
      let forcedOngoingCollection = null;
      try {
        const userEmail = (user?.email || '').toLowerCase();
        if (userEmail === 'ncip@inventory.gov.ph' && activeTab === 'ongoing') {
          // Force newCollection mode and use a dedicated ongoing collection name
          const uid = user?.uid || 'anon';
          forcedOngoingCollection = `mappings_ongoing_${uid}`;
          options = { ...options, mode: 'newCollection', collectionName: forcedOngoingCollection, forceOngoing: true };
        }
      } catch (e) {
        // ignore
      }
      if (mode === 'newCollection') {
        // If we forced an ongoing collection, always use that name regardless
        // of the user-supplied collection name (prevents overwriting to mappings_import_...)
        if (forcedOngoingCollection) {
          options.collectionName = forcedOngoingCollection;
        } else {
          options.collectionName = collectionName || importCollectionName;
        }
        // When creating a new collection, include the raw sheet rows so the
        // created collection uses the original Excel headers as document fields.
        options.rawImport = importRawSheets;
      }
      await onImportMappings(importPreviewRecords, options);
      // If we imported into a dedicated ongoing collection, switch UI to show it
      try {
        const col = options && options.collectionName;
        if (col && String(col).toLowerCase().includes('ongoing')) {
          setActiveTab('ongoing');
          if (typeof onSelectCollection === 'function') onSelectCollection(col);
        }
      } catch (e) {
        // ignore
      }
      const modeMsg = mode === 'add' ? 'added' : mode === 'replace' ? 'replaced' : (mode === 'newCollection' ? 'imported into new collection' : 'processed');
      setAlertTick((t) => t + 1);
      setAlert({ type: 'success', message: `Import successful. ${importPreviewRecords.length} records ${modeMsg}.` });
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
          m.projectCost || '',
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

  // Clear all records handler
  const handleClearAll = async () => {
    setIsClearingAll(true);
    try {
      // Delete all mappings one by one
      for (const mapping of mappings) {
        await onDeleteMapping(mapping.id);
      }
      setAlertTick((t) => t + 1);
      setAlert({ type: 'success', message: `Successfully deleted ${mappings.length} record(s).` });
      handleCloseClearAllModal();
    } catch (error) {
      setAlertTick((t) => t + 1);
      setAlert({ type: 'error', message: error?.message || 'Failed to clear records.' });
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleCloseClearAllModal = () => {
    if (isClearingAll) return;
    setIsClosingClearAllModal(true);
    setTimeout(() => {
      setShowClearAllModal(false);
      setIsClosingClearAllModal(false);
    }, 200);
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
  const parseProjectCost = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const cleaned = String(v).replace(/[^0-9.-]+/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const totalProjectCostNumber = mappings.reduce((sum, m) => {
    return sum + parseProjectCost(m.projectCost || m.project_cost || m.cost || 0);
  }, 0);

  const approvedCount = mappings.filter(m => {
    const status = String(m.cadtStatus || m.cadt_status || '').toLowerCase();
    return status.includes('approved') || status.includes('registered') || status.includes('awarded');
  }).length;

  const ongoingCount = mappings.filter(m => {
    const status = String(m.cadtStatus || m.cadt_status || '').toLowerCase();
    return status.includes('on process') || status.includes('for processing') || status.includes('processing');
  }).length;

  const stats = {
    totalMappings: mappings.length,
    totalProjectCost: totalProjectCostNumber,
    totalProjectCostFormatted: (totalProjectCostNumber === 0) ? '0.00' : `₱${totalProjectCostNumber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    regions: new Set(mappings.map((m) => m.region)).size,
    approved: approvedCount,
    ongoing: ongoingCount,
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
      {/* Clear All Confirmation Modal */}
      {showClearAllModal && (
        <>
          <div
            className={cn(
              "fixed inset-0 z-[100] transition-all duration-200",
              isClosingClearAllModal ? "animate-out fade-out" : "animate-in fade-in"
            )}
            style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(3,6,23,0.45)' }}
            onClick={() => {
              if (!isClearingAll) {
                setIsClosingClearAllModal(true);
                setTimeout(() => {
                  setShowClearAllModal(false);
                  setIsClosingClearAllModal(false);
                }, 200);
              }
            }}
          />

          <div className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[92vw] max-w-md transition-all duration-200",
            isClosingClearAllModal ? "animate-out zoom-out fade-out" : "animate-in zoom-in fade-in"
          )}>
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 sm:py-5" style={{ backgroundImage: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center ring-2 ring-white/25 shadow-xl">
                    <Trash2 size={22} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Clear All Records</h3>
                </div>
              </div>

              <div className="px-4 sm:px-6 py-4 sm:py-5 text-white/90">
                <p className="text-sm mb-3">
                  Are you sure you want to delete <strong className="text-red-300">{mappings.length}</strong> record(s)?
                </p>
                <p className="text-xs text-white/70">
                  This action cannot be undone. All data will be permanently removed from the database.
                </p>
              </div>

              <div className="px-4 sm:px-6 py-3 border-t border-white/15 flex gap-3 bg-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsClosingClearAllModal(true);
                    setTimeout(() => {
                      setShowClearAllModal(false);
                      setIsClosingClearAllModal(false);
                    }, 200);
                  }}
                  disabled={isClearingAll}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/20 text-white/90 hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isClearingAll}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isClearingAll ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete All
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
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
                <p className="text-sm mb-2">Found <strong>{importPreviewRecords.length}</strong> record(s) across the uploaded sheets.</p>
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
                <p className="text-sm mb-2">Do you want to <strong>add</strong> these records into the existing database or <strong>create a new set</strong>?</p>
                <p className="text-xs text-white/70 mb-2">If your Excel file has a different format, choose Create new and review results first.</p>
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
                    Add to Existing
                  </button>
                </div>

                {mappings.length > 0 ? (
                  <div className="w-full">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={importCollectionName}
                        onChange={(e) => setImportCollectionName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 placeholder-white/50"
                        placeholder="mappings_import_<uid>_2026-02-09T..."
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const valid = /^[A-Za-z0-9_-]+$/.test(importCollectionName.replace(/^mappings_import_/, '')) || /^[A-Za-z0-9_-]+$/.test(importCollectionName);
                          if (!importCollectionName || !valid) {
                            setAlertTick((t) => t + 1);
                            setAlert({ type: 'error', message: 'Please enter a valid collection name (letters, numbers, hyphens, underscores).' });
                            return;
                          }
                          handleConfirmImport('newCollection', importCollectionName);
                        }}
                        className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
                      >
                        Create
                      </button>
                    </div>
                    <p className="text-xs text-white/70 mt-2">Collection names may contain letters, numbers, hyphens and underscores only.</p>
                  </div>
                ) : (
                  <div className="w-full">
                    <p className="text-sm text-white/80">No existing mappings found — only adding is available.</p>
                  </div>
                )}
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
                  You are logged in as <span className="font-semibold text-[#F2C94C]">{user.role}</span>. Manage Indigenous Cultural Community mappings below.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {Array.isArray(availableCollections) && availableCollections.length > 1 && activeTab !== 'ongoing' && activeTab !== 'overview' ? (
                  <div className="flex items-center gap-2 mr-2">
                        <label className="sr-only">Collection</label>
                        <Select
                          value={dropdownSelections[activeTab === 'ongoing' ? 'ongoing' : 'mappings']}
                          onValueChange={(value) => {
                            const key = activeTab === 'ongoing' ? 'ongoing' : 'mappings';
                            console.log('Dashboard: dropdown changed ->', { key, value, activeTab, selectedCollection });
                            setDropdownSelections((s) => ({ ...s, [key]: value }));
                            // If the dropdown change happened on the currently active tab,
                            // load the collection immediately so the selected data remains visible.
                            if ((activeTab === 'ongoing' && key === 'ongoing') || (activeTab === 'mappings' && key === 'mappings')) {
                              // don't trigger load for the placeholder empty entry
                              if (value && value !== '__none__' && typeof onSelectCollection === 'function') {
                                console.log('Dashboard: calling onSelectCollection from dropdown ->', value);
                                onSelectCollection(value);
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="relative w-[220px] bg-white/5 text-white/90 text-sm rounded-lg px-3 py-2 border border-white/10">
                            <SelectValue placeholder="Select collection" />
                            <div className="absolute inset-0 pointer-events-none flex items-center px-3">
                              <span className="truncate text-sm text-white/90">{currentSelectionDisplay}</span>
                            </div>
                          </SelectTrigger>
                          <SelectContent className="bg-white border-[#0A2D55]/10 rounded-xl shadow-2xl">
                            {filteredCollectionsForDropdown.length > 0 ? (
                              filteredCollectionsForDropdown.map((c) => (
                                <SelectItem key={c.id} value={c.collectionName}>{c.displayName || c.collectionName}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="__none__" disabled>
                                {activeTab === 'ongoing' ? 'No ongoing collections' : 'No collections'}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-white/25 transition active:scale-95"
                >
                  <Upload size={16} className="sm:w-4.5 sm:h-4.5" />
                  Upload Excel
                </button>
                {mappings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearAllModal(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/20 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white ring-1 ring-red-500/30 backdrop-blur-md hover:bg-red-500/30 transition active:scale-95"
                  >
                    <Trash2 size={16} className="sm:w-4.5 sm:h-4.5" />
                    Clear All Records
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
              <span>Approved</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('ongoing');
                setMobileMenuOpen(false);
              }}
              className={`flex-1 min-w-0 sm:flex-none px-3 sm:px-5 py-3 sm:py-3.5 font-medium text-xs sm:text-base border-b-2 transition whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'ongoing'
                  ? 'border-[#F2C94C] text-[#0A2D55] bg-[#F2C94C]/10'
                  : 'border-transparent text-[#0A2D55]/70 hover:text-[#0A2D55] hover:bg-[#0A2D55]/5'
              }`}
            >
              <Bell size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
              <span>Ongoing</span>
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
                    <p className="text-[#0A2D55]/70 text-xs sm:text-sm font-medium mb-1">Total Project Cost</p>
                    <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-[#0C3B6E] leading-tight">{stats.totalProjectCostFormatted}</p>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-[#F2C94C]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-[#0C3B6E]" />
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
                    <p className="text-[#0A2D55]/70 text-xs sm:text-sm font-medium truncate">Approved</p>
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

                <div className="w-full sm:w-[200px]">
                  <Select
                    value={regionFilter}
                    onValueChange={(value) => {
                      setRegionFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full bg-white border-2 border-[#0A2D55]/10 rounded-xl px-4 py-2.5 text-sm text-[#0A2D55] hover:border-[#F2C94C]/40 focus:ring-[#F2C94C]/40 shadow-sm">
                      <SelectValue placeholder="All Regions" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#0A2D55]/10 rounded-xl shadow-2xl">
                      {regionOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className="hidden sm:block overflow-x-auto">
                  <table className={isInventoryUser ? "w-full table-auto min-w-[1600px]" : "w-full table-fixed"}>
                    <thead className="bg-[#0A2D55]/5 border-b border-[#0A2D55]/15">
                      <tr>
                        {getTableHeaders().map((h, idx) => (
                          <th
                            key={idx}
                            className={
                              isInventoryUser
                                ? "px-3 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-semibold text-[#0A2D55] normal-case leading-snug whitespace-normal break-words min-w-[120px]"
                                : "px-3 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-semibold text-[#0A2D55] normal-case leading-snug"
                            }
                          >
                            {h}
                          </th>
                        ))}
                        <th className="px-3 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-semibold text-[#0A2D55] normal-case w-[120px] sticky right-0 bg-[#F4F7FA] shadow-[-6px_0_10px_rgba(7,26,44,0.06)]">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMappings.map((mapping, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-[#0A2D55]/10 hover:bg-[#F2C94C]/5 transition fade-in-up"
                          style={{ animationDelay: `${idx * 100 + 400}ms`, opacity: 0 }}
                        >
                          {getTableHeaders().map((h, i) => (
                            <td
                              key={i}
                              className={
                                isInventoryUser
                                  ? "px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 whitespace-normal break-words min-w-[140px]"
                                  : "px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-xs truncate"
                              }
                              title={String(renderCellForHeader(mapping, h) || '')}
                            >
                              {renderCellForHeader(mapping, h)}
                            </td>
                          ))}
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
                          <p className="text-xs text-[#0A2D55]/60 font-medium">SURVEY NUMBER</p>
                          <p className="text-sm font-bold text-[#0A2D55] truncate">{mapping.surveyNumber}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-[#0A2D55]/60 font-medium">REGION</p>
                          <p className="text-xs text-[#0A2D55]/90 truncate">{mapping.region || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#0A2D55]/60 font-medium">AREA (HA)</p>
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
                        <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">ICCS/IPS</p>
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
                  {activeTab === 'ongoing' ? (
                    <>
                      <div className="text-xs sm:text-sm text-[#0A2D55]/70 font-medium">
                        Showing <span className="font-bold text-[#0A2D55]">{ongoingStart + 1}</span> to <span className="font-bold text-[#0A2D55]">{Math.min(ongoingEnd, (ongoingRecords || []).length)}</span> of <span className="font-bold text-[#0A2D55]">{(ongoingRecords || []).length}</span> records
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
                          Page <span className="text-[#F2C94C]">{currentPage}</span> of <span className="text-[#F2C94C]">{ongoingTotalPages || 1}</span>
                        </div>
                        <button
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage >= ongoingTotalPages}
                          className={cn(
                            'flex items-center justify-center gap-1 px-2.5 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition',
                            currentPage < ongoingTotalPages
                              ? 'bg-[#0A2D55] text-white hover:bg-[#0C3B6E] active:scale-95 shadow-md'
                              : 'bg-[#0A2D55]/20 text-[#0A2D55]/50 cursor-not-allowed'
                          )}
                          aria-label="Next page"
                        >
                          <span className="hidden sm:inline">Next →</span>
                          <span className="sm:hidden">→</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs sm:text-sm text-[#0A2D55]/70 font-medium">
                        Showing <span className="font-bold text-[#0A2D55]">{startIndex + 1}</span> to <span className="font-bold text-[#0A2D55]">{Math.min(endIndex, filteredMappings.length)}</span> of <span className="font-bold text-[#0A2D55]">{filteredMappings.length}</span> records
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={!canGoPrevious}
                          className={cn(
                            'flex items-center justify-center gap-1 px-2.5 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition',
                            canGoPrevious
                              ? 'bg-[#0A2D55] text-white hover:bg-[#0C3B6E] active:scale-95 shadow-md'
                              : 'bg-[#0A2D55]/20 text-[#0A2D55]/50 cursor-not-allowed'
                          )}
                          aria-label="Previous page"
                        >
                          <span className="sm:hidden">←</span>
                          <span className="hidden sm:inline">← Previous</span>
                        </button>
                        <div className="text-xs sm:text-sm text-[#0A2D55] font-semibold px-2 py-1">
                          Page <span className="text-[#F2C94C]">{currentPage}</span> of <span className="text-[#F2C94C]">{totalPages || 1}</span>
                        </div>
                        <button
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={!canGoNext}
                          className={cn(
                            'flex items-center justify-center gap-1 px-2.5 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition',
                            canGoNext
                              ? 'bg-[#0A2D55] text-white hover:bg-[#0C3B6E] active:scale-95 shadow-md'
                              : 'bg-[#0A2D55]/20 text-[#0A2D55]/50 cursor-not-allowed'
                          )}
                          aria-label="Next page"
                        >
                          <span className="sm:hidden">→</span>
                          <span className="hidden sm:inline">Next →</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ongoing' && (
          <div className="animate-section-1">
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-header">
              <h2 className="text-lg sm:text-2xl font-bold text-[#0A2D55]">Ongoing</h2>
            </div>
            {isInventoryUser ? (
              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-6 overflow-x-auto">
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
                            ongoingSummaryRows.map((r, idx) => (
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
                            ))
                          )}
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
                            <th className="px-2 sm:px-2 py-1 text-left text-[10px] sm:text-[11px] font-semibold text-[#0A2D55] normal-case w-[110px]">ACTIONS</th>
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
                                  <td key={j} className="px-2.5 sm:px-3 py-2 text-[12px] text-[#0A2D55]/80 whitespace-normal">{getOngoingField(m, k)}</td>
                                ))}
                                <td className="px-2.5 sm:px-3 py-2 text-[12px] text-[#0A2D55]/80 w-[110px]">
                                  <div className="flex items-center gap-1.5">
                                    <button type="button" onClick={() => handleViewMapping(m)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#0A2D55]/15 text-[#0A2D55] hover:bg-[#0A2D55]/5 transition" title="View" aria-label="View"><Eye size={15} /></button>
                                    <button type="button" onClick={() => onEditMapping(m)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-[#F2C94C]/40 text-[#8B6F1C] hover:bg-[#F2C94C]/15 transition" title="Edit" aria-label="Edit"><Pencil size={15} /></button>
                                    <button type="button" onClick={() => handleOpenDeleteModal(m)} className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition" title="Delete" aria-label="Delete"><Trash2 size={15} /></button>
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
      <div className="fixed right-8 z-50 bottom-20 sm:bottom-8" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
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
                    placeholder="mappings.xlsx"
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
                <p className="text-sm">Are you sure you want to delete this mapping? This action cannot be undone.</p>
                <div className="mt-4 rounded-xl border border-white/15 bg-white/10 p-3 text-xs">
                  <p className="font-semibold text-white">{deleteTarget.surveyNumber || 'Untitled Mapping'}</p>
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

              <div className="px-4 sm:px-6 py-4 sm:py-5 text-white/90 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {isInventoryUser ? (
                    <>
                      {/* NCIP Inventory User View */}
                      <div>
                        <p className="text-xs font-semibold text-white/70">No. (Survey Number)</p>
                        <p className="text-white font-semibold mt-1">{selectedMapping.surveyNumber || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Region</p>
                        <p className="text-white mt-1">{selectedMapping.region || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Control Number</p>
                        <p className="text-white font-semibold mt-1">{selectedMapping.controlNumber || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Proponent</p>
                        <p className="text-white mt-1">{selectedMapping.applicantProponent || selectedMapping.proponent || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Name of Project</p>
                        <p className="text-white mt-1">{selectedMapping.nameOfProject || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Location</p>
                        <p className="text-white mt-1">{selectedMapping.location || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Nature of Project</p>
                        <p className="text-white mt-1">{selectedMapping.natureOfProject || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Project Cost</p>
                        <p className="text-white mt-1">{selectedMapping.projectCost || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">CADT Status</p>
                        <p className="text-white mt-1">{selectedMapping.cadtStatus || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Affected ICC</p>
                        <p className="text-white mt-1">{selectedMapping.icc?.join(', ') || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">Year Approved</p>
                        <p className="text-white mt-1">{selectedMapping.yearApproved || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/70">MOA Duration</p>
                        <p className="text-white mt-1">{selectedMapping.moaDuration || '-'}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold text-white/70">Community Benefits</p>
                        <p className="text-white mt-1">{selectedMapping.communityBenefits || '-'}</p>
                      </div>
                      {selectedMapping.remarks && (
                        <div className="sm:col-span-2">
                          <p className="text-xs font-semibold text-white/70">Remarks</p>
                          <p className="text-white mt-1">{selectedMapping.remarks}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Regular User View */}
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
