'use client';

import React, { useState } from 'react';
import {
  Plus,
  Search,
  Download,
  LogOut,
  Map,
  MapPin,
  Layers,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Allowed roles: admin and user (encoder, reviewer)
const ALLOWED_ROLES = ['admin', 'encoder', 'reviewer'];
const isAllowedRole = (role) => role && ALLOWED_ROLES.includes(role.toLowerCase());
const isAdmin = (role) => role && role.toLowerCase() === 'admin';

export function Dashboard({ user, onLogout, onAddMapping, onViewMappings, mappings = [] }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [fabOpen, setFabOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const itemsPerPage = 15;

  const userCanAccess = isAllowedRole(user?.role);
  const userIsAdmin = isAdmin(user?.role);

  // Filter mappings based on search query
  const filteredMappings = mappings.filter((mapping) => {
    const query = searchQuery.toLowerCase();
    return (
      mapping.surveyNumber?.toLowerCase().includes(query) ||
      mapping.province?.toLowerCase().includes(query) ||
      mapping.municipality?.toLowerCase().includes(query) ||
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

  // Export to Excel function
  const handleExportExcel = () => {
    const headers = ['Survey Number', 'Province', 'Municipality', 'Barangays', 'Total Area', 'ICC', 'Remarks', 'Region'];
    const rows = mappings.map(m => [
      m.surveyNumber || '',
      m.province || '',
      m.municipality || '',
      m.barangays?.join(', ') || '',
      m.totalArea || '',
      m.icc?.join('; ') || '',
      m.remarks || '',
      m.region || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `mappings-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setFabOpen(false);
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

  // Calculate statistics
  const stats = {
    totalMappings: mappings.length,
    totalArea: mappings.reduce((sum, m) => sum + (m.totalArea || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    regions: new Set(mappings.map((m) => m.region)).size,
  };

  if (!userCanAccess) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-[#0A2D55]" style={{
          backgroundImage: 'linear-gradient(135deg, #0A2D55 0%, #0C3B6E 40%, #0A2D55 100%)',
        }}>
          <div className="text-center text-white px-6 max-w-md">
            <p className="text-lg font-semibold">Access restricted</p>
            <p className="text-white/80 mt-2 text-sm">This dashboard is for admin and user accounts only.</p>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="mt-6 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium ring-1 ring-white/20"
            >
              Back to Login
            </button>
          </div>
        </div>

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
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#071A2C]/30">
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
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)} • {user.username}
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
              <Map size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
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
                    <Map className="w-5 h-5 sm:w-6 sm:h-6 text-[#0A2D55]" />
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
                <Map className="w-12 h-12 sm:w-16 sm:h-16 text-[#0A2D55]/30 mx-auto mb-4" />
                <p className="text-[#0A2D55]/70 text-sm sm:text-lg">
                  {searchQuery ? 'No mappings found matching your search.' : 'No mappings yet. Create your first mapping to get started.'}
                </p>
              </div>
            ) : (
              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg border border-white/20 overflow-hidden animate-section-2">
                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto hide-scrollbar">
                  <table className="w-full">
                    <thead className="bg-[#0A2D55]/5 border-b border-[#0A2D55]/15">
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Survey Number</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Location</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Area (ha)</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">ICCs/IPs</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Remarks</th>
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
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-xs">
                            <div className="line-clamp-2">{mapping.province}, {mapping.municipality}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 font-mono">
                            {mapping.totalArea?.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-xs truncate">{mapping.icc?.join(', ') || '-'}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-xs truncate">
                            {mapping.remarks || '-'}
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
                          <p className="text-xs text-[#0A2D55]/60 font-medium">Province</p>
                          <p className="text-xs text-[#0A2D55]/90 truncate">{mapping.province}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#0A2D55]/60 font-medium">Area (ha)</p>
                          <p className="text-xs text-[#0A2D55]/90 font-mono">
                            {mapping.totalArea?.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          </p>
                        </div>
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
          onClick={handleExportExcel}
          className={cn(
            "absolute w-14 h-14 bg-[#F2C94C] hover:bg-yellow-400 text-[#0A2D55] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-out active:scale-95 flex items-center justify-center",
            fabOpen
              ? "opacity-100 bottom-20 right-16"
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
