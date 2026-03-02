'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Upload, 
  Filter, 
  X, 
  FileText, 
  BarChart3,
  LogOut,
  User,
  Eye,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { 
  getAllCPProjects,
  importCPProjects,
  deleteCPProjectsByIds,
  updateCPProject
} from '@/lib/cpProjectsService';
import {
  filterProjectsByStatus,
  filterProjectsByRegion,
  computeSummaryByYear,
  computeSummaryByProjectType,
  getUniqueRegions,
  getUniqueProjectTypes,
  getUniqueYears
} from '@/lib/cpProjectsSchema';

function CPDashboardNew({ user, onLogout }) {
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [alert, setAlert] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [pendingSubTab, setPendingSubTab] = useState('list');
  const [ongoingSubTab, setOngoingSubTab] = useState('list');
  
  const fileInputRef = useRef(null);
  const itemsPerPage = 15;

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const allProjects = await getAllCPProjects();
      setProjects(allProjects);
      
      // Debug: Log project counts and sample data
      console.log('📊 Loaded projects:', allProjects.length);
      console.log('📊 By Status:', {
        Pending: allProjects.filter(p => p.status === 'Pending').length,
        Approved: allProjects.filter(p => p.status === 'Approved').length,
        Ongoing: allProjects.filter(p => p.status === 'Ongoing').length,
        Other: allProjects.filter(p => !['Pending', 'Approved', 'Ongoing'].includes(p.status)).length
      });
      
      // Show unique regions found in data
      const uniqueRegions = [...new Set(allProjects.map(p => p.region || 'No Region'))];
      console.log('📌 All Regions Found:', uniqueRegions);
      
      // Show region breakdown
      console.log('📊 By Region:', 
        allProjects.reduce((acc, p) => {
          const region = p.region || 'No Region';
          acc[region] = (acc[region] || 0) + 1;
          return acc;
        }, {})
      );
      
      // Show first 3 proponents for debugging
      if (allProjects.length > 0) {
        console.log('📊 Sample proponents:', 
          allProjects.slice(0, 3).map(p => ({
            proponent: p.proponent,
            project: p.project_name,
            status: p.status,
            region: p.region
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      showAlert('error', 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // Filter and search logic
  const getFilteredProjects = () => {
    let filtered = projects;
    
    console.log('🔍 Starting filter - Total projects:', projects.length);

    // Filter by tab (status)
    if (activeTab === 'pending') {
      filtered = filterProjectsByStatus(filtered, 'Pending');
      console.log('🔍 After Pending filter:', filtered.length);
    } else if (activeTab === 'approved') {
      filtered = filterProjectsByStatus(filtered, 'Approved');
      console.log('🔍 After Approved filter:', filtered.length);
    } else if (activeTab === 'ongoing') {
      filtered = filterProjectsByStatus(filtered, 'Ongoing');
      console.log('🔍 After Ongoing filter:', filtered.length);
    }

    // Filter by region
    if (regionFilter !== 'all') {
      console.log('🔍 Filtering by region:', regionFilter);
      const beforeRegion = filtered.length;
      filtered = filterProjectsByRegion(filtered, regionFilter);
      console.log(`🔍 After region filter (${regionFilter}): ${filtered.length} (was ${beforeRegion})`);
    }

    // Search filter - comprehensive search across all major fields
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      console.log('🔍 Search query:', `"${query}"`, 'Length:', query.length);
      const beforeSearch = filtered.length;
      
      // Show first project's searchable fields for debugging
      if (filtered.length > 0) {
        const sample = filtered[0];
        console.log('🔍 Sample project searchable fields:', {
          project_name: sample.project_name,
          proponent: sample.proponent,
          location: sample.location,
          control_number: sample.control_number,
          type_of_project: sample.type_of_project,
          status_of_application: sample.status_of_application
        });
      }
      
      filtered = filtered.filter(p => {
        // Helper to safely convert array to searchable string
        const arrayToString = (arr) => {
          if (Array.isArray(arr)) return arr.join(' ').toLowerCase();
          if (arr) return String(arr).toLowerCase();
          return '';
        };
        
        // Normalize function to handle special characters
        const normalize = (str) => {
          if (!str) return '';
          return String(str).toLowerCase().replace(/\s+/g, ' ').trim();
        };
        
        // Search across multiple fields - normalize both query and field values
        const searchableFields = [
          normalize(p.project_name),
          normalize(p.proponent),
          normalize(p.location),
          normalize(p.type_of_project),
          normalize(p.control_number),
          normalize(p.survey_number),
          normalize(p.province),
          normalize(p.municipality),
          normalize(p.barangay),
          normalize(p.cadt_status),
          normalize(p.status_of_application),
          normalize(arrayToString(p.affected_icc)),
          normalize(p.region)
        ];
        
        const matched = searchableFields.some(field => 
          field && field.includes(query)
        );
        
        // Debug: Log first non-match
        if (!matched && filtered.indexOf(p) === 0) {
          console.log('❌ First project did NOT match search. Query:', `"${query}"`);
          console.log('❌ Project fields:', {
            proponent: normalize(p.proponent),
            project_name: normalize(p.project_name),
            location: normalize(p.location)
          });
        }
        
        return matched;
      });
      
      console.log(`🔍 After search: ${filtered.length} (was ${beforeSearch})`);
      if (filtered.length > 0) {
        console.log('🔍 Sample matched projects:', 
          filtered.slice(0, 3).map(p => ({ proponent: p.proponent, project: p.project_name }))
        );
      } else {
        console.log('❌ NO MATCHES FOUND for search query:', `"${query}"`);
      }
    }

    console.log('✅ Final filtered count:', filtered.length);
    return filtered;
  };

  // Excel Import Handler
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setImportProgress(0);

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      // Parse all sheets
      const excelSheets = workbook.SheetNames.map(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (jsonData.length < 2) return null; // Skip empty sheets
        
        const headers = jsonData[0];
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== ''));
        
        return { sheetName, headers, rows };
      }).filter(Boolean);

      if (excelSheets.length === 0) {
        showAlert('error', 'No valid data found in Excel file');
        return;
      }

      // Import to Firestore
      const result = await importCPProjects({
        excelSheets,
        mode: 'add',
        onProgress: setImportProgress,
        batchId: `import_${Date.now()}`
      });

      if (result.created > 0) {
        showAlert('success', `Successfully imported ${result.created} projects`);
        await loadProjects(); // Reload projects
      }

      if (result.invalid > 0) {
        console.warn('Invalid records:', result.errors);
        showAlert('warning', `${result.invalid} records were invalid and skipped`);
      }

    } catch (error) {
      console.error('Import error:', error);
      showAlert('error', `Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Excel Export Handler
  const handleExport = () => {
    const filtered = getFilteredProjects();
    
    if (filtered.length === 0) {
      showAlert('warning', 'No projects to export');
      return;
    }

    const exportData = filtered.map(p => ({
      'Region': p.region || '',
      'Control Number': p.control_number || '',
      'Survey Number': p.survey_number || '',
      'Date Filed': p.date_filed ? new Date(p.date_filed.seconds * 1000).toLocaleDateString() : '',
      'Year Applied': p.year_applied || '',
      'Proponent': p.proponent || '',
      'Project Name': p.project_name || '',
      'Project Cost': p.project_cost || '',
      'Location': p.location || '',
      'Province': p.province || '',
      'Municipality': p.municipality || '',
      'Barangay': p.barangay || '',
      'Total Area (Ha)': p.total_area || '',
      'Type of Project': p.type_of_project || '',
      'CADT Status': p.cadt_status || '',
      'Affected ICC/IP': Array.isArray(p.affected_icc) ? p.affected_icc.join(', ') : p.affected_icc || '',
      'Has Ongoing FPIC': p.has_ongoing_fpic ? 'Yes' : 'No',
      'Status': p.status || '',
      'Status of Application': p.status_of_application || '',
      'Year Approved': p.year_approved || '',
      'MOA Duration': p.moa_duration || '',
      'Community Benefits': p.community_benefits || '',
      // FPIC workflow fields (if applicable)
      'Work Order': p.issuance_of_work_order || '',
      'Pre-FBI': p.pre_fbi_conference || '',
      'FBI Conduct': p.conduct_of_fbi || '',
      'FBI Review': p.review_of_fbi_report || '',
      'Pre-FPIC': p.pre_fpic_conference || '',
      '1st Assembly': p.first_community_assembly || '',
      '2nd Assembly': p.second_community_assembly || '',
      'Consensus': p.consensus_building_decision || '',
      'MOA Validation': p.moa_validation_ratification_signing || '',
      'Resolution': p.issuance_resolution_of_consent || '',
      'RRT Review': p.review_by_rrt || '',
      'ADO/LAO Review': p.review_by_ado_or_lao || '',
      'FPIC Compliance': p.for_compliance_of_fpic_team || '',
      'CEB': p.ceb_deliberation || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CP Projects');

    // Auto-size columns
    const maxWidth = 50;
    const colWidths = Object.keys(exportData[0] || {}).map(key => {
      const maxLen = Math.max(
        key.length,
        ...exportData.map(row => String(row[key] || '').length)
      );
      return { wch: Math.min(maxLen + 2, maxWidth) };
    });
    ws['!cols'] = colWidths;

    const fileName = `cp_projects_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showAlert('success', 'Export completed successfully');
  };

  // Pagination
  const filteredProjects = getFilteredProjects();
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Debug filtered results
  useEffect(() => {
    if (searchQuery.trim()) {
      console.log('🔍 Search query:', searchQuery);
      console.log('🔍 Filtered results:', filteredProjects.length);
      if (filteredProjects.length > 0) {
        console.log('🔍 First match:', {
          proponent: filteredProjects[0].proponent,
          project: filteredProjects[0].project_name,
          status: filteredProjects[0].status
        });
      }
    }
  }, [searchQuery, filteredProjects.length]);

  // Computed summaries
  const pendingProjects = filterProjectsByStatus(projects, 'Pending');
  const ongoingProjects = filterProjectsByStatus(projects, 'Ongoing');
  const approvedProjects = filterProjectsByStatus(projects, 'Approved');
  
  const summaryByYear = activeTab === 'pending' 
    ? computeSummaryByYear(pendingProjects)
    : activeTab === 'ongoing'
    ? computeSummaryByYear(ongoingProjects)
    : computeSummaryByYear(projects);
    
  const summaryByType = activeTab === 'pending'
    ? computeSummaryByProjectType(pendingProjects)
    : activeTab === 'ongoing'
    ? computeSummaryByProjectType(ongoingProjects)
    : computeSummaryByProjectType(projects);
    
  const regions = getUniqueRegions(projects);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Alert */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          alert.type === 'success' ? 'bg-green-500' :
          alert.type === 'error' ? 'bg-red-500' :
          alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
        } text-white flex items-center gap-2 animate-slide-in-right`}>
          {alert.type === 'success' && <CheckCircle size={20} />}
          {alert.type === 'error' && <AlertCircle size={20} />}
          {alert.type === 'warning' && <AlertCircle size={20} />}
          <span>{alert.message}</span>
          <button onClick={() => setAlert(null)} className="ml-2">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CP Projects Management System</h1>
              <p className="text-sm text-gray-600 mt-1">Single Source of Truth - Master Database</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.email || 'User'}</p>
                <p className="text-xs text-gray-500">{user?.role || 'Viewer'}</p>
              </div>
              <button
                onClick={onLogout}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut size={20} className="text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm p-1 mb-6 flex gap-1">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'pending', label: 'Pending', icon: Clock },
            { id: 'approved', label: 'Approved', icon: CheckCircle },
            { id: 'ongoing', label: 'Ongoing', icon: AlertCircle }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setCurrentPage(1);
                // Reset subtabs when switching main tabs
                if (tab.id === 'pending') setPendingSubTab('list');
                if (tab.id === 'ongoing') setOngoingSubTab('list');
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-blue-500' : 'bg-gray-200'
              }`}>
                {tab.id === 'overview' ? projects.length :
                 tab.id === 'pending' ? filterProjectsByStatus(projects, 'Pending').length :
                 tab.id === 'approved' ? filterProjectsByStatus(projects, 'Approved').length :
                 filterProjectsByStatus(projects, 'Ongoing').length}
              </span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {filteredProjects.length} result{filteredProjects.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-gray-400 hover:text-gray-600"
                    title="Clear search"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Region Filter */}
            <select
              value={regionFilter}
              onChange={(e) => {
                setRegionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Regions</option>
              {regions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>

            {/* Import Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Upload size={18} />
              {isImporting ? `Importing ${importProgress}%` : 'Import Excel'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Export Button */}
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Download size={18} />
              Export
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewTab projects={projects} />
        )}

        {activeTab === 'pending' && (
          <PendingTab 
            projects={pendingProjects}
            paginatedProjects={paginatedProjects}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            subTab={pendingSubTab}
            onSubTabChange={setPendingSubTab}
            summaryByYear={summaryByYear}
            summaryByType={summaryByType}
            regionFilter={regionFilter}
            onViewProject={(p) => {
              setSelectedProject(p);
              setShowViewModal(true);
            }}
          />
        )}

        {activeTab === 'approved' && (
          <ProjectListTab
            projects={paginatedProjects}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            onViewProject={(p) => {
              setSelectedProject(p);
              setShowViewModal(true);
            }}
          />
        )}

        {activeTab === 'ongoing' && (
          <OngoingTab 
            projects={ongoingProjects}
            paginatedProjects={paginatedProjects}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            subTab={ongoingSubTab}
            onSubTabChange={setOngoingSubTab}
            summaryByYear={summaryByYear}
            summaryByType={summaryByType}
            regionFilter={regionFilter}
            onViewProject={(p) => {
              setSelectedProject(p);
              setShowViewModal(true);
            }}
          />
        )}
      </div>

      {/* View Modal */}
      {showViewModal && selectedProject && (
        <ViewProjectModal
          project={selectedProject}
          onClose={() => {
            setShowViewModal(false);
            setSelectedProject(null);
          }}
        />
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ projects }) {
  const stats = {
    total: projects.length,
    pending: filterProjectsByStatus(projects, 'Pending').length,
    approved: filterProjectsByStatus(projects, 'Approved').length,
    ongoing: filterProjectsByStatus(projects, 'Ongoing').length
  };

  const regions = getUniqueRegions(projects);
  const years = getUniqueYears(projects);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Projects" value={stats.total} color="blue" icon={FileText} />
        <StatCard label="Pending" value={stats.pending} color="yellow" icon={Clock} />
        <StatCard label="Approved" value={stats.approved} color="green" icon={CheckCircle} />
        <StatCard label="Ongoing" value={stats.ongoing} color="purple" icon={AlertCircle} />
      </div>

      {/* Charts/Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Projects by Region</h3>
          <div className="space-y-2">
            {regions.map(region => {
              const count = filterProjectsByRegion(projects, region).length;
              const percentage = ((count / projects.length) * 100).toFixed(1);
              return (
                <div key={region} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{region}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Projects by Year</h3>
          <div className="space-y-2">
            {years.slice(0, 10).map(year => {
              const count = projects.filter(p => p.year_applied === year).length;
              const percentage = ((count / projects.length) * 100).toFixed(1);
              return (
                <div key={year} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{year}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Pending Tab with Computed Subtabs
function PendingTab({ 
  projects, 
  paginatedProjects, 
  currentPage, 
  totalPages, 
  onPageChange,
  subTab,
  onSubTabChange,
  summaryByYear,
  summaryByType,
  regionFilter,
  onViewProject
}) {
  return (
    <div className="space-y-4">
      {/* Subtabs */}
      <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1">
        {[
          { id: 'list', label: 'Project List' },
          { id: 'year', label: 'Summary by Year' },
          { id: 'type', label: 'Summary by Type' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => onSubTabChange(tab.id)}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              subTab === tab.id
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'list' && (
        <ProjectListTab
          projects={paginatedProjects}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          onViewProject={onViewProject}
        />
      )}

      {subTab === 'year' && (
        <SummaryByYearTable summary={summaryByYear} regionFilter={regionFilter} />
      )}

      {subTab === 'type' && (
        <SummaryByTypeTable summary={summaryByType} regionFilter={regionFilter} />
      )}
    </div>
  );
}

// Ongoing Tab Component
function OngoingTab({ 
  projects, 
  paginatedProjects, 
  currentPage, 
  totalPages, 
  onPageChange,
  subTab,
  onSubTabChange,
  summaryByYear,
  summaryByType,
  regionFilter,
  onViewProject
}) {
  return (
    <div className="space-y-4">
      {/* Subtabs */}
      <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1">
        {[
          { id: 'list', label: 'Project List' },
          { id: 'year', label: 'Summary by Year' },
          { id: 'type', label: 'Summary by Type' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => onSubTabChange(tab.id)}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              subTab === tab.id
                ? 'bg-green-100 text-green-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'list' && (
        <ProjectListTab
          projects={paginatedProjects}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          onViewProject={onViewProject}
        />
      )}

      {subTab === 'year' && (
        <SummaryByYearTable summary={summaryByYear} regionFilter={regionFilter} />
      )}

      {subTab === 'type' && (
        <SummaryByTypeTable summary={summaryByType} regionFilter={regionFilter} />
      )}
    </div>
  );
}

// Project List Component
function ProjectListTab({ projects, currentPage, totalPages, onPageChange, onViewProject }) {
  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
        <div className="text-gray-600">
          <p>Try adjusting your filters or search query.</p>
          <p className="text-sm text-gray-500 mt-2">
            💡 Tip: Search works on proponent, project name, location, region, and more
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Region</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Control No.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Proponent</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Project Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Location</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Year</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">FPIC</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {projects.map((project, idx) => (
              <tr key={project.id || idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-900">{project.region || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{project.control_number || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{project.proponent || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{project.project_name || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{project.type_of_project || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {project.location ? (
                    project.location.length > 30 ? `${project.location.substring(0, 30)}...` : project.location
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{project.year_applied || '-'}</td>
                <td className="px-4 py-3 text-sm text-center">
                  {project.has_ongoing_fpic ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      Ongoing
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onViewProject(project)}
                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                    title="View Details"
                  >
                    <Eye size={16} className="text-blue-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Summary by Year Table
function SummaryByYearTable({ summary, regionFilter }) {
  const years = Object.keys(summary).sort((a, b) => b - a);
  const regions = regionFilter === 'all' 
    ? Array.from(new Set(years.flatMap(y => Object.keys(summary[y])))).sort()
    : [regionFilter];

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Year</th>
              {regions.map(region => (
                <th key={region} className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  {region}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {years.map(year => {
              const rowTotal = regions.reduce((sum, region) => sum + (summary[year]?.[region] || 0), 0);
              return (
                <tr key={year} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{year}</td>
                  {regions.map(region => (
                    <td key={region} className="px-4 py-3 text-sm text-center text-gray-700">
                      {summary[year]?.[region] || 0}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900">{rowTotal}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Summary by Type Table
function SummaryByTypeTable({ summary, regionFilter }) {
  const types = Object.keys(summary).sort();
  const regions = regionFilter === 'all'
    ? Array.from(new Set(types.flatMap(t => Object.keys(summary[t])))).sort()
    : [regionFilter];

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Project Type</th>
              {regions.map(region => (
                <th key={region} className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  {region}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {types.map(type => {
              const rowTotal = regions.reduce((sum, region) => sum + (summary[type]?.[region] || 0), 0);
              return (
                <tr key={type} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{type}</td>
                  {regions.map(region => (
                    <td key={region} className="px-4 py-3 text-sm text-center text-gray-700">
                      {summary[type]?.[region] || 0}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900">{rowTotal}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Stats Card Component
function StatCard({ label, value, color, icon: Icon }) {
  const colors = {
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500'
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-l-transparent hover:border-l-blue-500 transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// View Project Modal
function ViewProjectModal({ project, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Project Details</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-4">
            <h3 className="font-semibold text-blue-900 mb-1">Basic Information</h3>
          </div>
          
          <DetailRow label="Region" value={project.region} />
          <DetailRow label="Control Number" value={project.control_number} />
          <DetailRow label="Survey Number" value={project.survey_number} />
          <DetailRow label="Proponent" value={project.proponent} />
          <DetailRow label="Project Name" value={project.project_name} />
          <DetailRow label="Project Cost" value={project.project_cost} />
          <DetailRow label="Type of Project" value={project.type_of_project} />
          <DetailRow label="CADT Status" value={project.cadt_status} />
          
          <div className="bg-green-50 border-l-4 border-green-600 p-4 my-4">
            <h3 className="font-semibold text-green-900 mb-1">Location Details</h3>
          </div>
          
          <DetailRow label="Location" value={project.location} />
          <DetailRow label="Province" value={project.province} />
          <DetailRow label="Municipality" value={project.municipality} />
          <DetailRow label="Barangay" value={project.barangay} />
          <DetailRow label="Total Area (Ha)" value={project.total_area} />
          
          <div className="bg-purple-50 border-l-4 border-purple-600 p-4 my-4">
            <h3 className="font-semibold text-purple-900 mb-1">Project Status</h3>
          </div>
          
          <DetailRow label="Status" value={project.status} />
          <DetailRow label="Status of Application" value={project.status_of_application} />
          <DetailRow label="Affected ICC/IP" value={
            Array.isArray(project.affected_icc) ? project.affected_icc.join(', ') : project.affected_icc
          } />
          <DetailRow label="Has Ongoing FPIC" value={project.has_ongoing_fpic ? 'Yes' : 'No'} />
          
          <div className="bg-yellow-50 border-l-4 border-yellow-600 p-4 my-4">
            <h3 className="font-semibold text-yellow-900 mb-1">Timeline & Benefits</h3>
          </div>
          
          <DetailRow label="Date Filed" value={
            project.date_filed 
              ? new Date(project.date_filed.seconds * 1000).toLocaleDateString()
              : '-'
          } />
          <DetailRow label="Year Applied" value={project.year_applied} />
          <DetailRow label="Year Approved" value={project.year_approved} />
          <DetailRow label="MOA Duration" value={project.moa_duration} />
          <DetailRow label="Community Benefits" value={project.community_benefits} />
          
          {/* Show FPIC workflow fields if project has ongoing FPIC */}
          {(project.has_ongoing_fpic || project.status === 'Ongoing') && (
            <>
              <div className="bg-red-50 border-l-4 border-red-600 p-4 my-4">
                <h3 className="font-semibold text-red-900 mb-1">FPIC Process Workflow</h3>
              </div>
              
              <DetailRow label="Issuance of Work Order" value={project.issuance_of_work_order} />
              <DetailRow label="Pre-FBI Conference" value={project.pre_fbi_conference} />
              <DetailRow label="Conduct of FBI" value={project.conduct_of_fbi} />
              <DetailRow label="Review of FBI Report" value={project.review_of_fbi_report} />
              <DetailRow label="Pre-FPIC Conference" value={project.pre_fpic_conference} />
              <DetailRow label="1st Community Assembly" value={project.first_community_assembly} />
              <DetailRow label="2nd Community Assembly" value={project.second_community_assembly} />
              <DetailRow label="Consensus Building & Decision" value={project.consensus_building_decision} />
              <DetailRow label="MOA Validation/Ratification/Signing" value={project.moa_validation_ratification_signing} />
              <DetailRow label="Issuance of Resolution of Consent" value={project.issuance_resolution_of_consent} />
              <DetailRow label="Review by RRT" value={project.review_by_rrt} />
              <DetailRow label="Review by ADO/LAO" value={project.review_by_ado_or_lao} />
              <DetailRow label="For Compliance of FPIC Team" value={project.for_compliance_of_fpic_team} />
              <DetailRow label="CEB Deliberation" value={project.ceb_deliberation} />
            </>
          )}
        </div>
        
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Detail Row Component
function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="font-medium text-gray-700">{label}:</div>
      <div className="col-span-2 text-gray-900">{value || '-'}</div>
    </div>
  );
}

export default CPDashboardNew;
