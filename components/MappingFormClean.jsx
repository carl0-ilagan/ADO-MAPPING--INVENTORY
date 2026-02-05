"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const PSGC = {
  REGIONS: "https://psgc.gitlab.io/api/regions/",
  PROVINCES: "https://psgc.gitlab.io/api/provinces/",
  MUNICIPALITIES: "https://psgc.gitlab.io/api/cities-municipalities/",
  BARANGAYS: "https://psgc.gitlab.io/api/barangays/",
};

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

function SearchableSelect({ options = [], selected = null, onChange = () => {}, placeholder = "Select", multi = false, disabled = false, summaryLabels = { singular: "item", plural: "items" } }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !triggerRef.current?.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
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
    if (!multi) return onChange(code);
    const next = new Set(Array.from(selected || []));
    const key = String(code);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  const label = (() => {
    if (multi) {
      const count = selected ? selected.size : 0;
      if (count === 0) return placeholder;
      if (count === 1) {
        const first = Array.from(selected)[0];
        const found = options.find((o) => String(o.code) === String(first));
        return found ? found.name : placeholder;
      }
      return `${count} ${summaryLabels.plural} selected`;
    }
    if (!selected) return placeholder;
    const found = options.find((o) => String(o.code) === String(selected));
    return found ? found.name : placeholder;
  })();

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn("w-full flex items-center justify-between px-4 py-3 text-sm border-2 rounded-lg bg-white/80 hover:border-[#F2C94C]/40 transition", disabled ? "opacity-60 cursor-not-allowed" : "")}
      >
        <span className="text-[#0A2D55] truncate font-medium">{label}</span>
        <ChevronDown size={18} className={`text-[#0A2D55]/40 transition ml-2 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div ref={menuRef} className="absolute z-50 mt-2 w-full bg-white border-2 rounded-lg shadow-lg max-h-80 overflow-hidden">
          <div className="p-3 sticky top-0 bg-white border-b">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full px-3 py-2 border-2 rounded-lg text-sm" />
          </div>
          <div className="p-2 max-h-72 overflow-y-auto">
            {filtered.length === 0 && <p className="text-center text-sm text-[#0A2D55]/40 py-4">No results found</p>}
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

export default function MappingForm({ isModal = false, onBack = () => {} }) {
  const [regions, setRegions] = useState([]);
  const [provincesAll, setProvincesAll] = useState([]);
  const [municipalitiesAll, setMunicipalitiesAll] = useState([]);
  const [barangaysAll, setBarangaysAll] = useState([]);

  const regionMap = useRef(new Map()).current;
  const provinceMap = useRef(new Map()).current;
  const municipalityMap = useRef(new Map()).current;
  const barangayMap = useRef(new Map()).current;

  const [selectedRegionCode, setSelectedRegionCode] = useState(null);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState(null);
  const [selectedMunicipalityCodes, setSelectedMunicipalityCodes] = useState(new Set());
  const [selectedBarangayCodes, setSelectedBarangayCodes] = useState(new Set());

  const [surveyNumber, setSurveyNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState({});
  const [savedSelections, setSavedSelections] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const regs = await fetchJson(PSGC.REGIONS);
        if (!mounted) return;
        const rlist = regs.map((r) => ({ code: r.regionCode || r.code, name: r.name }));
        rlist.forEach((r) => regionMap.set(String(r.code), r.name));
        setRegions(rlist);

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

  useEffect(() => {
    setSelectedProvinceCode(null);
    setSelectedMunicipalityCodes(new Set());
    setSelectedBarangayCodes(new Set());
  }, [selectedRegionCode]);

  useEffect(() => {
    setSelectedMunicipalityCodes(new Set());
    setSelectedBarangayCodes(new Set());
  }, [selectedProvinceCode]);

  useEffect(() => {
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

  const handleSave = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    const regionName = regionMap.get(String(selectedRegionCode)) || "";
    const provinceName = provinceMap.get(String(selectedProvinceCode)) || "";
    const municipalityNames = Array.from(selectedMunicipalityCodes).map((c) => municipalityMap.get(String(c)) || "").filter(Boolean).sort();
    const barangayNames = Array.from(selectedBarangayCodes).map((c) => barangayMap.get(String(c)) || "").filter(Boolean).sort();
    const row = { surveyNumber: surveyNumber.trim(), remarks: remarks.trim(), region: regionName, province: provinceName, municipalities: municipalityNames, barangays: barangayNames };
    setSavedSelections((s) => [...s, row]);
    setSurveyNumber("");
    setRemarks("");
    setSelectedRegionCode(null);
    setSelectedProvinceCode(null);
    setSelectedMunicipalityCodes(new Set());
    setSelectedBarangayCodes(new Set());
    setErrors({});
  };

  const exportCsv = () => {
    const header = ["Survey No.", "Remarks", "Region", "Province", "Municipalities", "Barangays"];
    const rows = [header, ...savedSelections.map((r) => [r.surveyNumber, r.remarks, r.region, r.province, r.municipalities.join(", "), r.barangays.join(", ")])];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "saved-selections.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={isModal ? "w-full min-h-full flex flex-col" : "min-h-screen py-6 sm:py-10"}>
      <div className={isModal ? "w-full flex-1 flex flex-col min-h-0" : "max-w-3xl mx-auto px-4 sm:px-6"}>
        {!isModal && (
          <button onClick={onBack} className="flex items-center gap-2 text-[#0A2D55] font-semibold mb-6">
            <ArrowLeft size={18} /> Back to Dashboard
          </button>
        )}

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#0A2D55]/5">
          <div className="border-b px-5 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-bold text-xl">Add New Mapping</h1>
                <p className="text-sm text-[#0A2D55]/55 mt-1">Indigenous Cultural Community mapping record</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="flex-1 p-5 sm:p-7">
            <div className="space-y-6">
              <div>
                <label className="block font-semibold text-[#0A2D55] mb-2">Survey Number <span className="text-red-500">*</span></label>
                <input value={surveyNumber} onChange={(e) => setSurveyNumber(e.target.value)} className="w-full px-4 py-3 border-2 rounded-lg" placeholder="e.g. ADO-2024-001" />
                {errors.surveyNumber && <p className="text-red-500 text-xs mt-1">{errors.surveyNumber}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#0A2D55] mb-2">Region <span className="text-red-500">*</span></label>
                  <SearchableSelect options={regions} selected={selectedRegionCode} onChange={(c) => setSelectedRegionCode(c)} placeholder="Select region" />
                  {errors.region && <p className="text-red-500 text-xs mt-1">{errors.region}</p>}
                </div>
                <div>
                  <label className="block font-semibold text-[#0A2D55] mb-2">Province <span className="text-red-500">*</span></label>
                  <SearchableSelect options={provinces.map((p) => ({ code: p.code, name: p.name }))} selected={selectedProvinceCode} onChange={(c) => setSelectedProvinceCode(c)} placeholder="Select province" disabled={!selectedRegionCode} />
                  {errors.province && <p className="text-red-500 text-xs mt-1">{errors.province}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#0A2D55] mb-2">Municipalities <span className="text-red-500">*</span></label>
                  <SearchableSelect options={municipalities.map((m) => ({ code: m.code, name: m.name }))} selected={selectedMunicipalityCodes} onChange={(s) => setSelectedMunicipalityCodes(s)} placeholder="Select municipalities" multi={true} disabled={!selectedProvinceCode} summaryLabels={{ singular: "municipality", plural: "municipalities" }} />
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
                  <SearchableSelect options={barangays.map((b) => ({ code: b.code, name: b.name }))} selected={selectedBarangayCodes} onChange={(s) => setSelectedBarangayCodes(s)} placeholder="Select barangays" multi={true} disabled={selectedMunicipalityCodes.size === 0} summaryLabels={{ singular: "barangay", plural: "barangays" }} />
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
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className="w-full px-4 py-3 border-2 rounded-lg" />
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button type="button" onClick={onBack} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button type="submit" className="px-6 py-2 bg-[#0A2D55] text-white rounded-lg">Save Mapping</button>
            </div>
          </form>

          <div className="p-5 border-t">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Saved Selections</h3>
              <button onClick={exportCsv} disabled={savedSelections.length === 0} className="px-3 py-1.5 bg-[#F2C94C] rounded-lg">Export CSV</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#0A2D55]/70">
                    <th className="py-2">Survey No.</th>
                    <th>Remarks</th>
                    <th>Region</th>
                    <th>Province</th>
                    <th>Municipalities</th>
                    <th>Barangays</th>
                  </tr>
                </thead>
                <tbody>
                  {savedSelections.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-[#0A2D55]/50">No saved data yet.</td>
                    </tr>
                  ) : (
                    savedSelections.map((r, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="py-2">{r.surveyNumber}</td>
                        <td>{r.remarks}</td>
                        <td>{r.region}</td>
                        <td>{r.province}</td>
                        <td>{r.municipalities.join(", ")}</td>
                        <td>{r.barangays.join(", ")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { MappingForm };
