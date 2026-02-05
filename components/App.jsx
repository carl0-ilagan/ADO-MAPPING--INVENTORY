'use client';

import React, { useState, useEffect } from 'react';
import { LoginPage } from '@/components/LoginPage';
import { Dashboard } from '@/components/Dashboard';
import { MappingForm } from '@/components/MappingFormClean';
import { RightSplitModal } from '@/components/RightSplitModal';
import { onAuthStateChangeListener, signOutUser } from '@/lib/firebaseAuth.js';
import { getUserMappings, addMapping, deleteMapping } from '@/lib/firebaseDB.js';

// Sample data based on the spreadsheet
const SAMPLE_MAPPINGS = [
  {
    id: 'sample-1',
    surveyNumber: 'ADs-0301-0027-Gni',
    location: 'Barangay/s of: DITEKI, DITUMABO, NONONG SENIOR, L. PIMENTEL, DIBALO, DIBAYABAY, DIBUT, DIKAPINISAN\nMunicipality/ies of: SAN LUIS\nProvince/s of: AURORA',
    totalArea: 42697.1993,
    icc: ['ALTA/DUMAGAT'],
    remarks: '',
    region: 'Region III - Central Luzon',
    province: 'Aurora',
    municipality: 'San Luis',
    barangays: ['Diteki', 'Ditumabo', 'Nonong Senior', 'L. Pimentel', 'Dibalo', 'Dibayabay', 'Dibut', 'Dikapinisan'],
    isSample: true,
  },
  {
    id: 'sample-2',
    surveyNumber: 'ADs-0302-0026-Gni',
    location: 'Barangay/s of: TUBO-TUBO, PAYANGAN AND BAYAN-BAYANAN\nMunicipality/ies of: DINALUPIHAN\nProvince/s of: BATAAN',
    totalArea: 5167.0486,
    icc: ['AYTA AMBALA'],
    remarks: '',
    region: 'Region III - Central Luzon',
    province: 'Bataan',
    municipality: 'Dinalupihan',
    barangays: ['Tubo-Tubo', 'Payangan', 'Bayan-Bayanan'],
    isSample: true,
  },
  {
    id: 'sample-3',
    surveyNumber: 'ADs-0302-0020-Gni',
    location: 'Barangay/s of: BINARITAN, NAGBALAYONG, & SABANG\nMunicipality/ies of: MORONG\nProvince/s of: BATAAN',
    totalArea: 12231.1026,
    icc: ['MAGBUKON AYTA'],
    remarks: 'void',
    region: 'Region III - Central Luzon',
    province: 'Bataan',
    municipality: 'Morong',
    barangays: ['Binaritan', 'Nagbalayong', 'Sabang'],
    isSample: true,
  },
  {
    id: 'sample-4',
    surveyNumber: 'ADs-0302-0025-Gni',
    location: 'Barangay/s of: BANAWANG, A. RICARDO, BINUKAWAN TANATO, DANGCOL, MUNTING BATANGAS SALIAN, GAYINTIN\nMunicipality/ies of: BAGAC, BALANGA, ABUCAY, SAMAL ORANI\nProvince/s of: BATAAN',
    totalArea: 14977.1478,
    icc: ['AYTA MAGBUKUN'],
    remarks: '3 COPIES',
    region: 'Region III - Central Luzon',
    province: 'Bataan',
    municipality: 'Bagac, Balanga, Abucay, Samal Orani',
    barangays: ['Banawang', 'A. Ricardo', 'Binukawan Tanato', 'Dangcol', 'Munting Batangas Salian', 'Gayintin'],
    isSample: true,
  },
  {
    id: 'sample-5',
    surveyNumber: 'ADs-0304-0022-Gni',
    location: 'Barangay/s of: CALABASA AND LIGAYA\nMunicipality/ies of: GABALDON\nProvince/s of: NUEVA ECIJA',
    totalArea: 4987.4402,
    icc: ['DUMAGAT'],
    remarks: '',
    region: 'Region III - Central Luzon',
    province: 'Nueva Ecija',
    municipality: 'Gabaldon',
    barangays: ['Calabasa', 'Ligaya'],
    isSample: true,
  },
  {
    id: 'sample-6',
    surveyNumber: 'ADs-0303-0021-Gni',
    location: 'Barangay/s of: BINAGBAG, MARUNGKO, SULUCAN, SAN ROQUE, STO CRISTO, STA LUCIA, BAYBAY, BANABAN\nMunicipality/ies of: Multiple\nProvince/s of: CAR',
    totalArea: 81564.8247,
    icc: ['DUMAGAT'],
    remarks: 'D:REGIONAL DIRECTOR ATTY. ROLAND P. CALDERON',
    region: 'CAR - Cordillera Administrative Region',
    province: 'Multiple Provinces',
    municipality: 'Multiple Municipalities',
    barangays: ['Binagbag', 'Marungko', 'Sulucan', 'San Roque', 'Sto Cristo', 'Sta Lucia', 'Baybay', 'Banaban'],
    isSample: true,
  },
];

export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login'); // 'login', 'dashboard', 'search'
  const [mappings, setMappings] = useState(SAMPLE_MAPPINGS); // Initialize with sample data
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
        // Load user's mappings from Firestore and merge with sample data
        setIsLoadingMappings(true);
        try {
          const userMappings = await getUserMappings(user.uid);
          // Combine sample data with user's actual data
          setMappings([...SAMPLE_MAPPINGS, ...userMappings]);
        } catch (error) {
          console.error('Error loading mappings:', error);
          // Keep sample data even if loading fails
          setMappings(SAMPLE_MAPPINGS);
        }
        setIsLoadingMappings(false);
      } else {
        setCurrentUser(null);
        setMappings(SAMPLE_MAPPINGS); // Keep sample data visible even when logged out
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
      setMappings(SAMPLE_MAPPINGS); // Keep sample data visible after logout
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
