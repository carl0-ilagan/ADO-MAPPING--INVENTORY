import { collection, writeBatch, doc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { 
  mapExcelHeadersToCPFields, 
  buildCPProjectDocument, 
  validateCPProject,
  detectRegionFromSheetName
} from './cpProjectsSchema.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Batch configuration to avoid Firestore rate limits
// Keep writes slow: ~0.5 docs/sec to stay well under free-tier quota
const BATCH_SIZE = 200; // safe batch size to avoid quota exhaustion
const INTER_BATCH_DELAY_MS = 2000; // 2 s between batches → ~100 writes/s

/**
 * Commit a batch with automatic retries on transient errors
 */
const commitWithRetries = async (batch, maxRetries = 5) => {
  let attempt = 0;
  while (true) {
    try {
      await batch.commit();
      return attempt;
    } catch (err) {
      attempt += 1;
      const msg = String(err?.message || '').toLowerCase();
      console.warn(`Batch commit failed (attempt ${attempt}) - ${msg}`);
      
      const isTransient = msg.includes('resource-exhausted') || 
                         msg.includes('unavailable') || 
                         msg.includes('internal') || 
                         msg.includes('deadline-exceeded');
      
      if (attempt > maxRetries || !isTransient) {
        console.error('Commit failed and will not retry further', err?.message || err);
        throw err;
      }

      // resource-exhausted = quota hit — wait much longer before retrying
      const isQuota = msg.includes('resource-exhausted');
      const base = isQuota
        ? Math.min(120_000, Math.pow(2, attempt) * 15_000)  // 30s, 60s, 120s…
        : Math.min(30_000, Math.pow(2, attempt) * 600);
      const jitter = Math.floor(Math.random() * 2000);
      const delay = Math.min(120_000, base + jitter);
      console.info(`Retrying batch commit in ${delay}ms (attempt ${attempt}/${maxRetries})`);
      await sleep(delay);
    }
  }
};

/**
 * Import CP projects from Excel data
 * 
 * @param {Object} options
 * @param {Array} options.excelSheets - Array of { sheetName, headers, rows }
 * @param {string} options.mode - 'add' or 'replace'
 * @param {function} options.onProgress - Progress callback (0-100)
 * @param {string} options.batchId - Optional batch identifier
 * @param {string} options.defaultStatus - Default status for records without explicit status ('Pending', 'Ongoing', 'Approved')
 * @returns {Object} { created, invalid, errors }
 */
export const importCPProjects = async ({ 
  excelSheets = [], 
  mode = 'add', 
  onProgress = () => {}, 
  batchId = null,
  defaultStatus = 'Ongoing'
}) => {
  console.log('🚀 Starting cp_projects import...');
  console.log(`   Mode: ${mode}`);
  console.log(`   Sheets: ${excelSheets.length}`);
  console.log(`   Default Status: ${defaultStatus}`);
  
  const results = {
    created: 0,
    invalid: 0,
    errors: [],
    projects: []
  };

  // If replace mode, clear only records with the matching status (not all statuses)
  if (mode === 'replace') {
    console.log(`⚠️  Replace mode: Deleting existing '${defaultStatus}' projects...`);
    try {
      await deleteProjectsByStatus(defaultStatus);
    } catch (error) {
      console.error('Failed to delete existing projects:', error);
      results.errors.push({ error: 'Failed to clear existing data', message: error.message });
      return results;
    }
  }

  const allDocuments = [];
  const invalidRecords = [];

  // For pending workbook imports, read the Summary sheet totals so we can
  // enforce per-region row-number caps and avoid importing appendix blocks.
  const extractPendingRegionCaps = (sheets = []) => {
    try {
      const summarySheet = (sheets || []).find((s) => String(s?.sheetName || '').toLowerCase() === 'summary');
      if (!summarySheet || !Array.isArray(summarySheet.rows) || !Array.isArray(summarySheet.headers)) return null;

      const normalize = (v) => String(v || '').trim().toUpperCase();
      const allRows = [summarySheet.headers, ...(summarySheet.rows || [])];
      const headerRowIndex = allRows.findIndex((r) => normalize(r && r[0]) === 'YEAR APPLIED');
      if (headerRowIndex === -1) return null;

      const headers = (allRows[headerRowIndex] || []).map((h) => normalize(h));
      const totalRow = allRows.slice(headerRowIndex + 1).find((r) => normalize(r && r[0]) === 'TOTAL');
      if (!Array.isArray(totalRow)) return null;

      const labelToRegion = {
        CAR: 'CAR',
        I: '1',
        II: '2',
        III: '3',
        IVA: '4A',
        IVB: '4B',
        V: '5',
        'VI/VII': '6&7',
        VIII: '8',
        IX: '9',
        X: '10',
        XI: '11',
        XII: '12',
        XIII: '13',
      };

      const caps = {};
      headers.forEach((h, idx) => {
        if (!Object.prototype.hasOwnProperty.call(labelToRegion, h)) return;
        const n = Number(String(totalRow[idx] || '').replace(/,/g, '').trim());
        if (Number.isFinite(n) && n > 0) {
          caps[labelToRegion[h]] = n;
        }
      });

      return Object.keys(caps).length > 0 ? caps : null;
    } catch (err) {
      console.warn('Failed to parse pending summary caps:', err?.message || err);
      return null;
    }
  };

  const pendingRegionCaps = String(defaultStatus || '').toLowerCase() === 'pending'
    ? extractPendingRegionCaps(excelSheets)
    : null;
  
  // Known canonical region values produced by detectRegionFromSheetName for valid region sheets
  const VALID_REGION_VALUES = new Set(['CAR', '1', '2', '3', '4A', '4B', '5', '6&7', '6', '7', '8', '9', '10', '11', '12', '13']);

  // Process each sheet
  for (const sheet of excelSheets) {
    const { sheetName, headers, rows } = sheet;
    console.log(`\n📄 Processing sheet: ${sheetName} (${rows.length} rows)`);

    // Only process sheets that correspond to actual regions (CAR, R1, R2, ..., R13, R6-7, R4A, etc.)
    // Sheets like "Summary", "ExtractiveMining Companies", "Copy of ExtractiveMining Compan",
    // "Summary Per Year" must be skipped — they have valid-looking rows but are NOT per-region data.
    const detectedForFilter = detectRegionFromSheetName(sheetName);
    if (!VALID_REGION_VALUES.has(detectedForFilter)) {
      console.warn(`   ⏭️  Sheet "${sheetName}" is not a recognized region sheet (detected: "${detectedForFilter}") — skipping.`);
      continue;
    }

    // Map headers to field names
    const fieldMap = mapExcelHeadersToCPFields(headers);
    console.log('   Field mappings:', fieldMap);
    
    if (Object.keys(fieldMap).length === 0) {
      console.warn(`   ⚠️  No field mappings found for sheet ${sheetName}, skipping...`);
      invalidRecords.push({
        sheet: sheetName,
        error: 'No field mappings found',
        headers
      });
      continue;
    }

    const capForSheet = (pendingRegionCaps && Number.isFinite(pendingRegionCaps[detectedForFilter]))
      ? pendingRegionCaps[detectedForFilter]
      : null;
    let acceptedForSheet = 0;

    // Build documents from rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        const projectDoc = buildCPProjectDocument(row, fieldMap, sheetName, defaultStatus);

        if (!projectDoc.worksheet_no) {
          const fallbackNo = String((Array.isArray(row) ? row[0] : '') || '').trim();
          if (fallbackNo) projectDoc.worksheet_no = fallbackNo;
        }

        // Pending workbook safeguard:
        // Keep only numbered rows within Summary totals per region.
        if (pendingRegionCaps && Object.keys(pendingRegionCaps).length > 0) {
          if (Number.isFinite(capForSheet)) {
            if (acceptedForSheet >= capForSheet) {
              continue;
            }
            const noRaw = String(projectDoc.worksheet_no || row[fieldMap.worksheet_no] || (Array.isArray(row) ? row[0] : '') || '').trim();
            const noNum = Number(noRaw);
            if (!Number.isFinite(noNum) || noNum <= 0) {
              results.invalid++;
              continue;
            }
          }
        }
        
        // Add batch ID if provided
        if (batchId) {
          projectDoc.import_batch_id = batchId;
          projectDoc.imported_at = new Date();
        }
        
        // Validate document
        const validation = validateCPProject(projectDoc);

        const isPendingCapMode = Number.isFinite(capForSheet);
        const noMeaningfulDataOnly =
          Array.isArray(validation.errors) &&
          validation.errors.length === 1 &&
          String(validation.errors[0] || '').toLowerCase().includes('no meaningful data');
        
        if (validation.isValid) {
          allDocuments.push(projectDoc);
          if (Number.isFinite(capForSheet)) acceptedForSheet += 1;
        } else if (isPendingCapMode && noMeaningfulDataOnly) {
          // When importing from the pending workbook, a few valid numbered rows
          // are summary-counted even if text cells are sparse/blank. Keep them.
          allDocuments.push(projectDoc);
          acceptedForSheet += 1;
        } else {
          invalidRecords.push({
            sheet: sheetName,
            row: i + 2, // +2 for Excel row (header + 0-index)
            errors: validation.errors,
            data: projectDoc
          });
          results.invalid++;
        }
      } catch (error) {
        console.error(`   Error processing row ${i + 2}:`, error);
        invalidRecords.push({
          sheet: sheetName,
          row: i + 2,
          error: error.message,
          data: row
        });
        results.invalid++;
      }
    }
  }

  console.log(`\n✅ Prepared ${allDocuments.length} valid documents`);
  console.log(`❌ Found ${invalidRecords.length} invalid records`);
  
  if (invalidRecords.length > 0) {
    results.errors = invalidRecords;
  }

  // Import documents in batches
  if (allDocuments.length > 0) {
    console.log(`\n📝 Writing ${allDocuments.length} documents to Firestore...`);
    
    const totalSteps = allDocuments.length;
    let processed = 0;

    for (let i = 0; i < allDocuments.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = allDocuments.slice(i, i + BATCH_SIZE);
      
      chunk.forEach((projectDoc) => {
        const ref = doc(collection(db, 'cp_projects'));
        batch.set(ref, projectDoc);
        results.projects.push({ id: ref.id, ...projectDoc });
      });

      await commitWithRetries(batch);
      
      processed += chunk.length;
      results.created += chunk.length;
      
      const progress = Math.min(100, Math.round((processed / totalSteps) * 100));
      onProgress(progress);
      
      console.log(`   Progress: ${processed}/${totalSteps} (${progress}%)`);
      
      // Always delay between batches to stay under quota
      if (i + BATCH_SIZE < allDocuments.length) {
        await sleep(INTER_BATCH_DELAY_MS);
      }
    }
  }

  onProgress(100);
  console.log(`\n🎉 Import complete!`);
  console.log(`   Created: ${results.created}`);
  console.log(`   Invalid: ${results.invalid}`);
  
  return results;
};

/**
 * Delete all CP projects (use with caution!)
 */
export const deleteAllCPProjects = async () => {
  console.log('🗑️  Deleting all cp_projects documents...');
  
  const projectsRef = collection(db, 'cp_projects');
  const snapshot = await getDocs(projectsRef);
  
  console.log(`   Found ${snapshot.size} documents to delete`);
  
  const batches = [];
  let currentBatch = writeBatch(db);
  let operationCount = 0;
  
  snapshot.docs.forEach((document) => {
    currentBatch.delete(document.ref);
    operationCount++;
    
    if (operationCount === 500) { // Firestore batch limit
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      operationCount = 0;
    }
  });
  
  if (operationCount > 0) {
    batches.push(currentBatch);
  }
  
  console.log(`   Committing ${batches.length} batch(es)...`);
  
  for (let i = 0; i < batches.length; i++) {
    await commitWithRetries(batches[i]);
    console.log(`   Batch ${i + 1}/${batches.length} complete`);
    if (i < batches.length - 1) {
      await sleep(1000);
    }
  }
  
  console.log('   ✅ All documents deleted');
};

/**
 * Delete all CP projects with a specific status (Ongoing / Pending / Approved)
 */
export const deleteProjectsByStatus = async (status) => {
  if (!status) throw new Error('deleteProjectsByStatus: status is required');
  console.log(`🗑️  Deleting all cp_projects with status='${status}'...`);

  const projectsRef = collection(db, 'cp_projects');
  const q = query(projectsRef, where('status', '==', status));
  const snapshot = await getDocs(q);

  console.log(`   Found ${snapshot.size} documents with status='${status}'`);

  const batches = [];
  let currentBatch = writeBatch(db);
  let operationCount = 0;

  snapshot.docs.forEach((document) => {
    currentBatch.delete(document.ref);
    operationCount++;
    if (operationCount === 500) {
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      operationCount = 0;
    }
  });

  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  for (let i = 0; i < batches.length; i++) {
    await commitWithRetries(batches[i]);
    if (i < batches.length - 1) await sleep(500);
  }

  console.log(`   ✅ Deleted ${snapshot.size} '${status}' documents`);
  return { deleted: snapshot.size };
};

/**
 * Delete CP projects by IDs
 */
export const deleteCPProjectsByIds = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { deleted: 0 };
  }

  console.log(`🗑️  Deleting ${ids.length} cp_projects documents...`);
  
  let deleted = 0;
  
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = ids.slice(i, i + BATCH_SIZE);
    
    chunk.forEach((id) => {
      const ref = doc(db, 'cp_projects', id);
      batch.delete(ref);
    });
    
    await commitWithRetries(batch);
    deleted += chunk.length;
    
    console.log(`   Progress: ${deleted}/${ids.length}`);
    
    if (i + BATCH_SIZE < ids.length) {
      await sleep(1000);
    }
  }
  
  console.log(`   ✅ Deleted ${deleted} documents`);
  
  return { deleted };
};

/**
 * Update a CP project document
 */
export const updateCPProject = async (projectId, updates) => {
  const ref = doc(db, 'cp_projects', projectId);
  const batch = writeBatch(db);
  
  batch.update(ref, {
    ...updates,
    updated_at: new Date()
  });
  
  await commitWithRetries(batch);
  
  return { id: projectId, ...updates };
};

/**
 * Safely read a cp_projects document, neutralising any stored Timestamps
 * whose seconds value is out of Firestore's valid range (ms-as-seconds bug).
 */
const sanitizeCPDoc = (docSnap) => {
  try {
    const data = docSnap.data();
    ['date_filed', 'created_at', 'updated_at', 'imported_at'].forEach((field) => {
      const v = data[field];
      if (v && typeof v === 'object' && typeof v.toDate === 'function') {
        try { v.toDate(); } catch { data[field] = null; }
      }
    });
    return { id: docSnap.id, ...data };
  } catch (err) {
    console.warn('sanitizeCPDoc: skipping doc', docSnap.id, err?.message || err);
    return null;
  }
};

/**
 * Get all CP projects from Firestore
 */
export const getAllCPProjects = async () => {
  const projectsRef = collection(db, 'cp_projects');
  const snapshot = await getDocs(projectsRef);
  const projects = [];
  snapshot.forEach((docSnap) => {
    const p = sanitizeCPDoc(docSnap);
    if (p) projects.push(p);
  });
  return projects;
};

export const getCPProjectsByStatus = async (status) => {
  const projectsRef = collection(db, 'cp_projects');
  const q = query(projectsRef, where('status', '==', status));
  const snapshot = await getDocs(q);
  const projects = [];
  snapshot.forEach((docSnap) => {
    const p = sanitizeCPDoc(docSnap);
    if (p) projects.push(p);
  });
  return projects;
};

/**
 * Get CP projects by region
 */
export const getCPProjectsByRegion = async (region) => {
  const projectsRef = collection(db, 'cp_projects');
  const q = query(projectsRef, where('region', '==', region));
  const snapshot = await getDocs(q);
  const projects = [];
  snapshot.forEach((docSnap) => {
    const p = sanitizeCPDoc(docSnap);
    if (p) projects.push(p);
  });
  return projects;
};
