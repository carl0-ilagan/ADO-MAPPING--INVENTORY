"use client";

import React from 'react';
import { Dashboard } from './Dashboard';

// CP Dashboard wrapper — force NCIP inventory user context so the Dashboard
// renders the NCIP-specific layout and columns without duplicating code.
export default function CPDashboard(props) {
  const forcedUser = { ...(props.user || {}), email: 'ncip@inventory.gov.ph' };
  return <Dashboard {...props} user={forcedUser} />;
}
