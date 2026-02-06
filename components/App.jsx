'use client';

import React, { useState, useEffect } from 'react';
import { LoginPage } from '@/components/LoginPage';
import { Dashboard } from '@/components/Dashboard';
import { MappingForm } from '@/components/MappingFormClean';
import { RightSplitModal } from '@/components/RightSplitModal';
import { ProfilePage } from '@/components/ProfilePage';
import { onAuthStateChangeListener, signOutUser } from '@/lib/firebaseAuth.js';
import { getUserMappings, addMapping, deleteMapping, updateMapping } from '@/lib/firebaseDB.js';
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
      };

      if (editingMapping?.id) {
        await updateMapping(editingMapping.id, {
          ...newMapping,
          location: '',
        });
        setMappings(mappings.map((m) => (m.id === editingMapping.id ? { ...m, ...newMapping } : m)));
      } else {
        const mappingId = await addMapping({
          ...newMapping,
          location: '',
        });

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

  const handleImportMappings = async (records = []) => {
    if (!currentUser || records.length === 0) return;

    const existingBySurvey = new Map(
      mappings.map((m) => [String(m.surveyNumber || '').trim().toLowerCase(), m])
    );
    const nextMappings = [...mappings];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    try {
      for (const record of records) {
        const surveyNumber = String(record.surveyNumber || '').trim();
        if (!surveyNumber) {
          skippedCount += 1;
          continue;
        }

        const municipalities = Array.isArray(record.municipalities)
          ? record.municipalities
          : (record.municipality ? String(record.municipality).split(',').map((v) => v.trim()).filter(Boolean) : []);
        const barangays = Array.isArray(record.barangays)
          ? record.barangays
          : (record.barangays ? String(record.barangays).split(',').map((v) => v.trim()).filter(Boolean) : []);

        const newMapping = {
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

        const key = surveyNumber.toLowerCase();
        const existing = existingBySurvey.get(key);

        if (existing?.id) {
          await updateMapping(existing.id, { ...newMapping, location: '' });
          const idx = nextMappings.findIndex((m) => m.id === existing.id);
          if (idx !== -1) nextMappings[idx] = { ...existing, ...newMapping };
          updatedCount += 1;
        } else {
          const mappingId = await addMapping({ ...newMapping, location: '' });
          nextMappings.push({ id: mappingId, ...newMapping });
          createdCount += 1;
        }
      }

      setMappings(nextMappings);
      setToastTick((t) => t + 1);
      setToast({
        type: 'success',
        message: `Import complete: ${createdCount} added, ${updatedCount} updated, ${skippedCount} skipped.`,
      });
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
