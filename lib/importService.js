import { collection, writeBatch, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { registerImportCollection } from './firebaseDB.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Tuned throttling and adaptive backpressure controls to avoid
// write burst quota/backoff warnings during large imports.
// Reduce batch size and use an adaptive inter-batch delay with jitter.
const BATCH_SIZE = 10;
const INTER_BATCH_DELAY_MS = 4000;
const MAX_INTER_BATCH_DELAY = 60_000;

const commitWithRetries = async (batch, maxRetries = 5) => {
  let attempt = 0;
  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
      // return number of retry attempts performed (0 = immediate success)
      return attempt;
    } catch (err) {
      attempt += 1;
      const msg = String(err?.message || '').toLowerCase();
      console.warn(`importService: batch commit failed (attempt ${attempt}) - ${msg}`);
      // If error isn't transient, abort immediately
      const isTransient = msg.includes('resource-exhausted') || msg.includes('unavailable') || msg.includes('internal') || msg.includes('deadline-exceeded');
      if (attempt > maxRetries || !isTransient) {
        console.error('importService: commit failed and will not retry further', err?.message || err);
        throw err;
      }

      // exponential backoff with jitter (bounded)
      const base = Math.min(30_000, Math.pow(2, attempt) * 600);
      const jitter = Math.floor(Math.random() * 1000);
      const delay = Math.min(30_000, base + jitter);
      console.info(`importService: retrying batch commit in ${delay}ms (attempt ${attempt}/${maxRetries})`);
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

  // Brief pause before starting writes to avoid immediate burst after other activity
  await sleep(500);

  // Adaptive inter-batch delay that grows if we encounter repeated transient errors
  let adaptiveDelay = INTER_BATCH_DELAY_MS;

  // Write preparedDocs in batches into the target collection
  for (let i = 0; i < preparedDocs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = preparedDocs.slice(i, i + BATCH_SIZE);
    chunk.forEach((origRec) => {
      const rec = { ...origRec };
      // mark which import collection this document belongs to so UI can
      // detect records by collection name even if internal flags are missing
      if (collectionName) rec.importCollection = collectionName;
      // If caller requested forcing ongoing, ensure documents are flagged
      if (forceOngoing) {
        rec._ongoing = true;
      }
      // If the collection name indicates it's a pending import, mark the
      // documents as pending so the Pending tab filters them correctly.
      try {
        if (String(collectionName || '').toLowerCase().includes('pending')) rec._pending = true;
      } catch (e) {
        // ignore
      }
      const ref = doc(collection(db, collectionName));
      batch.set(ref, rec);
      createdMappings.push({ id: ref.id, ...rec });
    });

    // small random jitter before committing to spread traffic
    // eslint-disable-next-line no-await-in-loop
    await sleep(Math.floor(Math.random() * 300) + 100);

    // commit and learn whether we needed retries
    // eslint-disable-next-line no-await-in-loop
    const retryAttempts = await commitWithRetries(batch);

    // if we needed retries, increase delay to reduce pressure; otherwise decay toward base
    if (retryAttempts > 0) {
      adaptiveDelay = Math.min(MAX_INTER_BATCH_DELAY, adaptiveDelay * 2);
    } else {
      adaptiveDelay = Math.max(INTER_BATCH_DELAY_MS, Math.floor(adaptiveDelay / 2));
    }

    // Pause between batch commits to avoid write-stream/quota bursts.
    // Add a small random jitter to further smooth the traffic.
    // eslint-disable-next-line no-await-in-loop
    await sleep(adaptiveDelay + Math.floor(Math.random() * 1000));

    processed += chunk.length;
    onProgress(Math.min(100, Math.round((processed / totalSteps) * 100)));
  }

  // Register the import collection if it's not the main 'mappings' collection
  try {
    if (collectionName && collectionName !== 'mappings') {
      // add a lightweight `type` field so the UI can classify ongoing/pending imports
      const meta = { count: preparedDocs.length };
      try {
        const lower = String(collectionName || '').toLowerCase();
        if (lower.includes('ongoing')) meta.type = 'ongoing';
        else if (lower.includes('pending')) meta.type = 'pending';
        else meta.type = 'import';
      } catch (e) {
        meta.type = 'import';
      }
      await registerImportCollection(userId || 'unknown', collectionName, meta);
    }
  } catch (e) {
    // swallow registration errors (non-critical)
    // eslint-disable-next-line no-console
    console.warn('importService: registerImportCollection failed', e?.message || e);
  }

  return { created: createdMappings.length, collectionName, mappings: createdMappings };
};

export default { importMappings };
