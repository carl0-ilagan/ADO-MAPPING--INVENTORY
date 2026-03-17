#!/usr/bin/env node
/**
 * Import ongoing CPs from Excel to Firestore
 */
import * as XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import * as fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (getApps().length === 0) initializeApp(firebaseConfig);
const db = getFirestore();

const sanitize = (v) => {
  if (!v) return '';
  const s = String(v).trim();
  return s.length > 5000 ? s.substring(0, 5000) : s;
};

const toRegion = (r) => {
  const v = String(r || '').toUpperCase();
  if (v === 'CAR' || v.includes('CORDILLERA')) return 'CAR';
  return r;
};

async function importData() {
  console.log('Starting import...');
  const file = path.join(__dirname, '..', 'APPROVED CPs  (Large Scale)_Project cost.xlsx');
  const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  
  const sheets = ['CAR', 'R1', 'R2', 'R3', 'R4A', 'R4B', 'R5', 'R6-7', 'R9', 'R10', 'R11', 'R12', 'R13'];
  let count = 0;

  for (const sheetName of sheets) {
    if (!wb.Sheets[sheetName]) continue;
    console.log(`Processing ${sheetName}...`);
    
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
    const headers = rows[0] || [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      if (!row.some(c => String(c || '').trim())) continue;
      
      const rec = {
        _ongoing: true,
        importCollection: 'approved_cps_ongoing',
        sourceFile: 'APPROVED CPs  (Large Scale)_Project cost.xlsx',
        sheetName,
        region: toRegion(sheetName),
      };
      
      for (let j = 0; j < headers.length; j++) {
        const h = String(headers[j] || '').toLowerCase().trim();
        const v = sanitize(row[j]);
        if (!v) continue;
        
        if (h.includes('proponent')) rec.proponent = v;
        else if (h.includes('project') && h.includes('name')) rec.nameOfProject = v;
        else if (h.includes('type') && h.includes('project')) rec.typeOfProject = v;
        else if (h.includes('location')) rec.location = v;
        else if (h.includes('area') || h.includes('hectare')) rec.area = v;
        else if (h.includes('ancestral') || h.includes('domain')) rec.ancestral = v;
        else if (h.includes('icc') || h.includes('ips')) rec.iccs = v;
        else if (h.includes('remarks')) rec.remarks = v;
      }
      
      if (rec.proponent || rec.nameOfProject) {
        try {
          await addDoc(collection(db, 'approved_cps_ongoing'), rec);
          count++;
          if (count % 50 === 0) console.log(`  Imported ${count} records...`);
        } catch (err) {
          console.error(`  Error on row ${i}: ${err.message}`);
        }
      }
    }
  }
  
  console.log(`✅ Successfully imported ${count} records!`);
}

importData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
