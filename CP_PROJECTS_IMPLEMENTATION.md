# CP Projects System - Implementation Guide

## Overview

This system implements a **single source of truth** architecture for CP (Consent Project) management using a unified master table called `cp_projects`. All reports, summaries, and views are dynamically computed from this single collection.

## Architecture

### Master Table: `cp_projects`

**Collection**: `cp_projects` (Firestore)

**Fields**:
- `id` (string) - Auto-generated document ID
- `region` (string) - Region (CAR, Region I, etc.)
- `date_filed` (timestamp) - Date when project was filed
- `proponent` (string) - Applicant/Proponent name
- `project_name` (string) - Name of the project
- `project_cost` (string) - Project cost
- `location` (string) - Full location description
- `type_of_project` (string) - Project type/nature
- `affected_icc` (array) - Array of affected ICCs/IPs
- `status_of_application` (string) - Current application status/remarks
- `status` (string) - **Main status**: 'Pending', 'Approved', or 'Ongoing'
- `year_applied` (number) - Year extracted from date_filed
- `province` (string) - Province name (optional)
- `municipality` (string) - Municipality name(s) (optional)
- `barangay` (string) - Barangay name(s) (optional)
- `created_at` (timestamp) - When record was created
- `updated_at` (timestamp) - Last update timestamp
- `imported_at` (timestamp) - When imported from Excel
- `import_batch_id` (string) - Batch identifier for imports

## Features

### 1. Excel Import
- Upload Excel files with multiple sheets
- Auto-maps Excel columns to database fields
- Validates data before import
- Supports batch imports with progress tracking
- Error handling for invalid records

### 2. Tab Views
- **Overview**: Dashboard with statistics and charts
- **Pending**: Projects with status 'Pending' + computed summaries
- **Approved**: Projects with status 'Approved'
- **Ongoing**: Projects with status 'Ongoing'

### 3. Computed Summaries (Pending Tab)
Two dynamically computed subtabs:
- **Summary by Year**: Count of projects per year per region
- **Summary by Project Type**: Count of projects per type per region

All summaries are computed in real-time from the master table, not stored separately.

### 4. Filtering
- Filter by region (dropdown)
- Filter by status (tab selection)
- Search by project name, proponent, location, or type

### 5. Excel Export
- Export filtered data to Excel
- Includes all fields
- Auto-sized columns
- Named with date and tab context

## Files Created/Modified

### New Files
1. **`lib/cpProjectsSchema.js`** - Master schema definition and utilities
   - Schema definition
   - Excel header mappings
   - Validation functions
   - Computed summary functions

2. **`lib/cpProjectsService.js`** - Database service layer
   - Import/export functions
   - CRUD operations
   - Batch processing with retries
   - Firestore queries

3. **`components/CPDashboardNew.jsx`** - Main dashboard component
   - Tab navigation (Overview, Pending, Approved, Ongoing)
   - Computed summaries
   - Excel import/export UI
   - Filtering and search
   - Project list and details

4. **`app/cp-projects/page.jsx`** - Next.js page wrapper
   - Authentication handling
   - User session management

5. **`app/api/cp-projects/import/route.js`** - API route for imports
   - Excel data validation endpoint

### Modified Files
1. **`firestore.rules`** - Added cp_projects collection rules

## Usage

### Accessing the System
Navigate to: `/cp-projects`

### Importing Data
1. Click "Import Excel" button
2. Select Excel file (.xlsx or .xls)
3. System auto-detects regions from sheet names
4. Progress bar shows import status
5. Invalid records are logged (check console)

### Excel Format Requirements
Your Excel file should have headers that match these patterns:

**Required Fields**:
- Region: "Region", "Regional Office", "RO"
- Proponent: "Proponent", "Applicant", "Company"
- Project Name: "Project Name", "Name of Project"

**Optional Fields**:
- Date Filed: "Date Filed", "Filing Date"
- Type: "Type of Project", "Project Type", "Nature"
- Location: "Location", "Project Location"
- Status: "Status", "Project Status"
- And more (see `cpProjectsSchema.js` for full list)

### Viewing Summaries
1. Go to "Pending" tab
2. Click "Summary by Year" or "Summary by Project Type"
3. Use region filter to focus on specific region
4. Summaries update automatically based on filters

### Exporting Data
1. Apply desired filters (tab, region, search)
2. Click "Export" button
3. Excel file downloads with filtered data

## Technical Details

### Database Queries
- All queries use Firestore SDK client-side
- No server-side API needed for reads
- Batch writes for imports (10 docs per batch)
- Automatic retry logic for transient errors
- Inter-batch delays to avoid rate limits

### Computed Summaries
Summaries are computed client-side using utility functions:
- `computeSummaryByYear(projects)` - Groups by year and region
- `computeSummaryByProjectType(projects)` - Groups by type and region
- Functions work on filtered datasets
- No Firestore queries needed for summaries

### Performance
- Client-side filtering (fast for <10k records)
- Pagination (15 items per page)
- Lazy loading of project details
- Efficient batch operations

### Scalability
For larger datasets (>10k projects):
- Consider server-side pagination
- Add Firestore indexes
- Implement incremental loading
- Cache computed summaries

## Integration with Existing System

The new CP Projects system is **independent** from the existing mappings system:
- Uses separate `cp_projects` collection
- Has its own page at `/cp-projects`
- Does not interfere with existing Dashboard
- Can run in parallel with old system

## Future Enhancements

1. **Advanced Filtering**
   - Date range filters
   - Multiple region selection
   - Project cost range

2. **Bulk Operations**
   - Bulk status updates
   - Bulk delete
   - Batch editing

3. **Analytics**
   - Trend charts
   - Regional comparisons
   - Cost analysis

4. **User Permissions**
   - Role-based access (Admin, Viewer)
   - Region-specific access
   - Approval workflows

5. **Data Validation**
   - Duplicate detection
   - Data quality checks
   - Auto-correction suggestions

## Deployment

### Firestore Rules
Deploy updated rules:
```bash
firebase deploy --only firestore:rules
```

### Environment
No environment variables needed. Uses existing Firebase config.

### Build
```bash
npm run build
```

### Deploy
Deploy to your hosting provider (Vercel, Firebase Hosting, etc.)

## Support

For questions or issues:
1. Check browser console for detailed errors
2. Review Firestore indexes
3. Check Firebase quotas
4. Verify authentication

## License

Same as project license.
