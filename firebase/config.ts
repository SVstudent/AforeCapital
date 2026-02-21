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
try {
    // Only attempt to initialize if we have a plausible API key
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined' && !firebaseConfig.apiKey.includes('PLACEHOLDER')) {
        app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    } else {
        console.warn('Firebase API key is missing or is the default placeholder. Firebase features will be disabled.');
    }
} catch (error) {
    console.error('Firebase initialization failed:', error);
    app = null;
}

// Auth instance
export const auth = app ? getAuth(app) : null;

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Firestore instance
export const db = app ? getFirestore(app) : null;

export default app;
