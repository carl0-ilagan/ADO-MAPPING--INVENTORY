/**
 * CP Projects Schema - Single Source of Truth
 * 
 * Unified Firestore schema for cp_projects collection.
 * All project data is stored in this master table with status field (Pending/Approved/Ongoing).
 * All summary views and reports are dynamically computed from this collection.
 */

// Master table schema for cp_projects collection
export const CP_PROJECTS_SCHEMA = {
  // Core fields
  id: 'string',                          // Auto-generated document ID
  region: 'string',                      // Region (CAR, Region I, etc.)
  date_filed: 'timestamp',               // Date when project was filed
  proponent: 'string',                   // Applicant/Proponent name
  project_name: 'string',                // Name of the project
  project_cost: 'string',                // Project cost (kept as string to preserve formatting)
  location: 'string',                    // Full location description
  affected_ancestral_domain: 'string',   // Affected ancestral domain/s
  type_of_project: 'string',             // Project type/nature
  affected_icc: 'array',                 // Array of affected ICCs/IPs
  status_of_application: 'string',       // Current application status/remarks
  status: 'string',                      // Main status: 'Pending', 'Approved', or 'Ongoing'
  year_applied: 'number',                // Year extracted from date_filed
  
  // CADT/CALT identification fields
  control_number: 'string',              // CADT/CALT control number
  survey_number: 'string',               // Survey/ECCV/Petition number
  cadt_status: 'string',                 // CADT/CALT status or type
  
  // Additional project details
  total_area: 'number',                  // Total area in hectares
  moa_duration: 'string',                // MOA duration
  community_benefits: 'string',          // Benefits to community
  year_approved: 'string',               // Year approved (for approved projects)
  
  // Optional detailed location fields
  province: 'string',                    // Province name
  municipality: 'string',                // Municipality name(s)
  barangay: 'string',                    // Barangay name(s)
  
  // FPIC/Ongoing Workflow Status Fields (for projects with ongoing FPIC)
  has_ongoing_fpic: 'boolean',           // Flag if project has ongoing FPIC process
  issuance_of_work_order: 'string',      // Work order issuance status/date
  pre_fbi_conference: 'string',          // Pre-FBI conference status/date
  conduct_of_fbi: 'string',              // FBI conduct status/date
  review_of_fbi_report: 'string',        // FBI report review status/date
  pre_fpic_conference: 'string',         // Pre-FPIC conference status/date
  first_community_assembly: 'string',    // 1st community assembly status/date
  second_community_assembly: 'string',   // 2nd community assembly status/date
  consensus_building_decision: 'string', // Consensus building & decision meeting
  moa_validation_ratification_signing: 'string', // MOA validation/ratification/signing
  issuance_resolution_of_consent: 'string',      // Resolution of consent issuance
  review_by_rrt: 'string',               // RRT review status/date
  review_by_ado_or_lao: 'string',        // ADO/LAO review status/date
  for_compliance_of_fpic_team: 'string', // FPIC team compliance status
  ceb_deliberation: 'string',            // CEB deliberation status/date
  
  // Metadata
  created_at: 'timestamp',               // When record was created
  updated_at: 'timestamp',               // Last update timestamp
  imported_at: 'timestamp',              // When imported from Excel (if applicable)
  import_batch_id: 'string',             // Batch identifier for imports
};

// Excel header mappings to cp_projects fields
export const CP_PROJECTS_EXCEL_MAPPINGS = {
  region: [
    'region',
    'regional office',
    'ro',
  ],
  date_filed: [
    'date filed',
    'date of filing',
    'date of application',
    'filing date',
    'application date',
    'date applied',
    'date received',
  ],
  proponent: [
    'proponent',
    'name of proponent',
    'applicant',
    'applicant/proponent',
    'applicant proponent',
    'company',
    'company name',
    'organization',
  ],
  project_name: [
    'project name',
    'name of project',
    'project',
    'project title',
    'name',
  ],
  project_cost: [
    'project cost',
    'cost',
    'total project cost',
    'total cost',
    'estimated cost',
  ],
  // Location and area fields - order matters! More specific first
  total_area: [
    'total area',
    'area',
    'project area',
    'project area in hectares',
    'area (hectares)',
    'area hectares',
    'area ha',
  ],
  location: [
    'location',
    'project location',
    'site location',
    'address',
  ],
  affected_ancestral_domain: [
    'affected ancestral domain',
    'affected ancestral domains',
    'ancestral domain',
    'ancestral domains',
    'affected ad',
    'affected a d',
  ],
  type_of_project: [
    'type of project',
    'project type',
    'nature of project',
    'project category',
    'category',
    'type',
    'nature',
  ],
  affected_icc: [
    'affected icc',
    'affected iccs',
    'affected iccs ips',
    'affected ad icc ip',
    'affected ad/icc/ip',
    'icc',
    'iccs',
    'affected ips',
    'ips',
    'indigenous peoples',
    'ip groups',
    'icc/ip',
    'icc ip',
    'per ip group',
  ],
  status_of_application: [
    'status of application',
    'application status',
    'current status',
    'remarks',
    'status remarks',
    'notes',
    'ado remarks status',
  ],
  status: [
    'status',
    'project status',
    'state',
  ],
  // CADT/CALT fields
  control_number: [
    'control number',
    'control no',
    'cadt calt no',
    'cadt no',
    'calt no',
    'cadt/calt no',
  ],
  survey_number: [
    'survey number',
    'survey no',
    'eccv no',
    'eccv number',
    'petition no',
    'petition number',
  ],
  cadt_status: [
    'cadt status',
    'cadt type',
    'type cadt calt',
    'type (cadt/calt)',
    'cadt',
    'calt',
  ],
  // Additional details (note: total_area is defined earlier with location fields)
  moa_duration: [
    'moa duration',
    'duration',
    'memorandum duration',
  ],
  community_benefits: [
    'community benefits',
    'benefits to community',
    'benefits',
  ],
  year_approved: [
    'year approved',
    'date approved',
    'approved year',
  ],
  // Location fields
  province: [
    'province',
    'provinces',
  ],
  municipality: [
    'municipality',
    'municipalities',
    'municipality/ies',
    'municipal',
    'city',
    'city/municipality',
  ],
  barangay: [
    'barangay',
    'barangays',
    'barangay/s',
    'brgy',
  ],
  // FPIC/Ongoing workflow fields
  has_ongoing_fpic: [
    'for cp with ongoing fpic',
    '(for cp with ongoing fpic)',
    'ongoing fpic',
    'has ongoing fpic',
  ],
  issuance_of_work_order: [
    'issuance of work order',
    'work order',
    'work order issued',
  ],
  pre_fbi_conference: [
    'pre-fbi conference',
    'pre fbi conference',
    'pre fbi',
  ],
  conduct_of_fbi: [
    'conduct of fbi',
    'conducting fbi',
    'fbi conduct',
  ],
  review_of_fbi_report: [
    'review of fbi report',
    'fbi report review',
    'review fbi report',
  ],
  pre_fpic_conference: [
    'pre-fpic conference',
    'pre fpic conference',
    'pre fpic',
  ],
  first_community_assembly: [
    '1st community assembly',
    'first community assembly',
  ],
  second_community_assembly: [
    '2nd community assembly',
    'second community assembly',
  ],
  consensus_building_decision: [
    'consensus building & decision meeting',
    'consensus building',
    'decision meeting',
  ],
  moa_validation_ratification_signing: [
    'moa validation',
    'moa ratification',
    'moa signing',
    'moa validation ratification signing',
  ],
  issuance_resolution_of_consent: [
    'issuance of resolution of consent',
    'resolution of consent',
  ],
  review_by_rrt: [
    'review of the fpic report by rrt',
    'review by rrt',
    'rrt review',
  ],
  review_by_ado_or_lao: [
    'review of the fpic report by ado',
    'review by ado',
    'review by lao',
    'ado review',
    'lao review',
  ],
  for_compliance_of_fpic_team: [
    'for compliance of fpic team',
    'for compliance',
    'compliance fpic',
  ],
  ceb_deliberation: [
    'ceb deliberation',
    'ceb',
  ],
};

/**
 * Normalize header text for matching (case-insensitive, punctuation-tolerant)
 */
export function normalizeHeader(headerText) {
  return String(headerText || '')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')           // Non-breaking space
    .replace(/[\r\n\t]+/g, ' ')        // Line breaks, tabs
    .replace(/["""'''`]/g, '')         // Quotes
    .replace(/[/\\]/g, ' ')           // Slashes
    .replace(/_+/g, ' ')               // Underscores to spaces
    .replace(/[^\w\s]/g, ' ')          // Non-word chars except space
    .replace(/\s+/g, ' ')              // Collapse whitespace
    .trim();
}

/**
 * Map Excel headers to cp_projects field names
 * Returns { fieldName: columnIndex }
 */
export function mapExcelHeadersToCPFields(excelHeaders) {
  const normalizedHeaders = excelHeaders.map(normalizeHeader);
  const fieldMap = {};
  const usedIndices = new Set(); // Track which column indices are already mapped

  console.log('📋 Mapping Excel headers to cp_projects fields...');
  console.log('   Excel Headers:', excelHeaders);

  // First pass: Exact matches only (highest priority)
  Object.entries(CP_PROJECTS_EXCEL_MAPPINGS).forEach(([fieldName, variants]) => {
    const normalizedVariants = variants.map(normalizeHeader);
    
    const matchIndex = normalizedHeaders.findIndex((header, idx) => {
      if (usedIndices.has(idx)) return false; // Skip already-mapped columns
      return normalizedVariants.some((variant) => header === variant);
    });

    if (matchIndex !== -1) {
      fieldMap[fieldName] = matchIndex;
      usedIndices.add(matchIndex);
      console.log(`   ✓ [EXACT] Mapped '${excelHeaders[matchIndex]}' → ${fieldName}`);
    }
  });

  // Second pass: Multi-word contains matches
  Object.entries(CP_PROJECTS_EXCEL_MAPPINGS).forEach(([fieldName, variants]) => {
    if (fieldName in fieldMap) return; // Skip if already mapped
    
    const normalizedVariants = variants.map(normalizeHeader);
    
    const matchIndex = normalizedHeaders.findIndex((header, idx) => {
      if (usedIndices.has(idx)) return false;
      return normalizedVariants.some((variant) => {
        // Compact match (no spaces)
        const compactHeader = header.replace(/\s/g, '');
        const compactVariant = variant.replace(/\s/g, '');
        if (compactHeader === compactVariant) return true;
        
        // Contains match - only if variant is multi-word (more specific)
        if (variant.split(/\s+/).length > 1 && header.includes(variant)) return true;
        if (header.split(/\s+/).length > 2 && variant.length > 5 && header.includes(variant)) return true;
        
        return false;
      });
    });

    if (matchIndex !== -1) {
      fieldMap[fieldName] = matchIndex;
      usedIndices.add(matchIndex);
      console.log(`   ✓ [CONTAINS] Mapped '${excelHeaders[matchIndex]}' → ${fieldName}`);
    }
  });

  return fieldMap;
}

/**
 * Extract year from date field (timestamp or string)
 */
export function extractYear(dateValue) {
  if (!dateValue) return null;
  
  try {
    // If it's a Firestore Timestamp
    if (typeof dateValue === 'object' && dateValue.toDate) {
      return dateValue.toDate().getFullYear();
    }
    
    // If it's a Date object
    if (dateValue instanceof Date) {
      return dateValue.getFullYear();
    }
    
    // If it's a string, try to parse it
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.getFullYear();
      }
      
      // Try to extract year with regex (YYYY)
      const yearMatch = dateValue.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        return parseInt(yearMatch[0], 10);
      }
    }
    
    // If it's already a number
    if (typeof dateValue === 'number' && dateValue > 1900 && dateValue < 2100) {
      return dateValue;
    }
  } catch (error) {
    console.warn('Failed to extract year:', error);
  }
  
  return null;
}

/**
 * Parse date from various formats
 */
export function parseDate(dateValue) {
  if (!dateValue && dateValue !== 0) return null;
  
  try {
    // If it's already a Firestore Timestamp
    if (typeof dateValue === 'object' && dateValue !== null && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // If it's a Date object
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }
    
    // If it's a number - could be Excel serial date or ms unix timestamp
    if (typeof dateValue === 'number') {
      // Small number = Excel serial date (days since Jan 0, 1900)
      // Excel serial 1 = Jan 1, 1900; ~45000 = year 2023
      if (dateValue > 0 && dateValue < 200000) {
        // Convert Excel serial to JS Date
        // Excel serial 25569 = Jan 1, 1970 (Unix epoch)
        const msFromEpoch = (dateValue - 25569) * 86400 * 1000;
        const d = new Date(msFromEpoch);
        return isNaN(d.getTime()) ? null : d;
      }
      // Large number = ms unix timestamp (e.g., 1351521129600 ms = Oct 2012)
      if (dateValue > 1000000000000) {
        const d = new Date(dateValue);
        return isNaN(d.getTime()) ? null : d;
      }
      // Medium number could be seconds timestamp
      if (dateValue > 1000000000) {
        const d = new Date(dateValue * 1000);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    }
    
    // If it's a string, try to parse
    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim();
      if (!trimmed) return null;
      // Try as-is first
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) return date;
      // Try numeric string as ms timestamp
      const asNum = Number(trimmed);
      if (!isNaN(asNum) && asNum > 0) return parseDate(asNum);
    }
  } catch (error) {
    console.warn('Failed to parse date:', dateValue, error);
  }
  
  return null;
}

/**
 * Validate status field
 */
export function normalizeStatus(statusValue) {
  if (!statusValue) return 'Pending';
  
  const status = String(statusValue).toLowerCase().trim();
  
  if (status.includes('ongoing')) return 'Ongoing';
  if (status.includes('approved')) return 'Approved';
  if (status.includes('pending')) return 'Pending';
  
  // Default to Pending if unclear
  return 'Pending';
}

/**
 * Build a cp_projects document from Excel row data
 */
export function buildCPProjectDocument(rowData, fieldMap, sheetName = '', defaultStatus = 'Ongoing') {
  const doc = {};
  
  // Map fields from Excel columns
  Object.entries(fieldMap).forEach(([fieldName, columnIndex]) => {
    const value = rowData[columnIndex];
    
    if (value !== null && value !== undefined && value !== '') {
      // Special handling for specific fields
      if (fieldName === 'date_filed') {
        doc[fieldName] = parseDate(value);
      } else if (fieldName === 'affected_icc') {
        // Convert to array if comma-separated
        doc[fieldName] = Array.isArray(value)
          ? value
          : String(value).split(',').map(v => v.trim()).filter(Boolean);
      } else if (fieldName === 'status') {
        doc[fieldName] = normalizeStatus(value);
      } else {
        // Store as string for most fields
        doc[fieldName] = String(value).trim();
      }
    }
  });
  
  // Extract year from date_filed
  if (doc.date_filed) {
    doc.year_applied = extractYear(doc.date_filed);
  }
  
  // Always use sheet name as the authoritative region source when available.
  // The Excel sheet name (CAR, R1, R2, R13, etc.) is always correct.
  // This overrides any wrong region value that may exist in the row data.
  if (sheetName) {
    const detectedRegion = detectRegionFromSheetName(sheetName);
    // Only override if we successfully detected a real region (not just the raw sheet name fallback)
    if (detectedRegion && detectedRegion !== sheetName) {
      doc.region = detectedRegion;
    } else if (!doc.region) {
      doc.region = detectedRegion;
    }
  }
  
  // Set default status if not provided (use the passed defaultStatus parameter)
  if (!doc.status) {
    doc.status = defaultStatus; // Use tab-based default status
  }
  
  // Add metadata
  doc.created_at = new Date();
  doc.updated_at = new Date();
  
  return doc;
}

/**
 * Detect region from sheet name
 */
export function detectRegionFromSheetName(sheetName) {
  const name = String(sheetName).toUpperCase().trim();
  
  if (name.includes('CAR') || name.includes('CORDILLERA')) return 'CAR';
  
  // Roman numeral with suffix: Region IV-A, IVA
  const romanToNum = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13 };
  const romanSuffix = name.match(/(?:REGION\s*)?(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\s*[-–]?\s*(A|B)\b/);
  if (romanSuffix) {
    const n = romanToNum[romanSuffix[1]];
    return n ? `${n}${romanSuffix[2]}` : sheetName;
  }

  // Roman numeral without suffix
  const roman = name.match(/(?:REGION\s*)?(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/);
  if (roman) {
    const n = romanToNum[roman[1]];
    return n ? String(n) : sheetName;
  }

  // Region 6-7 / 6&7
  if (/6\s*[-&/]\s*7/.test(name)) return '6&7';

  // Arabic numeric: R2, R13, Region 2, Region 13, plain 2
  const arabic = name.match(/(?:REGION\s+|\bR)(\d{1,2})\s*[-–]?\s*(A|B)?$/) || name.match(/^(\d{1,2})\s*[-–]?\s*(A|B)?$/);
  if (arabic) {
    const n = Number(arabic[1]);
    if (n >= 1 && n <= 13) return arabic[2] ? `${n}${arabic[2]}` : String(n);
  }

  return sheetName; // Return as-is if can't detect
}

/**
 * Validate a cp_projects document
 */
export function validateCPProject(doc) {
  const errors = [];
  
  // Required fields
  if (!doc.proponent || String(doc.proponent).trim() === '') {
    errors.push('Proponent is required');
  }
  
  if (!doc.project_name || String(doc.project_name).trim() === '') {
    errors.push('Project name is required');
  }
  
  if (!doc.region || String(doc.region).trim() === '') {
    errors.push('Region is required');
  }
  
  // Valid status
  if (doc.status && !['Pending', 'Approved', 'Ongoing'].includes(doc.status)) {
    errors.push('Status must be Pending, Approved, or Ongoing');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get projects by status
 */
export function filterProjectsByStatus(projects, status) {
  if (!status || status === 'all') return projects;
  return projects.filter(p => p.status === status);
}

/**
 * Get projects by region
 */
export function filterProjectsByRegion(projects, region) {
  if (!region || region === 'all') return projects;
  return projects.filter(p => p.region === region);
}

/**
 * Compute summary by year per region
 */
export function computeSummaryByYear(projects) {
  const summary = {};
  
  projects.forEach(project => {
    const year = project.year_applied || 'Unknown';
    const region = project.region || 'Unknown';
    
    if (!summary[year]) {
      summary[year] = {};
    }
    
    if (!summary[year][region]) {
      summary[year][region] = 0;
    }
    
    summary[year][region]++;
  });
  
  return summary;
}

/**
 * Compute summary by project type per region
 */
export function computeSummaryByProjectType(projects) {
  const summary = {};
  
  projects.forEach(project => {
    const projectType = project.type_of_project || 'Unknown';
    const region = project.region || 'Unknown';
    
    if (!summary[projectType]) {
      summary[projectType] = {};
    }
    
    if (!summary[projectType][region]) {
      summary[projectType][region] = 0;
    }
    
    summary[projectType][region]++;
  });
  
  return summary;
}

/**
 * Get all unique regions from projects
 */
export function getUniqueRegions(projects) {
  const regions = new Set();
  projects.forEach(p => {
    if (p.region) regions.add(p.region);
  });
  return Array.from(regions).sort();
}

/**
 * Get all unique project types from projects
 */
export function getUniqueProjectTypes(projects) {
  const types = new Set();
  projects.forEach(p => {
    if (p.type_of_project) types.add(p.type_of_project);
  });
  return Array.from(types).sort();
}

/**
 * Get all unique years from projects
 */
export function getUniqueYears(projects) {
  const years = new Set();
  projects.forEach(p => {
    if (p.year_applied) years.add(p.year_applied);
  });
  return Array.from(years).sort((a, b) => b - a); // Descending order
}
