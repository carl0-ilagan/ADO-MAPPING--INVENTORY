'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { ArrowLeft, User, Mail, Shield, Building2, LogOut, Edit2, Key, Lock, Eye, EyeOff, Check, X, Plus, Download, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateUserEmail, updateUserPassword } from '@/lib/firebaseAuth.js';

export function ProfilePage({ user, onBack, onLogout, onAddMapping, mappings = [] }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  
  // Email update state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [isClosingEmailModal, setIsClosingEmailModal] = useState(false);
  
  // Password update state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isClosingPasswordModal, setIsClosingPasswordModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isClosingExportModal, setIsClosingExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [exportError, setExportError] = useState('');

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

    const match = value.match(/REGION\s*(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII)(?:\s*[-–]\s*(A|B))?/i);
    if (match) {
      const numeral = match[1].toUpperCase();
      const suffix = match[2] ? match[2].toUpperCase() : null;
      if (numeral === 'IV' && suffix) return `Region IV-${suffix}`;
      return `Region ${numeral}`;
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

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } catch (error) {
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
    }
  };

  const handleCloseModal = () => {
    if (isLoggingOut) return;
    setIsClosingModal(true);
    setTimeout(() => {
      setShowLogoutModal(false);
      setIsClosingModal(false);
    }, 200);
  };

  const handleCloseEmailModal = () => {
    if (isUpdatingEmail) return;
    setIsClosingEmailModal(true);
    setTimeout(() => {
      setShowEmailModal(false);
      setIsClosingEmailModal(false);
    }, 200);
  };

  const handleClosePasswordModal = () => {
    if (isUpdatingPassword) return;
    setIsClosingPasswordModal(true);
    setTimeout(() => {
      setShowPasswordModal(false);
      setIsClosingPasswordModal(false);
    }, 200);
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess(false);

    if (!newEmail || !emailPassword) {
      setEmailError('Please fill in all fields');
      return;
    }

    if (!newEmail.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsUpdatingEmail(true);
    try {
      await updateUserEmail(newEmail, emailPassword);
      setEmailSuccess(true);
      setTimeout(() => {
        handleCloseEmailModal();
        setTimeout(() => {
          setNewEmail('');
          setEmailPassword('');
          setEmailSuccess(false);
        }, 200);
      }, 2000);
    } catch (error) {
      if (error.message.includes('auth/wrong-password')) {
        setEmailError('Incorrect password');
      } else if (error.message.includes('auth/email-already-in-use')) {
        setEmailError('This email is already in use');
      } else if (error.message.includes('auth/invalid-email')) {
        setEmailError('Invalid email format');
      } else {
        setEmailError(error.message || 'Failed to update email');
      }
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    setIsUpdatingPassword(true);
    try {
      await updateUserPassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setTimeout(() => {
        handleClosePasswordModal();
        setTimeout(() => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setPasswordSuccess(false);
        }, 200);
      }, 2000);
    } catch (error) {
      if (error.message.includes('auth/wrong-password')) {
        setPasswordError('Current password is incorrect');
      } else if (error.message.includes('auth/weak-password')) {
        setPasswordError('Password is too weak');
      } else {
        setPasswordError(error.message || 'Failed to update password');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const buildExportWorkbook = () => {
    const headers = ['Survey Number', 'Province', 'Municipality', 'Barangays', 'Total Area', 'ICC', 'Remarks', 'Sheet'];
    const rowsBySheet = new globalThis.Map();

    mappings.forEach((m) => {
      const sheet = detectRegionSheet(m.region) || 'Unknown';
      const rows = rowsBySheet.get(sheet) || [];
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
    setExportError('');
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
        setExportError(error?.message || 'Failed to export Excel file.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-full bg-transparent">

      {/* Main Content */}
      <main className="w-full px-3 sm:px-4 pb-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#0A2D55]/5">
          <div className="border-b px-6 py-5 bg-gradient-to-r from-[#0A2D55]/5 via-[#F2C94C]/10 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-bold text-xl text-[#0A2D55]">Profile Details</h1>
                <p className="text-sm text-[#0A2D55]/55 mt-1">Account information and security</p>
              </div>
            </div>
          </div>

          {/* Profile Information */}
          <div className="p-6 sm:p-7 space-y-4">
            {/* Email */}
            <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:border-[#0A2D55]/20 transition-all group">
              <div className="w-12 h-12 bg-[#0A2D55]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail size={22} className="text-[#0A2D55]" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email Address
                </label>
                <p className="text-base sm:text-lg text-gray-900 font-medium mt-1 truncate">
                  {user?.email || 'Not available'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Update to your official email for password recovery
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEmailModal(true);
                  setNewEmail(user?.email || '');
                  setEmailError('');
                }}
                className="flex-shrink-0 w-9 h-9 bg-[#0A2D55]/10 hover:bg-[#0A2D55]/20 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                title="Update Email"
              >
                <Edit2 size={16} className="text-[#0A2D55]" />
              </button>
            </div>

            {/* Role */}
            <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:border-[#0A2D55]/20 transition-all">
              <div className="w-12 h-12 bg-[#0A2D55]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield size={22} className="text-[#0A2D55]" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Role
                </label>
                <p className="text-base sm:text-lg text-gray-900 font-medium mt-1 capitalize">
                  {user?.role || 'User'}
                </p>
              </div>
            </div>

            {/* Community */}
            {user?.communityName && (
              <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:border-[#0A2D55]/20 transition-all">
                <div className="w-12 h-12 bg-[#0A2D55]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 size={22} className="text-[#0A2D55]" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Community
                  </label>
                  <p className="text-base sm:text-lg text-gray-900 font-medium mt-1">
                    {user.communityName}
                  </p>
                </div>
              </div>
            )}

            {/* User ID */}
            <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:border-[#0A2D55]/20 transition-all">
              <div className="w-12 h-12 bg-[#0A2D55]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <User size={22} className="text-[#0A2D55]" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  User ID
                </label>
                <p className="text-xs sm:text-sm text-gray-600 font-mono mt-1 break-all">
                  {user?.uid || 'Not available'}
                </p>
              </div>
            </div>

            {/* Change Password Button */}
            <div className="pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowPasswordModal(true);
                  setPasswordError('');
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-gradient-to-r from-[#0A2D55] to-[#0C3B6E] hover:shadow-xl text-white rounded-xl font-semibold transition-all active:scale-95 shadow-lg"
              >
                <Key size={20} />
                Change Password
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Update Email Modal */}
      {showEmailModal && (
        <>
          <div 
            className={cn(
              "fixed inset-0 z-[100] transition-all duration-200",
              isClosingEmailModal ? "animate-out fade-out" : "animate-in fade-in"
            )}
            style={{
              backgroundImage: `
                radial-gradient(circle at 20% 20%, rgba(255, 215, 0, 0.08), transparent 30%),
                radial-gradient(circle at 80% 80%, rgba(255, 215, 0, 0.05), transparent 28%),
                linear-gradient(135deg, rgba(10, 45, 85, 0.7) 0%, rgba(12, 59, 110, 0.8) 100%)
              `,
              backdropFilter: 'blur(12px)',
            }}
            onClick={handleCloseEmailModal}
          />
          
          <div className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[90%] max-w-md transition-all duration-200",
            isClosingEmailModal ? "animate-out zoom-out fade-out" : "animate-in zoom-in fade-in"
          )}>
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#0A2D55] to-[#0C3B6E] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center ring-2 ring-white/25 shadow-xl">
                    <Mail size={22} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Update Email</h3>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleUpdateEmail} className="p-6 space-y-5 text-white/90">
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    New Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={isUpdatingEmail}
                    className="w-full px-4 py-3 border border-white/20 rounded-xl bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-[#F2C94C]/40 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="Enter your official email"
                    required
                  />
                  <p className="text-xs text-white/60 mt-2">
                    Use your official email for password recovery
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    Current Password (for confirmation)
                  </label>
                  <input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    disabled={isUpdatingEmail}
                    className="w-full px-4 py-3 border border-white/20 rounded-xl bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-[#F2C94C]/40 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="Enter your current password"
                    required
                  />
                </div>

                {emailError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-50 text-sm">
                    <X size={18} />
                    {emailError}
                  </div>
                )}

                {emailSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-400/15 border border-emerald-300/30 rounded-xl text-emerald-50 text-sm">
                    <Check size={18} />
                    Email updated successfully!
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleCloseEmailModal}
                    disabled={isUpdatingEmail}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingEmail}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-[#0A2D55] to-[#0C3B6E] text-white hover:shadow-xl hover:shadow-black/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ring-1 ring-white/20"
                  >
                    {isUpdatingEmail ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Email'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <>
          <div 
            className={cn(
              "fixed inset-0 z-[100] transition-all duration-200",
              isClosingPasswordModal ? "animate-out fade-out" : "animate-in fade-in"
            )}
            style={{
              backgroundImage: `
                radial-gradient(circle at 20% 20%, rgba(255, 215, 0, 0.08), transparent 30%),
                radial-gradient(circle at 80% 80%, rgba(255, 215, 0, 0.05), transparent 28%),
                linear-gradient(135deg, rgba(10, 45, 85, 0.7) 0%, rgba(12, 59, 110, 0.8) 100%)
              `,
              backdropFilter: 'blur(12px)',
            }}
            onClick={handleClosePasswordModal}
          />
          
          <div className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[90%] max-w-md transition-all duration-200",
            isClosingPasswordModal ? "animate-out zoom-out fade-out" : "animate-in zoom-in fade-in"
          )}>
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#0A2D55] to-[#0C3B6E] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center ring-2 ring-white/25 shadow-xl">
                    <Key size={22} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Change Password</h3>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleUpdatePassword} className="p-6 space-y-5 text-white/90">
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={isUpdatingPassword}
                      className="w-full px-4 py-3 pr-12 border border-white/20 rounded-xl bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-[#F2C94C]/40 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                    >
                      {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isUpdatingPassword}
                      className="w-full px-4 py-3 pr-12 border border-white/20 rounded-xl bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-[#F2C94C]/40 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="Enter new password (min 6 chars)"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isUpdatingPassword}
                      className="w-full px-4 py-3 pr-12 border border-white/20 rounded-xl bg-white/10 text-white placeholder-white/60 focus:ring-2 focus:ring-[#F2C94C]/40 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="Re-enter new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-50 text-sm">
                    <X size={18} />
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-400/15 border border-emerald-300/30 rounded-xl text-emerald-50 text-sm">
                    <Check size={18} />
                    Password changed successfully!
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleClosePasswordModal}
                    disabled={isUpdatingPassword}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-[#0A2D55] to-[#0C3B6E] text-white hover:shadow-xl hover:shadow-black/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ring-1 ring-white/20"
                  >
                    {isUpdatingPassword ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
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

      {/* Floating Action Button with Menu */}
      <div className="fixed bottom-8 right-8 z-50">
        {/* Back to Dashboard Button - Top */}
        <button
          onClick={() => {
            onBack();
            setFabOpen(false);
          }}
          className={cn(
            "absolute w-14 h-14 bg-[#0A2D55] hover:bg-[#0C3B6E] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-out active:scale-95 flex items-center justify-center",
            fabOpen
              ? "opacity-100 bottom-20 right-0"
              : "opacity-0 bottom-0 right-0 pointer-events-none"
          )}
          title="Back to Dashboard"
        >
          <Home size={24} strokeWidth={2.5} />
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
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[90%] max-w-md transition-all duration-200",
            isClosingExportModal ? "animate-out zoom-out fade-out" : "animate-in zoom-in fade-in"
          )}>
            <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 overflow-hidden">
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
                className="px-6 py-5"
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

              <div className="px-6 py-5 text-white/90">
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
                {exportError && (
                  <div className="mt-4 flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-50 text-sm">
                    <X size={18} />
                    {exportError}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-white/15 flex items-center justify-end gap-3">
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
    </div>
  );
}
