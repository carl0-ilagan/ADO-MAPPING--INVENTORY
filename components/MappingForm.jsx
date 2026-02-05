'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, Plus, X, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// Sample hierarchical data
const locationData = {
  regions: [
    { id: 1, name: 'Region I - Ilocos Region' },
    { id: 2, name: 'Region II - Cagayan Valley' },
    { id: 3, name: 'CAR - Cordillera Administrative Region' },
    { id: 4, name: 'Region III - Central Luzon' },
    { id: 5, name: 'CALABARZON - Region IV-A' },
    { id: 6, name: 'MIMAROPA - Region IV-B' },
    { id: 7, name: 'Region V - Bicol Region' },
    { id: 8, name: 'Region VI - Western Visayas' },
    { id: 9, name: 'Region VII - Central Visayas' },
    { id: 10, name: 'Region VIII - Eastern Visayas' },
    { id: 11, name: 'Region IX - Zamboanga Peninsula' },
    { id: 12, name: 'Region X - Northern Mindanao' },
    { id: 13, name: 'Region XI - Davao Region' },
    { id: 14, name: 'Region XII - SOCCSKSARGEN' },
    { id: 15, name: 'Region XIII - CARAGA' },
    { id: 16, name: 'BARMM - Bangsamoro Autonomous Region' },
  ],
  provinces: {
    1: [
      { id: 1, name: 'Ilocos Norte' },
      { id: 2, name: 'Ilocos Sur' },
      { id: 3, name: 'La Union' },
    ],
    2: [
      { id: 4, name: 'Cagayan' },
      { id: 5, name: 'Isabela' },
      { id: 6, name: 'Nueva Vizcaya' },
    ],
    3: [
      { id: 7, name: 'Abra' },
      { id: 8, name: 'Benguet' },
      { id: 9, name: 'Ifugao' },
      { id: 10, name: 'Kalinga' },
    ],
  },
  municipalities: {
    1: [
      { id: 1, name: 'Laoag City' },
      { id: 2, name: 'Batac' },
      { id: 3, name: 'Paoay' },
    ],
    2: [
      { id: 4, name: 'Vigan City' },
      { id: 5, name: 'Caoayan' },
      { id: 6, name: 'Candon City' },
    ],
    4: [
      { id: 7, name: 'Tuguegarao' },
      { id: 8, name: 'Cabanatuan' },
    ],
  },
  barangays: {
    1: [
      { id: 1, name: 'Barangay 1' },
      { id: 2, name: 'Barangay 2' },
      { id: 3, name: 'Barangay 3' },
    ],
    2: [
      { id: 4, name: 'Barangay A' },
      { id: 5, name: 'Barangay B' },
    ],
  },
};

const iccOptions = [
  'Igorot',
  'Cordillera People',
  'Lumad',
  'Aeta',
  'Ibanag',
  'Ilocano',
  'Visayan',
  'Maranao',
  'Tausug',
];

const ipGroupOptions = [
  'Ifugao',
  'Kalinga',
  'Kankanaey',
  'Isneg',
  'Bontoc',
  'Tausug',
  'Maranao',
  'Maguindanao',
];

function SearchableSelect({ options, selected, onChange, placeholder, multi = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (open && menuRef.current && !menuRef.current.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const filtered = options.filter((opt) =>
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (option) => {
    if (multi) {
      const isSelected = selected.find((s) => s.id === option.id);
      onChange(
        isSelected ? selected.filter((s) => s.id !== option.id) : [...selected, option]
      );
    } else {
      onChange(option);
      setOpen(false);
    }
  };

  const handleAddCustom = () => {
    if (customValue.trim()) {
      const newOption = { id: Date.now(), name: customValue };
      handleSelect(newOption);
      setCustomValue('');
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm border-2 border-[#0A2D55]/10 rounded-lg bg-white/80 hover:border-[#F2C94C]/40 focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/40 focus:border-[#F2C94C] transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-md"
      >
        <span className="text-[#0A2D55] truncate font-medium">
          {multi && selected.length > 0
            ? `${selected.length} selected`
            : selected?.name || placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`text-[#0A2D55]/40 transition flex-shrink-0 ml-2 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div 
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            width: `${menuPosition.width}px`,
          }}
          className="bg-white border-2 border-[#0A2D55]/10 rounded-lg shadow-2xl z-[99999] max-h-80 overflow-hidden flex flex-col"
        >
          <div className="p-3 sticky top-0 bg-white border-b border-[#0A2D55]/10 rounded-t-lg z-10">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 border-2 border-[#0A2D55]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/40 transition shadow-sm"
            />
          </div>
          <div className="p-2 max-h-72 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelect(option)}
                  type="button"
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition duration-150 ${
                    (Array.isArray(selected) ? selected.find((s) => s.id === option.id) : selected?.id === option.id)
                      ? 'bg-[#F2C94C]/30 text-[#0A2D55] font-semibold'
                      : 'hover:bg-[#0A2D55]/5 text-[#0A2D55]'
                  }`}
                >
                  {option.name}
                </button>
              ))
            ) : (
              <p className="text-center text-sm text-[#0A2D55]/40 py-4">No results found</p>
            )}
            <div className="border-t border-[#0A2D55]/10 mt-2 pt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="Add new..."
                  className="flex-1 px-3 py-2 border-2 border-[#0A2D55]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/40 transition shadow-sm"
                />
                <button
                  type="button"
                  onClick={handleAddCustom}
                  className="px-3 py-2 bg-[#F2C94C] text-[#0A2D55] rounded-lg text-sm font-semibold hover:bg-[#E6BB3A] transition active:scale-95 flex-shrink-0"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MappingForm({ onBack, onSubmit, isModal = false }) {
  const [formData, setFormData] = useState({
    surveyNumber: '',
    totalArea: '',
    selectedRegion: null,
    selectedProvince: null,
    municipalities: [],
    barangays: [],
    icc: [],
    ipGroup: [],
    remarks: '',
  });

  const [errors, setErrors] = useState({});

  // Filtered options based on cascading selections
  const provinces = useMemo(() => {
    if (!formData.selectedRegion) return [];
    return locationData.provinces[formData.selectedRegion.id] || [];
  }, [formData.selectedRegion]);

  const municipalities = useMemo(() => {
    if (!formData.selectedProvince) return [];
    return locationData.municipalities[formData.selectedProvince.id] || [];
  }, [formData.selectedProvince]);

  const barangays = useMemo(() => {
    if (formData.municipalities.length === 0) return [];
    const allBarangays = [];
    formData.municipalities.forEach((mun) => {
      allBarangays.push(...(locationData.barangays[mun.id] || []));
    });
    return allBarangays;
  }, [formData.municipalities]);

  const handleValidateAndSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.surveyNumber.trim())
      newErrors.surveyNumber = 'Survey Number is required';
    if (!formData.totalArea) newErrors.totalArea = 'Total Area is required';
    if (isNaN(formData.totalArea) || formData.totalArea <= 0)
      newErrors.totalArea = 'Area must be a positive number';
    if (!formData.selectedRegion) newErrors.selectedRegion = 'Region is required';
    if (!formData.selectedProvince) newErrors.selectedProvince = 'Province is required';
    if (formData.municipalities.length === 0)
      newErrors.municipalities = 'At least one municipality is required';
    if (formData.barangays.length === 0)
      newErrors.barangays = 'At least one barangay is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className={isModal ? 'w-full min-h-full flex flex-col' : 'min-h-screen bg-gradient-to-br from-[#071A2C]/5 via-white to-[#F2C94C]/5 py-6 sm:py-10'}>
      <div className={isModal ? 'w-full flex-1 flex flex-col min-h-0' : 'max-w-3xl mx-auto px-4 sm:px-6'}>
        {!isModal && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#0A2D55] font-semibold mb-6 hover:gap-3 transition text-sm sm:text-base active:scale-95"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
            Back to Dashboard
          </button>
        )}

        <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col flex-1 min-h-0 border border-[#0A2D55]/5 ${isModal ? 'rounded-t-3xl border-t-4 border-[#F2C94C]' : ''}`}>
          {/* Modern header with gradient background */}
          <div className={cn('border-b border-[#0A2D55]/8 bg-gradient-to-r from-[#0A2D55]/3 via-[#F2C94C]/5 to-transparent flex-shrink-0', isModal ? 'px-4 py-3 animate-header' : 'px-5 sm:px-7 py-5 sm:py-6')}>
            <h1 className={cn('font-bold bg-gradient-to-r from-[#0A2D55] to-[#0A2D55] bg-clip-text text-transparent', isModal ? 'text-lg' : 'text-xl sm:text-2xl')}>Add New Mapping</h1>
            {!isModal && <p className="text-sm text-[#0A2D55]/55 mt-1">Indigenous Cultural Community mapping record</p>}
          </div>

          <form onSubmit={handleValidateAndSubmit} className={cn('flex-1 flex flex-col min-h-0', isModal ? 'p-3 sm:p-4' : 'p-5 sm:p-7')}>
            {/* Single column unified form - with scrolling content */}
            <div className={cn('flex-1 overflow-y-auto pr-2', isModal ? 'space-y-2' : 'space-y-6')}>
              {/* Section 1: Mapping Info */}
              <div className={cn(isModal ? 'space-y-2 animate-section-1' : 'space-y-4')}>
                <div className={isModal ? 'flex items-center gap-3 mb-2' : 'flex items-center gap-4 mb-4'}>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-[#F2C94C] via-[#F2C94C]/50 to-transparent"></div>
                  <h2 className={cn('font-bold uppercase tracking-wider text-[#0A2D55] whitespace-nowrap', isModal ? 'text-xs' : 'text-sm')}>📍 Mapping Info</h2>
                  <div className="flex-1 h-0.5 bg-gradient-to-l from-[#F2C94C] via-[#F2C94C]/50 to-transparent"></div>
                </div>
                <div className={isModal ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
                  <div>
                    <label className={cn('block font-semibold text-[#0A2D55]', isModal ? 'text-xs mb-1' : 'text-sm mb-2')}>Survey Number <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.surveyNumber}
                      onChange={(e) => setFormData({ ...formData, surveyNumber: e.target.value })}
                      placeholder="e.g. ADO-2024-001"
                      className={cn('w-full border-2 border-[#0A2D55]/10 rounded-lg bg-white/80 hover:border-[#F2C94C]/40 focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/50 focus:border-[#F2C94C] transition-all duration-200 shadow-sm hover:shadow-md', isModal ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm')}
                    />
                    {errors.surveyNumber && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.surveyNumber}</p>}
                  </div>
                  <div>
                    <label className={cn('block font-semibold text-[#0A2D55]', isModal ? 'text-xs mb-1' : 'text-sm mb-2')}>Area (hectares) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={formData.totalArea}
                      onChange={(e) => setFormData({ ...formData, totalArea: e.target.value })}
                      placeholder="Enter area"
                      className={cn('w-full border border-[#0A2D55]/15 rounded-xl bg-white hover:border-[#0A2D55]/25 focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/40 focus:border-[#F2C94C] transition-all duration-200', isModal ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm')}
                    />
                    {errors.totalArea && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.totalArea}</p>}
                  </div>
                </div>
              </div>

              {/* Section 2: Location */}
              <div className={cn(isModal ? 'space-y-2 animate-section-2' : 'space-y-4')}>
                <div className={isModal ? 'flex items-center gap-3 mb-2' : 'flex items-center gap-4 mb-4'}>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-[#F2C94C] via-[#F2C94C]/50 to-transparent"></div>
                  <h2 className={cn('font-bold uppercase tracking-wider text-[#0A2D55] whitespace-nowrap', isModal ? 'text-xs' : 'text-sm')}>🗺️ Location Details</h2>
                  <div className="flex-1 h-0.5 bg-gradient-to-l from-[#F2C94C] via-[#F2C94C]/50 to-transparent"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={cn('block font-semibold text-[#0A2D55]', isModal ? 'text-xs mb-1' : 'text-sm mb-2')}>Region <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    options={locationData.regions}
                    selected={formData.selectedRegion}
                    onChange={(region) => setFormData({ ...formData, selectedRegion: region, selectedProvince: null, municipalities: [], barangays: [] })}
                    placeholder="Select region"
                  />
                  {errors.selectedRegion && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.selectedRegion}</p>}
                </div>
                <div>
                  <label className={cn('block font-semibold text-[#0A2D55]', isModal ? 'text-xs mb-1' : 'text-sm mb-2')}>Province <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      options={provinces}
                      selected={formData.selectedProvince}
                      onChange={(province) => setFormData({ ...formData, selectedProvince: province, municipalities: [], barangays: [] })}
                      placeholder="Select province"
                      disabled={!formData.selectedRegion}
                    />
                    {errors.selectedProvince && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.selectedProvince}</p>}
                  </div>
                </div>
                <div>
                  <label className={cn('block font-semibold text-[#0A2D55]', isModal ? 'text-xs mb-1' : 'text-sm mb-2')}>Municipalities <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    options={municipalities}
                    selected={formData.municipalities}
                    onChange={(mun) => setFormData({ ...formData, municipalities: mun })}
                    placeholder="Select municipalities"
                    multi={true}
                  />
                  {errors.municipalities && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.municipalities}</p>}
                  {formData.municipalities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {formData.municipalities.map((mun) => (
                        <span key={mun.id} className="inline-flex items-center gap-1.5 bg-[#0A2D55]/10 text-[#0A2D55] px-3 py-1.5 rounded-full text-xs font-medium hover:bg-[#0A2D55]/15 transition-colors">
                          {mun.name}
                          <button type="button" onClick={() => setFormData({ ...formData, municipalities: formData.municipalities.filter((m) => m.id !== mun.id) })} className="hover:opacity-60 p-0.5 ml-0.5">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={cn('block font-semibold text-[#0A2D55]', isModal ? 'text-xs mb-1' : 'text-sm mb-2')}>Barangays <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    options={barangays}
                    selected={formData.barangays}
                    onChange={(bar) => setFormData({ ...formData, barangays: bar })}
                    placeholder="Select barangays"
                    multi={true}
                  />
                  {errors.barangays && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.barangays}</p>}
                  {formData.barangays.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {formData.barangays.map((bar) => (
                        <span key={bar.id} className="inline-flex items-center gap-1.5 bg-[#F2C94C]/20 text-[#8B6F1C] px-3 py-1.5 rounded-full text-xs font-medium hover:bg-[#F2C94C]/30 transition-colors">
                          {bar.name}
                          <button type="button" onClick={() => setFormData({ ...formData, barangays: formData.barangays.filter((b) => b.id !== bar.id) })} className="hover:opacity-60 p-0.5 ml-0.5">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Communities & Notes */}
              <div className={cn(isModal ? 'space-y-2 animate-section-3' : 'space-y-4')}>
                <div className={isModal ? 'flex items-center gap-3 mb-2' : 'flex items-center gap-4 mb-4'}>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-[#F2C94C] via-[#F2C94C]/50 to-transparent"></div>
                  <h2 className={isModal ? 'text-xs font-bold uppercase tracking-wider text-[#0A2D55] whitespace-nowrap' : 'text-sm font-bold uppercase tracking-wider text-[#0A2D55] whitespace-nowrap'}>👥 Communities & Notes</h2>
                  <div className="flex-1 h-0.5 bg-gradient-to-l from-[#F2C94C] via-[#F2C94C]/50 to-transparent"></div>
                </div>
                <div className={isModal ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
                  <div>
                    <label className={cn('block font-semibold text-[#0A2D55]', isModal ? 'text-xs mb-1' : 'text-sm mb-2')}>Indigenous Cultural Community (ICC)</label>
                    <SearchableSelect
                      options={iccOptions.map((name, idx) => ({ id: idx, name }))}
                      selected={formData.icc}
                      onChange={(icc) => setFormData({ ...formData, icc })}
                      placeholder="Select ICC"
                      multi={true}
                    />
                    {formData.icc.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {formData.icc.map((icc) => (
                          <span key={icc.id} className="inline-flex items-center gap-1.5 bg-[#0A2D55] text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-[#0C3B6E] transition-colors">
                            {icc.name}
                            <button type="button" onClick={() => setFormData({ ...formData, icc: formData.icc.filter((i) => i.id !== icc.id) })} className="hover:opacity-70 p-0.5 ml-0.5">✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={cn('block font-semibold text-[#0A2D55]', isModal ? 'text-xs mb-1' : 'text-sm mb-2')}>IP Group</label>
                    <SearchableSelect
                      options={ipGroupOptions.map((name, idx) => ({ id: idx, name }))}
                      selected={formData.ipGroup}
                      onChange={(ipGroup) => setFormData({ ...formData, ipGroup })}
                      placeholder="Select IP Group"
                      multi={true}
                    />
                    {formData.ipGroup.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {formData.ipGroup.map((ip) => (
                          <span key={ip.id} className="inline-flex items-center gap-1.5 bg-[#0C3B6E] text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-[#0A2D55] transition-colors">
                            {ip.name}
                            <button type="button" onClick={() => setFormData({ ...formData, ipGroup: formData.ipGroup.filter((i) => i.id !== ip.id) })} className="hover:opacity-70 p-0.5 ml-0.5">✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className={cn('block font-semibold text-[#0A2D55]', isModal ? 'text-xs mb-1' : 'text-sm mb-2')}>Remarks</label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Add any additional notes or observations..."
                    rows={isModal ? 2 : 3}
                    className={cn('w-full border-2 border-[#0A2D55]/10 rounded-lg bg-white/80 hover:border-[#F2C94C]/40 focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/50 focus:border-[#F2C94C] transition-all duration-200 resize-none shadow-sm hover:shadow-md', isModal ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm')}
                  />
                </div>
              </div>
            </div>

            {/* Modern Action Buttons - Right Aligned */}
            <div className={cn('flex gap-3 flex-shrink-0 border-t border-[#0A2D55]/8 justify-end', isModal ? 'pt-3 mt-3 animate-buttons' : 'pt-5 mt-6')}>
              <button
                type="button"
                onClick={onBack}
                className={cn('font-semibold text-[#0A2D55] bg-white border-2 border-[#0A2D55]/20 hover:bg-[#0A2D55]/5 rounded-lg transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md', isModal ? 'px-4 py-2 text-xs' : 'px-6 py-2.5 text-sm')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={cn('font-semibold text-white bg-gradient-to-r from-[#0A2D55] to-[#0C3B6E] rounded-lg hover:shadow-lg hover:shadow-[#0A2D55]/30 transition-all duration-200 active:scale-95 shadow-md', isModal ? 'px-5 py-2 text-xs' : 'px-7 py-2.5 text-sm')}
              >
                Save Mapping
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
