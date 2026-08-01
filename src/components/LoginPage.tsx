/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  BarChart3,
  Users,
  Lock,
} from 'lucide-react';
import { ApiError, apiClient } from '../apiClient';
import { runtimeConfig } from '../runtimeConfig';
import { Button, Input } from './ui';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

type PageMode = 'login' | 'mfa' | 'forgot' | 'reset' | 'signup';

interface OidcProvider {
  id: string;
  name: string;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<PageMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [oidcProviders, setOidcProviders] = useState<OidcProvider[]>([]);

  // MFA state
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // Signup state
  const [signupForm, setSignupForm] = useState({ name: '', company_name: '', email: '', password: '' });

  // Password reset state
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  // Check for reset token or OIDC callback in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setMode('reset');
    }

    // OIDC callback — token is in the URL hash
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const oidcToken = hashParams.get('token');
    const oidcRefreshToken = hashParams.get('refresh_token');
    if (oidcToken) {
      apiClient.setToken(oidcToken);
      if (oidcRefreshToken) apiClient.setRefreshToken(oidcRefreshToken);
      // Clean the URL
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
      onLoginSuccess();
    }
  }, []);

  // Fetch configured SSO providers
  useEffect(() => {
    const baseUrl = runtimeConfig.apiUrl;
    fetch(`${baseUrl}/api/auth/oidc/providers`)
      .then(r => r.json())
      .then(data => setOidcProviders(data.providers || []))
      .catch(() => {});
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
      const result = await apiClient.forgotPassword(email.trim());
      // In dev mode, show the debug token so the user can test the reset flow
      if (result.debug_token) {
        setSuccessMsg(`[DEV] Reset token: ${result.debug_token}\nUse this token on the Reset Password form. In production, this would be delivered via email.`);
        setResetToken(result.debug_token);
        setMode('reset');
      } else {
        setSuccessMsg('If that email is registered, a password reset link has been sent.');
      }
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

  const linkBtn = 'w-full text-xs text-theme-secondary hover:text-theme-primary transition-colors font-sans bg-transparent border-none cursor-pointer py-1';

  const modeMeta: Record<PageMode, { title: string; subtitle: string }> = {
    login: { title: 'Welcome back', subtitle: 'Sign in to your workspace' },
    mfa: { title: 'Two-factor authentication', subtitle: 'Enter the 6-digit code from your authenticator app' },
    forgot: { title: 'Reset your password', subtitle: "Enter your email and we'll send you a reset link" },
    reset: { title: 'Set new password', subtitle: 'Enter your reset token and choose a new password' },
    signup: { title: 'Create your account', subtitle: 'Set up your organization and super admin account' },
  };

  return (
    <div className="h-screen w-screen flex select-none bg-theme-base">

      {/* Left brand panel — uses dedicated dark palette via CSS custom properties */}
      <div
        className="hidden lg:flex w-[44%] flex-col justify-between p-12 relative overflow-hidden login-brand-panel"
        style={{ backgroundColor: 'var(--brand-bg)' }}
        aria-hidden="true"
      >
        {/* Decorative background */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.07]" aria-hidden="true">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--brand-accent)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, var(--brand-glow-1) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -left-20 w-[28rem] h-[28rem] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--brand-glow-2) 0%, transparent 70%)' }}
        />

        {/* Brand */}
        <div className="relative flex items-center gap-2.5">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--brand-surface)' }}>
            <ShieldCheck className="w-6 h-6" style={{ color: 'var(--brand-accent)' }} />
          </div>
          <div>
            <h1 className="font-semibold text-base tracking-wide" style={{ color: 'var(--brand-text)' }}>Boutinly</h1>
            <span className="text-2xs" style={{ color: 'var(--brand-muted)' }}>Enterprise CRM</span>
          </div>
        </div>

        {/* Value proposition */}
        <div className="relative max-w-sm">
          <h2 className="text-2xl font-semibold leading-snug" style={{ color: 'var(--brand-text)' }}>
            The revenue platform built for serious sales teams.
          </h2>
          <div className="mt-8 space-y-5">
            {[
              { icon: <BarChart3 className="w-4 h-4" />, title: 'Pipeline intelligence', body: 'Forecasting, win/loss analytics, and custom reporting out of the box.' },
              { icon: <Users className="w-4 h-4" />, title: 'Team-scoped access', body: 'Role-based permissions with tenant isolation and full audit trails.' },
              { icon: <Lock className="w-4 h-4" />, title: 'Enterprise security', body: 'MFA, session revocation, and encrypted credentials as standard.' },
            ].map(f => (
              <div key={f.title} className="flex gap-3">
                <span
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: 'var(--brand-surface)', color: 'var(--brand-accent)' }}
                >
                  {f.icon}
                </span>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--brand-text)' }}>{f.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--brand-muted)' }}>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-2xs" style={{ color: 'var(--brand-muted)' }}>
          Secured with HMAC-SHA256 &middot; boutinly.com
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-sm animate-overlay-in">

          {/* Mobile-only brand */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 bg-theme-accent-soft rounded-xl flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6 text-theme-accent" />
            </div>
            <h1 className="text-lg font-semibold text-theme-primary font-sans">Boutinly CRM</h1>
          </div>

          {/* Heading */}
          <div className="mb-6">
            {mode === 'mfa' && (
              <div className="w-11 h-11 bg-theme-accent-soft rounded-full flex items-center justify-center mb-4">
                <KeyRound className="w-5 h-5 text-theme-accent" />
              </div>
            )}
            <h2 className="text-xl font-semibold text-theme-primary font-sans">{modeMeta[mode].title}</h2>
            <p className="text-xs text-theme-secondary mt-1">{modeMeta[mode].subtitle}</p>
          </div>

          {/* Success / error banners */}
          {successMsg && (
            <div className="flex items-start gap-2 p-3 bg-success-soft border border-success/20 rounded-lg mb-4 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
              <p className="text-xs text-success font-sans">{successMsg}</p>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-danger-soft border border-danger/20 rounded-lg mb-4 animate-fade-in" role="alert">
              <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
              <p className="text-xs text-danger font-sans">{error}</p>
            </div>
          )}

          {/* LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                placeholder="admin@boutinly.com"
                autoFocus
              />
              <Input
                label="Password"
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                placeholder="Enter password"
              />
              <Button type="submit" loading={loading} className="w-full">
                {loading ? 'Authenticating…' : 'Sign In'}
              </Button>

              {oidcProviders.length > 0 && (
                <>
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-theme-border" />
                    <span className="text-2xs text-theme-secondary">or continue with</span>
                    <div className="flex-1 h-px bg-theme-border" />
                  </div>
                  {oidcProviders.map(p => (
                    <a
                      key={p.id}
                      href={`${runtimeConfig.apiUrl}/api/auth/oidc/login/${p.id}?redirect=/`}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-theme-border rounded-md text-xs font-medium text-theme-primary hover:bg-theme-hover transition-colors cursor-pointer no-underline font-sans"
                    >
                      {p.id === 'google' ? '🔵' : '🟦'} Sign in with {p.name}
                    </a>
                  ))}
                </>
              )}

              <button type="button" onClick={() => { setMode('forgot'); setError(null); setSuccessMsg(null); }} className={linkBtn}>
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
                className="w-full text-xs text-theme-accent hover:opacity-80 transition-opacity font-sans font-medium bg-transparent border-none cursor-pointer py-1"
              >
                Don't have an account? Create one
              </button>
            </form>
          )}

          {/* MFA */}
          {mode === 'mfa' && (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                className="w-full bg-theme-card border border-theme-border rounded-lg px-3 py-3 text-center text-2xl tracking-[0.5em] text-theme-primary placeholder:text-theme-secondary/40 focus:border-theme-accent disabled:opacity-50 font-mono tnum"
                placeholder="000000"
                autoFocus
                aria-label="6-digit verification code"
              />
              <Button type="submit" loading={loading} disabled={mfaCode.length !== 6} className="w-full">
                {loading ? 'Verifying…' : 'Verify Code'}
              </Button>
              <button
                type="button"
                onClick={() => { setMode('login'); setMfaToken(null); setMfaCode(''); setError(null); }}
                disabled={loading}
                className={linkBtn}
              >
                Back to sign in
              </button>
            </form>
          )}

          {/* FORGOT */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <Input
                label="Email"
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                placeholder="admin@boutinly.com"
                autoFocus
              />
              <Button type="submit" loading={loading} className="w-full">
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Button>
              <button type="button" onClick={() => { setMode('login'); setError(null); }} disabled={loading} className={linkBtn}>
                Back to sign in
              </button>
            </form>
          )}

          {/* RESET */}
          {mode === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <Input
                label="Reset Token"
                id="reset-token"
                type="text"
                value={resetToken}
                onChange={e => setResetToken(e.target.value)}
                disabled={loading}
                placeholder="Paste reset token from email"
                autoFocus={!resetToken}
              />
              <Input
                label="New Password"
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                disabled={loading}
                placeholder="Min. 8 characters"
                help="Must be at least 8 characters."
              />
              <Button type="submit" loading={loading} disabled={resetPassword.length < 8} className="w-full">
                {loading ? 'Resetting…' : 'Reset Password'}
              </Button>
              <button type="button" onClick={() => { setMode('login'); setError(null); }} disabled={loading} className={linkBtn}>
                Back to sign in
              </button>
            </form>
          )}

          {/* SIGNUP */}
          {mode === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <Input
                label="Full Name"
                id="signup-name"
                type="text"
                autoComplete="name"
                value={signupForm.name}
                onChange={e => setSignupForm(prev => ({ ...prev, name: e.target.value }))}
                disabled={loading}
                placeholder="Your full name"
                autoFocus
              />
              <Input
                label="Company Name"
                id="signup-company"
                type="text"
                autoComplete="organization"
                value={signupForm.company_name}
                onChange={e => setSignupForm(prev => ({ ...prev, company_name: e.target.value }))}
                disabled={loading}
                placeholder="Your company"
              />
              <Input
                label="Email"
                id="signup-email"
                type="email"
                autoComplete="email"
                value={signupForm.email}
                onChange={e => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                disabled={loading}
                placeholder="admin@company.com"
              />
              <Input
                label="Password"
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={signupForm.password}
                onChange={e => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                disabled={loading}
                placeholder="Min. 8 characters"
              />
              <Button type="submit" loading={loading} className="w-full">
                {loading ? 'Creating Account…' : 'Create Account'}
              </Button>
              <button type="button" onClick={() => { setMode('login'); setError(null); }} disabled={loading} className={linkBtn}>
                Already have an account? Sign in
              </button>
            </form>
          )}

          <p className="text-[10px] text-theme-secondary/60 text-center mt-8 font-sans lg:hidden">
            Secured with HMAC-SHA256 &middot; Enterprise SSO Enabled
          </p>
        </div>
      </div>
    </div>
  );
}
