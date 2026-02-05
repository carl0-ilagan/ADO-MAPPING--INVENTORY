// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration (from env)
// Required env vars: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
// NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID,
// NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate Firebase config for debugging
if (typeof window !== 'undefined') {
  const missingKeys = Object.entries(firebaseConfig)
    .filter(([_, val]) => !val || val.length === 0)
    .map(([key, _]) => key);
  
  if (missingKeys.length > 0) {
    console.error('❌ Missing Firebase config keys:', missingKeys);
    console.error('Actual config:', firebaseConfig);
  } else {
    console.log('✓ Firebase config loaded successfully');
    console.log('Project ID:', firebaseConfig.projectId);
  }
}

// Initialize Firebase
console.log('🔥 Initializing Firebase with config:', {
  apiKey: firebaseConfig.apiKey ? '***SET***' : 'MISSING',
  authDomain: firebaseConfig.authDomain || 'MISSING',
  projectId: firebaseConfig.projectId || 'MISSING',
  appId: firebaseConfig.appId ? '***SET***' : 'MISSING',
});

const app = initializeApp(firebaseConfig);
console.log('✓ Firebase app initialized');

// Initialize Firebase services
export const auth = getAuth(app);
console.log('✓ Firebase auth initialized');

export const db = getFirestore(app);
console.log('✓ Firestore db initialized');

export const storage = getStorage(app);
console.log('✓ Firebase storage initialized');

// Initialize Analytics (only in browser)
if (typeof window !== 'undefined') {
  getAnalytics(app);
  console.log('✓ Firebase analytics initialized');
}

export default app;
