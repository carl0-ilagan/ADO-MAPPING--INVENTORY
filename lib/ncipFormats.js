// NCIP Excel detailed sheet header definitions for CAR and Regions I–XIII
// Exports a canonical header array and helpers to retrieve per-sheet formats.

export const NCIP_DETAILED_HEADERS = [
  'No.',
  'Region',
  'Control number',
  'Applicant/Proponent',
  'Name of Project',
  'Nature of Project',
  'Project Cost',
  'CADT Status',
  'ICC',
  'Location',
  'Year Approved',
  'Remarks',
];

export const REGION_SHEETS = [
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

// Return the canonical detailed headers for a region sheet.
export function getDetailedHeadersForSheet(sheetName) {
  if (!sheetName) return NCIP_DETAILED_HEADERS.slice();
  const name = String(sheetName).trim();
  // All region sheets use the same detailed header layout in NCIP workbook spec.
  if (REGION_SHEETS.includes(name)) return NCIP_DETAILED_HEADERS.slice();
  // Fallback: return canonical headers
  return NCIP_DETAILED_HEADERS.slice();
}

export default {
  NCIP_DETAILED_HEADERS,
  REGION_SHEETS,
  getDetailedHeadersForSheet,
};
