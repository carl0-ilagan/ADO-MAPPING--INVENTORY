#!/usr/bin/env node
/*
  Script: register_import_collection.js

  Usage:
    1) Provide a service account JSON via the env var GOOGLE_APPLICATION_CREDENTIALS
       or place the file at ./serviceAccountKey.json
    2) Run:
       node scripts/register_import_collection.js <userUid> <collectionName> [count]

  Example:
    node scripts/register_import_collection.js Up7ZTyD8JeZQeU3tbMqWpkifwLH2 mappings_import_Up7ZTyD8JeZQeU3tbMqWpkifwLH2_2026-02-24T05-15-59-004Z 42

  This will create (or merge) a document at `users/<userUid>/imports/<collectionName>` with
  metadata that the app uses to display import collections.
*/

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/register_import_collection.js <userUid> <collectionName> [count]');
  process.exit(1);
}

const [userUid, collectionName, countArg] = args;
const count = Number(countArg) || 1;

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
  const ref = db.collection('users').doc(userUid).collection('imports').doc(collectionName);
  await ref.set({
    collectionName,
    count,
    type: 'ongoing',
    readable: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('Registered import collection', collectionName, 'for user', userUid);
}

main().catch((err) => {
  console.error('Failed to register import collection:', err?.message || err);
  process.exit(1);
});
