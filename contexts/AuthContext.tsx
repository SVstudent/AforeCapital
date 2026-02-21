'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';
import { UserRole } from '../types';

// Extended user type with role
export interface AuraUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    role: UserRole;
}

interface AuthContextType {
    user: AuraUser | null;
    loading: boolean;
    error: string | null;
    signUp: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signInWithGoogle: (role?: UserRole) => Promise<void>;
    signOut: () => Promise<void>;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuraUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Fetch user data from Firestore
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || userData.displayName,
                        photoURL: firebaseUser.photoURL || userData.photoURL,
                        role: userData.role || UserRole.STUDENT,
                    });
                } else {
                    // User exists in Auth but not Firestore - create with default role
                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName,
                        photoURL: firebaseUser.photoURL,
                        role: UserRole.STUDENT,
                    });
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Sign up with email/password
    const signUp = async (email: string, password: string, displayName: string, role: UserRole) => {
        try {
            setError(null);
            const result = await createUserWithEmailAndPassword(auth, email, password);

            // Update profile
            await updateProfile(result.user, { displayName });

            // Create user document in Firestore
            await setDoc(doc(db, 'users', result.user.uid), {
                email,
                displayName,
                role,
                photoURL: null,
                createdAt: serverTimestamp(),
            });
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
            throw err;
        }
    };

    // Sign in with email/password
    const signIn = async (email: string, password: string) => {
        try {
            setError(null);
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            setError(err.message || 'Failed to sign in');
            throw err;
        }
    };

    // Sign in with Google
    const signInWithGoogle = async (role: UserRole = UserRole.STUDENT) => {
        try {
            setError(null);
            const result = await signInWithPopup(auth, googleProvider);

            // Check if user exists in Firestore
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));

            if (!userDoc.exists()) {
                // Create user document for new Google users
                await setDoc(doc(db, 'users', result.user.uid), {
                    email: result.user.email,
                    displayName: result.user.displayName,
                    photoURL: result.user.photoURL,
                    role,
                    createdAt: serverTimestamp(),
                });
            }
        } catch (err: any) {
            setError(err.message || 'Failed to sign in with Google');
            throw err;
        }
    };

    // Sign out
    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setUser(null);
        } catch (err: any) {
            setError(err.message || 'Failed to sign out');
            throw err;
        }
    };

    const clearError = () => setError(null);

    const value: AuthContextType = {
        user,
        loading,
        error,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        clearError,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
