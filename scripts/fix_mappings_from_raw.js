#!/usr/bin/env node
/*
  Script: fix_mappings_from_raw.js

  Purpose:
    Rebuild canonical Firestore fields from `raw_fields` using header-matching
    heuristics similar to the importer. Useful when imported rows were
    misaligned and canonical fields are scrambled.

  Usage:
    node scripts/fix_mappings_from_raw.js <collectionName> [--force] [--dry]

  Options:
    --force   Overwrite existing canonical fields
    --dry     Do a dry run (log changes, don't write)

  Notes:
    Requires `firebase-admin` installed and a service account via
    GOOGLE_APPLICATION_CREDENTIALS or serviceAccountKey.json in project root.
*/

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/fix_mappings_from_raw.js <collectionName> [--force] [--dry]');
  process.exit(1);
}

const collectionName = args[0];
const force = args.includes('--force');
const dry = args.includes('--dry');

const svcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(svcPath)) {
  console.error('Service account JSON not found at', svcPath);
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json in project root.');
  process.exit(1);
}

const serviceAccount = require(svcPath);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Partial copy of HEADER_MAPPINGS and parsing utilities from lib/firestoreSchema.js
const HEADER_MAPPINGS = {
  control_number: ['cadt calt no','cadt no','calt no','control number','control no','control'],
  survey_number: ['survey no','survey number','eccv no','petition no'],
  applicant_proponent: ['applicant/proponent','applicant proponent','applicant','proponent','company','company name'],
  name_of_project: ['name of project','project name','project','name of ads iccs ips','name of ads'],
  total_area: ['total area','area','area hectares','area ha'],
  province: ['province','provinces'],
  municipality: ['municipality','municipalities'],
  barangay: ['barangay','barangays','brgy'],
  icc: ['icc','iccs','iccs ips','ip group','ip'],
  remarks: ['remarks','remark','notes'],
  issuance_of_work_order: ['issuance of work order','work order','work order issued'],
  pre_fbi_conference: ['pre-fbi conference','pre fbi conference','pre fbi'],
  conduct_of_fbi: ['conduct of fbi','conduct fbi'],
  review_of_fbi_report: ['review of fbi report','fbi report review'],
  pre_fpic_conference: ['pre-fpic conference','pre fpic'],
  first_community_assembly: ['1st community assembly','first community assembly'],
  second_community_assembly: ['2nd community assembly','second community assembly'],
  consensus_building_decision: ['consensus building & decision meeting','consensus building','decision meeting'],
  moa_validation_ratification_signing: ['moa validation','moa signing','moa ratification'],
  issuance_resolution_of_consent: ['issuance of resolution of consent','resolution of consent'],
  review_by_rrt: ['review by rrt','rrt review'],
  review_by_ado_or_lao: ['review by ado','ado review','lao review'],
  for_compliance_of_fpic_team: ['for compliance of fpic team','for compliance'],
  ceb_deliberation: ['ceb deliberation','ceb'],
};

function normalizeHeaderForMapping(headerText) {
  return String(headerText || '')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["'`]/g, '')
    .replace(/[\/\\]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFieldValueForType(fieldName, rawValue) {
  const str = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
  if (str === '' || str.toLowerCase() === 'void') {
    if (['icc','barangays','municipalities'].includes(fieldName)) return [];
    if (['total_area'].includes(fieldName)) return 0;
    return '';
  }
  if (['total_area'].includes(fieldName)) {
    const cleaned = str.replace(/,/g, '');
    const num = Number(cleaned);
    return Number.isNaN(num) ? 0 : num;
  }
  if (['icc','barangays','municipalities'].includes(fieldName)) {
    const sep = fieldName === 'icc' ? /[;,/]+/ : /,/;
    return String(str).split(sep).map(s => s.trim()).filter(Boolean);
  }
  return str;
}

async function main() {
  console.log('Reading collection', collectionName);
  const snap = await db.collection(collectionName).get();
  if (snap.empty) {
    console.log('No documents found in', collectionName);
    return;
  }

  let total = 0;
  let changed = 0;
  const ops = [];

  for (const doc of snap.docs) {
    total++;
    const data = doc.data() || {};
    const raw = data.raw_fields || {};
    if (!raw || Object.keys(raw).length === 0) continue;

    const updates = {};

    // build normalized headers map from safe raw key name (underscore separated)
    const rawKeyMap = Object.keys(raw).map(k => ({
      safeKey: k,
      normalized: normalizeHeaderForMapping(k.replace(/_/g, ' ')),
      value: raw[k],
    }));

    // For each canonical field, find a matching raw key
    for (const [field, variants] of Object.entries(HEADER_MAPPINGS)) {
      // skip if field already present and not forcing
      if (!force && data[field] !== undefined && data[field] !== null && data[field] !== '' && !(Array.isArray(data[field]) && data[field].length === 0)) continue;

      // try exact normalized match against variants
      let matched = null;
      for (const rk of rawKeyMap) {
        for (const v of variants) {
          const nv = normalizeHeaderForMapping(v);
          if (rk.normalized === nv) {
            matched = rk; break;
          }
          // loose contains match
          if (rk.normalized.includes(nv) || nv.includes(rk.normalized)) {
            matched = rk; break;
          }
        }
        if (matched) break;
      }

      if (matched) {
        updates[field] = parseFieldValueForType(field, matched.value);
      }
    }

    // If we found updates, prepare alias fields similar to buildFirestoreDocument
    if (Object.keys(updates).length > 0) {
      // map aliases
      if (updates.control_number) updates.surveyNumber = updates.control_number;
      if (updates.survey_number) updates.surveyNumber = updates.survey_number;
      if (updates.applicant_proponent) {
        updates.applicant = updates.applicant_proponent;
        updates.proponent = updates.applicant_proponent;
        updates.applicantProponent = updates.applicant_proponent;
      }
      if (updates.name_of_project) {
        updates.nameOfProject = updates.name_of_project;
        updates.projectName = updates.name_of_project;
      }
      if (updates.total_area !== undefined) updates.totalArea = updates.total_area;

      if (dry) {
        console.log('DRY:', doc.id, 'would update:', updates);
      } else {
        ops.push({ ref: doc.ref, data: { ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() } });
        changed++;
      }
    }
  }

  // Commit in batches
  while (ops.length) {
    const batch = db.batch();
    const chunk = ops.splice(0, 500);
    for (const op of chunk) batch.update(op.ref, op.data);
    await batch.commit();
    console.log('Committed batch of', chunk.length);
  }

  console.log(`Done. Scanned ${total} docs, changed ${changed} documents.`);
}

main().catch(err => { console.error(err); process.exit(1); });
