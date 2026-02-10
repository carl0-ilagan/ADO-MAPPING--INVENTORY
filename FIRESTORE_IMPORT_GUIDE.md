# Firestore Import System - Implementation Guide

## Overview

This system imports Excel files into Google Firestore with **robust field mapping** that prevents data scrambling and column misalignment.

### Key Features

✅ **Header-token mapping** (not column indexes) prevents column shifting  
✅ **Unified schema** across all sheets (CAR, R1-R13, Extractive/Mining)  
✅ **Normalized field names** (lowercase, underscores only)  
✅ **Explicit type conversion** (string → number/array)  
✅ **Source tracking** (source_sheet, import_batch_id)  
✅ **Validation** to prevent silent corruption

---

## Firestore Document Schema

Every imported record becomes a Firestore document with these **normalized fields**:

### Core Fields

| Firestore Field | Type | Description | Excel Header Variants |
|----------------|------|-------------|----------------------|
| `control_number` | string | Primary identifier | Control number, Control no, Control #, Control |
| `survey_number` | string | Alternative ID | Survey number, Survey no, No. |
| `region` | string | Region name | Region, CAR, Region I, etc. |
| `source_sheet` | string | Original Excel sheet | (auto-added) |

### Project Details

| Firestore Field | Type | Description | Excel Header Variants |
|----------------|------|-------------|----------------------|
| `applicant_proponent` | string | Company/individual | Applicant/Proponent, Applicant, Proponent, Company |
| `name_of_project` | string | Project title | Name of Project, Project Name |
| `nature_of_project` | string | Project type | Nature of Project, Nature |
| `project_cost` | string | Cost (preserved as string) | Project Cost, Cost |

### Location

| Firestore Field | Type | Description | Excel Header Variants |
|----------------|------|-------------|----------------------|
| `location` | string | Full location text | Location, ICC Location |
| `province` | string | Province name | Province |
| `municipality` | string | Comma-separated | Municipality, Municipality/ies |
| `municipalities` | array | Municipality array | (auto-split from municipality) |
| `barangay` | string | Comma-separated | Barangay, Barangay/s |
| `barangays` | array | Barangay array | (auto-split from barangay) |

### CADT and ICC

| Firestore Field | Type | Description | Excel Header Variants |
|----------------|------|-------------|----------------------|
| `cadt_status` | string | CADT status | CADT Status, CADT |
| `icc` | array | ICC numbers/IPs | ICC, ICCS, ICCS/IPs, ICC/IPs |

### Temporal & Numeric

| Firestore Field | Type | Description | Excel Header Variants |
|----------------|------|-------------|----------------------|
| `year_approved` | string | Year (as string) | Year Approved, Year |
| `total_area` | number | Area in hectares | Total Area, Area, Area (ha) |
| `remarks` | string | Notes | Remarks, Remark |

### Metadata

| Firestore Field | Type | Description |
|----------------|------|-------------|
| `imported_at` | timestamp | Import timestamp |
| `import_batch_id` | string | Batch identifier |

---

## How Field Mapping Works

### 1. Header Detection

The system:
- Scans the first 200 rows to find the header row
- Scores each row by matching keywords: `applicant`, `project`, `control`, `icc`, `location`, `year`, etc.
- Picks the row with the highest match score
- Normalizes headers (lowercase, removes punctuation, collapses whitespace)

### 2. Field Mapping by Tokens

For each Firestore field, the system searches headers for **any variant**:

```javascript
// Example: applicant_proponent field
const variants = [
  'applicant/proponent',
  'applicant / proponent',
  'applicant proponent',
  'applicant',
  'proponent',
  'company',
  'company name'
];
```

The mapper finds which Excel column contains **any of these variants** and maps it to `applicant_proponent`.

### 3. Normalization Process

All headers are normalized before matching:
- **Lowercase**: `Applicant/Proponent` → `applicant/proponent`
- **Remove quotes**: `"Control Number"` → `control number`
- **Replace slashes**: `ICC/IPs` → `icc ips`
- **Collapse whitespace**: `Name  of   Project` → `name of project`
- **Remove line breaks**: Multi-line headers become single line

### 4. Type Conversion

All values are **forced to string first**, then explicitly converted:

```javascript
// Number conversion (total_area)
String(cellValue).replace(/,/g, '') → Number() → 1234.5678

// Array conversion (icc, barangays)
String(cellValue).split(/[;,/]+/) → ['ICC-001', 'ICC-002']

// String (default)
String(cellValue).trim() → 'Benguet Province'
```

### 5. Combined ICC/Location Handling

When Excel has one column for **both ICC and Location**:

```
"ICC-001, ICC-002; Barangay Poblacion, Municipality of Baguio, Province of Benguet"
```

The system:
1. Detects location markers: `barangay`, `municipality`, `province`, `city`
2. Splits by: newlines, double spaces, ` - `, `;`, `|`
3. Separates ICC (before markers) from Location (after markers)
4. Result:
   - `icc`: `['ICC-001', 'ICC-002']`
   - `location`: `'Barangay Poblacion, Municipality of Baguio, Province of Benguet'`

---

## Validation Rules

### Required Fields (At Least One)

Import succeeds if **at least one** core field is found:
- `control_number`
- `survey_number`
- `applicant_proponent`
- `name_of_project`

### Row Validation

Each row must have **at least one** of these populated:
- Control number
- Survey number
- Applicant/Proponent
- Name of Project

Empty rows are automatically skipped.

### Sheet Exclusions

These sheets are **never imported** (reporting only):
- `Summary`
- `Summary per year`

---

## Safe Import Workflow

### Step 1: Prepare Excel File

Ensure headers include **at least** these columns (in any order):
- Region (or detectable from sheet name: CAR, R1, R2, etc.)
- Control Number or Survey Number
- Applicant/Proponent
- Name of Project
- ICC or ICCS/IPs
- Location (or Province + Municipality + Barangay)

### Step 2: Upload File

1. Click **Upload Excel** button
2. Select your NCIP Excel file
3. System scans all sheets (except Summary sheets)

### Step 3: Header Detection

For each sheet:
- System finds header row automatically
- Maps headers to Firestore fields by token matching
- Reports any sheets without sufficient headers

### Step 4: Preview & Validate

System shows:
- Number of records found
- Number of sheets parsed
- Any invalid sheets (with header mismatches)

### Step 5: Import Options

Choose:
- **Add to existing**: Merge into current collection
- **Create new collection**: Create separate collection with timestamp
- **Replace existing**: Clear current collection and import fresh

### Step 6: Verification

After import:
- Check Dashboard table shows correct data
- Verify ICC and Location are separate columns (for NCIP user)
- Confirm region, applicant, project name align correctly

---

## Preventing Data Scrambling

### ❌ What Causes Scrambling

1. **Column index assumptions**: `row[2]` always means Control Number
2. **Header variations**: "Control Number" vs "Control no." not matched
3. **Combined cells**: ICC+Location in one column not split
4. **Missing fields**: Sheet lacks a column → all columns shift
5. **No validation**: Silent failure imports wrong data

### ✅ How This System Prevents It

1. **Token-based mapping**: Finds Control Number wherever it appears
2. **Fuzzy matching**: Handles punctuation, quotes, slashes, multi-line
3. **Smart splitting**: Detects and separates combined ICC/Location
4. **Required field check**: Rejects sheets without core fields
5. **Validation logging**: Reports which sheets failed and why

---

## Example Mappings

### Sheet: CAR

**Excel Headers:**
```
No. | Region | Control number | Applicant/Proponent | Name of Project | Nature of Project | Project Cost | CADT Status | ICC | Location | Year Approved | Remarks
```

**Firestore Fields:**
```javascript
{
  survey_number: "CAR-001",           // from "No."
  control_number: "CAR-001",          // from "Control number"
  region: "CAR",                      // from "Region" or sheet name
  applicant_proponent: "Wilfred Resources, Inc.",
  name_of_project: "Mining project (Exploration permit...)",
  nature_of_project: "Mining",
  project_cost: "500,000,000",
  cadt_status: "Approved",
  icc: ["ICC-001", "ICC-002"],        // from "ICC" (split by ;,/)
  location: "Brgy. Marcos, Municipality of Tuba, Province of Benguet",
  year_approved: "2020",
  remarks: "",
  source_sheet: "CAR",
  import_batch_id: "batch_1707573600000_abc123",
  imported_at: Timestamp(2026-02-10T10:00:00Z)
}
```

### Sheet: R1 (Region I)

**Excel Headers:**
```
Survey Number | Province | Municipality | Barangay | Total Area | ICC | Remarks
```

**Firestore Fields:**
```javascript
{
  survey_number: "R1-042",
  control_number: "R1-042",
  region: "Region I",
  province: "Ilocos Norte",
  municipality: "Pagudpud",
  municipalities: ["Pagudpud"],
  barangay: "Balaoi, Caparispisan",
  barangays: ["Balaoi", "Caparispisan"],
  total_area: 1234.5678,              // number (from string)
  icc: ["IP-Tingguian"],
  remarks: "Renewable energy project",
  source_sheet: "Region I",
  import_batch_id: "batch_1707573600000_abc123",
  imported_at: Timestamp(2026-02-10T10:00:00Z)
}
```

### Sheet: Extractive/Mining Companies

**Excel Headers:**
```
Region | Applicant | Name of Project | ICC Location
```

**Firestore Fields:**
```javascript
{
  region: "CAR",
  applicant_proponent: "Benguet Corporation",
  name_of_project: "Acupan Gold Mine",
  icc: ["IP-Ibaloi", "IP-Kankanaey"],  // extracted from combined cell
  location: "Barangay Itogon, Municipality of Itogon, Province of Benguet",
  source_sheet: "Extractive/Mining Companies",
  import_batch_id: "batch_1707573600000_abc123",
  imported_at: Timestamp(2026-02-10T10:00:00Z)
}
```

---

## Backwards Compatibility

For existing code that uses old field names, the system provides **aliases**:

| Old Field | New Field | Alias Added |
|-----------|-----------|-------------|
| `surveyNumber` | `control_number` or `survey_number` | ✅ |
| `controlNumber` | `control_number` or `survey_number` | ✅ |
| `applicant` | `applicant_proponent` | ✅ |
| `nameOfProject` | `name_of_project` | ✅ |
| `projectName` | `name_of_project` | ✅ |
| `nature` | `nature_of_project` | ✅ |
| `natureOfProject` | `nature_of_project` | ✅ |
| `projectCost` | `project_cost` | ✅ |
| `cadtStatus` | `cadt_status` | ✅ |
| `cadt` | `cadt_status` | ✅ |
| `yearApproved` | `year_approved` | ✅ |
| `year` | `year_approved` | ✅ |
| `totalArea` | `total_area` | ✅ |

**This ensures existing queries and UI components continue to work.**

---

## Testing & Verification

### Test Import

1. Prepare a small test Excel file with 2-3 sheets
2. Include varied headers (with/without punctuation, quotes, slashes)
3. Include at least one sheet with combined ICC/Location column
4. Upload and verify:
   - All sheets detected
   - Header row found in each
   - Records parsed correctly
   - ICC and Location separated
   - Region auto-detected

### Manual Validation

After import, check Firestore console:
- Open `mappings` collection
- Select a document
- Verify fields match expected schema
- Check `source_sheet` and `import_batch_id` present
- Confirm `icc` is an array, `total_area` is a number

### Dashboard Verification

- Login as `ncip@inventory.gov.ph`
- View imported records in Dashboard table
- Verify columns: No., Region, Control number, Applicant/Proponent, Name of Project, ICC, Location, Year Approved
- Confirm ICC and Location are separate columns
- Check data alignment (no jumbled values)

---

## Troubleshooting

### "No valid rows found to import"

**Cause**: Header row not detected or no core fields mapped.

**Fix**:
1. Check Excel file has headers (Region, Applicant, Name of Project, etc.)
2. Ensure headers are in first ~200 rows
3. Verify headers use recognizable names (not completely custom)
4. Check console for which sheets failed: error message lists invalid sheets

### "Sheets without headers: CAR, R1, R2..."

**Cause**: Header detection score too low (no keyword matches).

**Fix**:
1. Headers added: `applicant`, `proponent`, `name of project`, `control`, `icc`, `location`, `year`
2. If custom headers, add variants to `HEADER_MAPPINGS` in `/lib/firestoreSchema.js`
3. Ensure first row is **not** a title row (or add title keywords to header detection)

### Data still misaligned

**Cause**: Field mapping collision (two fields mapped to same column).

**Fix**:
1. Check rawRecords in browser console (displays actual Excel headers found)
2. Verify which Firestore field each Excel column mapped to
3. Add more specific header variants to `/lib/firestoreSchema.js`
4. Ensure Excel headers are unique per column

### ICC and Location not separated

**Cause**: Combined cell not matching split heuristics.

**Fix**:
1. Check cell format: should contain location markers (`barangay`, `municipality`, `province`)
2. Ensure separators: newlines, ` - `, `;`, `|`, or double spaces
3. Example working format:
   ```
   ICC-001, ICC-002; Barangay Poblacion, Municipality of Baguio
   ```
4. If format differs, update `splitCombinedIccLocation()` in `/lib/firestoreSchema.js`

---

## Maintenance

### Adding New Header Variants

If your Excel uses a new header format not recognized:

1. Open `/lib/firestoreSchema.js`
2. Find `HEADER_MAPPINGS`
3. Add your variant to the appropriate field:

```javascript
export const HEADER_MAPPINGS = {
  applicant_proponent: [
    'applicant/proponent',
    'applicant',
    'proponent',
    'company',
    'company name',
    'your new header here',  // ← add here
  ],
  // ...
};
```

### Adding New Schema Fields

To add a new field to the schema:

1. Add to `FIRESTORE_SCHEMA` with type:
```javascript
export const FIRESTORE_SCHEMA = {
  // ... existing fields
  permit_number: 'string',  // ← new field
};
```

2. Add header mappings:
```javascript
export const HEADER_MAPPINGS = {
  // ... existing mappings
  permit_number: ['permit number', 'permit no', 'permit #'],
};
```

3. Update table UI in `Dashboard.jsx` to display new field (if needed).

---

## Summary

✅ **Firestore is now the stable source of truth**  
✅ **All imports use explicit field mapping (no column indexes)**  
✅ **Headers are normalized and matched fuzzily**  
✅ **Values forced to string first, then explicitly typed**  
✅ **ICC/Location splitting handles combined cells**  
✅ **Every document includes source_sheet and import_batch_id**  
✅ **Validation prevents silent corruption**  
✅ **Backwards compatibility maintained via field aliases**

**Result**: No more data scrambling, column shifting, or silent corruption.
