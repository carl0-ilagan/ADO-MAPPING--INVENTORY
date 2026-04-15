'use client';

import React, { useState, useEffect } from 'react';
import { LoginPage } from '@/components/LoginPage';
import { Dashboard } from '@/components/Dashboard';
import { MappingForm } from '@/components/MappingFormClean';
import { RightSplitModal } from '@/components/RightSplitModal';
import { ProfilePage } from '@/components/ProfilePage';
import { onAuthStateChangeListener, signOutUser } from '@/lib/firebaseAuth.js';
import { getUserMappings, addMapping, deleteMapping, updateMapping, addMappingToCollection, getMappingsFromCollection, registerImportCollection, getUserImportCollections, updateDocumentInCollection, deleteDocumentsInCollection, computeLocationFromMapping } from '@/lib/firebaseDB.js';
import { getAllCPProjects, deleteCPProjectsByIds } from '@/lib/cpProjectsService.js';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase.js';


export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login'); // 'login', 'dashboard', 'search'
  const [mappings, setMappings] = useState([]);
  const [mainMappings, setMainMappings] = useState([]);
  const [showAddMappingModal, setShowAddMappingModal] = useState(false);
  const [addMappingContext, setAddMappingContext] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [toast, setToast] = useState(null);
  const [toastTick, setToastTick] = useState(0);
  const [availableCollections, setAvailableCollections] = useState([{ id: 'cp_projects', collectionName: 'cp_projects', displayName: 'CP Projects (Unified)', type: 'cp_projects' }]);
  const [selectedCollection, setSelectedCollection] = useState('cp_projects');

  const buildDisplay = (m) => ({
    location: computeLocationFromMapping(m) || (m.location || ''),
    iccs: (m.affectedIccsIps || m.affected_iccs_ips || m.affected_iccs || m.affectedIccs || m.affected_icc || m.icc || m.iccs || ''),
    // Prefer an explicit 'name of proponent' variant for display. Avoid picking short tokens (likely import artifacts or ids).
    proponent: (() => {
      try {
        const candidates = [
          // nested ongoing variants
          (m && m.ongoing && (m.ongoing.nameOfProponent || m.ongoing.name_of_proponent || m.ongoing.nameOfProponent)),
          // common top-level variants
          m && (m.nameOfProponent || m.name_of_proponent || m.nameOfProponent || m.name_of_proponent),
          m && (m.applicantProponent || m.applicant_proponent || m.applicantName || m.applicant_name),
          m && m.proponent,
        ].filter(Boolean).map((s) => String(s || '').trim()).filter(Boolean);

        for (const c of candidates) {
          // Exclude tokens that look like Firestore document IDs (alphanumeric/hyphen/underscore, length 16-40)
          const looksLikeId = /^[A-Za-z0-9_-]{16,40}$/.test(c);
          if (c.length > 2 && !looksLikeId) return c;
        }
        return (candidates[0] && String(candidates[0])) || '';
      } catch (e) {
        return '';
      }
    })(),
  });

  const normalizeCpProjectRecord = (p) => {
    const raw = p && typeof p.raw_fields === 'object' && p.raw_fields ? p.raw_fields : {};
    const rawNested = raw && typeof raw.raw_fields === 'object' && raw.raw_fields ? raw.raw_fields : {};
    const pick = (...keys) => {
      for (const key of keys) {
        const candidates = [
          p && p[key],
          raw && raw[key],
          raw && raw[String(key).toUpperCase()],
          raw && raw[String(key).toLowerCase()],
          rawNested && rawNested[key],
          rawNested && rawNested[String(key).toUpperCase()],
          rawNested && rawNested[String(key).toLowerCase()],
        ];
        for (const candidate of candidates) {
          if (candidate === null || typeof candidate === 'undefined') continue;
          if (Array.isArray(candidate) && candidate.length === 0) continue;
          const value = String(candidate).trim();
          if (value) return candidate;
        }
      }
      return '';
    };

    const statusText = String(
      pick('status', 'workflow_status', 'STATUS', 'Status', 'STATUS OF APPLICATION', 'Status of Application') ||
      p?.status ||
      ''
    ).trim();
    const explicitPending = Boolean(
      p?._pending ||
      raw?._pending ||
      rawNested?._pending ||
      String(pick('_pending') || '').toLowerCase() === 'true'
    );
    const normalizedStatus = explicitPending
      ? 'Pending'
      : /pend/i.test(statusText)
        ? 'Pending'
        : /approved/i.test(statusText)
          ? 'Approved'
          : /ongoing|on process|processing/i.test(statusText)
            ? 'Ongoing'
            : (statusText || 'Ongoing');
    const affectedIcc = pick('affected_icc', 'ICC', 'ICCs', 'affected_iccs', 'AFFECTED AD/ICC/IP', 'Affected AD/ICC/IP (for CP with ongoing FPIC)');

    return {
      id: p.id,
      surveyNumber: pick('control_number', 'survey_number', 'worksheet_no', 'NO', 'No', 'no') || '',
      controlNumber: pick('control_number', 'survey_number', 'worksheet_no', 'NO', 'No', 'no') || '',
      proponent: pick('proponent', 'applicantProponent', 'applicant', 'NAME OF PROPONENT', 'Name of Proponent', 'name_of_proponent') || '',
      applicantProponent: pick('proponent', 'applicantProponent', 'applicant', 'NAME OF PROPONENT', 'Name of Proponent', 'name_of_proponent') || '',
      applicant: pick('proponent', 'applicantProponent', 'applicant', 'NAME OF PROPONENT', 'Name of Proponent', 'name_of_proponent') || '',
      nameOfProject: pick('project_name', 'nameOfProject', 'projectName', 'NAME OF PROJECT', 'Name of Project', 'name_of_project') || '',
      projectName: pick('project_name', 'nameOfProject', 'projectName', 'NAME OF PROJECT', 'Name of Project', 'name_of_project') || '',
      typeOfProject: pick('type_of_project', 'natureOfProject', 'Type of Project', 'typeOfProject') || '',
      natureOfProject: pick('type_of_project', 'natureOfProject', 'Type of Project', 'typeOfProject') || '',
      location: pick('location', 'LOCATION', 'Project Location', 'province') || '',
      projectCost: pick('project_cost', 'Project Cost') || '',
      totalArea: pick('total_area', 'totalArea') || '',
      area: pick('total_area', 'totalArea') || '',
      ancestralDomain: pick('affected_ancestral_domain', 'Affected Ancestral Domain', 'AFFECTED AD/ICC/IP', 'AFFECTED AD/ICC/IP\t(for CP with ongoing FPIC)') || '',
      dateOfApplication: pick('date_filed', 'dateOfFiling', 'DATE OF FILING OF CP APPLICATION', 'Date of Filing of CP Application') || '',
      date_filed: pick('date_filed', 'dateOfFiling', 'DATE OF FILING OF CP APPLICATION', 'Date of Filing of CP Application') || '',
      yearApplied: p.year_applied || null,
      region: pick('region', 'REGION', 'Region') || '',
      province: pick('province', 'PROVINCE', 'Province') || '',
      municipality: pick('municipality', 'MUNICIPALITY', 'Municipality') || '',
      municipalities: Array.isArray(p.municipalities) ? p.municipalities : (pick('municipality', 'MUNICIPALITY', 'Municipality') ? [String(pick('municipality', 'MUNICIPALITY', 'Municipality')).trim()] : []),
      barangays: Array.isArray(p.barangays) ? p.barangays : (pick('barangay', 'BARANGAY', 'Barangay') ? [String(pick('barangay', 'BARANGAY', 'Barangay')).trim()] : []),
      icc: Array.isArray(p.affected_icc) ? p.affected_icc : (affectedIcc ? String(affectedIcc).split(/[;,/]+/).map((v) => v.trim()).filter(Boolean) : []),
      iccs: Array.isArray(p.affected_icc) ? p.affected_icc.join(', ') : (affectedIcc || ''),
      reviewOfApplicationDocuments: pick('review_of_application_documents') || '',
      needForFBI: pick('need_for_fbi') || '',
      issuanceOfWorkOrder: pick('issuance_of_work_order') || '',
      preFBIConference: pick('pre_fbi_conference') || '',
      approvalOfWFP: pick('approval_of_wfp', 'approval_concurrence_of_wfp') || '',
      paymentOfFBIFee: pick('payment_of_fbi_fee') || '',
      conductOfFBI: pick('conduct_of_fbi') || '',
      preparationOfFBIReport: pick('preparation_of_fbi_report') || '',
      reviewOfFBIReport: pick('review_of_fbi_report') || '',
      issuanceOfWorkOrderOfFPICTeam: pick('issuance_of_work_order_of_fpic_team') || '',
      preFPICConference: pick('pre_fpic_conference') || '',
      paymentOfFPICFee: pick('payment_of_fpic_fee') || '',
      postingOfNotices: pick('posting_of_notices') || '',
      firstCommunityAssembly: pick('first_community_assembly') || '',
      secondCommunityAssembly: pick('second_community_assembly') || '',
      consensusBuildingDecision: pick('consensus_building_decision') || '',
      proceedToMOANegotiation: pick('proceed_to_moa_negotiation') || '',
      issuanceResolutionToProceedToMOA: pick('issuance_resolution_to_proceed_to_moa') || '',
      moaNegotiationPreparation: pick('moa_negotiation_preparation') || '',
      moaValidationRatificationSigning: pick('moa_validation_ratification_signing') || '',
      issuanceResolutionOfConsent: pick('issuance_resolution_of_consent') || '',
      submissionOfFPICReport: pick('submission_of_fpic_report') || '',
      reviewByRRT: pick('review_by_rrt') || '',
      reviewByADOorLAO: pick('review_by_ado_or_lao') || '',
      forComplianceOfFPICTeam: pick('for_compliance_of_fpic_team') || '',
      cebDeliberation: pick('ceb_deliberation') || '',
      cebApproved: pick('ceb_approved') || '',
      preparationSigningCEBResolutionCP: pick('preparation_signing_ceb_resolution_cp') || '',
      releaseOfCPToProponent: pick('release_of_cp_to_proponent') || '',
      worksheetNo: pick('worksheet_no', 'NO', 'No', 'no') || '',
      statusOfApplication: pick('status_of_application', 'STATUS OF APPLICATION', 'Status of Application') || '',
      workflowStatus: statusText,
      hasOngoingFpic: pick('has_ongoing_fpic') || '',
      remarks: pick('remarks', 'REMARKS') || '',
      status: normalizedStatus,
      _ongoing: normalizedStatus === 'Ongoing',
      _pending: normalizedStatus === 'Pending' || explicitPending,
      importCollection: 'cp_projects',
      raw_fields: rawNested && Object.keys(rawNested).length > 0 ? rawNested : (raw && Object.keys(raw).length > 0 ? raw : p),
      _display: `${pick('proponent', 'applicantProponent', 'applicant', 'NAME OF PROPONENT', 'Name of Proponent') || 'N/A'} - ${pick('project_name', 'nameOfProject', 'projectName', 'NAME OF PROJECT', 'Name of Project') || 'N/A'}`
    };
  };

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChangeListener(async (user) => {
      if (user) {
        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          role: userData.role || 'user',
          communityName: userData.communityName || ''
        });
        // Load CP Projects data as default (unified table for all statuses)
        setIsLoadingMappings(true);
        try {
          console.log('🚀 Initial load: Loading CP Projects from cp_projects table');
          const cpProjects = await getAllCPProjects();
          console.log('📊 Loaded cp_projects count:', cpProjects.length);
          
          // Convert to mappings format for Dashboard compatibility
          const mappingsFormat = cpProjects.map(p => ({
            id: p.id,
            surveyNumber: p.control_number || p.survey_number || '',
            proponent: p.proponent || '',
            applicant: p.proponent || '',
            nameOfProject: p.project_name || '',
            projectName: p.project_name || '',
            typeOfProject: p.type_of_project || '',
            natureOfProject: p.type_of_project || '',
            location: p.location || p.province || '',
            projectCost: p.project_cost || '',
            totalArea: p.total_area || '',
            area: p.total_area || '',
            ancestralDomain: p.affected_ancestral_domain || '',
            dateOfApplication: p.date_filed || '',
            date_filed: p.date_filed || '',
            yearApplied: p.year_applied || null,
            region: p.region || '',
            province: p.province || '',
            municipality: p.municipality || '',
            municipalities: p.municipality ? [p.municipality] : [],
            barangays: p.barangay ? [p.barangay] : [],
            icc: p.affected_icc || [],
            iccs: Array.isArray(p.affected_icc) ? p.affected_icc.join(', ') : (p.affected_icc || ''),
            // FBI / FPIC workflow step fields
            reviewOfApplicationDocuments: p.review_of_application_documents || '',
            needForFBI: p.need_for_fbi || '',
            issuanceOfWorkOrder: p.issuance_of_work_order || '',
            preFBIConference: p.pre_fbi_conference || '',
            approvalOfWFP: p.approval_of_wfp || p.approval_concurrence_of_wfp || '',
            paymentOfFBIFee: p.payment_of_fbi_fee || '',
            conductOfFBI: p.conduct_of_fbi || '',
            preparationOfFBIReport: p.preparation_of_fbi_report || '',
            reviewOfFBIReport: p.review_of_fbi_report || '',
            issuanceOfWorkOrderOfFPICTeam: p.issuance_of_work_order_of_fpic_team || '',
            preFPICConference: p.pre_fpic_conference || '',
            paymentOfFPICFee: p.payment_of_fpic_fee || '',
            postingOfNotices: p.posting_of_notices || '',
            firstCommunityAssembly: p.first_community_assembly || '',
            secondCommunityAssembly: p.second_community_assembly || '',
            consensusBuildingDecision: p.consensus_building_decision || '',
            proceedToMOANegotiation: p.proceed_to_moa_negotiation || '',
            issuanceResolutionToProceedToMOA: p.issuance_resolution_to_proceed_to_moa || '',
            moaNegotiationPreparation: p.moa_negotiation_preparation || '',
            moaValidationRatificationSigning: p.moa_validation_ratification_signing || '',
            issuanceResolutionOfConsent: p.issuance_resolution_of_consent || '',
            submissionOfFPICReport: p.submission_of_fpic_report || '',
            reviewByRRT: p.review_by_rrt || '',
            reviewByADOorLAO: p.review_by_ado_or_lao || '',
            forComplianceOfFPICTeam: p.for_compliance_of_fpic_team || '',
            cebDeliberation: p.ceb_deliberation || '',
            cebApproved: p.ceb_approved || '',
            preparationSigningCEBResolutionCP: p.preparation_signing_ceb_resolution_cp || '',
            releaseOfCPToProponent: p.release_of_cp_to_proponent || '',
            worksheetNo: p.worksheet_no || '',
            statusOfApplication: p.status_of_application || '',
            workflowStatus: p.workflow_status || p.cadt_status || '',
            hasOngoingFpic: p.has_ongoing_fpic || '',
            remarks: p.remarks || '',
            status: p.status || 'Ongoing',
            _ongoing: (p.status || 'Ongoing') === 'Ongoing',
            _pending: (p.status || 'Ongoing') === 'Pending' || p._pending === true,
            importCollection: 'cp_projects',
            raw_fields: p,
            _display: `${p.proponent || 'N/A'} - ${p.project_name || 'N/A'}`
          }));
          
          const normalizedMappingsFormat = mappingsFormat.map((m) => normalizeCpProjectRecord(m));
          setMappings(normalizedMappingsFormat);
          setMainMappings(normalizedMappingsFormat);
          
          // Also load user's old mappings for reference
          const userMappings = await getUserMappings(user.uid);
          const normalized = (userMappings || []).map((m) => ({ ...m, _display: buildDisplay(m) }));
          
          // load user's import collections
          try {
              const imports = await getUserImportCollections(user.uid);
              const prefix = `mappings_import_${user.uid}_`;
              const visibleImports = imports.filter((i) => Number(i.count) > 0 && i.collectionName && String(i.collectionName).trim());

              // Verify collections actually contain documents before showing them
              const checked = await Promise.all(
                visibleImports.map(async (i) => {
                  try {
                    const docs = await getMappingsFromCollection(i.collectionName);
                    const docsArray = Array.isArray(docs) ? docs : [];
                    const importMeta = { ...i };
                    // If any document in the collection is marked as ongoing, tag the importMeta
                    if (docsArray.some((d) => d && (d._ongoing === true || String(d.importCollection || '').toLowerCase().includes('ongoing') || String(i.collectionName || '').toLowerCase().includes('ongoing')))) {
                      importMeta.type = 'ongoing';
                    }
                    importMeta.readable = true;
                    return { importMeta, docsCount: docsArray.length };
                  } catch (err) {
                    const importMeta = { ...i, readable: false };
                    return { importMeta, docsCount: -1 };
                  }
                })
              );

              const finalImports = checked.filter((c) => c.docsCount > 0).map((c) => c.importMeta);

              const list = [
                { id: 'cp_projects', collectionName: 'cp_projects', displayName: 'CP Projects (Unified)', type: 'cp_projects' },
                ...finalImports.map((i) => {
                  const base = i.displayName || (i.collectionName && i.collectionName.startsWith(prefix) ? i.collectionName.slice(prefix.length) : i.collectionName);
                  return ({
                    id: i.collectionName,
                    collectionName: i.collectionName,
                    displayName: (i.type && String(i.type).toLowerCase() === 'ongoing') ? `${base} (ongoing)` : base,
                    type: i.type || null,
                    readable: typeof i.readable === 'boolean' ? i.readable : true,
                  });
                }),
              ];
              setAvailableCollections(list);
              // Debug: report available collections for troubleshooting
              try {
                console.debug('App: availableCollections set ->', JSON.parse(JSON.stringify(list)));
              } catch (e) {
                console.debug('App: availableCollections set', list);
              }
          } catch (e) {
            console.warn('Unable to load user import collections', e);
          }
          setSelectedCollection('cp_projects'); // Always default to unified CP Projects table
        } catch (error) {
          console.error('Error loading mappings:', error);
          setMappings([]);
        }
        setIsLoadingMappings(false);
      } else {
        setCurrentUser(null);
        setMappings([]);
      }
    });

    return unsubscribe;
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setCurrentView('login');
      setMappings([]);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Keep `mainMappings` synced whenever the active selection is the main `mappings` collection.
  useEffect(() => {
    try {
      if (String(selectedCollection || '').toLowerCase() === 'mappings') {
        setMainMappings(mappings || []);
      }
    } catch (e) {
      // ignore
    }
  }, [mappings, selectedCollection]);

  // Local canonicalization helper (keeps behavior consistent with Dashboard)
  const canonicalRegion = (regionValue) => {
    const raw = String(regionValue || '').trim();
    if (!raw) return '';
    const value = String(regionValue || '').toUpperCase();
    if (value.includes('CORDILLERA') || value.includes('CAR')) return 'CAR';

    const romanMatch = value.match(/REGION\s*(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?:\s*[-–]\s*(A|B))?/i);
    if (romanMatch) {
      const numeral = romanMatch[1].toUpperCase();
      const suffix = romanMatch[2] ? romanMatch[2].toUpperCase() : null;
      if (numeral === 'IV' && suffix) return `Region IV-${suffix}`;
      return `Region ${numeral}`;
    }

    const numericMatch = value.match(/REGION\s*(\d{1,2})(?:\s*[-–]?\s*([AB]))?/i) || value.match(/\b(\d{1,2})(?:\s*[-–]?\s*([AB]))?\b/);
    if (numericMatch) {
      const numberValue = Number(numericMatch[1]);
      const suffix = numericMatch[2] ? numericMatch[2].toUpperCase() : null;
      if (numberValue === 4 && suffix) return `Region IV-${suffix}`;
      if (numberValue >= 1 && numberValue <= 13) {
        const romanMap = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII'];
        return `Region ${romanMap[numberValue - 1]}`;
      }
    }

    // last-resort: return trimmed original
    return raw;
  };

  const handleAddMapping = (opts = {}) => {
    setEditingMapping(null);
    setAddMappingContext(opts || {});
    setShowAddMappingModal(true);
  };

  const handleEditMapping = (mapping) => {
    setEditingMapping(mapping);
    setShowAddMappingModal(true);
  };

  const handleFormSubmit = async (formData) => {
    if (!currentUser) return;

    try {
      const deriveCanonicalStatus = (...values) => {
        for (const v of values) {
          if (v === null || typeof v === 'undefined') continue;
          const text = String(v).trim().toLowerCase();
          if (!text) continue;
          if (text.includes('approved') || text.includes('approve')) return 'Approved';
          if (text.includes('ongoing') || text.includes('on process') || text.includes('processing') || text.includes('in progress')) return 'Ongoing';
          if (text.includes('pend')) return 'Pending';
        }
        return '';
      };

      const municipalities = formData.municipalities || [];
      const barangays = formData.barangays || [];

      const newMapping = {
        userId: currentUser.uid,
        surveyNumber: formData.surveyNumber || '',
        region: formData.region || '',
        province: formData.province || '',
        municipality: municipalities.join(', '),
        municipalities,
        barangays,
        icc: formData.icc || [],
        remarks: formData.remarks || '',
        totalArea: formData.totalArea || 0,
        // NCIP-specific fields
        controlNumber: formData.controlNumber || '',
        applicantProponent: formData.applicantProponent || '',
        proponent: formData.applicantProponent || '', // alias for compatibility
        nameOfProject: formData.nameOfProject || '',
        natureOfProject: formData.natureOfProject || '',
        cadtStatus: formData.cadtStatus || '',
        location: formData.location || '',
        yearApproved: formData.yearApproved || '',
        moaDuration: formData.moaDuration || '',
        communityBenefits: formData.communityBenefits || '',
        // Merge any ongoing-specific fields (if provided by the form)
        // Preserve a nested `ongoing` object and also copy common ongoing subkeys
        // to the root for Dashboard compatibility.
        ...(formData && formData.ongoing ? { ongoing: { ...formData.ongoing }, ...formData.ongoing } : {}),
        // If the add mapping context indicated this was created from the Ongoing tab,
        // mark the mapping with the internal `_ongoing` flag so it appears in ongoing views.
        _ongoing: Boolean((formData && formData._ongoing) || (addMappingContext && addMappingContext.ongoing)),
      };

      // Preserve any raw_fields submitted by specialized forms (e.g. Pending-mode)
      if (formData && formData.raw_fields && typeof formData.raw_fields === 'object') {
        newMapping.raw_fields = { ...formData.raw_fields };
      }

      // Mark as pending if the add context, form, or selected collection requested it
      newMapping._pending = Boolean(
        (formData && formData._pending) ||
        (addMappingContext && addMappingContext.pending) ||
        String(selectedCollection || '').toLowerCase().includes('pending')
      );

      // Canonical status/flags for cp_projects edits/import-like records.
      // This ensures tab movement is correct after editing (e.g. Pending -> Ongoing).
      const explicitStatus =
        // Prefer explicit values coming from the submitted form/edit action.
        deriveCanonicalStatus(
          formData?.status,
          formData?.workflowStatus,
          formData?.cadtStatus,
          formData?.ongoing?.status
        ) ||
        // Fallback to descriptive fields only if explicit status is absent.
        deriveCanonicalStatus(
          formData?.remarks,
          formData?.ongoing?.remarks,
          editingMapping?.status,
          editingMapping?.workflowStatus,
          editingMapping?.cadtStatus
        );

      if (explicitStatus) {
        newMapping.status = explicitStatus;
        newMapping._pending = explicitStatus === 'Pending';
        newMapping._ongoing = explicitStatus === 'Ongoing';
      }


      // Debug: show the final mapping object that will be saved/updated
      try {
        console.debug('App: handleFormSubmit - final mapping object ->', JSON.parse(JSON.stringify(newMapping)));
      } catch (e) {
        console.debug('App: handleFormSubmit - final mapping object (raw) ->', newMapping);
      }

      // If this add originated from a region subtab, force the saved mapping
      // to use the canonical region and mark it as ongoing so it only appears
      // under that region's ongoing subtab.
      if (addMappingContext && addMappingContext.region && !editingMapping?.id) {
        const canon = canonicalRegion(addMappingContext.region);
        if (canon) {
          newMapping.region = canon;
          newMapping._ongoing = true;
          newMapping.ongoing = { ...(newMapping.ongoing || {}), region: canon };
        }
      }

      if (editingMapping?.id) {
        // Merge edits into the existing mapping without wiping non-empty fields.
        // For nested objects (e.g. `ongoing`) perform a shallow merge so
        // unspecified subkeys are preserved instead of being replaced.
        const mergedMapping = { ...editingMapping };
        const isPlainObject = (x) => x && typeof x === 'object' && !Array.isArray(x);

        Object.keys(newMapping).forEach((k) => {
          const v = newMapping[k];
          const isEmptyArray = Array.isArray(v) && v.length === 0;
          if (v === '' || v === null || typeof v === 'undefined' || isEmptyArray) {
            // preserve existing value
            return;
          }

          // If both existing and new values are plain objects, merge their keys
          // but skip empty sub-values so we don't clobber existing subkeys.
          if (isPlainObject(v) && isPlainObject(mergedMapping[k])) {
            const existingObj = mergedMapping[k] || {};
            const mergedObj = { ...existingObj };
            Object.keys(v).forEach((subk) => {
              const subv = v[subk];
              const isSubEmptyArray = Array.isArray(subv) && subv.length === 0;
              if (subv === '' || subv === null || typeof subv === 'undefined' || isSubEmptyArray) return;
              mergedObj[subk] = subv;
            });
            mergedMapping[k] = mergedObj;
          } else {
            mergedMapping[k] = v;
          }
        });

        const targetCollection = editingMapping.importCollection && String(editingMapping.importCollection).trim() ? editingMapping.importCollection : 'mappings';
        if (targetCollection !== 'mappings') {
          await updateDocumentInCollection(targetCollection, editingMapping.id, { ...mergedMapping });
        } else {
          await updateMapping(editingMapping.id, { ...mergedMapping });
        }
        setMappings((prev) => prev.map((m) => {
          if (m.id !== editingMapping.id) return m;
          const updated = { ...m, ...mergedMapping };
          return { ...updated, _display: buildDisplay(updated) };
        }));
      } else {
        const isPendingSubmission = Boolean(
          (formData && formData._pending) ||
          (addMappingContext && addMappingContext.pending) ||
          String(selectedCollection || '').toLowerCase().includes('pending')
        );
        const mappingId = isPendingSubmission
          ? await addMappingToCollection('cp_projects', { ...newMapping })
          : await addMapping({ ...newMapping });
        // Update local state using functional update to avoid stale closures
        setMappings((prev) => [...prev, { id: mappingId, ...newMapping, _display: buildDisplay({ id: mappingId, ...newMapping }) }]);
      }

      setToastTick((t) => t + 1);
      setToast({ type: 'success', message: editingMapping ? 'Record updated successfully.' : 'Record saved successfully.' });
      setShowAddMappingModal(false);
      setEditingMapping(null);
    } catch (error) {
      console.error('Error adding mapping:', error);
      setToastTick((t) => t + 1);
      setToast({ type: 'error', message: error?.message || 'Failed to save record.' });
      throw error;
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    try {
      await deleteMapping(mappingId);
      setMappings((prev) => prev.filter((m) => m.id !== mappingId));
    } catch (error) {
      console.error('Error deleting mapping:', error);
    }
  };

  const handleDeleteAllByStatus = async (status) => {
    try {
      const normalize = (v) => String(v || '').trim().toLowerCase();
      const desired = normalize(status);
      const matchesStatus = (project) => {
        const statusCandidates = [
          project?.status,
          project?.state,
          project?.statusText,
          project?.workflowStatus,
          project?.workflow_status,
        ].map(normalize).filter(Boolean);

        if (desired === 'pending') {
          if (project?._pending === true) return true;
          if (String(project?.pending || '').toLowerCase() === 'true') return true;
          return statusCandidates.some((s) => s.includes('pend'));
        }
        if (desired === 'ongoing') {
          return statusCandidates.some((s) => s.includes('ongoing') || s.includes('on process') || s.includes('processing'));
        }
        if (desired === 'approved') {
          return statusCandidates.some((s) => s.includes('approved'));
        }
        return statusCandidates.some((s) => s === desired);
      };

      const selectedCollectionName = String(selectedCollection || '').trim();
      const useCurrentCollection = selectedCollectionName && selectedCollectionName !== 'cp_projects';
      const sourceRecords = useCurrentCollection
        ? await getMappingsFromCollection(selectedCollectionName)
        : await getAllCPProjects();

      const deleteAllInCurrentPendingCollection = useCurrentCollection && selectedCollectionName.toLowerCase().includes('pending') && desired === 'pending';
      const targets = deleteAllInCurrentPendingCollection
        ? sourceRecords
        : sourceRecords.filter((p) => matchesStatus(p));
      const ids = targets.map((p) => p.id).filter(Boolean);
      if (ids.length === 0) return { deleted: 0 };

      const result = useCurrentCollection
        ? await deleteDocumentsInCollection(selectedCollectionName, ids)
        : await deleteCPProjectsByIds(ids);

      // Reload from the source collection so the UI reflects the actual
      // Firestore state instead of relying on a potentially stale local filter.
      try {
        if (useCurrentCollection) {
          const refreshed = await getMappingsFromCollection(selectedCollectionName);
          setMappings(refreshed);
          if (selectedCollectionName === 'cp_projects') {
            setMainMappings(refreshed);
          }
        } else {
          const refreshed = await getAllCPProjects();
          setMappings(refreshed);
          setMainMappings(refreshed);
        }
      } catch (reloadErr) {
        console.warn('Failed to reload after delete-by-status:', reloadErr);
        // Fallback to local pruning if refresh fails.
        if (deleteAllInCurrentPendingCollection) {
          setMappings([]);
          setMainMappings([]);
        } else {
          setMappings((prev) => prev.filter((m) => !matchesStatus(m)));
          setMainMappings((prev) => (Array.isArray(prev) ? prev.filter((m) => !matchesStatus(m)) : prev));
        }
      }
      return result;
    } catch (error) {
      console.error('Error deleting all by status:', error);
      throw error;
    }
  };

  const handleImportMappings = async (records = [], options = {}) => {
    if (!currentUser || records.length === 0) return;

    // Special handling for cp_projects - use dedicated import service
    if (selectedCollection === 'cp_projects' || options.targetCollection === 'cp_projects') {
      try {
        const mode = options.mode && options.mode === 'replace' ? 'replace' : 'add';
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
        
        // Determine status based on current tab
        const activeTab = options.activeTab || 'ongoing'; // Default to ongoing
        let defaultStatus = 'Ongoing';
        if (activeTab === 'pending') {
          defaultStatus = 'Pending';
        } else if (activeTab === 'mappings') {
          defaultStatus = 'Approved';
        }
        
        console.log(`🚀 Importing to cp_projects table from ${activeTab} tab...`, { 
          mode, 
          recordCount: records.length,
          defaultStatus 
        });
        
        // Import using CP Projects service
        const { importCPProjects } = await import('../lib/cpProjectsService.js');
        
        // Prefer raw sheets (original Excel data) for best field mapping accuracy.
        // rawImport has: [{ sheetName, rawRecords: [{header_key: value, ...}], headers: [original headers] }]
        let excelSheets;
        const rawSheets = options.rawImport;
        if (rawSheets && Array.isArray(rawSheets) && rawSheets.length > 0) {
          excelSheets = rawSheets
            .map(({ sheetName, rawRecords, headers: origHeaders }) => {
              if (!rawRecords || rawRecords.length === 0) return null;
              // Use original Excel headers if available, otherwise use sanitized keys
              const headers = (origHeaders && origHeaders.length > 0)
                ? origHeaders
                : Object.keys(rawRecords[0]);
              const rows = rawRecords.map((r) => {
                return headers.map((h) => {
                  const key = String(h ?? '');
                  const val = Object.prototype.hasOwnProperty.call(r, key) ? r[key] : '';
                  return val ?? '';
                });
              });
              return { sheetName, headers, rows };
            })
            .filter(Boolean);
        } else {
          // Fallback: records are already-processed objects — wrap as single sheet
          excelSheets = [{
            sheetName: 'Import',
            headers: Object.keys(records[0] || {}),
            rows: records.map((rec) => Object.values(rec).map((v) => v ?? ''))
          }];
        }
        
        const result = await importCPProjects({
          excelSheets,
          mode,
          onProgress,
          defaultStatus  // Pass default status for records without explicit status
        });
        
        console.log('✅ Import to cp_projects complete:', result);
        
        // Reload cp_projects data
        const cpProjects = await getAllCPProjects();
        const mappingsFormat = cpProjects.map(p => ({
          id: p.id,
          surveyNumber: p.control_number || p.survey_number || '',
          controlNumber: p.control_number || p.survey_number || p.worksheet_no || '',
          proponent: p.proponent || '',
          applicantProponent: p.proponent || '',
          applicant: p.proponent || '',
          nameOfProject: p.project_name || '',
          projectName: p.project_name || '',
          typeOfProject: p.type_of_project || '',
          natureOfProject: p.type_of_project || '',
          location: p.location || p.province || '',
          projectCost: p.project_cost || '',
          totalArea: p.total_area || '',
          area: p.total_area || '',
          ancestralDomain: p.affected_ancestral_domain || '',
          dateOfApplication: p.date_filed || '',
          date_filed: p.date_filed || '',
          yearApplied: p.year_applied || null,
          region: p.region || '',
          province: p.province || '',
          municipality: p.municipality || '',
          municipalities: p.municipality ? [p.municipality] : [],
          barangays: p.barangay ? [p.barangay] : [],
          icc: p.affected_icc || [],
          iccs: Array.isArray(p.affected_icc) ? p.affected_icc.join(', ') : (p.affected_icc || ''),
          // FBI / FPIC workflow step fields
          reviewOfApplicationDocuments: p.review_of_application_documents || '',
          needForFBI: p.need_for_fbi || '',
          issuanceOfWorkOrder: p.issuance_of_work_order || '',
          preFBIConference: p.pre_fbi_conference || '',
          approvalOfWFP: p.approval_of_wfp || p.approval_concurrence_of_wfp || '',
          paymentOfFBIFee: p.payment_of_fbi_fee || '',
          conductOfFBI: p.conduct_of_fbi || '',
          preparationOfFBIReport: p.preparation_of_fbi_report || '',
          reviewOfFBIReport: p.review_of_fbi_report || '',
          issuanceOfWorkOrderOfFPICTeam: p.issuance_of_work_order_of_fpic_team || '',
          preFPICConference: p.pre_fpic_conference || '',
          paymentOfFPICFee: p.payment_of_fpic_fee || '',
          postingOfNotices: p.posting_of_notices || '',
          firstCommunityAssembly: p.first_community_assembly || '',
          secondCommunityAssembly: p.second_community_assembly || '',
          consensusBuildingDecision: p.consensus_building_decision || '',
          proceedToMOANegotiation: p.proceed_to_moa_negotiation || '',
          issuanceResolutionToProceedToMOA: p.issuance_resolution_to_proceed_to_moa || '',
          moaNegotiationPreparation: p.moa_negotiation_preparation || '',
          moaValidationRatificationSigning: p.moa_validation_ratification_signing || '',
          issuanceResolutionOfConsent: p.issuance_resolution_of_consent || '',
          submissionOfFPICReport: p.submission_of_fpic_report || '',
          reviewByRRT: p.review_by_rrt || '',
          reviewByADOorLAO: p.review_by_ado_or_lao || '',
          forComplianceOfFPICTeam: p.for_compliance_of_fpic_team || '',
          cebDeliberation: p.ceb_deliberation || '',
          cebApproved: p.ceb_approved || '',
          preparationSigningCEBResolutionCP: p.preparation_signing_ceb_resolution_cp || '',
          releaseOfCPToProponent: p.release_of_cp_to_proponent || '',
          worksheetNo: p.worksheet_no || '',
          statusOfApplication: p.status_of_application || '',
          workflowStatus: p.workflow_status || p.cadt_status || '',
          hasOngoingFpic: p.has_ongoing_fpic || '',
          remarks: p.remarks || '',
          status: p.status || 'Ongoing',
          _ongoing: (p.status || 'Ongoing') === 'Ongoing',
          _pending: (p.status || 'Ongoing') === 'Pending' || p._pending === true,
          importCollection: 'cp_projects',
          raw_fields: p,
          _display: `${p.proponent || 'N/A'} - ${p.project_name || 'N/A'}`
        }));
        
        const normalizedMappingsFormat = mappingsFormat.map((m) => normalizeCpProjectRecord(m));
        setMappings(normalizedMappingsFormat);
        // Reload fresh data from Firestore so the UI reflects the new import
        try {
          const freshProjects = await getAllCPProjects();
          const mappingsFormat = freshProjects.map(p => ({
            id: p.id,
            surveyNumber: p.control_number || p.survey_number || '',
            controlNumber: p.control_number || p.survey_number || p.worksheet_no || '',
            proponent: p.proponent || '',
            applicantProponent: p.proponent || '',
            applicant: p.proponent || '',
            nameOfProject: p.project_name || '',
            projectName: p.project_name || '',
            typeOfProject: p.type_of_project || '',
            natureOfProject: p.type_of_project || '',
            location: p.location || p.province || '',
            projectCost: p.project_cost || '',
            totalArea: p.total_area || '',
            area: p.total_area || '',
            ancestralDomain: p.affected_ancestral_domain || '',
            dateOfApplication: p.date_filed || '',
            date_filed: p.date_filed || '',
            yearApplied: p.year_applied || null,
            region: p.region || '',
            province: p.province || '',
            municipality: p.municipality || '',
            municipalities: p.municipality ? [p.municipality] : [],
            barangays: p.barangay ? [p.barangay] : [],
            icc: p.affected_icc || [],
            iccs: Array.isArray(p.affected_icc) ? p.affected_icc.join(', ') : (p.affected_icc || ''),
            reviewOfApplicationDocuments: p.review_of_application_documents || '',
            needForFBI: p.need_for_fbi || '',
            issuanceOfWorkOrder: p.issuance_of_work_order || '',
            preFBIConference: p.pre_fbi_conference || '',
            approvalOfWFP: p.approval_of_wfp || p.approval_concurrence_of_wfp || '',
            paymentOfFBIFee: p.payment_of_fbi_fee || '',
            conductOfFBI: p.conduct_of_fbi || '',
            preparationOfFBIReport: p.preparation_of_fbi_report || '',
            reviewOfFBIReport: p.review_of_fbi_report || '',
            issuanceOfWorkOrderOfFPICTeam: p.issuance_of_work_order_of_fpic_team || '',
            preFPICConference: p.pre_fpic_conference || '',
            paymentOfFPICFee: p.payment_of_fpic_fee || '',
            postingOfNotices: p.posting_of_notices || '',
            firstCommunityAssembly: p.first_community_assembly || '',
            secondCommunityAssembly: p.second_community_assembly || '',
            consensusBuildingDecision: p.consensus_building_decision || '',
            proceedToMOANegotiation: p.proceed_to_moa_negotiation || '',
            issuanceResolutionToProceedToMOA: p.issuance_resolution_to_proceed_to_moa || '',
            moaNegotiationPreparation: p.moa_negotiation_preparation || '',
            moaValidationRatificationSigning: p.moa_validation_ratification_signing || '',
            issuanceResolutionOfConsent: p.issuance_resolution_of_consent || '',
            submissionOfFPICReport: p.submission_of_fpic_report || '',
            reviewByRRT: p.review_by_rrt || '',
            reviewByADOorLAO: p.review_by_ado_or_lao || '',
            forComplianceOfFPICTeam: p.for_compliance_of_fpic_team || '',
            cebDeliberation: p.ceb_deliberation || '',
            cebApproved: p.ceb_approved || '',
            preparationSigningCEBResolutionCP: p.preparation_signing_ceb_resolution_cp || '',
            releaseOfCPToProponent: p.release_of_cp_to_proponent || '',
            worksheetNo: p.worksheet_no || '',
            statusOfApplication: p.status_of_application || '',
            workflowStatus: p.workflow_status || p.cadt_status || '',
            hasOngoingFpic: p.has_ongoing_fpic || '',
            remarks: p.remarks || '',
            status: p.status || 'Ongoing',
            _ongoing: (p.status || 'Ongoing') === 'Ongoing',
            _pending: (p.status || 'Ongoing') === 'Pending' || p._pending === true,
            importCollection: 'cp_projects',
            raw_fields: p,
            _display: `${p.proponent || 'N/A'} - ${p.project_name || 'N/A'}`
          }));
          const normalizedMappingsFormat = mappingsFormat.map((m) => normalizeCpProjectRecord(m));
          setMappings(normalizedMappingsFormat);
          setMainMappings(normalizedMappingsFormat);
          setSelectedCollection('cp_projects');
        } catch (reloadErr) {
          console.warn('Failed to reload after import:', reloadErr);
        }
        setToastTick((t) => t + 1);
        setToast({ type: 'success', message: `Import complete: ${result.created || 0} records saved to CP Projects table.` });
        onProgress(100);
        return;
      } catch (err) {
        console.error('Import to cp_projects failed:', err);
        setToastTick((t) => t + 1);
        setToast({ type: 'error', message: err?.message || 'Failed to import to CP Projects.' });
        throw err;
      }
    }

    // Lazy-load importService to avoid circular imports at module load time
    const { importMappings } = await import('../lib/importService.js');

    const mode = options.mode || 'add'; // 'add' or 'replace'
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    const forceOngoing = Boolean(options.forceOngoing);

    // Prepare ids to delete for replace mode
    const idsToDelete = mode === 'replace' ? mappings.filter((m) => m?.id).map((m) => m.id) : [];

    try {
      // Ensure we pass a concrete collection name when creating a new collection.
      let collectionNameToWrite = options.collectionName;
      if (mode === 'newCollection' && !collectionNameToWrite) {
        const safeTs = new Date().toISOString().replace(/[:.]/g, '-');
        collectionNameToWrite = `mappings_import_${currentUser.uid}_${safeTs}`;
      }
      const result = await importMappings({ preparedDocs: records, rawRecords: options.rawImport || [], mode, collectionName: 'cp_projects', userId: currentUser.uid, idsToDelete, onProgress, forceOngoing });

      // If importService returned a collectionName, try to refresh available imports
      try {
        const imports = await getUserImportCollections(currentUser.uid);
        const prefix = `mappings_import_${currentUser.uid}_`;
        const visibleImports = imports.filter((i) => Number(i.count) > 0 && i.collectionName && String(i.collectionName).trim());
        const checked = await Promise.all(
          visibleImports.map(async (i) => {
            try {
              const docs = await getMappingsFromCollection(i.collectionName);
              const docsArray = Array.isArray(docs) ? docs : [];
              const importMeta = { ...i };
              if (docsArray.some((d) => d && (d._ongoing === true || String(d.importCollection || '').toLowerCase().includes('ongoing') || String(i.collectionName || '').toLowerCase().includes('ongoing')))) {
                importMeta.type = 'ongoing';
              }
              importMeta.readable = true;
              return { importMeta, docsCount: docsArray.length };
            } catch (err) {
              const importMeta = { ...i, readable: false };
              return { importMeta, docsCount: -1 };
            }
          })
        );
        const finalImports = checked.filter((c) => c.docsCount > 0).map((c) => c.importMeta);
        const list = [{ id: 'cp_projects', collectionName: 'cp_projects', displayName: 'CP Projects (Unified)', type: 'cp_projects' }, ...finalImports.map((i) => {
          const base = i.displayName || (i.collectionName && i.collectionName.startsWith(prefix) ? i.collectionName.slice(prefix.length) : i.collectionName);
          return { id: i.collectionName, collectionName: i.collectionName, displayName: (i.type && String(i.type).toLowerCase() === 'ongoing') ? `${base} (ongoing)` : base };
        })];
        setAvailableCollections(list);
      } catch (err) {
        console.warn('Failed to refresh import collections after import', err);
      }

      // Refresh mappings view depending on where we wrote
      try {
        if (result && result.collectionName && String(result.collectionName).toLowerCase() !== 'mappings') {
          const newMappings = await getMappingsFromCollection(result.collectionName);
          setMappings(newMappings);
          setSelectedCollection(result.collectionName);
        } else {
          // Reload main mappings
          const all = await getAllMappings();
          setMappings(all);
        }
      } catch (err) {
        console.warn('Failed to reload mappings after import', err);
      }

      setToastTick((t) => t + 1);
      setToast({ type: 'success', message: `Import complete: ${result.created || 0} records added to ${result.collectionName || 'mappings'}.` });
      onProgress(100);
      return;
    } catch (err) {
      console.error('Import failed (importService):', err);
      setToastTick((t) => t + 1);
      setToast({ type: 'error', message: err?.message || 'Failed to import mappings.' });
      throw err;
    }
  };

  const handleViewMappings = () => {
    setCurrentView('search');
  };

  const handleViewProfile = () => {
    setShowProfileModal(true);
  };

  // View Components
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const dashboardWithModal = (
    <>
      <Dashboard
        user={currentUser}
        onLogout={handleLogout}
        onAddMapping={handleAddMapping}
        onViewMappings={handleViewMappings}
        onViewProfile={handleViewProfile}
        onEditMapping={handleEditMapping}
        onDeleteMapping={handleDeleteMapping}
        onDeleteAllByStatus={handleDeleteAllByStatus}
        onImportMappings={handleImportMappings}
        onPreviewImport={async (records = []) => {
          if (!records || !Array.isArray(records) || records.length === 0) return;
          try {
            // Create lightweight preview mappings with temporary ids and ongoing flag
            const now = Date.now();
            const previewMappings = records.map((r, idx) => ({
              id: `preview_${now}_${idx}`,
              _ongoing: true,
              importCollection: '__preview__',
              userId: currentUser.uid,
              ...r,
            }));
            setSelectedCollection('__preview__');
            setMappings(previewMappings);
          } catch (err) {
            console.error('Failed to preview import as ongoing', err);
          }
        }}
        externalAlert={toast}
        externalAlertTick={toastTick}
        onClearExternalAlert={() => setToast(null)}
        mappings={mappings}
        mainMappings={mainMappings}
        isLoadingMappings={isLoadingMappings}
        availableCollections={availableCollections}
        selectedCollection={selectedCollection}
        onSelectCollection={async (collectionName) => {
          if (!collectionName) return;
          console.log('App: onSelectCollection called ->', collectionName);
          setSelectedCollection(collectionName);
          setIsLoadingMappings(true);
          try {
            if (collectionName === 'mappings') {
              console.log('App: loading main mappings for user', currentUser?.uid);
              const userMappings = await getUserMappings(currentUser.uid);
              console.log('App: loaded user mappings count ->', Array.isArray(userMappings) ? userMappings.length : 0);
              try { console.log('App: sample user mapping ->', Array.isArray(userMappings) && userMappings.length ? JSON.parse(JSON.stringify(userMappings[0])) : null); } catch (e) { /* ignore */ }
              setMappings(userMappings);
              setMainMappings(userMappings);
            } else if (collectionName === 'cp_projects') {
              console.log('App: loading CP Projects from cp_projects table');
              const cpProjects = await getAllCPProjects();
              console.log('App: loaded cp_projects count ->', Array.isArray(cpProjects) ? cpProjects.length : 0);
              
              // Convert CP Projects format to mappings format for Dashboard compatibility
              const mappingsFormat = cpProjects.map(normalizeCpProjectRecord);
              
              setMappings(mappingsFormat);
              try { console.log('App: sample cp_project mapped ->', mappingsFormat.length ? JSON.parse(JSON.stringify(mappingsFormat[0])) : null); } catch (e) { /* ignore */ }
            } else {
              try {
                console.log('App: loading import collection ->', collectionName);
                const colMappings = await getMappingsFromCollection(collectionName);
                console.log('App: loaded collection', collectionName, 'count ->', Array.isArray(colMappings) ? colMappings.length : 0);
                try { console.log('App: sample import mapping ->', Array.isArray(colMappings) && colMappings.length ? JSON.parse(JSON.stringify(colMappings[0])) : null); } catch (e) { /* ignore */ }
                setMappings(colMappings);
                // If this is an ongoing import collection, ensure documents are flagged
                // as ongoing in the collection so the Ongoing UI and summary detect them.
                try {
                  if (String(collectionName || '').toLowerCase().includes('ongoing') && Array.isArray(colMappings) && colMappings.length) {
                    (async () => {
                      console.log('App: background tagging loaded import collection as ongoing ->', collectionName);
                      const items = colMappings;
                      const batchSize = 200;
                      for (let i = 0; i < items.length; i += batchSize) {
                        const chunk = items.slice(i, i + batchSize);
                        await Promise.all(chunk.map(async (it) => {
                          if (!it || !it.id) return;
                          try {
                            const needsTag = !(it._ongoing === true || String(it.importCollection || '').toLowerCase().includes('ongoing') || String(it.importCollection || '').toLowerCase() === String(collectionName).toLowerCase());
                            if (needsTag) {
                              await updateDocumentInCollection(collectionName, it.id, { _ongoing: true, importCollection: String(collectionName) });
                            }
                          } catch (err) {
                            console.debug('App: background tag failed for', it.id, err?.message || err);
                          }
                        }));
                      }
                      console.log('App: background tagging complete for', collectionName);
                    })();
                  }
                } catch (bgErr) {
                  console.warn('App: failed background tagging ongoing collection', bgErr);
                }
              } catch (err) {
                // If Firestore denies permission, show a friendly toast but DO NOT clear existing mappings
                const msg = String(err?.message || '').toLowerCase();
                if (msg.includes('permission') || msg.includes('insufficient') || msg.includes('missing')) {
                  setToastTick((t) => t + 1);
                  setToast({ type: 'error', message: 'You do not have permission to view that import collection.' });
                  console.log('App: permission denied when loading collection ->', collectionName);
                  // Keep previous `mappings` so the UI doesn't flash empty then disappear
                } else {
                  console.error('Error loading selected collection', err);
                  // For non-permission errors, clear mappings to reflect lack of data
                  setMappings([]);
                }
              }
            }
          } catch (err) {
            console.error('Error loading selected collection', err);
            setMappings([]);
          }
          setIsLoadingMappings(false);
        }}
      />
      <RightSplitModal
        open={showAddMappingModal}
        onOpenChange={(open) => {
          setShowAddMappingModal(open);
          if (!open) {
            setEditingMapping(null);
            setAddMappingContext(null);
          }
        }}
        title={editingMapping ? "Edit Record" : "Add New Record"}
        dismissOnSecondaryClick={true}
        primaryChildren={
            <MappingForm
              isModal
              user={currentUser}
              onBack={() => setShowAddMappingModal(false)}
              onSubmit={handleFormSubmit}
              initialData={editingMapping || (addMappingContext && addMappingContext.region ? { region: addMappingContext.region } : null)}
              // Enable ongoingMode when either opening from the Ongoing tab or when editing an ongoing mapping
              ongoingMode={Boolean(
                (addMappingContext && addMappingContext.ongoing) ||
                (editingMapping && (
                  editingMapping._ongoing === true ||
                  /ongoing|on process|processing/i.test(String(editingMapping.status || editingMapping.workflowStatus || editingMapping.cadtStatus || '')) ||
                  String(editingMapping.importCollection || '').toLowerCase().includes('ongoing')
                ))
              )}
              // Enable pendingMode when opening from the Pending tab or when the
              // currently selected collection appears to be a pending import.
              pendingMode={Boolean(
                (addMappingContext && addMappingContext.pending) ||
                (editingMapping && (
                  editingMapping._pending === true ||
                  /pend/i.test(String(editingMapping.status || editingMapping.workflowStatus || editingMapping.cadtStatus || '')) ||
                  String(editingMapping.importCollection || '').toLowerCase().includes('pending')
                )) ||
                String(selectedCollection || '').toLowerCase().includes('pending')
              )}
              // Lock region when opened from a region subtab or when editing a mapping (use mapping.region)
              fixedRegion={
                (editingMapping && (editingMapping.region || null)) ||
                (addMappingContext && addMappingContext.region ? addMappingContext.region : null)
              }
              formTitle={editingMapping ? "Edit Record" : "Add New Record"}
              submitLabel={editingMapping ? "Update Record" : "Save Record"}
            />
        }
      />
      <RightSplitModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        title="Profile"
        dismissOnSecondaryClick={true}
        primaryChildren={
          <ProfilePage
            user={currentUser}
            onBack={() => setShowProfileModal(false)}
            onLogout={handleLogout}
            onAddMapping={handleAddMapping}
            mappings={mappings}
          />
        }
      />
    </>
  );

  if (currentView === 'search') {
    return dashboardWithModal;
  }

  return dashboardWithModal;
}
