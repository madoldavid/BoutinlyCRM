/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import { ApiError, apiClient } from '../apiClient';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

type PageMode = 'login' | 'mfa' | 'forgot' | 'reset' | 'signup';

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<PageMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // MFA state
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // Signup state
  const [signupForm, setSignupForm] = useState({ name: '', company_name: '', email: '', password: '' });

  // Password reset state
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  // Check for reset token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setMode('reset');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.login(email.trim(), password);

      if ('mfa_required' in result && result.mfa_required) {
        setMfaToken(result.mfa_token);
        setMode('mfa');
        setLoading(false);
        return;
      }

      onLoginSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Connection failed. Is the API server running?');
      }
    } finally {
      if (mode !== 'mfa') setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mfaCode.length !== 6) {
      setError('Please enter a 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.mfaChallenge(mfaToken!, mfaCode);
      onLoginSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.forgotPassword(email.trim());
      setSuccessMsg('If that email is registered, a password reset link has been sent.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Connection failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!resetToken.trim()) {
      setError('Reset token is required.');
      return;
    }
    if (resetPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.resetPassword(resetToken.trim(), resetPassword);
      setSuccessMsg('Password reset successfully. You can now sign in.');
      setMode('login');
      setPassword('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Connection failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signupForm.name.trim() || !signupForm.company_name.trim() || !signupForm.email.trim() || !signupForm.password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (signupForm.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.signup(
        signupForm.name.trim(),
        signupForm.email.trim(),
        signupForm.password,
        signupForm.company_name.trim(),
      );
      onLoginSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Connection failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-50 flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-sm">
        {/* Logo / Brand Block */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight font-sans">
            Boutinly CRM
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-sans">
            Enterprise Sales Operations Platform
          </p>
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-700 font-sans">{successMsg}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 font-sans">{error}</p>
          </div>
        )}

        {/* MFA Challenge Form */}
        {mode === 'mfa' && (
          <form
            onSubmit={handleMfaSubmit}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900 font-sans">Two-Factor Authentication</h2>
              <p className="text-xs text-gray-500 mt-1 font-sans">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div>
              <input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-center text-2xl tracking-[0.5em] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 font-mono"
                placeholder="000000"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 font-sans"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); setMfaToken(null); setMfaCode(''); setError(null); }}
              disabled={loading}
              className="w-full text-xs text-gray-500 hover:text-gray-700 transition-colors font-sans bg-transparent border-none cursor-pointer"
            >
              Back to sign in
            </button>
          </form>
        )}

        {/* Forgot Password Form */}
        {mode === 'forgot' && (
          <form
            onSubmit={handleForgotSubmit}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm"
          >
            <div className="text-center">
              <h2 className="text-sm font-bold text-gray-900 font-sans">Reset Your Password</h2>
              <p className="text-xs text-gray-500 mt-1 font-sans">
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            <div>
              <label
                htmlFor="forgot-email"
                className="block text-[11px] font-medium text-gray-600 uppercase tracking-wider mb-1.5 font-sans"
              >
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 font-sans"
                placeholder="admin@boutinly.com"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 font-sans"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              disabled={loading}
              className="w-full text-xs text-gray-500 hover:text-gray-700 transition-colors font-sans bg-transparent border-none cursor-pointer"
            >
              Back to sign in
            </button>
          </form>
        )}

        {/* Reset Password Form (with token) */}
        {mode === 'reset' && (
          <form
            onSubmit={handleResetSubmit}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900 font-sans">Set New Password</h2>
              <p className="text-xs text-gray-500 mt-1 font-sans">
                Enter your reset token and choose a new password.
              </p>
            </div>

            <div>
              <label
                htmlFor="reset-token"
                className="block text-[11px] font-medium text-gray-600 uppercase tracking-wider mb-1.5 font-sans"
              >
                Reset Token
              </label>
              <input
                id="reset-token"
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 font-sans"
                placeholder="Paste reset token from email"
                autoFocus={!resetToken}
              />
            </div>

            <div>
              <label
                htmlFor="reset-password"
                className="block text-[11px] font-medium text-gray-600 uppercase tracking-wider mb-1.5 font-sans"
              >
                New Password
              </label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 font-sans"
                placeholder="Min. 8 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading || resetPassword.length < 8}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 font-sans"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              disabled={loading}
              className="w-full text-xs text-gray-500 hover:text-gray-700 transition-colors font-sans bg-transparent border-none cursor-pointer"
            >
              Back to sign in
            </button>
          </form>
        )}

        {/* Signup Form */}
        {mode === 'signup' && (
          <form
            onSubmit={handleSignupSubmit}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm"
          >
            <div className="text-center">
              <h2 className="text-sm font-bold text-gray-900 font-sans">Create Your Account</h2>
              <p className="text-xs text-gray-500 mt-1 font-sans">
                Set up your organization and super admin account.
              </p>
            </div>

            <div>
              <label
                htmlFor="signup-name"
                className="block text-[11px] font-medium text-gray-600 uppercase tracking-wider mb-1.5 font-sans"
              >
                Full Name
              </label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={signupForm.name}
                onChange={(e) => setSignupForm(prev => ({ ...prev, name: e.target.value }))}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 font-sans"
                placeholder="Your full name"
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="signup-company"
                className="block text-[11px] font-medium text-gray-600 uppercase tracking-wider mb-1.5 font-sans"
              >
                Company Name
              </label>
              <input
                id="signup-company"
                type="text"
                autoComplete="organization"
                value={signupForm.company_name}
                onChange={(e) => setSignupForm(prev => ({ ...prev, company_name: e.target.value }))}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 font-sans"
                placeholder="Your company"
              />
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="block text-[11px] font-medium text-gray-600 uppercase tracking-wider mb-1.5 font-sans"
              >
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={signupForm.email}
                onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 font-sans"
                placeholder="admin@company.com"
              />
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-[11px] font-medium text-gray-600 uppercase tracking-wider mb-1.5 font-sans"
              >
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={signupForm.password}
                onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 font-sans"
                placeholder="Min. 8 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 font-sans"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              disabled={loading}
              className="w-full text-xs text-gray-500 hover:text-gray-700 transition-colors font-sans bg-transparent border-none cursor-pointer"
            >
              Already have an account? Sign in
            </button>
          </form>
        )}

        {/* Login Form */}
        {mode === 'login' && (
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-medium text-gray-600 uppercase tracking-wider mb-1.5 font-sans"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 font-sans"
                placeholder="admin@boutinly.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[11px] font-medium text-gray-600 uppercase tracking-wider mb-1.5 font-sans"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 font-sans"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 font-sans"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(null); setSuccessMsg(null); }}
              className="w-full text-xs text-gray-500 hover:text-gray-700 transition-colors font-sans bg-transparent border-none cursor-pointer"
            >
              Forgot password?
            </button>

            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
              className="w-full text-xs text-indigo-600 hover:text-indigo-700 transition-colors font-sans bg-transparent border-none cursor-pointer font-medium"
            >
              Don't have an account? Create one
            </button>
          </form>
        )}

        <p className="text-[10px] text-gray-400 text-center mt-6 font-sans">
          Secured with HMAC-SHA256 &middot; Enterprise SSO Enabled
        </p>
      </div>
    </div>
  );
}
