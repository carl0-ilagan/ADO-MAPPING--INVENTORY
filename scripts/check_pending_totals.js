#!/usr/bin/env node
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const filePath = path.join(process.cwd(), 'Final List of All Pending CP Applications.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer' });

const results = [];

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const first = String(row[0] || '').trim().toUpperCase();
    if (first === 'TOTAL' || first === 'TOTALS') {
      const numericLike = row
        .slice(1)
        .map((v) => String(v || '').trim())
        .filter((v) => v !== '');

      results.push({
        sheetName,
        rowIndex: i + 1,
        values: numericLike,
      });
    }
  }
}

if (results.length === 0) {
  console.log('No TOTAL row found in any sheet.');
  process.exit(0);
}

for (const r of results) {
  console.log(`SHEET: ${r.sheetName} | ROW: ${r.rowIndex}`);
  console.log(`TOTAL\t${r.values.join('\t')}`);
  console.log('---');
}
