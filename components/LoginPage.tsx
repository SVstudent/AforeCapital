'use client';

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

export default function LoginPage() {
    const { signIn, signUp, signInWithGoogle, error, clearError, loading } = useAuth();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (isSignUp) {
                await signUp(email, password, displayName, role);
            } else {
                await signIn(email, password);
            }
        } catch (err) {
            // Error is handled in AuthContext
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsSubmitting(true);
        try {
            await signInWithGoogle(role);
        } catch (err) {
            // Error is handled in AuthContext
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-violet-50">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-2 py-4">
            <div className="flex items-start gap-4 max-w-2xl w-full">

                {/* Demo Credentials Panel (Left - Compact) */}
                <div className="w-48 flex-shrink-0 hidden md:block">
                    <div className="bg-white/80 backdrop-blur border border-indigo-100 rounded-xl p-3 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></div>
                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Demo Access</span>
                        </div>

                        {/* Student */}
                        <button
                            onClick={() => { setEmail('DriJanet@fsd.com'); setPassword('studentpass'); }}
                            className="w-full text-left p-2 rounded-lg border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all mb-2 group cursor-pointer"
                        >
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-sm">🎓</span>
                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Student</span>
                            </div>
                            <div className="text-[10px] text-slate-500 leading-relaxed">
                                <div className="truncate"><span className="text-slate-400">Email:</span> DriJanet@fsd.com</div>
                                <div><span className="text-slate-400">Pass:</span> studentpass</div>
                            </div>
                            <div className="text-[8px] text-indigo-400 font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to autofill →</div>
                        </button>

                        {/* Teacher */}
                        <button
                            onClick={() => { setEmail('darwinteach@gmail.com'); setPassword('password'); }}
                            className="w-full text-left p-2 rounded-lg border border-slate-100 hover:border-violet-300 hover:bg-violet-50/50 transition-all group cursor-pointer"
                        >
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-sm">👨‍🏫</span>
                                <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">Teacher</span>
                            </div>
                            <div className="text-[10px] text-slate-500 leading-relaxed">
                                <div className="truncate"><span className="text-slate-400">Email:</span> darwinteach@gmail.com</div>
                                <div><span className="text-slate-400">Pass:</span> password</div>
                            </div>
                            <div className="text-[8px] text-violet-400 font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to autofill →</div>
                        </button>
                    </div>
                </div>

                {/* Main Auth Form (Right - Dominant) */}
                <div className="w-full max-w-sm">
                    {/* Logo & Branding */}
                    <div className="text-center mb-4">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl shadow-xl shadow-indigo-100 mb-2">
                            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">LuminaOS</h1>
                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em]">AI-Native Education OS</p>
                    </div>

                    {/* Auth Card */}
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-5">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">
                            {isSignUp ? 'Create Account' : 'Welcome Back'}
                        </h2>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
                                <span>{error}</span>
                                <button onClick={clearError} className="text-red-500 hover:text-red-700">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-3">
                            {isSignUp && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm"
                                        placeholder="Prof. Gauss or Alex Johnson"
                                        required
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e8e3e]/20 focus:border-[#1e8e3e] transition-all text-sm"
                                    placeholder="you@school.edu"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e8e3e]/20 focus:border-[#1e8e3e] transition-all text-sm"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>

                            {/* Role Selection */}
                            {isSignUp && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">I am a...</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setRole(UserRole.STUDENT)}
                                            className={`p-2.5 rounded-lg border-2 transition-all ${role === UserRole.STUDENT
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                                : 'border-slate-100 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="text-lg">🎓</div>
                                            <div className="font-bold text-sm">Student</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRole(UserRole.TEACHER)}
                                            className={`p-2.5 rounded-lg border-2 transition-all ${role === UserRole.TEACHER
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                                : 'border-slate-100 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="text-lg">👨‍🏫</div>
                                            <div className="font-bold text-sm">Teacher</div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-lg font-black text-sm hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : isSignUp ? (
                                    'Create Account'
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="flex items-center my-4">
                            <div className="flex-1 border-t border-gray-200" />
                            <span className="px-3 text-xs text-gray-400">or</span>
                            <div className="flex-1 border-t border-gray-200" />
                        </div>

                        {/* Google Sign In */}
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={isSubmitting}
                            className="w-full py-2.5 bg-white border border-gray-200 rounded-lg font-medium text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>

                        {/* Toggle Sign Up / Sign In */}
                        <p className="text-center text-xs text-gray-500 mt-4">
                            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                            <button
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    clearError();
                                }}
                                className="text-indigo-600 font-bold hover:underline"
                            >
                                {isSignUp ? 'Sign In' : 'Sign Up'}
                            </button>
                        </p>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-[10px] text-gray-400 mt-3">
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>
            </div>
        </div>
    );
}
