// Firebase configuration
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase (prevent duplicate initialization)
let app = null;
export let isFirebaseReady = false;

try {
    // Check for obvious placeholders or missing keys
    const isPlausibleKey = firebaseConfig.apiKey &&
        firebaseConfig.apiKey !== 'undefined' &&
        !firebaseConfig.apiKey.includes('PLACEHOLDER') &&
        firebaseConfig.apiKey.length > 10;

    if (isPlausibleKey) {
        app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        isFirebaseReady = true;
    }
} catch (error) {
    console.warn('Firebase initializeApp failed:', error);
}

// Auth instance - Wrapped in try/catch to handle invalid API key errors during service creation
let authInstance = null;
try {
    if (app) authInstance = getAuth(app);
} catch (error) {
    console.warn('Firebase Auth creation failed:', error);
    isFirebaseReady = false;
}
export const auth = authInstance;

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Firestore instance - Wrapped in try/catch to handle invalid API key errors
let dbInstance = null;
try {
    if (app) dbInstance = getFirestore(app);
} catch (error) {
    console.warn('Firebase Firestore creation failed:', error);
    isFirebaseReady = false;
}
export const db = dbInstance;

export default app;
