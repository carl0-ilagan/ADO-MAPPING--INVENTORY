#!/usr/bin/env node
/*
  Script: fix_proponent_from_raw.js

  Purpose:
    Copy a proponent/applicant/project value from `raw_fields` into a top-level
    `proponent` field so the app search (which looks at top-level `proponent`)
    can find the document without re-importing.

  Usage:
    Set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON or place
    `serviceAccountKey.json` in the repo root, then run:

      node scripts/fix_proponent_from_raw.js <collectionName> <rawKeyOrSubstring> [--exact] [--force]

  Examples:
    node scripts/fix_proponent_from_raw.js mappings_import_Up7ZTyD8JeZQeU3tbMqWpkifwLH2_2026-02-24T05-15-59-004Z "proponent"
    node scripts/fix_proponent_from_raw.js mappings "Green Indiegous" --force

  Options:
    --exact    Match raw_fields key exactly instead of substring match
    --force    Overwrite existing top-level `proponent` values

*/

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/fix_proponent_from_raw.js <collectionName> <rawKeyOrSubstring> [--exact] [--force]');
  process.exit(1);
}

const collectionName = args[0];
const rawKey = args[1];
const exact = args.includes('--exact');
const force = args.includes('--force');

const svcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(svcPath)) {
  console.error('Service account JSON not found at', svcPath);
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json in project root.');
  process.exit(1);
}

const serviceAccount = require(svcPath);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  console.log('Scanning collection', collectionName, 'for raw field matching:', rawKey, '(exact=', exact, 'force=', force, ')');
  const col = db.collection(collectionName);
  const snapshot = await col.get();
  if (snapshot.empty) {
    console.log('No documents found in collection', collectionName);
    return;
  }

  let updated = 0;
  let skipped = 0;
  const ops = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const raw = data.raw_fields || {};
    if (!raw || Object.keys(raw).length === 0) {
      skipped++;
      continue;
    }

    // If top-level proponent exists and not forcing, skip
    if (!force && (data.proponent || data.applicant || data.applicantProponent || data.projectName || data.nameOfProject)) {
      skipped++;
      continue;
    }

    // Find key
    let foundKey = null;
    if (exact) {
      if (raw.hasOwnProperty(rawKey)) foundKey = rawKey;
    } else {
      const target = String(rawKey).toLowerCase();
      for (const k of Object.keys(raw)) {
        if (String(k).toLowerCase().includes(target)) {
          foundKey = k;
          break;
        }
      }
    }

    if (!foundKey) {
      skipped++;
      continue;
    }

    const val = raw[foundKey];
    if (!val || String(val).trim() === '') {
      skipped++;
      continue;
    }

    // Prepare update: set `proponent` top-level
    ops.push({ ref: doc.ref, data: { proponent: String(val).trim(), updatedAt: admin.firestore.FieldValue.serverTimestamp() } });
    updated++;
  }

  // Commit updates in batches of 500
  while (ops.length) {
    const batch = db.batch();
    const chunk = ops.splice(0, 500);
    for (const op of chunk) batch.update(op.ref, op.data);
    await batch.commit();
  }

  console.log('Done. Updated:', updated, 'Skipped:', skipped, 'Total scanned:', snapshot.size);
}

main().catch((err) => {
  console.error('Error:', err?.message || err);
  process.exit(1);
});
