"use client";

import React, { useState } from 'react';
import { ensureSeedUser } from '../../lib/firebaseAuth.js';

export default function SeedUserPage() {
  const [status, setStatus] = useState(null);
  const email = 'ncip@inventory.gov.ph';
  const password = 'admin123';

  const handleSeed = async () => {
    setStatus('Seeding...');
    try {
      const res = await ensureSeedUser({ email, password, role: 'admin', communityName: 'NCIP' });
      setStatus(JSON.stringify(res));
    } catch (err) {
      setStatus(String(err.message || err));
    }
  };

  return (
    <div className="min-h-screen flex ~items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-md p-6">
        <h1 className="text-lg font-semibold mb-4">Seed NCIP Admin User (inventory)</h1>
        <p className="text-sm mb-4">This will create an auth user and a `users` Firestore document with:</p>
        <ul className="text-sm list-disc list-inside mb-4">
          <li>Email: <strong>{email}</strong></li>
          <li>Password: <strong>{password}</strong></li>
        </ul>
        <div className="flex gap-3">
          <button onClick={handleSeed} className="px-4 py-2 bg-blue-600 text-white rounded-md">Create User</button>
          <button onClick={() => setStatus(null)} className="px-4 py-2 border rounded-md">Clear</button>
        </div>
        {status && (
          <pre className="mt-4 p-3 bg-gray-100 rounded-md text-xs overflow-auto">{String(status)}</pre>
        )}
      </div>
    </div>
  );
}
