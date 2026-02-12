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

// Add a new mapping
export const addMapping = async (mappingData) => {
  try {
    console.log('🔁 addMapping - writing mapping with location:', mappingData?.location);
    const docRef = await addDoc(collection(db, "mappings"), {
      ...mappingData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding mapping:", error.message);
    throw new Error(error.message);
  }
};

// Add a mapping to a specific collection name (used for import into a new collection)
export const addMappingToCollection = async (collectionName, mappingData) => {
  try {
    console.log(`🔁 addMappingToCollection ${collectionName} - writing mapping with location:`, mappingData?.location);
    const docRef = await addDoc(collection(db, collectionName), {
      ...mappingData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error adding mapping to ${collectionName}:`, error.message);
    throw new Error(error.message);
  }
};

// Get all mappings for a user
export const getUserMappings = async (userId) => {
  try {
    const q = query(collection(db, "mappings"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const mappings = [];

    querySnapshot.forEach((doc) => {
      mappings.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return mappings;
  } catch (error) {
    console.error("Error getting user mappings:", error.message);
    return [];
  }
};

// Get all mappings (for admin)
export const getAllMappings = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "mappings"));
    const mappings = [];

    querySnapshot.forEach((doc) => {
      mappings.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return mappings;
  } catch (error) {
    console.error("Error getting all mappings:", error.message);
    return [];
  }
};

// Get all documents from an arbitrary collection (used for import collections)
export const getMappingsFromCollection = async (collectionName) => {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const mappings = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() || {};
      // Normalize imported collection documents to the expected mapping shape
      const normalized = normalizeImportedDoc(data);
      // Preserve any important control fields (e.g. internal flags set during import)
      const preserved = {};
      if (data && typeof data === 'object') {
        if (typeof data._ongoing !== 'undefined') preserved._ongoing = data._ongoing;
        if (typeof data.importCollection !== 'undefined') preserved.importCollection = data.importCollection;
      }
      mappings.push({ id: doc.id, ...normalized, ...preserved });
    });
    return mappings;
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    console.error(`Error getting mappings from ${collectionName}:`, error.message);
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
    console.error('Error registering import collection:', error.message);
    throw error;
  }
};

export const getUserImportCollections = async (userId) => {
  try {
    const q = query(collection(db, 'users', userId, 'imports'));
    const querySnapshot = await getDocs(q);
    const imports = [];
    querySnapshot.forEach((doc) => imports.push({ id: doc.id, ...doc.data() }));
    return imports;
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('permission') || msg.includes('insufficient') || msg.includes('missing')) {
      // Likely rules prevent listing imports; treat as no imports available without noisy error
      console.warn('Permission denied when fetching user import collections; skipping import list.');
    } else {
      console.error('Error fetching user import collections:', error.message);
    }
    return [];
  }
};

// Update a mapping
export const updateMapping = async (mappingId, updatedData) => {
  try {
    console.log('🔁 updateMapping', mappingId, '- updating location to:', updatedData?.location);
    await updateDoc(doc(db, "mappings", mappingId), {
      ...updatedData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating mapping:", error.message);
    throw new Error(error.message);
  }
};

// Delete a mapping
export const deleteMapping = async (mappingId) => {
  try {
    await deleteDoc(doc(db, "mappings", mappingId));
  } catch (error) {
    console.error("Error deleting mapping:", error.message);
    throw new Error(error.message);
  }
};

// Get mappings by region
export const getMappingsByRegion = async (region) => {
  try {
    const q = query(collection(db, "mappings"), where("region", "==", region));
    const querySnapshot = await getDocs(q);
    const mappings = [];

    querySnapshot.forEach((doc) => {
      mappings.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return mappings;
  } catch (error) {
    console.error("Error getting mappings by region:", error.message);
    return [];
  }
};

// Get mappings by community name
export const getMappingsByCommunity = async (communityName) => {
  try {
    const q = query(collection(db, "mappings"), where("communityName", "==", communityName));
    const querySnapshot = await getDocs(q);
    const mappings = [];

    querySnapshot.forEach((doc) => {
      mappings.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return mappings;
  } catch (error) {
    console.error("Error getting mappings by community:", error.message);
    return [];
  }
};
