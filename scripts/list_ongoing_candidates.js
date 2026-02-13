/**
 * List documents in a collection that look like 'ongoing' candidates.
 * Usage: node list_ongoing_candidates.js [collectionName] [maxDocs]
 * - collectionName: Firestore collection to scan (default: mappings)
 * - maxDocs: approximate max documents to fetch (default: 5000)
 * Requires: scripts/serviceAccountKey.json (Firebase service account)
 */

const admin = require('firebase-admin');
const path = require('path');

async function main() {
  const collectionName = process.argv[2] || 'mappings';
  const maxDocs = Number(process.argv[3]) || 5000;

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

  try {
    const snap = await db.collection(collectionName).limit(maxDocs).get();
    console.log(`Scanned ${snap.size} documents`);
    const candidates = [];
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const ongoingFlag = data._ongoing === true || String(data._ongoing || '').toLowerCase() === 'true';
      const importCol = String(data.importCollection || '').toLowerCase();
      const importMarker = importCol.includes('ongoing') || importCol.includes('import');
      if (ongoingFlag || importMarker) {
        candidates.push({ id: doc.id, _ongoing: data._ongoing, importCollection: data.importCollection, region: data.region || data.regionName || '', surveyNumber: data.surveyNumber || data.survey_number || data.controlNumber || '' });
      }
    });

    console.log(`Found ${candidates.length} candidate(s) flagged as ongoing/imported.`);
    if (candidates.length > 0) {
      console.log('Sample (first 20):');
      candidates.slice(0, 20).forEach((c, i) => {
        console.log(`${i + 1}. id=${c.id}  _ongoing=${JSON.stringify(c._ongoing)}  importCollection=${c.importCollection}  region=${c.region}  survey=${c.surveyNumber}`);
      });
    } else {
      console.log('No candidate documents found in this scan.');
    }

    // If there are candidates but you still see data, show a hint about other collections
    if (candidates.length === 0) {
      console.log('\nHint: The UI may be showing data from a different collection.');
      console.log('Check `availableCollections` passed to the Dashboard or the selected collection in the UI.');
    }
  } catch (err) {
    console.error('Error scanning collection:', err);
    process.exit(1);
  }
  process.exit(0);
}

main();
