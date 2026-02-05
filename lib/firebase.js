// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAqLCXNvJ1g67kI7suazJ-TX1MlzAIFbfw",
  authDomain: "ado-mapping.firebaseapp.com",
  projectId: "ado-mapping",
  storageBucket: "ado-mapping.firebasestorage.app",
  messagingSenderId: "8752518784",
  appId: "1:8752518784:web:e10567570304aae2b77865",
  measurementId: "G-WSEG53SE78"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Analytics (only in browser)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

export default app;
