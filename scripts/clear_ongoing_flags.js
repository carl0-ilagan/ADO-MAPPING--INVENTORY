#!/usr/bin/env node
/*
  Safe helper to clear `_ongoing` and `importCollection` flags from documents.

  Usage:
    1. Place your Firebase service account JSON at scripts/serviceAccountKey.json
    2. Install dependency: npm install firebase-admin
    3. Run: node scripts/clear_ongoing_flags.js

  The script will:
    - Ask which collection to inspect (default: mappings)
    - List documents where `_ongoing === true` OR `importCollection` contains 'ongoing'
    - Show a sample (first 20) and total count
    - Ask for confirmation before clearing the flags
    - Update documents in batches using FieldValue.delete()
*/

const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (ans) => { rl.close(); res(ans); }));
}

async function main() {
  const admin = require('firebase-admin');

  const keyPath = path.join(__dirname, 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    console.error('serviceAccountKey.json not found in scripts/. Place your service account key there and re-run.');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(require(keyPath)),
  });

  const db = admin.firestore();

  const colNameInput = (await prompt('Collection to inspect (default: mappings): ')).trim();
  const collectionName = colNameInput || 'mappings';

  console.log(`Fetching documents from collection: ${collectionName} (this may be slow for large collections)...`);

  const colRef = db.collection(collectionName);
  const snapshot = await colRef.get();
  console.log(`Total documents in ${collectionName}: ${snapshot.size}`);

  const matches = [];
  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const importCol = data.importCollection || data.import_collection || '';
    if (data._ongoing === true) {
      matches.push({ id: doc.id, reason: '_ongoing', preview: { surveyNumber: data.surveyNumber || data.survey_number || '', region: data.region || '', importCollection: importCol } });
      return;
    }
    if (importCol && String(importCol).toLowerCase().includes('ongoing')) {
      matches.push({ id: doc.id, reason: 'importCollection', preview: { surveyNumber: data.surveyNumber || data.survey_number || '', region: data.region || '', importCollection: importCol } });
      return;
    }
  });

  console.log(`Found ${matches.length} candidate document(s) flagged as ongoing.`);
  if (matches.length === 0) {
    console.log('No candidate ongoing documents found. Exiting.');
    process.exit(0);
  }

  console.log('Sample documents (first 20):');
  matches.slice(0, 20).forEach((m, i) => {
    console.log(`${i + 1}. id=${m.id} reason=${m.reason} survey=${m.preview.surveyNumber} region=${m.preview.region} importCollection=${m.preview.importCollection}`);
  });

  const confirm = (await prompt(`Clear flags on these ${matches.length} document(s) in collection '${collectionName}'? Type 'yes' to confirm: `)).trim();
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Aborted by user. No changes made.');
    process.exit(0);
  }

  // Update in batches
  const BATCH_SIZE = 400;
  let processed = 0;
  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = matches.slice(i, i + BATCH_SIZE);
    slice.forEach((m) => {
      const ref = db.collection(collectionName).doc(m.id);
      batch.update(ref, {
        _ongoing: admin.firestore.FieldValue.delete(),
        importCollection: admin.firestore.FieldValue.delete(),
      });
    });
    await batch.commit();
    processed += slice.length;
    console.log(`Cleared flags on ${processed}/${matches.length} documents...`);
  }

  console.log(`Done. Cleared flags on ${processed} documents in ${collectionName}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
