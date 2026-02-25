#!/usr/bin/env node
/*
  Script: auto_register_import_collection.js

  Usage:
    node scripts/auto_register_import_collection.js <userUid> <collectionName>

  This script counts documents in <collectionName> and writes a numeric `count`
  and `type: 'ongoing'` into `users/<userUid>/imports/<collectionName>`.
*/

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/auto_register_import_collection.js <userUid> <collectionName>');
  process.exit(1);
}

const [userUid, collectionName] = args;
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
  console.log('Counting documents in collection:', collectionName);
  const colRef = db.collection(collectionName);
  const snapshot = await colRef.get();
  const count = snapshot.size || 0;
  if (count === 0) {
    console.warn('Collection has 0 documents — registration will still be written but the app filters by count>0');
  }

  const ref = db.collection('users').doc(userUid).collection('imports').doc(collectionName);
  await ref.set({
    collectionName,
    count: count,
    type: 'ongoing',
    readable: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('Registered import collection', collectionName, 'for user', userUid, 'count=', count);
}

main().catch((err) => {
  console.error('Failed to auto-register import collection:', err?.message || err);
  process.exit(1);
});
