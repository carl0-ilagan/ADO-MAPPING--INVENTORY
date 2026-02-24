import { collection, writeBatch, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { registerImportCollection } from './firebaseDB.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Aggressive throttling to avoid write burst quota errors during large imports
const BATCH_SIZE = 50;
const INTER_BATCH_DELAY_MS = 2000;

const commitWithRetries = async (batch, maxRetries = 10) => {
  let attempt = 0;
  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
      return;
    } catch (err) {
      attempt += 1;
      const msg = String(err?.message || '').toLowerCase();
      console.warn(`importService: batch commit failed (attempt ${attempt}) - ${msg}`);
      if (attempt > maxRetries || (!msg.includes('resource-exhausted') && !msg.includes('unavailable') && !msg.includes('internal'))) {
        console.error('importService: commit failed and will not retry further', err?.message || err);
        throw err;
      }
      // exponential backoff with jitter
      const delay = Math.min(30_000, Math.pow(2, attempt) * 500 + Math.floor(Math.random() * 500));
      console.info(`importService: retrying batch commit in ${delay}ms`);
      // eslint-disable-next-line no-await-in-loop
      await sleep(delay);
    }
  }
};

export const importMappings = async ({ preparedDocs = [], rawRecords = [], mode = 'add', collectionName = 'mappings', userId = null, idsToDelete = [], onProgress = () => {}, forceOngoing = false }) => {
  if (!Array.isArray(preparedDocs) || preparedDocs.length === 0) {
    return { created: 0, collectionName, mappings: [] };
  }

  const totalSteps = Math.max(1, idsToDelete.length + preparedDocs.length);
  let processed = 0;
  const createdMappings = [];

  // Batched deletes for replace mode (if ids provided)
  if (mode === 'replace' && Array.isArray(idsToDelete) && idsToDelete.length > 0) {
    for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
      chunk.forEach((id) => {
        const ref = doc(db, 'mappings', id);
        batch.delete(ref);
      });
      // eslint-disable-next-line no-await-in-loop
      await commitWithRetries(batch);
      processed += chunk.length;
      onProgress(Math.min(100, Math.round((processed / totalSteps) * 100)));
    }
  }

  // Write preparedDocs in batches into the target collection
  for (let i = 0; i < preparedDocs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = preparedDocs.slice(i, i + BATCH_SIZE);
    chunk.forEach((origRec) => {
      const rec = { ...origRec };
      // If caller requested forcing ongoing, ensure documents are flagged
      // so the UI treats them as ongoing regardless of original content.
      if (forceOngoing) {
        rec._ongoing = true;
      }
      const ref = doc(collection(db, collectionName));
      // write record (now possibly augmented with _ongoing)
      batch.set(ref, rec);
      createdMappings.push({ id: ref.id, ...rec });
    });
    // eslint-disable-next-line no-await-in-loop
    await commitWithRetries(batch);
    // Small pause between batch commits to avoid write-stream/quota bursts
    // (Firestore tolerates slower steady writes better than large bursts)
    // eslint-disable-next-line no-await-in-loop
    await sleep(INTER_BATCH_DELAY_MS);
    processed += chunk.length;
    onProgress(Math.min(100, Math.round((processed / totalSteps) * 100)));
  }

  // Register the import collection if it's not the main 'mappings' collection
  try {
    if (collectionName && collectionName !== 'mappings') {
      await registerImportCollection(userId || 'unknown', collectionName, { count: preparedDocs.length });
    }
  } catch (e) {
    // swallow registration errors (non-critical)
    // eslint-disable-next-line no-console
    console.warn('importService: registerImportCollection failed', e?.message || e);
  }

  return { created: createdMappings.length, collectionName, mappings: createdMappings };
};

export default { importMappings };
