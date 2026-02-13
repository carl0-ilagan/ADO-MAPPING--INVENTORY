'use client';

import React, { useState, useEffect } from 'react';
import { LoginPage } from '@/components/LoginPage';
import { Dashboard } from '@/components/Dashboard';
import { MappingForm } from '@/components/MappingFormClean';
import { RightSplitModal } from '@/components/RightSplitModal';
import { ProfilePage } from '@/components/ProfilePage';
import { onAuthStateChangeListener, signOutUser } from '@/lib/firebaseAuth.js';
import { getUserMappings, addMapping, deleteMapping, updateMapping, addMappingToCollection, getMappingsFromCollection, registerImportCollection, getUserImportCollections } from '@/lib/firebaseDB.js';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase.js';


export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login'); // 'login', 'dashboard', 'search'
  const [mappings, setMappings] = useState([]);
  const [showAddMappingModal, setShowAddMappingModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [toast, setToast] = useState(null);
  const [toastTick, setToastTick] = useState(0);
  const [availableCollections, setAvailableCollections] = useState([{ id: 'mappings', collectionName: 'mappings' }]);
  const [selectedCollection, setSelectedCollection] = useState('mappings');

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
        // Load user's mappings from Firestore and merge with sample data
        setIsLoadingMappings(true);
        try {
          const userMappings = await getUserMappings(user.uid);
          setMappings(userMappings);
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
                { id: 'mappings', collectionName: 'mappings', displayName: 'mappings' },
                ...finalImports.map((i) => ({
                  id: i.collectionName,
                  collectionName: i.collectionName,
                  displayName: i.displayName || (i.collectionName && i.collectionName.startsWith(prefix) ? i.collectionName.slice(prefix.length) : i.collectionName),
                  type: i.type || null,
                  readable: typeof i.readable === 'boolean' ? i.readable : true,
                })),
              ];
              setAvailableCollections(list);
              // Debug: report available collections for troubleshooting
              try {
                console.debug('App: availableCollections set ->', JSON.parse(JSON.stringify(list)));
              } catch (e) {
                console.debug('App: availableCollections set', list);
              }
            setSelectedCollection('mappings');
          } catch (e) {
            console.warn('Unable to load user import collections', e);
          }
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

  const handleAddMapping = () => {
    setEditingMapping(null);
    setShowAddMappingModal(true);
  };

  const handleEditMapping = (mapping) => {
    setEditingMapping(mapping);
    setShowAddMappingModal(true);
  };

  const handleFormSubmit = async (formData) => {
    if (!currentUser) return;

    try {
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
        projectCost: formData.projectCost || '',
        cadtStatus: formData.cadtStatus || '',
        location: formData.location || '',
        yearApproved: formData.yearApproved || '',
        moaDuration: formData.moaDuration || '',
        communityBenefits: formData.communityBenefits || '',
      };

      if (editingMapping?.id) {
        await updateMapping(editingMapping.id, { ...newMapping });
        setMappings(mappings.map((m) => (m.id === editingMapping.id ? { ...m, ...newMapping } : m)));
      } else {
        const mappingId = await addMapping({ ...newMapping });
        // Update local state
        const updatedMappings = [...mappings, { id: mappingId, ...newMapping }];
        setMappings(updatedMappings);
      }

      setToastTick((t) => t + 1);
      setToast({ type: 'success', message: editingMapping ? 'Mapping updated successfully.' : 'Mapping saved successfully.' });
      setShowAddMappingModal(false);
      setEditingMapping(null);
    } catch (error) {
      console.error('Error adding mapping:', error);
      setToastTick((t) => t + 1);
      setToast({ type: 'error', message: error?.message || 'Failed to save mapping.' });
      throw error;
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    try {
      await deleteMapping(mappingId);
      setMappings(mappings.filter(m => m.id !== mappingId));
    } catch (error) {
      console.error('Error deleting mapping:', error);
    }
  };

  const handleImportMappings = async (records = [], options = {}) => {
    if (!currentUser || records.length === 0) return;

    const mode = options.mode || 'add'; // 'add' or 'replace'
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

    // Prepare counts for progress reporting
    const idsToDelete = mode === 'replace' ? mappings.filter((m) => m?.id).map((m) => m.id) : [];
    const totalSteps = Math.max(1, idsToDelete.length + records.length);
    let processedSteps = 0;

    // If creating a new collection, prepare a unique collection name
    let targetCollection = null;
    let targetDisplayName = null;
    if (mode === 'newCollection') {
      // allow caller to provide a collectionName; otherwise generate a timestamped name
      if (options.collectionName && typeof options.collectionName === 'string' && options.collectionName.trim()) {
        // sanitize: allow only letters, numbers, hyphens, underscores
        const raw = String(options.collectionName).trim();
        const sanitized = raw.replace(/[^A-Za-z0-9_-]/g, '_');
        // If user accidentally included the required prefix with their uid, allow it
        const prefix = `mappings_import_${currentUser.uid}`;
        if (sanitized.startsWith('mappings_import_')) {
          // If they supplied a prefix for another user, override to ensure it's under this user's UID
          if (!sanitized.startsWith(prefix)) {
            targetCollection = `${prefix}_${sanitized.replace(/^mappings_import_/, '')}`;
            targetDisplayName = sanitized.replace(/^mappings_import_/, '');
          } else {
            targetCollection = sanitized;
            targetDisplayName = sanitized.slice(prefix.length + 1) || null;
          }
        } else {
          targetCollection = `${prefix}_${sanitized}`;
          targetDisplayName = sanitized;
        }
      } else {
        const safeTs = new Date().toISOString().replace(/[:.]/g, '-');
        targetCollection = `mappings_import_${currentUser.uid}_${safeTs}`;
        targetDisplayName = safeTs;
      }
    }

    // If replace mode, delete all existing mappings for the current user first
    if (mode === 'replace') {
      try {
        if (idsToDelete.length > 0) {
          for (const id of idsToDelete) {
            // eslint-disable-next-line no-await-in-loop
            await deleteMapping(id);
            processedSteps += 1;
            onProgress(Math.min(100, Math.round((processedSteps / totalSteps) * 100)));
          }
        }
        // Clear local state immediately so UI reflects replacement
        setMappings([]);
      } catch (err) {
        console.error('Error clearing existing mappings for replace:', err);
        setToastTick((t) => t + 1);
        setToast({ type: 'error', message: err?.message || 'Failed to clear existing mappings before replace.' });
        throw err;
      }
    }

    // If creating a new collection from raw sheet headers, handle that path separately
    if (mode === 'newCollection' && options.rawImport && Array.isArray(options.rawImport) && options.rawImport.length > 0) {
      const flat = [];
      options.rawImport.forEach((s) => {
        const sheetName = s.sheetName || '';
        (s.rawRecords || []).forEach((r) => flat.push({ ...r, sheet: sheetName }));
      });

      const totalFlat = Math.max(1, flat.length);
      let processedFlat = 0;
      let createdFlat = 0;
      let fallbackFlat = false;

      try {
        const fallbackTargetMappings = [...mappings];
        for (const doc of flat) {
          try {
            await addMappingToCollection(targetCollection, { ...doc, userId: currentUser.uid });
            createdFlat += 1;
            } catch (err) {
            const msg = String(err?.message || '').toLowerCase();
            if (msg.includes('permission') || msg.includes('missing') || msg.includes('insufficient')) {
              const mappingId = await addMapping({ ...doc, importCollection: targetCollection, userId: currentUser.uid });
              fallbackTargetMappings.push({ id: mappingId, ...doc, importCollection: targetCollection });
              createdFlat += 1;
              fallbackFlat = true;
            } else {
              throw err;
            }
          }

          processedFlat += 1;
          onProgress(Math.min(100, Math.round((processedFlat / totalFlat) * 100)));
        }

        setMappings(fallbackTargetMappings);
        setToastTick((t) => t + 1);
        const successMessage = `Import complete: ${createdFlat} records added to collection ${targetDisplayName || targetCollection}.`;
        const finalMessage = fallbackFlat
          ? `${successMessage} Note: your project security rules prevented creating a new collection; imported records were written into the main 'mappings' collection and tagged with the importCollection name.`
          : successMessage;
        setToast({ type: 'success', message: finalMessage });
        onProgress(100);

            if (!fallbackFlat) {
            try {
            const meta = { count: createdFlat, displayName: targetDisplayName };
            // If the caller requested forcing into an ongoing collection, or the
            // import originated from the ongoing tab, persist that metadata
            if (options && (options.forceOngoing || options.targetTab === 'ongoing')) meta.type = 'ongoing';
            await registerImportCollection(currentUser.uid, targetCollection, meta);
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
            const list = [{ id: 'mappings', collectionName: 'mappings', displayName: 'mappings' }, ...finalImports.map((i) => ({ id: i.collectionName, collectionName: i.collectionName, displayName: i.displayName || (i.collectionName && i.collectionName.startsWith(prefix) ? i.collectionName.slice(prefix.length) : i.collectionName) }))];
            setAvailableCollections(list);
            setSelectedCollection(targetCollection);
            const newMappings = await getMappingsFromCollection(targetCollection);
            setMappings(newMappings);
          } catch (err) {
            console.warn('Failed to register or load new import collection', err);
          }
        }

        return;
      } catch (err) {
        console.error('Error importing raw sheets into new collection:', err);
        setToastTick((t) => t + 1);
        setToast({ type: 'error', message: err?.message || 'Failed to import mappings.' });
        throw err;
      }
    }

    const existingBySurvey = new Map(
      (mode === 'replace' ? [] : mappings).map((m) => [String(m.surveyNumber || '').trim().toLowerCase(), m])
    );
    const nextMappings = mode === 'replace' ? [] : [...mappings];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let fallbackToMappings = false;

    try {
      for (const record of records) {
        const surveyNumber = String(record.surveyNumber || '').trim();
        if (!surveyNumber) {
          skippedCount += 1;
          processedSteps += 1;
          onProgress(Math.min(100, Math.round((processedSteps / totalSteps) * 100)));
          continue;
        }

        const municipalities = Array.isArray(record.municipalities)
          ? record.municipalities
          : (record.municipality ? String(record.municipality).split(',').map((v) => v.trim()).filter(Boolean) : []);
        const barangays = Array.isArray(record.barangays)
          ? record.barangays
          : (record.barangays ? String(record.barangays).split(',').map((v) => v.trim()).filter(Boolean) : []);

        const newMapping = {
          ...record, // Preserve ALL fields from imported record (including NCIP fields)
          userId: currentUser.uid,
          surveyNumber,
          region: record.region || '',
          province: record.province || '',
          municipality: municipalities.join(', '),
          municipalities,
          barangays,
          icc: record.icc || [],
          remarks: record.remarks || '',
          totalArea: record.totalArea || 0,
        };
        // If the import was initiated while the user was on the 'ongoing' tab,
        // mark imported mappings with an internal flag so the Dashboard shows
        // them in the Ongoing view. Apply to all users (not just NCIP).
        if (options && options.targetTab === 'ongoing') {
          newMapping._ongoing = true;
        }

        const key = surveyNumber.toLowerCase();
        const existing = existingBySurvey.get(key);

        if (mode === 'newCollection') {
            try {
            const mappingId = await addMappingToCollection(targetCollection, { ...newMapping });
            createdCount += 1;
          } catch (err) {
            // If permission denied for arbitrary collections, fall back to writing into 'mappings'
            const msg = String(err?.message || '').toLowerCase();
            if (msg.includes('permission') || msg.includes('missing') || msg.includes('insufficient')) {
              // write into main `mappings` collection with an importCollection tag so users can find them
              const mappingId = await addMapping({ ...newMapping, importCollection: targetCollection });
              nextMappings.push({ id: mappingId, ...newMapping, importCollection: targetCollection });
              createdCount += 1;
              // flag will be surfaced after loop via toast (see below)
              fallbackToMappings = true;
            } else {
              throw err;
            }
          }
        } else if (existing?.id) {
          await updateMapping(existing.id, { ...newMapping });
          const idx = nextMappings.findIndex((m) => m.id === existing.id);
          if (idx !== -1) nextMappings[idx] = { ...existing, ...newMapping };
          updatedCount += 1;
        } else {
          const mappingId = await addMapping({ ...newMapping });
          nextMappings.push({ id: mappingId, ...newMapping });
          createdCount += 1;
        }

        processedSteps += 1;
        onProgress(Math.min(100, Math.round((processedSteps / totalSteps) * 100)));
      }

      setMappings(nextMappings);
      setToastTick((t) => t + 1);
      const successMessage = mode === 'newCollection'
        ? `Import complete: ${createdCount} records added to collection ${targetDisplayName || targetCollection}.`
        : `Import complete: ${createdCount} added, ${updatedCount} updated, ${skippedCount} skipped.`;

      const finalMessage = fallbackToMappings
        ? `${successMessage} Note: your project security rules prevented creating a new collection; imported records were written into the main 'mappings' collection and tagged with the importCollection name.`
        : successMessage;

      setToast({ type: 'success', message: finalMessage });
      onProgress(100);

      // If we created a real new collection (no fallback), register and load it
        if (!fallbackToMappings && mode === 'newCollection' && targetCollection) {
          try {
          const meta = { count: createdCount, displayName: targetDisplayName };
        if (options && (options.forceOngoing || options.targetTab === 'ongoing')) meta.type = 'ongoing';
          await registerImportCollection(currentUser.uid, targetCollection, meta);
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

          const list = [
              { id: 'mappings', collectionName: 'mappings', displayName: 'mappings' },
              ...finalImports.map((i) => ({
                id: i.collectionName,
                collectionName: i.collectionName,
                displayName: i.displayName || (i.collectionName && i.collectionName.startsWith(prefix) ? i.collectionName.slice(prefix.length) : i.collectionName),
                type: i.type || null,
                readable: typeof i.readable === 'boolean' ? i.readable : true,
              })),
          ];
          setAvailableCollections(list);
          setSelectedCollection(targetCollection);
          const newMappings = await getMappingsFromCollection(targetCollection);
          setMappings(newMappings);
        } catch (err) {
          console.warn('Failed to register or load new import collection', err);
        }
      }
    } catch (error) {
      console.error('Error importing mappings:', error);
      setToastTick((t) => t + 1);
      setToast({ type: 'error', message: error?.message || 'Failed to import mappings.' });
      throw error;
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
        onImportMappings={handleImportMappings}
        externalAlert={toast}
        externalAlertTick={toastTick}
        onClearExternalAlert={() => setToast(null)}
        mappings={mappings}
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
            } else {
              try {
                console.log('App: loading import collection ->', collectionName);
                const colMappings = await getMappingsFromCollection(collectionName);
                console.log('App: loaded collection', collectionName, 'count ->', Array.isArray(colMappings) ? colMappings.length : 0);
                try { console.log('App: sample import mapping ->', Array.isArray(colMappings) && colMappings.length ? JSON.parse(JSON.stringify(colMappings[0])) : null); } catch (e) { /* ignore */ }
                setMappings(colMappings);
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
          if (!open) setEditingMapping(null);
        }}
        title={editingMapping ? "Edit Mapping" : "Add New Mapping"}
        dismissOnSecondaryClick={true}
        primaryChildren={
          <MappingForm
            isModal
            user={currentUser}
            onBack={() => setShowAddMappingModal(false)}
            onSubmit={handleFormSubmit}
            initialData={editingMapping}
            formTitle={editingMapping ? "Edit Mapping" : "Add New Mapping"}
            submitLabel={editingMapping ? "Update Mapping" : "Save Mapping"}
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
