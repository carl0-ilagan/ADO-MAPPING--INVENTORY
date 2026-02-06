"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, ArrowLeft, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const PSGC = {
  REGIONS: "https://psgc.gitlab.io/api/regions/",
  PROVINCES: "https://psgc.gitlab.io/api/provinces/",
  MUNICIPALITIES: "https://psgc.gitlab.io/api/cities-municipalities/",
  BARANGAYS: "https://psgc.gitlab.io/api/barangays/",
};

const ICC_IP_OPTIONS = [
  "Agta",
  "Aeta",
  "Alangan",
  "Ati",
  "Ayta",
  "B'laan",
  "Bagobo",
  "Balangao",
  "Bajau",
  "Bontoc",
  "Bugkalot",
  "Bukidnon",
  "Dumagat",
  "Hanunoo",
  "Ifugao",
  "Ibanag",
  "Igorot",
  "Ilongot",
  "Iraya",
  "Isneg",
  "Itawes",
  "Ivatan",
  "Kalinga",
  "Kankanaey",
  "Maguindanao",
  "Manobo",
  "Maranao",
  "Sama-Badjao",
  "Subanen",
  "Tagbanua",
  "Tausug",
  "Teduray",
  "Tboli",
  "Tingguian",
  "Tuwali",
  "Yakan",
];

const REGION_LABELS = {
  "01": "Region I",
  "02": "Region II",
  "03": "Region III",
  "04": "Region IV-A",
  "05": "Region V",
  "06": "Region VI",
  "07": "Region VII",
  "08": "Region VIII",
  "09": "Region IX",
  "10": "Region X",
  "11": "Region XI",
  "12": "Region XII",
  "13": "Region XIII",
  "14": "CAR",
  "17": "Region IV-B",
};

const REGION_ORDER = ["14", "01", "02", "03", "04", "17", "05", "06", "07", "08", "09", "10", "11", "12", "13"];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

function SearchableSelect({ options = [], selected = null, onChange = () => {}, placeholder = "Select", multi = false, disabled = false, summaryLabels = { singular: "item", plural: "items" }, allowCustom = false }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const closeMenu = () => {
    if (!open) return;
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      if (!allowCustom) setSearch("");
    }, 160);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !triggerRef.current?.contains(e.target)) closeMenu();
    };
    const onEsc = (e) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const filtered = options.filter((o) => String(o.name).toLowerCase().includes(search.toLowerCase()));

  const handleToggle = (code) => {
    if (!multi) {
      onChange(code);
      if (allowCustom) {
        const found = options.find((o) => String(o.code) === String(code));
        setSearch(found ? found.name : code);
      }
      closeMenu();
      return;
    }
    const next = new Set(Array.from(selected || []));
    const key = String(code);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  // Allow custom value entry for single select
  const handleCustomValue = () => {
    if (!allowCustom || !search.trim()) return;
    const trimmed = search.trim();
    
    if (multi) {
      // For multi-select, add the custom value as a new item
      const next = new Set(Array.from(selected || []));
      next.add(trimmed);
      onChange(next);
      setSearch("");
      return;
    }
    
    // For single select
    // Check if it already exists in options
    const existing = options.find((o) => o.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      onChange(existing.code);
    } else {
      // Use the custom text as both code and name
      onChange(trimmed);
    }
    closeMenu();
  };

  const label = (() => {
    if (multi) {
      const count = selected ? selected.size : 0;
      if (count === 0) return placeholder;
      if (count === 1) {
        const first = Array.from(selected)[0];
        const found = options.find((o) => String(o.code) === String(first));
        return found ? found.name : first;
      }
      return `${count} ${summaryLabels.plural} selected`;
    }
    if (!selected) return placeholder;
    const found = options.find((o) => String(o.code) === String(selected));
    return found ? found.name : selected;
  })();

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) closeMenu();
          else setOpen(true);
        }}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-sm rounded-xl bg-white/80 border-2 border-[#0A2D55]/10 hover:border-[#F2C94C]/40 focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/40 transition-all duration-200 shadow-sm hover:shadow-md",
          disabled ? "opacity-60 cursor-not-allowed" : ""
        )}
      >
        <span className="text-[#0A2D55] truncate font-medium">{label}</span>
        <ChevronDown size={18} className={`text-[#0A2D55]/40 transition ml-2 ${open && !closing ? "rotate-180" : ""}`} />
      </button>

      {(open || closing) && (
        <div
          ref={menuRef}
          className={cn(
            "absolute z-50 mt-2 w-full bg-white border-2 border-[#0A2D55]/10 rounded-xl shadow-2xl max-h-80 overflow-hidden origin-top transition-all duration-200",
            closing ? "opacity-0 scale-95 -translate-y-1" : "opacity-100 scale-100 translate-y-0"
          )}
        >
          <div className="p-3 sticky top-0 bg-white border-b border-[#0A2D55]/10">
            <input 
              ref={inputRef}
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && allowCustom && search.trim()) {
                  e.preventDefault();
                  handleCustomValue();
                }
              }}
              placeholder={allowCustom ? "Search or type custom..." : "Search..."} 
              className="w-full px-3 py-2 border-2 border-[#0A2D55]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/40" 
            />
          </div>
          <div className="p-2 max-h-72 overflow-y-auto">
            {filtered.length === 0 && !allowCustom && <p className="text-center text-sm text-[#0A2D55]/40 py-4">No results found</p>}
            {filtered.length === 0 && allowCustom && search.trim() && (
              <button
                type="button"
                onClick={handleCustomValue}
                className="w-full px-3 py-3 text-left hover:bg-[#F2C94C]/10 rounded-lg text-sm font-medium text-[#0A2D55] border-2 border-dashed border-[#F2C94C]/30"
              >
                ✨ Add {multi ? '' : 'custom: '}"<span className="font-bold">{search.trim()}</span>"
              </button>
            )}
            {filtered.map((opt) => (
              <label key={String(opt.code)} className="flex items-center gap-3 w-full px-3 py-2 hover:bg-[#0A2D55]/5 rounded-lg cursor-pointer">
                {multi ? (
                  <input type="checkbox" checked={selected ? selected.has(String(opt.code)) : false} onChange={() => handleToggle(opt.code)} />
                ) : (
                  <input type="radio" name="single-select" checked={String(selected) === String(opt.code)} onChange={() => handleToggle(opt.code)} />
                )}
                <span className="text-sm">{opt.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MappingForm({
  isModal = false,
  onBack = () => {},
  onSubmit = () => {},
  initialData = null,
  formTitle = "Add New Mapping",
  submitLabel = "Save Mapping",
}) {
  const [regions, setRegions] = useState([]);
  const [provincesAll, setProvincesAll] = useState([]);
  const [municipalitiesAll, setMunicipalitiesAll] = useState([]);
  const [barangaysAll, setBarangaysAll] = useState([]);

  const regionMap = useRef(new Map()).current;
  const regionNameMap = useRef(new Map()).current;
  const provinceMap = useRef(new Map()).current;
  const municipalityMap = useRef(new Map()).current;
  const barangayMap = useRef(new Map()).current;

  const [selectedRegionCode, setSelectedRegionCode] = useState(null);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState(null);
  const [selectedMunicipalityCodes, setSelectedMunicipalityCodes] = useState(new Set());
  const [selectedBarangayCodes, setSelectedBarangayCodes] = useState(new Set());
  const [selectedIccIpCodes, setSelectedIccIpCodes] = useState(new Set());

  const [surveyNumber, setSurveyNumber] = useState("");
  const [totalArea, setTotalArea] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState({});
  const [isHydrating, setIsHydrating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [alertTick, setAlertTick] = useState(0);

  const normalize = (value) => String(value || "").trim().toLowerCase();

  const getMunicipalityNames = (data) => {
    if (!data) return [];
    if (Array.isArray(data.municipalities)) return data.municipalities.filter(Boolean);
    if (typeof data.municipality === "string") {
      return data.municipality.split(",").map((v) => v.trim()).filter(Boolean);
    }
    return [];
  };

  const getBarangayNames = (data) => {
    if (!data) return [];
    if (Array.isArray(data.barangays)) return data.barangays.filter(Boolean);
    if (typeof data.barangays === "string") {
      return data.barangays.split(",").map((v) => v.trim()).filter(Boolean);
    }
    return [];
  };

  useEffect(() => {
    if (!alert) return;
    const timeoutId = setTimeout(() => setAlert(null), 10_000);
    return () => clearTimeout(timeoutId);
  }, [alertTick, alert]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const regs = await fetchJson(PSGC.REGIONS);
        if (!mounted) return;

        regs.forEach((r) => {
          const code = String(r.regionCode || r.code || "");
          regionNameMap.set(normalize(r.name), code);
        });

        const regionList = REGION_ORDER.map((key) => {
          const match = regs.find((r) => String(r.regionCode || r.code || "").startsWith(key));
          const code = String(match?.regionCode || match?.code || key);
          const label = REGION_LABELS[key] || match?.name || key;
          regionMap.set(code, label);
          return { code, name: label };
        });

        setRegions(regionList);

        const provs = await fetchJson(PSGC.PROVINCES);
        if (!mounted) return;
        const provList = provs.map((p) => ({ code: p.provinceCode || p.code, name: p.name, regionCode: p.regionCode }));
        provList.forEach((p) => provinceMap.set(String(p.code), p.name));
        setProvincesAll(provList);

        const mums = await fetchJson(PSGC.MUNICIPALITIES);
        if (!mounted) return;
        const munList = mums.map((m) => ({ code: m.code || m.citymunCode, name: m.name, provinceCode: m.provinceCode }));
        munList.forEach((m) => municipalityMap.set(String(m.code), m.name));
        setMunicipalitiesAll(munList);

        const bars = await fetchJson(PSGC.BARANGAYS);
        if (!mounted) return;
        const barList = bars.map((b) => ({ code: b.code || b.brgyCode, name: b.name, municipalityCode: b.municipalityCode || b.cityCode }));
        barList.forEach((b) => barangayMap.set(String(b.code), b.name));
        setBarangaysAll(barList);
      } catch (err) {
        console.error("Failed to fetch PSGC data", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!initialData) return;
    setIsHydrating(true);

    const resolveByName = (list, name) => {
      if (!name) return null;
      const normalized = normalize(name);
      const found = list.find((o) => normalize(o.name) === normalized);
      if (found) return found.code;
      const apiCode = regionNameMap.get(normalized);
      return apiCode || name;
    };

    const municipalityNames = getMunicipalityNames(initialData);
    const barangayNames = getBarangayNames(initialData);

    const regionCode = resolveByName(regions, initialData.region);
    const provinceCode = resolveByName(provincesAll, initialData.province);
    const municipalityCodes = municipalityNames.map((name) => {
      const found = municipalitiesAll.find((m) => normalize(m.name) === normalize(name));
      return found ? found.code : name;
    });
    const municipalityCodeSet = new Set(municipalityCodes.map(String));
    const barangayCodes = barangayNames.map((name) => {
      const found = barangaysAll.find((b) => {
        const nameMatch = normalize(b.name) === normalize(name);
        if (!nameMatch) return false;
        if (municipalityCodeSet.size === 0) return true;
        return municipalityCodeSet.has(String(b.municipalityCode)) || municipalityCodeSet.has(String(b.cityCode));
      });
      return found ? found.code : name;
    });

    const totalAreaValue = initialData.totalArea;
    const formattedTotalArea =
      typeof totalAreaValue === "number"
        ? totalAreaValue.toLocaleString("en-US", { maximumFractionDigits: 4 })
        : (totalAreaValue ?? "");

    setSurveyNumber(initialData.surveyNumber || "");
    setTotalArea(String(formattedTotalArea || ""));
    setRemarks(initialData.remarks || "");
    setSelectedRegionCode(regionCode);
    setSelectedProvinceCode(provinceCode);
    setSelectedMunicipalityCodes(new Set(municipalityCodes));
    setSelectedBarangayCodes(new Set(barangayCodes));
    setSelectedIccIpCodes(new Set(Array.isArray(initialData.icc) ? initialData.icc : []));
    setErrors({});

    setTimeout(() => setIsHydrating(false), 0);
  }, [initialData, regions, provincesAll, municipalitiesAll, barangaysAll]);

  const renderProvinces = (regionCode) => {
    if (!regionCode) return [];
    return provincesAll.filter((p) => String(p.regionCode) === String(regionCode));
  };

  const renderMunicipalities = (provinceCode) => {
    if (!provinceCode) return [];
    return municipalitiesAll.filter((m) => String(m.provinceCode) === String(provinceCode));
  };

  const renderBarangays = (munCodesSet) => {
    if (!munCodesSet || munCodesSet.size === 0) return [];
    const codes = new Set(Array.from(munCodesSet).map(String));
    return barangaysAll.filter((b) => codes.has(String(b.municipalityCode)) || codes.has(String(b.cityCode)));
  };

  const provinces = useMemo(() => renderProvinces(selectedRegionCode), [selectedRegionCode, provincesAll]);
  const municipalities = useMemo(() => renderMunicipalities(selectedProvinceCode), [selectedProvinceCode, municipalitiesAll]);
  const barangays = useMemo(() => renderBarangays(selectedMunicipalityCodes), [selectedMunicipalityCodes, barangaysAll]);

  // Handle total area input with commas and decimals
  const handleTotalAreaChange = (value) => {
    // Remove all non-numeric characters except decimal point and comma
    const cleaned = value.replace(/[^\d.,]/g, '');
    // Allow only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) return; // More than one decimal point
    setTotalArea(cleaned);
  };

  // Parse total area to number (remove commas)
  const parseTotalArea = (value) => {
    if (!value) return 0;
    const cleaned = value.replace(/,/g, '');
    return parseFloat(cleaned) || 0;
  };

  useEffect(() => {
    if (isHydrating) return;
    setSelectedProvinceCode(null);
    setSelectedMunicipalityCodes(new Set());
    setSelectedBarangayCodes(new Set());
  }, [selectedRegionCode, isHydrating]);

  useEffect(() => {
    if (isHydrating) return;
    setSelectedMunicipalityCodes(new Set());
    setSelectedBarangayCodes(new Set());
  }, [selectedProvinceCode, isHydrating]);

  useEffect(() => {
    if (isHydrating) return;
    if (!selectedMunicipalityCodes || selectedMunicipalityCodes.size === 0) {
      setSelectedBarangayCodes(new Set());
      return;
    }
    const allowed = new Set(renderBarangays(selectedMunicipalityCodes).map((b) => String(b.code)));
    const next = new Set(Array.from(selectedBarangayCodes).filter((c) => allowed.has(String(c))));
    if (next.size !== selectedBarangayCodes.size) setSelectedBarangayCodes(next);
  }, [selectedMunicipalityCodes, barangaysAll]);

  const validate = () => {
    const e = {};
    if (!surveyNumber.trim()) e.surveyNumber = "Survey Number is required";
    if (!selectedRegionCode) e.region = "Region is required";
    if (!selectedProvinceCode) e.province = "Province is required";
    if (!selectedMunicipalityCodes || selectedMunicipalityCodes.size === 0) e.municipalities = "At least one municipality is required";
    if (!selectedBarangayCodes || selectedBarangayCodes.size === 0) e.barangays = "At least one barangay is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setAlert(null);
    setIsSaving(true);

    const regionName = regionMap.get(String(selectedRegionCode)) || selectedRegionCode || "";
    
    // Handle province - could be from list or custom
    const provinceName = provinceMap.get(String(selectedProvinceCode)) || selectedProvinceCode || "";
    
    // Handle municipalities - could be from list or custom
    const municipalityNames = Array.from(selectedMunicipalityCodes)
      .map((c) => municipalityMap.get(String(c)) || c)
      .filter(Boolean)
      .sort();
    
    // Handle barangays - could be from list or custom
    const barangayNames = Array.from(selectedBarangayCodes)
      .map((c) => barangayMap.get(String(c)) || c)
      .filter(Boolean)
      .sort();
      
    const iccIpNames = Array.from(selectedIccIpCodes);

    try {
      await onSubmit({
        surveyNumber: surveyNumber.trim(),
        region: regionName,
        province: provinceName,
        municipalities: municipalityNames,
        barangays: barangayNames,
        icc: iccIpNames,
        remarks: remarks.trim(),
        totalArea: parseTotalArea(totalArea),
      });

      if (!isModal) {
        setAlertTick((t) => t + 1);
        setAlert({ type: "success", message: "Mapping saved successfully." });
      }

      setSurveyNumber("");
      setTotalArea("");
      setRemarks("");
      setSelectedRegionCode(null);
      setSelectedProvinceCode(null);
      setSelectedMunicipalityCodes(new Set());
      setSelectedBarangayCodes(new Set());
      setSelectedIccIpCodes(new Set());
      setErrors({});

      if (isModal) {
        // Close handled by parent after submit
      }
    } catch (error) {
      if (!isModal) {
        setAlertTick((t) => t + 1);
        setAlert({ type: "error", message: error?.message || "Failed to save mapping." });
      }
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className={isModal ? "w-full min-h-full flex flex-col" : "min-h-screen py-6 sm:py-10 bg-gradient-to-br from-[#071A2C]/5 via-white to-[#F2C94C]/10"}>
      {!isModal && alert && (
        <div className="fixed z-[120] right-4 bottom-4 sm:bottom-auto sm:top-4 w-[min(92vw,360px)] sm:w-96">
          <div
            key={alertTick}
            role="alert"
            className={[
              "ncip-animate-alert-in rounded-xl border p-3 text-xs sm:text-sm backdrop-blur-xl shadow-2xl shadow-black/30",
              alert.type === "error"
                ? "ncip-animate-shake bg-red-500/15 border-red-500/30 text-red-50"
                : "bg-emerald-400/15 border-emerald-300/30 text-emerald-50",
            ].join(" ")}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                <Bell className="h-4 w-4 text-current" aria-hidden />
              </div>
              <p className="leading-snug">{alert.message}</p>
            </div>
          </div>
        </div>
      )}
      <div className={isModal ? "w-full flex-1 flex flex-col min-h-0" : "max-w-4xl mx-auto px-4 sm:px-6"}>
        {!isModal && (
          <button onClick={onBack} className="flex items-center gap-2 text-[#0A2D55] font-semibold mb-6 hover:gap-3 transition">
            <ArrowLeft size={18} /> Back to Dashboard
          </button>
        )}

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#0A2D55]/5 min-h-0 relative">
          <div className="border-b px-6 py-5 bg-gradient-to-r from-[#0A2D55]/5 via-[#F2C94C]/10 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-bold text-xl text-[#0A2D55]">{formTitle}</h1>
                <p className="text-sm text-[#0A2D55]/55 mt-1">Indigenous Cultural Community mapping record</p>
              </div>
            </div>
          </div>

          {isSaving && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#071A2C]/20 backdrop-blur-md">
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full border border-white/20 bg-white/10 backdrop-blur-xl shadow-xl shadow-black/30 p-4">
                  <div className="h-12 w-12 rounded-full border-2 border-white/25 border-t-[#F2C94C] animate-spin" />
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 backdrop-blur-xl px-4 py-2 text-xs text-white/90">
                  Saving...
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar p-4 sm:p-7">
              <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#0A2D55] mb-2">Survey Number <span className="text-red-500">*</span></label>
                  <input value={surveyNumber} onChange={(e) => setSurveyNumber(e.target.value)} className="w-full px-4 py-3 border-2 border-[#0A2D55]/10 rounded-xl bg-white/80 hover:border-[#F2C94C]/40 focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/40 transition" placeholder="e.g. ADO-2024-001" />
                  {errors.surveyNumber && <p className="text-red-500 text-xs mt-1">{errors.surveyNumber}</p>}
                </div>
                <div>
                  <label className="block font-semibold text-[#0A2D55] mb-2">Total Area (hectares)</label>
                  <input 
                    value={totalArea} 
                    onChange={(e) => handleTotalAreaChange(e.target.value)} 
                    className="w-full px-4 py-3 border-2 border-[#0A2D55]/10 rounded-xl bg-white/80 hover:border-[#F2C94C]/40 focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/40 transition" 
                    placeholder="e.g. 1,234.56" 
                    type="text"
                  />
                  {totalArea && (
                    <p className="text-xs text-[#0A2D55]/60 mt-1">
                      {parseTotalArea(totalArea).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0A2D55] mb-2">ICC/IP Community</label>
                <SearchableSelect
                  options={ICC_IP_OPTIONS.map((name) => ({ code: name, name }))}
                  selected={selectedIccIpCodes}
                  onChange={(s) => setSelectedIccIpCodes(s)}
                  placeholder="Select ICC/IP"
                  multi={true}
                  summaryLabels={{ singular: "group", plural: "groups" }}
                  allowCustom={true}
                />
                {selectedIccIpCodes.size > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Array.from(selectedIccIpCodes).map((code) => (
                      <span key={code} className="inline-flex items-center gap-1.5 bg-[#0C3B6E] text-white px-3 py-1.5 rounded-full text-xs">
                        {code}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#0A2D55] mb-2">Region <span className="text-red-500">*</span></label>
                  <SearchableSelect options={regions} selected={selectedRegionCode} onChange={(c) => setSelectedRegionCode(c)} placeholder="Select region" />
                  {errors.region && <p className="text-red-500 text-xs mt-1">{errors.region}</p>}
                </div>
                <div>
                  <label className="block font-semibold text-[#0A2D55] mb-2">Province <span className="text-red-500">*</span></label>
                  <SearchableSelect 
                    options={provinces.map((p) => ({ code: p.code, name: p.name }))} 
                    selected={selectedProvinceCode} 
                    onChange={(c) => setSelectedProvinceCode(c)} 
                    placeholder="Select or type province" 
                    disabled={!selectedRegionCode}
                    allowCustom={true}
                  />
                  {errors.province && <p className="text-red-500 text-xs mt-1">{errors.province}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#0A2D55] mb-2">Municipalities <span className="text-red-500">*</span></label>
                  <SearchableSelect 
                    options={municipalities.map((m) => ({ code: m.code, name: m.name }))} 
                    selected={selectedMunicipalityCodes} 
                    onChange={(s) => setSelectedMunicipalityCodes(s)} 
                    placeholder="Select or type municipalities" 
                    multi={true} 
                    disabled={!selectedProvinceCode} 
                    summaryLabels={{ singular: "municipality", plural: "municipalities" }}
                    allowCustom={true}
                  />
                  {errors.municipalities && <p className="text-red-500 text-xs mt-1">{errors.municipalities}</p>}
                  {selectedMunicipalityCodes.size > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Array.from(selectedMunicipalityCodes).map((code) => (
                        <span key={code} className="inline-flex items-center gap-1.5 bg-[#0A2D55]/10 text-[#0A2D55] px-3 py-1.5 rounded-full text-xs">{municipalityMap.get(String(code)) || code}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-[#0A2D55] mb-2">Barangays <span className="text-red-500">*</span></label>
                  <SearchableSelect 
                    options={barangays.map((b) => ({ code: b.code, name: b.name }))} 
                    selected={selectedBarangayCodes} 
                    onChange={(s) => setSelectedBarangayCodes(s)} 
                    placeholder="Select or type barangays" 
                    multi={true} 
                    disabled={selectedMunicipalityCodes.size === 0} 
                    summaryLabels={{ singular: "barangay", plural: "barangays" }}
                    allowCustom={true}
                  />
                  {errors.barangays && <p className="text-red-500 text-xs mt-1">{errors.barangays}</p>}
                  {selectedBarangayCodes.size > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Array.from(selectedBarangayCodes).map((code) => (
                        <span key={code} className="inline-flex items-center gap-1.5 bg-[#F2C94C]/20 text-[#8B6F1C] px-3 py-1.5 rounded-full text-xs">{barangayMap.get(String(code)) || code}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0A2D55] mb-2">Remarks</label>
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className="w-full px-4 py-3 border-2 border-[#0A2D55]/10 rounded-xl bg-white/80 hover:border-[#F2C94C]/40 focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/40 transition" />
              </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-[#0A2D55]/10 px-4 sm:px-7 py-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button type="button" onClick={onBack} disabled={isSaving} className={cn("w-full sm:w-auto px-5 py-2.5 border-2 border-[#0A2D55]/15 text-[#0A2D55] rounded-xl hover:bg-[#0A2D55]/5 transition", isSaving ? "opacity-60 cursor-not-allowed" : "")}>Cancel</button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={cn(
                    "w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-[#0A2D55] to-[#0C3B6E] text-white rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2",
                    isSaving ? "opacity-75 cursor-not-allowed" : ""
                  )}
                >
                  {isSaving && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                  {isSaving ? "Saving..." : submitLabel}
                </button>
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}

export { MappingForm };
