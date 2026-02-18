#!/usr/bin/env node
/*
  Scan a Firestore collection for documents that the UI would consider "ongoing".

  Checks:
    - `_ongoing === true`
    - `importCollection` or `import_collection` contains 'ongoing'
    - Any field name containing 'status' whose value matches common ongoing keywords

  Usage:
    1. Place your Firebase service account JSON at scripts/serviceAccountKey.json
    2. Install dependency: npm install firebase-admin
    3. Run: node scripts/find_ongoing_by_status.js [collectionName] [maxDocs]

  Example:
    node scripts/find_ongoing_by_status.js mappings 10000

  Output: a summary and a sample (first 50) of matching documents.
*/

const admin = require('firebase-admin');
const path = require('path');

async function main() {
  const collectionName = process.argv[2] || 'mappings';
  const maxDocs = Number(process.argv[3]) || 20000;

  const keyPath = path.join(__dirname, 'serviceAccountKey.json');
  try {
    const serviceAccount = require(keyPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    console.error('Failed to load service account key at scripts/serviceAccountKey.json');
    console.error('Place your Firebase service account JSON at that path and try again.');
    process.exit(1);
  }

  const db = admin.firestore();
  console.log(`Scanning collection: ${collectionName} (max ${maxDocs} docs)`);

  const snapshot = await db.collection(collectionName).limit(maxDocs).get();
  console.log(`Read ${snapshot.size} documents from ${collectionName}`);

  const keywords = ['on process', 'for processing', 'processing', 'on-process', 'ongoing', 'in process'];
  const kwc = keywords.map((k) => k.toLowerCase());

  const matches = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};

    const importCol = (data.importCollection || data.import_collection || '') || '';
    const importMatch = String(importCol).toLowerCase().includes('ongoing');

    const ongoingFlag = data._ongoing === true || String(data._ongoing || '').toLowerCase() === 'true';

    // Check any status-like field
    let statusMatch = false;
    for (const k of Object.keys(data || {})) {
      try {
        if (!k.toLowerCase().includes('status')) continue;
        const val = String(data[k] || '').toLowerCase();
        if (!val) continue;
        for (const kw of kwc) {
          if (val.includes(kw)) {
            statusMatch = true;
            break;
          }
        }
        if (statusMatch) break;
      } catch (e) {
        // ignore
      }
    }

    if (ongoingFlag || importMatch || statusMatch) {
      matches.push({ id: doc.id, reason: { ongoingFlag, importMatch, statusMatch }, preview: { region: data.region || data.regionName || '', survey: data.surveyNumber || data.survey_number || data.controlNumber || '', cadtStatus: data.cadtStatus || data.cadt_status || '' } });
    }
  });

  console.log(`Found ${matches.length} matching document(s).
  Breakdown sample: `);
  const sample = matches.slice(0, 50);
  sample.forEach((m, i) => {
    console.log(`${i + 1}. id=${m.id} reason=${JSON.stringify(m.reason)} region=${m.preview.region} survey=${m.preview.survey} cadtStatus=${m.preview.cadtStatus}`);
  });

  if (matches.length === 0) {
    console.log('\nNo matches found.\nHint: the Dashboard also treats documents as ongoing when their CA/DT status contains keywords (e.g. "processing").');
  } else {
    console.log(`\nTotal matches: ${matches.length}.`);
    console.log('If you want to clear `_ongoing` or `importCollection` flags, use scripts/clear_ongoing_flags.js.');
    console.log('If you want to delete matched documents, use scripts/delete_ongoing.js (careful: irreversible).');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error scanning collection:', err);
  process.exit(1);
});
