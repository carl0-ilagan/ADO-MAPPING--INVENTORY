# Migration from Old System to New CP Projects System

## Overview

This guide helps you transition from the existing `mappings` collection to the new unified `cp_projects` system.

## Key Differences

### Old System (mappings)
- Multiple collections and flags (`_ongoing`, `_pending`, etc.)
- Complex nested data structures
- Status determined by flags and metadata
- Regional data mixed with project types

### New System (cp_projects)
- **Single collection**: `cp_projects`
- **Simple flat structure**
- **Clear status field**: 'Pending' | 'Approved' | 'Ongoing'
- **Dynamic computed views** (no stored summaries)

## Field Mapping

| Old Field (mappings) | New Field (cp_projects) | Notes |
|---------------------|-------------------------|-------|
| `control_number` or `survey_number` | `id` (auto-generated) | Document ID |
| `region` or `source_sheet` | `region` | Standardized region names |
| `applicant_proponent` | `proponent` | Applicant name |
| `name_of_project` | `project_name` | Project title |
| `nature_of_project` | `type_of_project` | Project category |
| `project_cost` | `project_cost` | Budget (string) |
| `location` | `location` | Full location |
| `province` | `province` | Province name |
| `municipality` / `municipalities` | `municipality` | Municipality (string) |
| `barangay` / `barangays` | `barangay` | Barangay (string) |
| `icc` | `affected_icc` | Affected communities (array) |
| `year_approved` | `year_applied` | Year (number) |
| `remarks` | `status_of_application` | Application notes |
| `_ongoing` / `_pending` flags | `status` | 'Pending' \| 'Approved' \| 'Ongoing' |
| - | `date_filed` | New: filing date (timestamp) |

## Migration Options

### Option 1: Fresh Start (Recommended)
**Best for**: Starting clean with new data structure

1. Keep existing `mappings` collection as-is
2. Import fresh Excel data into `cp_projects`
3. Run both systems in parallel during transition
4. Archive old system when ready

**Pros**:
- No data corruption risk
- Can verify new system thoroughly
- Easy rollback if needed

**Cons**:
- Need to re-import data
- Temporarily dual systems

### Option 2: Data Migration Script
**Best for**: Large existing datasets that must be preserved

Create a migration script to:
1. Read all documents from `mappings`
2. Transform to `cp_projects` schema
3. Map old fields to new fields
4. Determine status from flags
5. Write to `cp_projects` collection

Example pseudo-code:
```javascript
// Get all mappings
const mappings = await getAllMappings();

// Transform each mapping
const projects = mappings.map(m => ({
  region: m.region || m.source_sheet || detectRegion(m),
  proponent: m.applicant_proponent || '',
  project_name: m.name_of_project || '',
  type_of_project: m.nature_of_project || '',
  project_cost: m.project_cost || '',
  location: m.location || '',
  province: m.province || '',
  municipality: m.municipality || (Array.isArray(m.municipalities) ? m.municipalities.join(', ') : ''),
  barangay: m.barangay || (Array.isArray(m.barangays) ? m.barangays.join(', ') : ''),
  affected_icc: Array.isArray(m.icc) ? m.icc : [],
  status: determineStatus(m), // Convert flags to status
  status_of_application: m.remarks || '',
  year_applied: extractYear(m.year_approved) || null,
  date_filed: parseDate(m) || null,
  created_at: m.imported_at || new Date(),
  updated_at: new Date()
}));

// Import to cp_projects
await importCPProjects({ projects });
```

Helper function:
```javascript
function determineStatus(mapping) {
  if (mapping._ongoing === true) return 'Ongoing';
  if (mapping._pending === true) return 'Pending';
  
  // Check importCollection name
  const collection = String(mapping.importCollection || '').toLowerCase();
  if (collection.includes('ongoing')) return 'Ongoing';
  if (collection.includes('pending')) return 'Pending';
  if (collection.includes('approved')) return 'Approved';
  
  // Default
  return 'Pending';
}
```

### Option 3: Gradual Migration
**Best for**: Testing with subset of data

1. Export subset from old system
2. Import to new system
3. Verify accuracy
4. Gradually increase scope
5. Eventually migrate all data

## Verification Checklist

After migration, verify:

- [ ] Total count matches (old vs new)
- [ ] Region distribution matches
- [ ] Status counts match (Pending/Approved/Ongoing)
- [ ] Required fields populated
- [ ] Date fields correctly parsed
- [ ] Arrays properly formatted (affected_icc)
- [ ] Year extraction works correctly
- [ ] Sample spot-checks for accuracy

## Running Both Systems in Parallel

During transition period:

1. **Old Dashboard**: Keep at `/` or `/dashboard`
2. **New CP Projects**: Access at `/cp-projects`
3. **Users**: Gradually invite users to test new system
4. **Data**: Continue using old system for operations
5. **Feedback**: Gather user feedback
6. **Cutover**: Plan cutover date when ready

## Rollback Plan

If issues occur:

1. Keep old system intact (don't delete `mappings`)
2. Can delete `cp_projects` and restart
3. Firestore rules support both collections
4. No dependencies between systems

## Support Script: Count and Compare

```javascript
// Compare record counts
async function compareSystemCounts() {
  const mappingsSnapshot = await getDocs(collection(db, 'mappings'));
  const cpProjectsSnapshot = await getDocs(collection(db, 'cp_projects'));
  
  console.log('Old system (mappings):', mappingsSnapshot.size);
  console.log('New system (cp_projects):', cpProjectsSnapshot.size);
  
  // Count by status in old system
  const oldPending = mappingsSnapshot.docs.filter(d => d.data()._pending).length;
  const oldOngoing = mappingsSnapshot.docs.filter(d => d.data()._ongoing).length;
  
  console.log('Old pending:', oldPending);
  console.log('Old ongoing:', oldOngoing);
  
  // Count by status in new system
  const newPending = cpProjectsSnapshot.docs.filter(d => d.data().status === 'Pending').length;
  const newApproved = cpProjectsSnapshot.docs.filter(d => d.data().status === 'Approved').length;
  const newOngoing = cpProjectsSnapshot.docs.filter(d => d.data().status === 'Ongoing').length;
  
  console.log('New pending:', newPending);
  console.log('New approved:', newApproved);
  console.log('New ongoing:', newOngoing);
}
```

## Timeline Suggestion

**Week 1**: Setup and Testing
- Deploy new system
- Import sample data
- Internal team testing

**Week 2**: Pilot Users
- Invite 2-3 pilot users
- Gather feedback
- Fix any issues

**Week 3**: Parallel Operation
- All users access both systems
- Continue operations on old system
- Familiarize with new system

**Week 4**: Full Migration
- Migrate all data
- Switch primary system
- Archive old system

## Frequently Asked Questions

**Q: Will the old system stop working?**
A: No, both systems can run indefinitely in parallel.

**Q: Do I need to migrate immediately?**
A: No, you can start fresh and import new data only.

**Q: Can I edit old data in the new system?**
A: Only if you migrate it. Otherwise, new system starts fresh.

**Q: What happens to my old reports?**
A: They continue to work with old system. New reports use new system.

**Q: Can I migrate specific regions only?**
A: Yes, export those regions and import to new system.

## Next Steps

1. Review this migration guide
2. Choose migration option
3. Test with sample data
4. Plan rollout timeline
5. Execute migration
6. Verify results
7. Train users

## Recommendation

**Recommended approach**: Option 1 (Fresh Start)
- Import your latest Excel files into new system
- Run parallel for 2-4 weeks
- Transition fully when confident
- Archive old system

This minimizes risk and complexity while ensuring data integrity.
