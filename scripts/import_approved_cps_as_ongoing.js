#!/usr/bin/env node
/**
 * Script to import APPROVED CPs (Large Scale)_Project cost.xlsx into ongoing collection
 * Extracts data from regional sheets (CAR, R1-R13)
 * Usage: node scripts/import_approved_cps_as_ongoing.js
 */

import * as XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFirestore, collection, doc, writeBatch } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

// Helper functions
const normalizeHeader = (value) =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const parseValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  return String(value).trim();
};

const canonicalRegion = (regionValue) => {
  const raw = String(regionValue || '').trim();
  if (!raw) return '';
  const v = raw.toUpperCase();
  if (v.includes('CORDILLERA') || v === 'CAR') return 'CAR';
  return raw;
};

// Map header to field name
const mapHeaderToField = (h) => {
  const n = normalizeHeader(h);
  if (!n) return null;
  if (n.includes('proponent')) return 'proponent';
  if (n.includes('project') && n.includes('name')) return 'nameOfProject';
  if (n.includes('type') && n.includes('project')) return 'typeOfProject';
  if (n.includes('location')) return 'location';
  if (n.includes('area') || n.includes('hectare')) return 'area';
  if (n.includes('ancestral') || n.includes('domain')) return 'ancestral';
  if (n.includes('icc') || n.includes('ips')) return 'iccs';
  if (n.includes('remarks')) return 'remarks';
  if (n.includes('region')) return 'region';
  return sanitizeFieldName(h);
};

const sanitizeFieldName = (s) =>
  String(s || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .toLowerCase();

// Sanitize values for Firestore (ensure all values are strings or numbers)
const sanitizeValue = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (str === '') return '';
  // Limit field size to avoid Firestore limits
  if (str.length > 5000) return str.substring(0, 5000);
  return str;
};

// Main import function
async function importOngoingCPs() {
  try {
    console.log('📁 Starting import of APPROVED CPs (Large Scale)_Project cost.xlsx...');
    
    // Read Excel file
    const filePath = path.join(__dirname, '..', 'APPROVED CPs  (Large Scale)_Project cost.xlsx');
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    
    console.log(`📖 Reading file: ${filePath}`);
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;
    
    console.log(`📄 Found ${sheetNames.length} sheet(s)`);
    
    // Process regional sheets only
    const regionalSheets = ['CAR', 'R1', 'R2', 'R3', 'R4A', 'R4B', 'R5', 'R6-7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13'];
    const allRecords = [];
    
    for (const sheetName of regionalSheets) {
      if (!workbook.Sheets[sheetName]) {
        console.log(`⏭️  Skipping "${sheetName}"`);
        continue;
      }
      
      console.log(`\n📊 Processing sheet "${sheetName}"...`);
      const worksheet = workbook.Sheets[sheetName];
      const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (!Array.isArray(allRows) || allRows.length < 2) {
        console.log(`   ⏭️  No data`);
        continue;
      }
      
      const headerRow = allRows[0] || [];
      const headerMap = headerRow.map(mapHeaderToField);
      const dataRows = allRows.slice(1);
      let sheetRecords = 0;
      
      for (const row of dataRows) {
        if (!row.some((cell) => String(cell || '').trim())) continue;
        
        const record = {
          _ongoing: true,
          importCollection: 'approved_cps_ongoing',
          sourceFile: 'APPROVED CPs  (Large Scale)_Project cost.xlsx',
          sheetName,
          region: canonicalRegion(sheetName),
        };
        
        for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
          const fieldName = headerMap[colIdx];
          const rawValue = row[colIdx];
          const value = sanitizeValue(rawValue);
          if (fieldName && value) record[fieldName] = value;
        }
        
        if (record.proponent || record.nameOfProject) {
          allRecords.push(record);
          sheetRecords++;
        }
      }
      
      console.log(`   ✓ ${sheetRecords} records`);
    }
    
    console.log(`\n✅ Total: ${allRecords.length} records`);
    
    if (allRecords.length === 0) {
      console.warn('⚠️  No records to import');
      return;
    }
    
    // Import to Firestore
    console.log('\n💾 Importing to Firestore...');
    const collectionRef = collection(db, 'approved_cps_ongoing');
    const BATCH_SIZE = 50;
    let imported = 0;
    
    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = allRecords.slice(i, i + BATCH_SIZE);
      
      chunk.forEach((record) => {
        batch.set(doc(collectionRef), record);
      });
      
      await batch.commit();
      imported += chunk.length;
      console.log(`   ✓ ${imported}/${allRecords.length} records`);
    }
    
    console.log(`\n✅ Success! Imported ${imported} records`);
    console.log('\n📌 Next steps:');
    console.log('   1. Refresh the dashboard');
    console.log('   2. Go to "Ongoing" tab');
    console.log('   3. Select "approved_cps_ongoing" collection');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

importOngoingCPs().then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
}).catch(() => process.exit(1));
