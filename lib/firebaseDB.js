import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase.js";

// Compute a sensible location value from mapping data using common fallbacks
const computeLocationFromMapping = (mappingData) => {
  if (!mappingData || typeof mappingData !== 'object') return '';
  const tryVal = (v) => (v === null || typeof v === 'undefined') ? '' : String(v).trim();

  // Prefer explicit location fields
  const explicit = tryVal(mappingData.location) || tryVal(mappingData.location_full) || tryVal(mappingData.locationFull);
  if (explicit) return explicit;

  // Use province as a fallback
  if (tryVal(mappingData.province)) return tryVal(mappingData.province);

  // Use region if nothing better
  if (tryVal(mappingData.region)) return tryVal(mappingData.region);

  // Inspect raw_fields for keys that look like location/province/site
  try {
    if (mappingData.raw_fields && typeof mappingData.raw_fields === 'object') {
      const keys = Object.keys(mappingData.raw_fields || {});
      for (const k of keys) {
        const lk = String(k || '').toLowerCase();
        if (lk.includes('location') || lk.includes('province') || lk.includes('loc') || lk.includes('site')) {
          const v = tryVal(mappingData.raw_fields[k]);
          if (v) return v;
        }
      }
      // fallback: first non-empty raw field
      for (const k of keys) {
        const v = tryVal(mappingData.raw_fields[k]);
        if (v) return v;
      }
    }
  } catch (e) {
    // ignore
  }

  return '';
};

// Add a new mapping
export const addMapping = async (mappingData) => {
  try {
    const computedLocation = computeLocationFromMapping(mappingData);
    const writeData = { ...mappingData };
    if (!writeData.location || String(writeData.location).trim() === '') writeData.location = computedLocation;
    console.log('🔁 addMapping - writing mapping with location:', writeData.location, 'flags:', { _ongoing: writeData._ongoing, importCollection: writeData.importCollection });
    const docRef = await addDoc(collection(db, "mappings"), {
      ...writeData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding mapping:", error?.message || error);
    throw new Error(error?.message || String(error));
  }
};

// Add a mapping to a specific collection name (used for import into a new collection)
export const addMappingToCollection = async (collectionName, mappingData) => {
  try {
    const computedLocation = computeLocationFromMapping(mappingData);
    const writeData = { ...mappingData };
    if (!writeData.location || String(writeData.location).trim() === '') writeData.location = computedLocation;
    console.log(`🔁 addMappingToCollection ${collectionName} - writing mapping with location:`, writeData.location, 'flags:', { _ongoing: writeData._ongoing, importCollection: writeData.importCollection });
    const docRef = await addDoc(collection(db, collectionName), {
      ...writeData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error adding mapping to ${collectionName}:`, error?.message || error);
    throw new Error(error?.message || String(error));
  }
};

// Get all mappings for a user
export const getUserMappings = async (userId) => {
  try {
    const q = query(collection(db, "mappings"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const mappings = [];

    querySnapshot.forEach((docSnap) => {
      mappings.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    return mappings;
  } catch (error) {
    console.error("Error getting user mappings:", error?.message || error);
    return [];
  }
};

// Get all mappings (for admin)
export const getAllMappings = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "mappings"));
    const mappings = [];

    querySnapshot.forEach((docSnap) => {
      mappings.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    return mappings;
  } catch (error) {
    console.error("Error getting all mappings:", error?.message || error);
    return [];
  }
};

// Get all documents from an arbitrary collection (used for import collections)
export const getMappingsFromCollection = async (collectionName) => {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const mappings = [];
    console.debug(`firebaseDB: getMappingsFromCollection '${collectionName}' - snapshot size: ${querySnapshot.size}`);

    if (querySnapshot.empty) {
      console.debug(`firebaseDB: collection '${collectionName}' returned empty snapshot`);
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() || {};
      // Debug: show raw document shape for the first few docs to help
      // diagnose whether import-time flags like `_ongoing` or `importCollection`
      // are present in Firestore or are being lost during normalization.
      try {
        if (mappings.length < 5) {
          console.debug(`firebaseDB: raw doc from ${collectionName} id=${docSnap.id}`, data, 'keys:', Object.keys(data));
        }
      } catch (e) {
        /* ignore logging errors */
      }
      try {
        if (mappings.length < 5) console.debug(`firebaseDB: sample doc id from ${collectionName}:`, docSnap.id);
      } catch (e) {
        // ignore logging errors
      }

      // Normalize imported collection documents to the expected mapping shape
      const normalized = normalizeImportedDoc(data);
      // Preserve any important control fields (e.g. internal flags set during import)
      const preserved = {};
      if (data && typeof data === 'object') {
        if (typeof data._ongoing !== 'undefined') preserved._ongoing = data._ongoing;
        if (typeof data.importCollection !== 'undefined') preserved.importCollection = data.importCollection;
      }
      mappings.push({ id: docSnap.id, ...normalized, ...preserved });
    });

    console.debug(`firebaseDB: getMappingsFromCollection '${collectionName}' - returning ${mappings.length} normalized mappings`);
    return mappings;
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    console.error(`Error getting mappings from ${collectionName}:`, error?.message || error);
    // If this is a permission/denied error, rethrow so callers can handle without
    // wiping the UI (caller logic expects exceptions for permission failures).
    if (msg.includes('permission') || msg.includes('insufficient') || msg.includes('missing')) {
      throw error;
    }
    // For other errors, return an empty array so the UI can continue.
    return [];
  }
};

// Attempt to map arbitrary import document fields (from Excel headers) to
// the canonical mapping fields used by the UI: surveyNumber, region, province,
// municipalities (array), barangays (array), totalArea (number), icc (array), remarks
const normalizeImportedDoc = (data) => {
  if (!data || typeof data !== 'object') return {};

  const keys = Object.keys(data);
  const lookup = {};
  keys.forEach((k) => {
    const key = String(k || '').trim().toLowerCase();
    lookup[key] = k; // map normalized -> original
  });

  const findKey = (candidates) => {
    for (const cand of candidates) {
      const n = String(cand || '').trim().toLowerCase();
      if (lookup[n]) return lookup[n];
    }
    // fuzzy contains
    for (const k of Object.keys(lookup)) {
      for (const cand of candidates) {
        const n = String(cand || '').trim().toLowerCase();
        if (k.includes(n) || n.includes(k)) return lookup[k];
      }
    }
    return null;
  };

  const get = (origKey) => {
    if (!origKey) return '';
    return data[origKey] ?? '';
  };

  const splitList = (v) => {
    if (!v && v !== 0) return [];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    return String(v).split(/[,;\/\|]|\band\b/gi).map((s) => s.trim()).filter(Boolean);
  };

  const parseArea = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    const num = Number(String(v).replace(/,/g, ''));
    return Number.isNaN(num) ? 0 : num;
  };

  const surveyKey = findKey(['survey number', 'survey no', 'survey #', 'survey']);
  const regionKey = findKey(['region', 'sheet']);
  const provinceKey = findKey(['province']);
  const municipalityKey = findKey(['municipality', 'municipalities', 'municipality/ies']);
  const barangayKey = findKey(['barangay', 'barangays', 'barangay/s']);
  const locationKey = findKey(['location', 'loc', 'site', 'location_full']);
  const areaKey = findKey(['total area', 'area', 'area (ha)']);
  const iccKey = findKey(['icc', 'iccs', 'icc/ips', 'ip']);
  const remarksKey = findKey(['remarks', 'note', 'notes']);

  const surveyNumber = String(get(surveyKey) || '').trim();
  const region = String(get(regionKey) || '').trim();
  const province = String(get(provinceKey) || '').trim();
  const location = String(get(locationKey) || '').trim();
  const municipalities = splitList(get(municipalityKey));
  const barangays = splitList(get(barangayKey));
  const totalArea = parseArea(get(areaKey));
  const icc = splitList(get(iccKey));
  const remarks = String(get(remarksKey) || '').trim();

  // If no surveyNumber found, try common alternative keys or fall back
  if (!surveyNumber) {
    // Look for any key that looks like 'survey' in original keys
    for (const k of Object.keys(lookup)) {
      if (k.includes('survey')) {
        const orig = lookup[k];
        if (orig && String(data[orig] || '').trim()) {
          return {
            surveyNumber: String(data[orig]).trim(),
            region,
            province,
            municipality: municipalities.join(', '),
            municipalities,
            barangays,
            totalArea,
            icc,
            remarks,
          };
        }
      }
    }
  }

  return {
    surveyNumber: surveyNumber || '',
    region: region || '',
    province: province || '',
    location: location || '',
    municipality: municipalities.join(', '),
    municipalities,
    barangays,
    totalArea,
    icc,
    remarks,
  };
};

// Register an import collection under the user's imports subcollection
export const registerImportCollection = async (userId, collectionName, meta = {}) => {
  try {
    const ref = doc(db, 'users', userId, 'imports', collectionName);
    await setDoc(ref, {
      collectionName,
      createdAt: serverTimestamp(),
      ...meta,
    });
  } catch (error) {
    console.error('Error registering import collection:', error?.message || error);
    throw error;
  }
};

export const getUserImportCollections = async (userId) => {
  try {
    const q = query(collection(db, 'users', userId, 'imports'));
    const querySnapshot = await getDocs(q);
    const imports = [];
    querySnapshot.forEach((docSnap) => imports.push({ id: docSnap.id, ...docSnap.data() }));
    return imports;
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('permission') || msg.includes('insufficient') || msg.includes('missing')) {
      // Likely rules prevent listing imports; treat as no imports available without noisy error
      console.warn('Permission denied when fetching user import collections; skipping import list.');
    } else {
      console.error('Error fetching user import collections:', error?.message || error);
    }
    return [];
  }
};

// Update a mapping
export const updateMapping = async (mappingId, updatedData) => {
  try {
    const computedLocation = computeLocationFromMapping(updatedData);
    const writeData = { ...updatedData };
    if (!writeData.location || String(writeData.location).trim() === '') writeData.location = computedLocation;
    console.log('🔁 updateMapping', mappingId, '- updating location to:', writeData.location);
    await updateDoc(doc(db, "mappings", mappingId), {
      ...writeData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating mapping:", error?.message || error);
    throw new Error(error?.message || String(error));
  }
};

// Update a document in an arbitrary collection (used for imported collections)
export const updateDocumentInCollection = async (collectionName, docId, updatedData) => {
  try {
    console.log(`🔁 updateDocumentInCollection ${collectionName} - updating doc ${docId}`);
    await updateDoc(doc(db, collectionName, docId), {
      ...updatedData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(`Error updating document ${docId} in ${collectionName}:`, error?.message || error);
    throw new Error(error?.message || String(error));
  }
};

// Delete a mapping
export const deleteMapping = async (mappingId) => {
  try {
    await deleteDoc(doc(db, "mappings", mappingId));
  } catch (error) {
    console.error("Error deleting mapping:", error?.message || error);
    throw new Error(error?.message || String(error));
  }
};

// Get mappings by region
export const getMappingsByRegion = async (region) => {
  try {
    const q = query(collection(db, "mappings"), where("region", "==", region));
    const querySnapshot = await getDocs(q);
    const mappings = [];

    querySnapshot.forEach((docSnap) => {
      mappings.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    return mappings;
  } catch (error) {
    console.error("Error getting mappings by region:", error?.message || error);
    return [];
  }
};

// Get mappings by community name
export const getMappingsByCommunity = async (communityName) => {
  try {
    const q = query(collection(db, "mappings"), where("communityName", "==", communityName));
    const querySnapshot = await getDocs(q);
    const mappings = [];

    querySnapshot.forEach((docSnap) => {
      mappings.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    return mappings;
  } catch (error) {
    console.error("Error getting mappings by community:", error?.message || error);
    return [];
  }
};
