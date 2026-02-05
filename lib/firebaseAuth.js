import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { auth, db } from "./firebase.js";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Set persistence
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Sign up function
export const signUpUser = async (
  email,
  password,
  role = "user",
  communityName = ""
) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Store additional user data in Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      role,
      communityName,
      createdAt: new Date().toISOString(),
      uid: user.uid
    });

    return user;
  } catch (error) {
    console.error("Sign up error:", error.message);
    throw new Error(error.message);
  }
};

// Sign in function
export const signInUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Sign in error:", error.message);
    throw new Error(error.message);
  }
};

// Sign out function
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign out error:", error.message);
    throw new Error(error.message);
  }
};

// Get user data from Firestore
export const getUserData = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (error) {
    console.error("Error getting user data:", error.message);
    return null;
  }
};

// Monitor auth state changes
export const onAuthStateChangeListener = (callback) => {
  return onAuthStateChanged(auth, callback);
};
