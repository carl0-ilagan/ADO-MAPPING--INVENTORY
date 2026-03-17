#!/usr/bin/env node
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'Final List of All Pending CP Applications.xlsx');
const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });

const targetSheet = wb.SheetNames.find((n) => String(n).toLowerCase().includes('summary per project'));
if (!targetSheet) {
  console.log('Summary per project sheet not found.');
  process.exit(0);
}

const rows = XLSX.utils.sheet_to_json(wb.Sheets[targetSheet], { header: 1, defval: '' });

let headerRowIndex = -1;
let totalRowIndex = -1;

for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i] || [];
  const rowText = row.map((c) => String(c || '').toLowerCase()).join(' | ');
  if (headerRowIndex === -1 && rowText.includes('government') && rowText.includes('mining') && rowText.includes('energy')) {
    headerRowIndex = i;
  }
  const first = String(row[0] || '').trim().toUpperCase();
  if (first === 'TOTAL') {
    totalRowIndex = i;
  }
}

console.log(`Sheet: ${targetSheet}`);
console.log(`Header row index: ${headerRowIndex + 1}`);
console.log(`Total row index: ${totalRowIndex + 1}`);

if (headerRowIndex >= 0) {
  const header = rows[headerRowIndex] || [];
  console.log('\nHEADERS:');
  header.forEach((h, idx) => {
    console.log(`${idx}: ${String(h || '').trim()}`);
  });
}

if (totalRowIndex >= 0) {
  const total = rows[totalRowIndex] || [];
  console.log('\nTOTAL ROW:');
  total.forEach((v, idx) => {
    console.log(`${idx}: ${String(v || '').trim()}`);
  });
}
