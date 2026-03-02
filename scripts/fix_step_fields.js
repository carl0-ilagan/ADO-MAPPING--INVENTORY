/**
 * fix_step_fields.js
 * 
 * Clears FBI/FPIC step fields that contain garbage data (ICC names, location text, etc.)
 * A valid step field value must be: done, pending, a date, or an Excel serial date.
 * Everything else gets wiped so the summary counts are accurate.
 * 
 * Run: node scripts/fix_step_fields.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const STEP_FIELDS = [
  'pre_fbi_conference',
  'conduct_of_fbi',
  'review_of_fbi_report',
  'issuance_of_work_order',
  'pre_fpic_conference',
  'first_community_assembly',
  'second_community_assembly',
  'consensus_building_decision',
  'moa_validation_ratification_signing',
  'issuance_resolution_of_consent',
  'review_by_rrt',
  'review_by_ado_or_lao',
  'for_compliance_of_fpic_team',
  'ceb_deliberation',
  'ceb_approved',
  'preparation_signing_ceb_resolution_cp',
  'release_of_cp_to_proponent',
  'issuance_of_work_order_of_fpic_team',
  'approval_of_wfp',
  'payment_of_fbi_fee',
  'preparation_of_fbi_report',
  'payment_of_fpic_fee',
  'posting_of_notices',
  'proceed_to_moa_negotiation',
  'issuance_resolution_to_proceed_to_moa',
  'moa_negotiation_preparation',
  'submission_of_fpic_report',
];

function isValidStepValue(v) {
  if (v === null || v === undefined) return true; // already empty = fine
  const s = String(v).trim().toLowerCase();
  if (!s) return true;
  // Valid: explicit status words
  const statusWords = ['done', 'pending', 'completed', 'finished', 'ongoing', 'for compliance', 'complied', 'yes', 'no'];
  if (statusWords.some(w => s === w || s.startsWith(w))) return true;
  // Valid: date formats  (2024-01-15, 01/15/2024, Jan 15 2024)
  if (/\d{1,4}[-\/\.]\d{1,2}[-\/\.]\d{1,4}/.test(s)) return true;
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(s) && /\d/.test(s)) return true;
  // Valid: Excel serial date number (40000-55000 = year 2009-2050)
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (n > 40000 && n < 55000) return true;
  }
  return false;
}

async function run() {
  const snapshot = await db.collection('cp_projects').get();
  console.log(`Total records: ${snapshot.size}`);

  let fixed = 0;
  let skipped = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates = {};

    for (const field of STEP_FIELDS) {
      const val = data[field];
      if (val !== undefined && val !== null && val !== '' && !isValidStepValue(val)) {
        console.log(`  ❌ [${doc.id}] ${field}: "${val}" → clearing`);
        updates[field] = admin.firestore.FieldValue.delete();
      }
    }

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      fixed++;
      batchCount++;

      // Firestore batch limit = 500
      if (batchCount >= 490) {
        await batch.commit();
        batchCount = 0;
        console.log('Committed batch...');
      }
    } else {
      skipped++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n✅ Done. Fixed: ${fixed} records, Skipped (already clean): ${skipped} records`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
