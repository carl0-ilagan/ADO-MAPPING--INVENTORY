import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase.js";

// Add a new mapping
export const addMapping = async (mappingData) => {
  try {
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

// Update a mapping
export const updateMapping = async (mappingId, updatedData) => {
  try {
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
