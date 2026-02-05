'use client';

import React, { useState, useEffect } from 'react';
import { LoginPage } from '@/components/LoginPage';
import { Dashboard } from '@/components/Dashboard';
import { MappingForm } from '@/components/MappingForm';
import { RightSplitModal } from '@/components/RightSplitModal';
import { onAuthStateChangeListener, signOutUser } from '@/lib/firebaseAuth.js';
import { getUserMappings, addMapping, deleteMapping } from '@/lib/firebaseDB.js';

export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login'); // 'login', 'dashboard', 'search'
  const [mappings, setMappings] = useState([]);
  const [showAddMappingModal, setShowAddMappingModal] = useState(false);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChangeListener(async (user) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          email: user.email,
        });
        // Load user's mappings from Firestore
        setIsLoadingMappings(true);
        try {
          const userMappings = await getUserMappings(user.uid);
          setMappings(userMappings);
        } catch (error) {
          console.error('Error loading mappings:', error);
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
    setShowAddMappingModal(true);
  };

  const handleFormSubmit = async (formData) => {
    if (!currentUser) return;

    try {
      const newMapping = {
        userId: currentUser.uid,
        communityName: formData.communityName || '',
        region: formData.selectedRegion?.name || '',
        province: formData.selectedProvince?.name || '',
        municipality: formData.selectedMunicipality?.name || '',
        barangay: formData.selectedBarangay?.name || '',
        populationEstimate: formData.populationEstimate || 0,
        resources: formData.selectedResources || [],
        contact: formData.contactPerson || '',
        email: formData.email || '',
      };

      const mappingId = await addMapping(newMapping);
      
      // Update local state
      const updatedMappings = [...mappings, { id: mappingId, ...newMapping }];
      setMappings(updatedMappings);

      setShowAddMappingModal(false);
    } catch (error) {
      console.error('Error adding mapping:', error);
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

  const handleViewMappings = () => {
    setCurrentView('search');
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
        onDeleteMapping={handleDeleteMapping}
        mappings={mappings}
        isLoadingMappings={isLoadingMappings}
      />
      <RightSplitModal
        open={showAddMappingModal}
        onOpenChange={setShowAddMappingModal}
        title="Add New Mapping"
        dismissOnSecondaryClick={true}
        primaryChildren={
          <MappingForm
            isModal
            onBack={() => setShowAddMappingModal(false)}
            onSubmit={handleFormSubmit}
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
