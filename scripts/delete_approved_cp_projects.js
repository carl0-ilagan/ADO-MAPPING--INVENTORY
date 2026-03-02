/**
 * Delete all CP Projects with status='Approved' from cp_projects collection.
 * Usage: node delete_approved_cp_projects.js
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

async function deleteApprovedProjects(db, batchSize = 500) {
  const collectionRef = db.collection('cp_projects');
  let totalDeleted = 0;

  while (true) {
    // Query for Approved status
    const snapshot = await collectionRef
      .where('status', '==', 'Approved')
      .limit(batchSize)
      .get();
    
    if (snapshot.empty) {
      console.log('No more Approved documents to delete.');
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      console.log(`   Deleting: ${doc.id} - ${doc.data().proponent || 'N/A'}`);
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    totalDeleted += snapshot.docs.length;
    console.log(`✅ Deleted ${snapshot.docs.length} documents (total ${totalDeleted}).`);

    // Small delay to avoid hitting rate limits
    await sleep(250);
  }

  console.log(`\n🎉 Finished! Total Approved records deleted: ${totalDeleted}`);
}

async function main() {
  const keyPath = path.join(__dirname, 'serviceAccountKey.json');
  let serviceAccount;
  
  try {
    serviceAccount = require(keyPath);
  } catch (e) {
    console.error('❌ Cannot load service account at scripts/serviceAccountKey.json.');
    console.error('Create a service account key in GCP and save it to that path.');
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  try {
    console.log('🗑️  Deleting all CP Projects with status=\'Approved\'...\n');
    await deleteApprovedProjects(db, 500);
    console.log('Done.');
  } catch (err) {
    console.error('❌ Error deleting approved projects:', err);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
