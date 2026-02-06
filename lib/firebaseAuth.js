import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import { auth, db } from "./firebase.js";
import { doc, setDoc, getDoc } from "firebase/firestore";

console.log('🔐 firebaseAuth.js imported, auth object:', auth ? '✓ Present' : '❌ MISSING');
console.log('📊 firebaseAuth.js imported, db object:', db ? '✓ Present' : '❌ MISSING');

// Set persistence only if auth is available
if (auth) {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn('Failed to set persistence:', error);
  });
  console.log('✓ Persistence set for auth');
}

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
    console.error("Sign in error:", error.code, error.message);
    // Preserve the original error with code
    throw error;
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

// Ensure a seeded user exists (email/password)
export const ensureSeedUser = async ({
  email,
  password,
  role = "admin",
  communityName = ""
}) => {
  console.log('🌱 ensureSeedUser called with email:', email);
  console.log('🌱 auth object available?', auth ? '✓ YES' : '❌ NO');
  console.log('🌱 db object available?', db ? '✓ YES' : '❌ NO');
  
  try {
    if (!auth || !db) {
      const error = new Error('Firebase services not initialized. Check your configuration.');
      console.error('❌ Firebase not initialized:', { auth: !!auth, db: !!db });
      throw error;
    }
    
    if (!email || !password) {
      const error = new Error('Email and password are required');
      console.error('❌ Missing credentials:', { email: !!email, password: !!password });
      throw error;
    }
    
    console.log('🌱 Attempting to create user...');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('✓ User created:', user.uid);
    
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      role,
      communityName,
      createdAt: new Date().toISOString(),
      uid: user.uid
    });
    console.log('✓ User document created in Firestore');
    
    await signOut(auth);
    console.log('✓ Seed user created:', email);
    return { created: true, uid: user.uid };
  } catch (error) {
    // Handle existing user silently (not an error)
    if (error?.code === "auth/email-already-in-use") {
      try {
        console.log('🌱 User already exists, verifying...');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('✓ Verified existing user:', user.uid);
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          console.log('🌱 Creating missing user document...');
          await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            role,
            communityName,
            createdAt: new Date().toISOString(),
            uid: user.uid
          });
          console.log('✓ User document created in Firestore');
        } else {
          console.log('✓ User document already exists');
        }
        await signOut(auth);
        console.log('✓ Seed user ready:', email);
        return { created: false, uid: user.uid, existing: true };
      } catch (innerError) {
        console.error('❌ Error verifying existing seed user:', {
          code: innerError?.code,
          message: innerError?.message,
          stringified: String(innerError)
        });
        throw innerError;
      }
    }
    
    // Log actual errors (not expected ones)
    console.error('🌱 Error in ensureSeedUser:', {
      code: error?.code || 'NO_CODE',
      message: error?.message || 'NO_MESSAGE',
      name: error?.name || 'NO_NAME',
      stack: error?.stack || 'NO_STACK',
      stringified: String(error),
      typeof: typeof error,
      keys: error ? Object.keys(error) : [],
      fullError: error
    });
    
    // Check for specific Firebase auth errors
    if (error?.code === "auth/configuration-not-found") {
      const customError = new Error(
        '⚠️ Firebase Email/Password authentication is NOT ENABLED.\n' +
        'Go to Firebase Console > Authentication > Sign-in method > Enable Email/Password'
      );
      customError.code = error.code;
      throw customError;
    }
    
    if (error?.code === "auth/invalid-api-key") {
      const customError = new Error('⚠️ Invalid Firebase API key. Check your .env.local file.');
      customError.code = error.code;
      throw customError;
    }
    
    throw error;
  }
};

// Monitor auth state changes
export const onAuthStateChangeListener = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Reauthenticate user (needed before updating email/password)
export const reauthenticateUser = async (currentPassword) => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error("No user is currently signed in");
    }
    
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    return true;
  } catch (error) {
    console.error("Reauthentication error:", error.message);
    throw new Error(error.message);
  }
};

// Update user email
export const updateUserEmail = async (newEmail, currentPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user is currently signed in");
    }

    // Reauthenticate first
    await reauthenticateUser(currentPassword);
    
    // Update email
    await updateEmail(user, newEmail);
    
    // Update email in Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: newEmail,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return true;
  } catch (error) {
    console.error("Update email error:", error.message);
    throw new Error(error.message);
  }
};

// Update user password
export const updateUserPassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user is currently signed in");
    }

    // Reauthenticate first
    await reauthenticateUser(currentPassword);
    
    // Update password
    await updatePassword(user, newPassword);

    return true;
  } catch (error) {
    console.error("Update password error:", error.message);
    throw new Error(error.message);
  }
};
