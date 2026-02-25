#!/usr/bin/env node
/*
  Script: tag_collection_ongoing.js

  Usage:
    1) Provide a service account JSON via the env var GOOGLE_APPLICATION_CREDENTIALS
       or place the file at ./serviceAccountKey.json
    2) Run:
       node scripts/tag_collection_ongoing.js <collectionName>

  Example:
    node scripts/tag_collection_ongoing.js mappings_import_Up7ZTyD8JeZQeU3tbMqWpkifwLH2_2026-02-24T05-15-59-004Z

  This will iterate all documents in the collection and set `_ongoing: true` and
  `importCollection: <collectionName>` for each document (merge update).
*/

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/tag_collection_ongoing.js <collectionName>');
  process.exit(1);
}

const [collectionName] = args;
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
  console.log('Tagging collection:', collectionName);
  const colRef = db.collection(collectionName);
  const snapshot = await colRef.get();
  if (snapshot.empty) {
    console.log('Collection is empty or does not exist. Nothing to tag.');
    return;
  }

  let updated = 0;
  const BATCH_SIZE = 500; // Firestore batch limit
  let batch = db.batch();
  let ops = 0;

  for (const docSnap of snapshot.docs) {
    const docRef = colRef.doc(docSnap.id);
    batch.set(docRef, { _ongoing: true, importCollection: collectionName }, { merge: true });
    ops += 1;
    if (ops >= BATCH_SIZE) {
      await batch.commit();
      updated += ops;
      console.log('Committed batch, tagged', updated, 'documents so far');
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
    updated += ops;
  }

  console.log('Tagging complete. Total documents updated:', updated);
}

main().catch((err) => {
  console.error('Failed to tag collection:', err?.message || err);
  process.exit(1);
});
