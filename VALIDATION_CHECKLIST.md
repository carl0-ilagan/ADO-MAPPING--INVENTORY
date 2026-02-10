# Quick Reference: Import Validation Rules

## ✅ Pre-Import Checklist

- [ ] Excel file has headers in first 200 rows
- [ ] At least one core field present: Control Number, Survey Number, Applicant, or Name of Project
- [ ] Summary and "Summary per year" sheets excluded (auto-skipped)
- [ ] Headers use recognizable terms (see variants below)
- [ ] Values are NOT formula-based (paste as values if needed)

## 📋 Recognized Header Variants

### Control/Survey Number
- No., No, Survey Number, Survey no, Control Number, Control no, Control #

### Applicant/Proponent
- Applicant/Proponent, Applicant, Proponent, Company, Company Name

### Project Name
- Name of Project, Project Name, Project

### Project Nature
- Nature of Project, Nature, Project Type

### Location
- Location, Province, Municipality, Barangay, ICC Location

### ICC/IPs
- ICC, ICCS, ICCS/IPs, ICC/IPs, ICC/IP

### CADT
- CADT Status, CADT

### Year
- Year Approved, Year

### Cost
- Project Cost, Cost, Total Project Cost

### Area
- Total Area, Area, Area (ha)

### Remarks
- Remarks, Remark, Notes

## 🔍 Validation Checks (Auto-Run)

1. **Header Detection**: Score each row for keyword matches
2. **Core Field Check**: At least one of: control_number, survey_number, applicant, name_of_project
3. **Row Validation**: Skip empty rows (all core fields blank)
4. **Type Conversion**: String → Number (area), String → Array (ICC, barangays)
5. **Combined Cell Split**: ICC+Location in one column → separate fields

## 🚫 Common Issues

| Issue | Detection | Fix |
|-------|-----------|-----|
| "No valid rows found" | No core fields mapped | Add recognizable headers |
| "Sheets without headers" | Header score < 1 | Move headers to top 200 rows |
| Data misaligned | Field collision | Make headers unique per column |
| ICC/Location not split | No location markers | Add "Barangay" or "Municipality" |

## 🎯 Expected Firestore Fields

All records will have these normalized fields:

**Core**: control_number, survey_number, region, source_sheet, import_batch_id, imported_at

**Project**: applicant_proponent, name_of_project, nature_of_project, project_cost

**Location**: location, province, municipality, municipalities (array), barangay, barangays (array)

**Regulatory**: cadt_status, icc (array), year_approved

**Numeric**: total_area (number)

**Other**: remarks

**Aliases** (for backwards compatibility): surveyNumber, controlNumber, applicant, nameOfProject, projectName, nature, natureOfProject, projectCost, cadtStatus, cadt, yearApproved, year, totalArea

## 📊 Test Verification Steps

After import:

1. Check Firestore console → verify documents have normalized field names
2. Check Dashboard table → verify data alignment (no jumbled columns)
3. For NCIP user → verify ICC and Location are separate columns
4. Check console logs → any sheets with invalid headers listed
5. Verify source_sheet field matches Excel sheet name
6. Verify import_batch_id is consistent for all records in same import

## 🛠️ Quick Fixes

### If headers not detected:
```javascript
// Add custom header variant to /lib/firestoreSchema.js → HEADER_MAPPINGS
applicant_proponent: [
  'applicant/proponent',
  'your custom header here',  // ← add
],
```

### If combined ICC/Location not splitting:
```javascript
// Update splitCombinedIccLocation() in /lib/firestoreSchema.js
// Add custom separator or location marker
```

### If sheet rejected:
- Check Excel → ensure headers in first 200 rows
- Check headers match variants above (case-insensitive, punctuation-tolerant)
- Check at least one core field present

## 📞 Support

See full guide: [FIRESTORE_IMPORT_GUIDE.md](./FIRESTORE_IMPORT_GUIDE.md)

Schema definition: [lib/firestoreSchema.js](./lib/firestoreSchema.js)

Import logic: [components/Dashboard.jsx](./components/Dashboard.jsx) → `buildRecordsFromRows()`
