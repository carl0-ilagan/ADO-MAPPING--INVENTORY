/**
 * Delete all documents in a Firestore collection in batches.
 * Usage: node delete_collection.js <collectionName> [batchSize]
 * Example: node delete_collection.js mappings_import_ABC 500
 *
 * Requirements:
 * - Place a Firebase service account JSON at: scripts/serviceAccountKey.json
 * - npm install firebase-admin
 */

const admin = require('firebase-admin');
const path = require('path');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function deleteCollection(db, collectionPath, batchSize = 500) {
  const collectionRef = db.collection(collectionPath);
  let totalDeleted = 0;

  while (true) {
    const snapshot = await collectionRef.orderBy('__name__').limit(batchSize).get();
    if (snapshot.empty) {
      console.log('No more documents to delete.');
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snapshot.docs.length;
    console.log(`Deleted ${snapshot.docs.length} documents (total ${totalDeleted}).`);

    // Small delay to avoid hitting rate limits
    await sleep(250);
  }

  console.log(`Finished deleting documents from ${collectionPath}. Total deleted: ${totalDeleted}`);
}

async function main() {
  const collectionName = process.argv[2];
  const batchSizeArg = process.argv[3];
  if (!collectionName) {
    console.error('Usage: node delete_collection.js <collectionName> [batchSize]');
    process.exit(1);
  }

  const keyPath = path.join(__dirname, 'serviceAccountKey.json');
  let serviceAccount;
  try {
    serviceAccount = require(keyPath);
  } catch (e) {
    console.error('Cannot load service account at scripts/serviceAccountKey.json.');
    console.error('Create a service account key in GCP and save it to that path.');
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const batchSize = Number(batchSizeArg) || 500;

  try {
    console.log(`Deleting collection: ${collectionName} with batch size ${batchSize}`);
    await deleteCollection(db, collectionName, batchSize);
    console.log('Done.');
  } catch (err) {
    console.error('Error deleting collection:', err);
    process.exit(1);
  }
  process.exit(0);
}

main();
