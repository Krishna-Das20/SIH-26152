'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function SignInPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // 1. Register User in MongoDB Atlas
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create account.');
        }

        // 2. Sign In after successful registration
        const loginRes = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });

        if (loginRes?.error) {
          throw new Error(loginRes.error);
        }

        router.push('/');
        router.refresh();
      } else {
        // Sign In Existing
        const loginRes = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });

        if (loginRes?.error) {
          throw new Error(loginRes.error);
        }

        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setLoading(true);
    signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Radial Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full intel-card rounded-2xl p-8 border border-intel-border shadow-2xl relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-xl bg-cyan-500/10 border border-intel-cyan/40 text-intel-cyan mb-3">
            <Shield className="w-8 h-8 animate-pulse" />
          </div>
          <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold mb-1">
            SIH26-26152 • NTRO Intel Portal
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isSignUp ? 'Create Analyst Account' : 'Analyst Authentication'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isSignUp
              ? 'Register to access real-time multi-platform OSINT analytics'
              : 'Sign in to access secure intelligence dashboard'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-white text-xs font-medium flex items-center justify-center gap-3 transition-all mb-5 shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
            />
            <path
              fill="#FBBC05"
              d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.9 6.3C.7 8.7 0 11.3 0 14s.7 5.3 1.9 7.7l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-[#0e1422] px-3 text-[10px] font-mono uppercase text-slate-500 absolute">
            Or with email credentials
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isSignUp && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Analyst Name"
                  className="w-full bg-slate-900/90 border border-slate-800 focus:border-cyan-500 rounded-xl px-9 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@domain.com"
                className="w-full bg-slate-900/90 border border-slate-800 focus:border-cyan-500 rounded-xl px-9 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-800 focus:border-cyan-500 rounded-xl px-9 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 bg-intel-cyan hover:bg-cyan-400 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
          >
            <span>{loading ? 'Authenticating...' : isSignUp ? 'Create Account & Sign In' : 'Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Toggle Login vs Sign Up */}
        <div className="mt-5 text-center text-xs text-slate-400">
          {isSignUp ? (
            <span>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setIsSignUp(false);
                  setError('');
                }}
                className="text-cyan-400 hover:underline font-medium"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Need an analyst account?{' '}
              <button
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                }}
                className="text-cyan-400 hover:underline font-medium"
              >
                Sign Up
              </button>
            </span>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <Link href="/" className="text-[11px] font-mono text-slate-500 hover:text-slate-300">
            ← Return to Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
