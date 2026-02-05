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

// Allowed roles: admin and user (encoder, reviewer)
const ALLOWED_ROLES = ['admin', 'encoder', 'reviewer'];
const isAllowedRole = (role) => role && ALLOWED_ROLES.includes(role.toLowerCase());
const isAdmin = (role) => role && role.toLowerCase() === 'admin';

export function Dashboard({ user, onLogout, onAddMapping, onViewMappings, mappings = [] }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userCanAccess = isAllowedRole(user?.role);
  const userIsAdmin = isAdmin(user?.role);

  // Calculate statistics
  const stats = {
    totalMappings: mappings.length,
    totalArea: mappings.reduce((sum, m) => sum + (m.totalArea || 0), 0).toFixed(2),
    regions: new Set(mappings.map((m) => m.region)).size,
  };

  if (!userCanAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A2D55]" style={{
        backgroundImage: 'linear-gradient(135deg, #0A2D55 0%, #0C3B6E 40%, #0A2D55 100%)',
      }}>
        <div className="text-center text-white px-6 max-w-md">
          <p className="text-lg font-semibold">Access restricted</p>
          <p className="text-white/80 mt-2 text-sm">This dashboard is for admin and user accounts only.</p>
          <button
            onClick={onLogout}
            className="mt-6 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium ring-1 ring-white/20"
          >
            Back to Login
          </button>
        </div>
      </div>
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
                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain drop-shadow-lg"
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
            onClick={onLogout}
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
                <button
                  onClick={onAddMapping}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white px-4 py-2.5 text-sm font-semibold ring-1 ring-white/15 backdrop-blur-md transition"
                >
                  <Plus size={18} />
                  Add Mapping
                </button>
                <button
                  onClick={onViewMappings}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F2C94C] hover:bg-[#E6BB3A] active:scale-95 text-[#0A2D55] px-4 py-2.5 text-sm font-semibold shadow-lg shadow-black/20 transition"
                >
                  <Search size={18} />
                  View Mappings
                </button>
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
          <div className="space-y-4 sm:space-y-6">
            {/* Stats Cards — login palette: navy #0A2D55, #0C3B6E, gold #F2C94C */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-4 sm:p-6 border-l-4 border-[#0A2D55] hover:shadow-xl hover:border-[#0C3B6E] transition">
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

              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-4 sm:p-6 border-l-4 border-[#F2C94C] hover:shadow-xl transition">
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

              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-4 sm:p-6 border-l-4 border-[#0C3B6E] hover:shadow-xl transition">
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

            {/* Quick Actions — login palette; Add Mapping only for admin */}
            <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg shadow-black/10 border border-white/20 p-4 sm:p-6 lg:p-8">
              <h2 className="text-lg sm:text-xl font-bold text-[#0A2D55] mb-4 sm:mb-6">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                {userIsAdmin && (
                  <button
                    onClick={onAddMapping}
                    className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 bg-[#0A2D55] hover:bg-[#0C3B6E] active:scale-[0.98] text-white px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl font-semibold transition text-sm sm:text-base touch-manipulation shadow-lg shadow-black/15 ring-1 ring-white/10"
                  >
                    <Plus size={20} className="sm:w-5 sm:h-5 flex-shrink-0" />
                    <span>Add Mapping</span>
                  </button>
                )}
                <button
                  onClick={onViewMappings}
                  className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 bg-[#F2C94C] hover:bg-[#E6BB3A] active:scale-[0.98] text-[#0A2D55] px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl font-semibold transition text-sm sm:text-base touch-manipulation shadow-lg shadow-black/15"
                >
                  <Search size={20} className="sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>View Mappings</span>
                </button>
                <button
                  className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 bg-[#0C3B6E]/15 hover:bg-[#0C3B6E]/25 active:scale-[0.98] text-[#0A2D55] px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl font-semibold transition text-sm sm:text-base touch-manipulation border border-[#0A2D55]/20"
                >
                  <Download size={20} className="sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>Export Excel</span>
                </button>
                <button
                  className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 bg-[#0A2D55] hover:bg-[#0C3B6E] active:scale-[0.98] text-white px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl font-semibold transition text-sm sm:text-base touch-manipulation shadow-lg shadow-black/15 ring-1 ring-white/10"
                >
                  <Download size={20} className="sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'mappings' && (
          <div>
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-lg sm:text-2xl font-bold text-[#0A2D55]">All Mappings</h2>
              {userIsAdmin && (
                <button
                  onClick={onAddMapping}
                  className="flex items-center gap-2 bg-[#0A2D55] hover:bg-[#0C3B6E] active:scale-[0.98] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition text-sm sm:text-base w-full sm:w-auto justify-center sm:justify-start touch-manipulation shadow-lg shadow-black/15 ring-1 ring-white/10"
                >
                  <Plus size={18} />
                  Add Mapping
                </button>
              )}
            </div>

            {mappings.length === 0 ? (
              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg border border-white/20 p-8 sm:p-12 text-center">
                <Map className="w-12 h-12 sm:w-16 sm:h-16 text-[#0A2D55]/30 mx-auto mb-4" />
                <p className="text-[#0A2D55]/70 text-sm sm:text-lg">No mappings yet. {userIsAdmin ? 'Create your first mapping to get started.' : 'Mappings will appear here.'}</p>
              </div>
            ) : (
              <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg border border-white/20 overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#0A2D55]/5 border-b border-[#0A2D55]/15">
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Survey</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Region</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Area (ha)</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">ICC</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-[#0A2D55] uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((mapping, idx) => (
                        <tr key={idx} className="border-b border-[#0A2D55]/10 hover:bg-[#F2C94C]/5 transition">
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-[#0A2D55]">{mapping.surveyNumber}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80">{mapping.region}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80">{mapping.totalArea}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#0A2D55]/80 max-w-xs truncate">{mapping.icc?.join(', ') || '-'}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4">
                            <span className="inline-block bg-[#F2C94C]/25 text-[#0A2D55] px-2 sm:px-3 py-1 rounded-full text-xs font-semibold">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3 p-3 sm:p-4">
                  {mappings.map((mapping, idx) => (
                    <div key={idx} className="bg-[#0A2D55]/5 border border-[#0A2D55]/15 rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#0A2D55]/60 font-medium">Survey</p>
                          <p className="text-sm font-bold text-[#0A2D55] truncate">{mapping.surveyNumber}</p>
                        </div>
                        <span className="inline-block bg-[#F2C94C]/25 text-[#0A2D55] px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0">
                          Active
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-[#0A2D55]/60 font-medium">Region</p>
                          <p className="text-xs text-[#0A2D55]/90 truncate">{mapping.region}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#0A2D55]/60 font-medium">Area (ha)</p>
                          <p className="text-xs text-[#0A2D55]/90">{mapping.totalArea}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-[#0A2D55]/60 font-medium mb-1">ICC</p>
                        <p className="text-xs text-[#0A2D55]/90 line-clamp-2">{mapping.icc?.join(', ') || '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
