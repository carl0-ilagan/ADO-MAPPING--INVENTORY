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
const BATCH_SIZE = 10;
const INTER_BATCH_DELAY_MS = 2000;

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

      const base = Math.min(30_000, Math.pow(2, attempt) * 600);
      const jitter = Math.floor(Math.random() * 1000);
      const delay = Math.min(30_000, base + jitter);
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

  // If replace mode, clear existing data first
  if (mode === 'replace') {
    console.log('⚠️  Replace mode: Deleting existing projects...');
    try {
      await deleteAllCPProjects();
    } catch (error) {
      console.error('Failed to delete existing projects:', error);
      results.errors.push({ error: 'Failed to clear existing data', message: error.message });
      return results;
    }
  }

  const allDocuments = [];
  const invalidRecords = [];
  
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
    
    // Build documents from rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        const projectDoc = buildCPProjectDocument(row, fieldMap, sheetName, defaultStatus);
        
        // Add batch ID if provided
        if (batchId) {
          projectDoc.import_batch_id = batchId;
          projectDoc.imported_at = new Date();
        }
        
        // Validate document
        const validation = validateCPProject(projectDoc);
        
        if (validation.isValid) {
          allDocuments.push(projectDoc);
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

      await sleep(Math.random() * 200); // Small jitter
      await commitWithRetries(batch);
      
      processed += chunk.length;
      results.created += chunk.length;
      
      const progress = Math.min(100, Math.round((processed / totalSteps) * 100));
      onProgress(progress);
      
      console.log(`   Progress: ${processed}/${totalSteps} (${progress}%)`);
      
      // Delay between batches
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
 * Get all CP projects from Firestore
 */
export const getAllCPProjects = async () => {
  const projectsRef = collection(db, 'cp_projects');
  const snapshot = await getDocs(projectsRef);
  
  const projects = [];
  snapshot.forEach((doc) => {
    projects.push({ id: doc.id, ...doc.data() });
  });
  
  return projects;
};

/**
 * Get CP projects by status
 */
export const getCPProjectsByStatus = async (status) => {
  const projectsRef = collection(db, 'cp_projects');
  const q = query(projectsRef, where('status', '==', status));
  const snapshot = await getDocs(q);
  
  const projects = [];
  snapshot.forEach((doc) => {
    projects.push({ id: doc.id, ...doc.data() });
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
  snapshot.forEach((doc) => {
    projects.push({ id: doc.id, ...doc.data() });
  });
  
  return projects;
};
