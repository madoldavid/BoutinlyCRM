/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  AlertCircle, CheckCircle2,
  BarChart3, Users, Lock, TrendingUp, Zap, ArrowRight,
  Menu, X, GitBranch, Target, Phone, Mail, Layers,
  Globe, Server, Shield, Sparkles, Clock, Star,
  ChevronRight,
} from 'lucide-react';
import { ApiError, apiClient } from '../apiClient';
import { runtimeConfig } from '../runtimeConfig';
import { useCRM } from '../store';
import { Button, Input } from './ui';

interface LoginPageProps { onLoginSuccess: () => void; }
type PageMode = 'landing' | 'login' | 'mfa' | 'forgot' | 'reset' | 'signup';
interface OidcProvider { id: string; name: string; }

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { getOidcProviders } = useCRM();
  const [mode, setMode] = useState<PageMode>('landing');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [oidcProviders, setOidcProviders] = useState<OidcProvider[]>([]);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [signupForm, setSignupForm] = useState({ name: '', company_name: '', email: '', password: '' });
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  // URL token / OIDC
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) { setResetToken(token); setMode('reset'); }
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const oidcToken = hashParams.get('token');
    const oidcRefresh = hashParams.get('refresh_token');
    if (oidcToken) {
      apiClient.setToken(oidcToken);
      if (oidcRefresh) apiClient.setRefreshToken(oidcRefresh);
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
      onLoginSuccess();
    }
  }, []);

  useEffect(() => {
    getOidcProviders().then(providers => setOidcProviders(providers)).catch(() => {});
  }, [getOidcProviders]);

  const resetToLanding = () => { setMode('landing'); setError(null); setSuccessMsg(null); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!email.trim() || !password.trim()) { setError('Please enter both email and password.'); return; }
    setLoading(true);
    try {
      const r = await apiClient.login(email.trim(), password);
      if ('mfa_required' in r && r.mfa_required) { setMfaToken(r.mfa_token); setMode('mfa'); setLoading(false); return; }
      onLoginSuccess();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Connection failed.'); }
    finally { if (mode !== 'mfa') setLoading(false); }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (mfaCode.length !== 6) { setError('Enter a 6-digit code.'); return; }
    setLoading(true);
    try { await apiClient.mfaChallenge(mfaToken!, mfaCode); onLoginSuccess(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Verification failed.'); }
    finally { setLoading(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccessMsg(null);
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setLoading(true);
    try {
      const r = await apiClient.forgotPassword(email.trim());
      if (r.debug_token) { setSuccessMsg(`[DEV] Reset token: ${r.debug_token}`); setResetToken(r.debug_token); setMode('reset'); }
      else setSuccessMsg('If that email is registered, a reset link has been sent.');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Connection failed.'); }
    finally { setLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccessMsg(null);
    if (!resetToken.trim()) { setError('Reset token is required.'); return; }
    if (resetPassword.length < 8) { setError('Password must be 8+ characters.'); return; }
    setLoading(true);
    try { await apiClient.resetPassword(resetToken.trim(), resetPassword); setSuccessMsg('Password reset. Sign in below.'); setMode('login'); setPassword(''); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Connection failed.'); }
    finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const { name, company_name, email: se, password: sp } = signupForm;
    if (!name.trim() || !company_name.trim() || !se.trim() || !sp) { setError('All fields required.'); return; }
    if (sp.length < 8) { setError('Password must be 8+ characters.'); return; }
    setLoading(true);
    try { await apiClient.signup(name.trim(), se.trim(), sp, company_name.trim()); onLoginSuccess(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Connection failed.'); }
    finally { setLoading(false); }
  };

  const linkBtn = 'w-full text-xs text-theme-secondary hover:text-theme-primary transition-colors font-sans bg-transparent border-none cursor-pointer py-1';
  const isAuthMode = mode !== 'landing';
  const isLanding = mode === 'landing';

  // ── Shared SSO button renderer ──
  const ssoButtons = (label: string) => oidcProviders.length > 0 ? (
    oidcProviders.map(p => (
      <a key={p.id} href={`${runtimeConfig.apiUrl}/api/auth/oidc/login/${p.id}?redirect=/`}
        className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-theme-border rounded-lg text-sm font-semibold text-theme-primary hover:border-theme-accent/40 hover:bg-theme-hover transition-all cursor-pointer no-underline font-sans shadow-card">
        {p.id === 'google' ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
        )}
        {label} with {p.name}
      </a>
    ))
  ) : null;

  return (
    <div className={`font-sans bg-theme-base text-theme-primary ${isLanding ? '' : 'h-screen flex flex-col overflow-hidden'}`}>

      {/* ═══════ TOP NAV ═══════ */}
      <nav className={`${isLanding ? 'sticky top-0 z-50' : 'shrink-0'} h-16 bg-theme-base/85 backdrop-blur-md flex items-center justify-between px-6 lg:px-10 select-none border-b border-theme-border`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-theme-accent to-theme-accent-strong flex items-center justify-center shadow-card">
            <span className="font-display font-semibold text-[15px] text-white leading-none translate-y-px">B</span>
          </div>
          <span className="font-display font-semibold text-[19px] text-theme-primary tracking-tight">Boutinly</span>
          <span className="hidden sm:inline text-[10px] font-semibold text-theme-secondary uppercase tracking-[0.18em] mt-0.5">CRM</span>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {isAuthMode ? (
            <button onClick={resetToLanding} className="text-sm font-semibold text-theme-secondary hover:text-theme-primary px-4 py-2 rounded-lg cursor-pointer bg-transparent border-none transition-colors">← Back</button>
          ) : (
            <>
              <button onClick={() => setMode('login')} className="text-sm font-semibold text-theme-primary hover:bg-theme-hover px-4 py-2 rounded-lg cursor-pointer bg-transparent border-none transition-colors">Sign In</button>
              <button onClick={() => setMode('signup')} className="text-sm font-semibold text-white bg-theme-accent hover:bg-theme-accent-strong px-5 py-2.5 rounded-lg shadow-card cursor-pointer border-none transition-all flex items-center gap-1.5">Get Started <ArrowRight className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
        <button className="sm:hidden p-2 text-theme-primary bg-transparent border-none cursor-pointer" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-theme-card border-b border-theme-border px-6 py-4 flex flex-col gap-3 shadow-raised animate-overlay-in">
          {isAuthMode ? (
            <button onClick={() => { resetToLanding(); setMobileMenuOpen(false); }} className="text-sm font-semibold text-theme-secondary text-left bg-transparent border-none cursor-pointer py-2">← Back</button>
          ) : (
            <>
              <button onClick={() => { setMode('login'); setMobileMenuOpen(false); }} className="text-sm font-semibold text-theme-primary text-left bg-transparent border-none cursor-pointer py-2">Sign In</button>
              <button onClick={() => { setMode('signup'); setMobileMenuOpen(false); }} className="w-full text-sm font-semibold text-white bg-theme-accent py-2.5 rounded-lg shadow-card cursor-pointer border-none">Get Started</button>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
            LANDING PAGE — Full Scroll
         ═══════════════════════════════════════════════ */}
      {isLanding && (<>
        {/* ── HERO ── */}
        <section className="relative overflow-hidden">
          <div className="absolute top-10 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #0D5F4A 0%, transparent 70%)' }} />
          <div className="absolute -bottom-24 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #0D5F4A 0%, transparent 70%)' }} />
          <div className="max-w-6xl mx-auto px-6 lg:px-10 pt-24 pb-28 relative">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-theme-accent-soft border border-theme-accent/15 text-[11px] font-semibold text-theme-accent uppercase tracking-[0.14em] mb-8">
                <Zap className="w-3.5 h-3.5" /> The Modern Sales Platform
              </div>
              <h1 className="font-display text-[42px] sm:text-6xl lg:text-[68px] font-semibold text-theme-primary leading-[1.05]">
                Close more deals.<br />
                <span className="italic text-theme-accent">Less busywork.</span>
              </h1>
              <p className="mt-7 text-base lg:text-lg text-theme-secondary max-w-xl mx-auto leading-relaxed">
                Pipeline intelligence that shows its work. Role-scoped views your reps already know. Enterprise security without the enterprise complexity.
              </p>
              <div className="mt-10 flex items-center justify-center gap-3.5 flex-wrap">
                <button onClick={() => setMode('signup')} className="text-[15px] font-semibold text-white bg-theme-accent hover:bg-theme-accent-strong px-8 py-3.5 rounded-lg shadow-raised cursor-pointer border-none transition-all inline-flex items-center gap-2">
                  Start Free Trial <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => setMode('login')} className="text-[15px] font-semibold text-theme-primary hover:bg-theme-hover bg-theme-card border border-theme-border px-8 py-3.5 rounded-lg shadow-card cursor-pointer transition-all">
                  Sign In
                </button>
              </div>
              {ssoButtons('Continue') && (
                <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">{ssoButtons('Continue')}</div>
              )}
            </div>
          </div>
        </section>

        {/* ── TRUST BAR ── */}
        <section className="py-14 bg-theme-card border-y border-theme-border">
          <div className="max-w-6xl mx-auto px-6 lg:px-10">
            <p className="text-center text-[11px] font-semibold text-theme-secondary uppercase tracking-[0.18em] mb-8">Trusted by high-growth sales teams</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '99.9%', label: 'Uptime SLA' },
                { value: 'HMAC-SHA256', label: 'JWT Signing' },
                { value: 'SOC 2', label: 'Ready Architecture' },
                { value: 'GDPR', label: 'Compliant by Default' },
              ].map(s => (
                <div key={s.label} className="space-y-1.5">
                  <p className="font-display text-[26px] font-semibold text-theme-primary">{s.value}</p>
                  <p className="text-[11px] font-semibold text-theme-secondary uppercase tracking-[0.12em]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES: Pipeline Intelligence ── */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-6 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-soft border border-success/20 text-xs font-bold text-success uppercase tracking-wider mb-4">
                  <TrendingUp className="w-3 h-3" /> Pipeline Intelligence
                </div>
                <h2 className="font-display text-3xl lg:text-4xl font-semibold text-theme-primary leading-[1.12]">Every deal scored.<br />Every recommendation explained.</h2>
                <p className="mt-4 text-base text-theme-secondary leading-relaxed max-w-lg">
                  Boutinly scores every open deal 0–100 with a transparent factor breakdown — stage momentum, engagement recency, deal stagnation, and value sizing. Every next-best action comes with a written reason, not a black-box alert.
                </p>
                <div className="mt-6 space-y-3">
                  {['Explainable deal scoring (0–100 with factor breakdown)', 'AI next-best actions with written reasoning', 'Duplicate detection & data quality alerts', 'Forecast confidence ranges with variance bands'].map(t => (
                    <div key={t} className="flex items-center gap-2.5 text-sm"><CheckCircle2 className="w-4 h-4 text-success shrink-0" /><span className="text-theme-primary font-medium">{t}</span></div>
                  ))}
                </div>
              </div>
              <div className="bg-theme-card border border-theme-border rounded-2xl shadow-raised p-6 space-y-4">
                {/* Visual deal score card */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-theme-inset/50 border border-theme-border">
                  <div><p className="text-xs font-bold text-theme-primary">Acme Enterprise License</p><p className="text-2xs text-theme-secondary">Stage: Proposal Sent · $180k</p></div>
                  <div className="flex items-center gap-2"><span className="text-xl font-bold text-success">75</span><span className="text-2xs text-theme-secondary">/100</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: 'Stage Momentum', val: '+45', tone: 'text-success' },
                    { label: 'Urgency', val: '+6', tone: 'text-success' },
                    { label: 'Stagnation', val: '−12', tone: 'text-danger' },
                    { label: 'Engagement', val: '+8', tone: 'text-success' },
                  ].map(f => (
                    <div key={f.label} className="flex justify-between p-2 rounded bg-theme-inset/40"><span className="font-semibold text-theme-secondary">{f.label}</span><span className={`font-bold ${f.tone}`}>{f.val}</span></div>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-theme-accent/5 border border-theme-accent/10 text-xs text-theme-accent font-semibold flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" /> Next action: Schedule follow-up call — closing in 56 days
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES: Kanban Pipeline ── */}
        <section className="py-20 bg-theme-inset/30">
          <div className="max-w-6xl mx-auto px-6 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 bg-theme-card border border-theme-border rounded-2xl shadow-raised p-5 overflow-hidden">
                <div className="flex gap-3">
                  {['Lead', 'Qualified', 'Demo', 'Proposal', 'Negotiation'].map((s, i) => (
                    <div key={s} className="flex-1 bg-theme-inset rounded-lg p-3 border border-theme-border">
                      <div className="flex items-center justify-between mb-2"><span className="text-2xs font-bold text-theme-secondary uppercase">{s}</span><span className="text-2xs text-theme-accent font-bold">{(i+1)*2}</span></div>
                      <div className={`h-1.5 rounded-full mb-2 ${i < 3 ? 'bg-theme-accent/60' : 'bg-theme-border'}`} style={{width: `${100 - i*15}%`}} />
                      <div className="space-y-2">
                        {Array.from({length: i < 2 ? 2 : 1}).map((_,j) => (
                           <div key={j} className="bg-theme-card rounded-md p-2 border border-theme-border text-2xs font-semibold text-theme-primary shadow-card">Deal #{i+1}{j+1}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-center text-2xs text-theme-secondary mt-4 font-medium">Drag-and-drop kanban · instant stage transitions · audit-logged</p>
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning-soft border border-warning/20 text-xs font-bold text-warning uppercase tracking-wider mb-4">
                  <GitBranch className="w-3 h-3" /> Visual Pipeline
                </div>
                <h2 className="font-display text-3xl lg:text-4xl font-semibold text-theme-primary leading-[1.12]">Drag deals.<br /><span className="italic text-theme-accent">Ship revenue.</span></h2>
                <p className="mt-4 text-base text-theme-secondary leading-relaxed max-w-lg">
                  Your pipeline is a living board — drag cards between stages, close deals in one click, and see weighted forecasts update in real time. No spreadsheets. No status meetings.
                </p>
                <div className="mt-6 space-y-3">
                  {['Drag-and-drop kanban across pipeline stages', 'Instant close-win / close-lost with reason capture', 'List view with sortable columns & CSV export', 'Per-rep and team-leader scoped views'].map(t => (
                    <div key={t} className="flex items-center gap-2.5 text-sm"><CheckCircle2 className="w-4 h-4 text-success shrink-0" /><span className="text-theme-primary font-medium">{t}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES: Data Control ── */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-6 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-info-soft border border-info/20 text-xs font-bold text-info uppercase tracking-wider mb-4">
                  <Shield className="w-3 h-3" /> Enterprise Security
                </div>
                <h2 className="font-display text-3xl lg:text-4xl font-semibold text-theme-primary leading-[1.12]">Your data. Your rules.<br /><span className="italic text-theme-accent">Your control.</span></h2>
                <p className="mt-4 text-base text-theme-secondary leading-relaxed max-w-lg">
                  Tenant-isolated PostgreSQL with row-level security. Every login, deal move, and file upload is append-only audited. GDPR export and account deletion are built in — not bolted on.
                </p>
                <div className="mt-6 space-y-3">
                  {['PostgreSQL RLS per organization (tenant isolation)', 'Immutable audit trail on every mutation', 'JWT with key rotation & refresh token rotation', 'GDPR export / right-to-erasure endpoints'].map(t => (
                    <div key={t} className="flex items-center gap-2.5 text-sm"><CheckCircle2 className="w-4 h-4 text-success shrink-0" /><span className="text-theme-primary font-medium">{t}</span></div>
                  ))}
                </div>
              </div>
              <div className="bg-theme-card border border-theme-border rounded-2xl shadow-raised p-6 space-y-3">
                <div className="flex items-center justify-between p-3 bg-theme-inset/40 rounded border border-theme-border">
                  <div className="flex items-center gap-2.5"><Lock className="w-4 h-4 text-success" /><span className="text-xs font-bold text-theme-primary">Encryption at Rest</span></div><span className="text-2xs font-bold text-success bg-success-soft px-2 py-0.5 rounded">Enabled</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-theme-inset/40 rounded border border-theme-border">
                  <div className="flex items-center gap-2.5"><Server className="w-4 h-4 text-success" /><span className="text-xs font-bold text-theme-primary">Tenant Isolation (RLS)</span></div><span className="text-2xs font-bold text-success bg-success-soft px-2 py-0.5 rounded">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-theme-inset/40 rounded border border-theme-border">
                  <div className="flex items-center gap-2.5"><Shield className="w-4 h-4 text-success" /><span className="text-xs font-bold text-theme-primary">JWT Key Rotation</span></div><span className="text-2xs font-bold text-success bg-success-soft px-2 py-0.5 rounded">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-theme-inset/40 rounded border border-theme-border">
                  <div className="flex items-center gap-2.5"><Globe className="w-4 h-4 text-success" /><span className="text-xs font-bold text-theme-primary">GDPR Compliant</span></div><span className="text-2xs font-bold text-success bg-success-soft px-2 py-0.5 rounded">Ready</span>
                </div>
                <div className="pt-2 border-t border-theme-border text-center text-2xs text-theme-secondary font-medium">
                  Full audit trail · MFA enforcement · Rate limiting · CSRF protection
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="py-20 bg-theme-inset/30">
          <div className="max-w-6xl mx-auto px-6 lg:px-10">
            <div className="text-center mb-14">
              <h2 className="font-display text-3xl lg:text-4xl font-semibold text-theme-primary">Up and running in <span className="italic text-theme-accent">under 3 minutes</span></h2>
              <p className="mt-3 text-base text-theme-secondary max-w-lg mx-auto">No credit card. No sales call. Just a workspace that works.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: '01', icon: <Users className="w-5 h-5" />, title: 'Create your account', body: 'Sign up with email or Google/Microsoft SSO. Your organization and default pipeline are provisioned instantly.' },
                { step: '02', icon: <Target className="w-5 h-5" />, title: 'Import your deals', body: 'Add contacts and deals via CSV import or the quick-create form. Your pipeline board renders immediately.' },
                { step: '03', icon: <TrendingUp className="w-5 h-5" />, title: 'Start closing', body: 'Drag deals through stages, log calls and meetings, and watch your forecast update in real time.' },
              ].map(item => (
                <div key={item.step} className="bg-theme-card border border-theme-border rounded-2xl shadow-card p-6 relative hover:shadow-raised transition-shadow">
                   <span className="font-display italic text-5xl font-semibold text-theme-accent/15 absolute top-4 right-4 select-none">{item.step}</span>
                  <div className="w-10 h-10 rounded-lg bg-theme-accent/10 flex items-center justify-center text-theme-accent mb-4 relative z-10">
                    {item.icon}
                  </div>
                  <h3 className="text-sm font-bold text-theme-primary">{item.title}</h3>
                  <p className="text-xs text-theme-secondary mt-2 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ALL FEATURES GRID ── */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-6 lg:px-10">
            <div className="text-center mb-14">
              <h2 className="font-display text-3xl lg:text-4xl font-semibold text-theme-primary">Everything your sales team needs</h2>
              <p className="mt-3 text-base text-theme-secondary max-w-lg mx-auto">One platform. Every workflow. No integrations required.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: <BarChart3 className="w-5 h-5" />, title: 'Reports & Analytics', items: 'KPI dashboards, pipeline health, win/loss analysis, custom report builder' },
                { icon: <Users className="w-5 h-5" />, title: 'Contacts & Accounts', items: 'Full CRM, CSV import/export, merge dedup, custom fields, account hierarchy' },
                { icon: <GitBranch className="w-5 h-5" />, title: 'Pipeline & Deals', items: 'Kanban board, list view, drag-to-move, line items, close-win/loss with reasons' },
                { icon: <Clock className="w-5 h-5" />, title: 'Tasks & Calendar', items: 'Call logging, meeting scheduling, Google/Microsoft calendar sync, overdue alerts' },
                { icon: <Mail className="w-5 h-5" />, title: 'Email & Campaigns', items: 'HTML templates, variable substitution, campaign sending, open/click tracking' },
                { icon: <Shield className="w-5 h-5" />, title: 'Admin & Security', items: 'User management, role-based access, MFA, audit logs, custom fields, GDPR' },
                { icon: <Sparkles className="w-5 h-5" />, title: 'AI Scoring', items: 'Per-deal explainable scores, next-best actions, duplicate detection, forecasting' },
                { icon: <Layers className="w-5 h-5" />, title: 'Developer Ready', items: 'REST API, JWT auth, PostgreSQL, Docker, migration runner, feature flags' },
              ].map(f => (
                <div key={f.title} className="bg-theme-card border border-theme-border rounded-2xl shadow-card p-5 hover:border-theme-accent/30 hover:shadow-raised transition-all">
                  <div className="w-9 h-9 rounded-lg bg-theme-accent/10 flex items-center justify-center text-theme-accent mb-3">{f.icon}</div>
                  <h3 className="text-sm font-bold text-theme-primary">{f.title}</h3>
                  <p className="text-xs text-theme-secondary mt-1.5 leading-relaxed">{f.items}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="py-20 bg-sidebar-bg relative overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-[0.12]" style={{ background: 'radial-gradient(ellipse, #45B993 0%, transparent 70%)' }} />
          <div className="max-w-6xl mx-auto px-6 lg:px-10 relative">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10 text-center">
              {[
                { value: '10×', label: 'Faster than spreadsheets' },
                { value: '56ms', label: 'Avg API response time' },
                { value: '100%', label: 'Explainable AI decisions' },
                { value: '0', label: 'Data shared with vendors' },
              ].map(s => (
                <div key={s.label}>
                  <p className="font-display text-[44px] font-semibold text-sidebar-text">{s.value}</p>
                  <p className="text-sm font-medium text-sidebar-muted mt-2">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING / CTA ── */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 text-center">
            <h2 className="font-display text-3xl lg:text-4xl font-semibold text-theme-primary">Ready to <span className="italic text-theme-accent">close more deals?</span></h2>
            <p className="mt-4 text-base text-theme-secondary max-w-lg mx-auto leading-relaxed">
              Self-host or deploy to your cloud. PostgreSQL, Docker, and API-first — your infrastructure, your data.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
              <button onClick={() => setMode('signup')} className="text-[15px] font-semibold text-white bg-theme-accent hover:bg-theme-accent-strong px-10 py-4 rounded-lg shadow-raised cursor-pointer border-none transition-all inline-flex items-center gap-2">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => setMode('login')} className="text-[15px] font-semibold text-theme-primary hover:bg-theme-hover bg-theme-card border border-theme-border px-10 py-4 rounded-lg shadow-card cursor-pointer transition-all">
                Sign In to Workspace
              </button>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t border-theme-border bg-theme-card py-10">
          <div className="max-w-6xl mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-theme-secondary font-medium">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-theme-accent flex items-center justify-center">
                <span className="font-display font-semibold text-[10px] text-white leading-none">B</span>
              </div>
              <span className="font-display font-semibold text-sm text-theme-primary">Boutinly CRM</span>
            </div>
            <div className="flex items-center gap-6">
              <span>Enterprise SSO</span><span>·</span><span>HMAC-SHA256</span><span>·</span><span>PostgreSQL RLS</span><span>·</span><span>GDPR Compliant</span>
            </div>
          </div>
        </footer>
      </>)}

      {/* ═══════════════════════════════════════════════
            AUTH PAGES — Premium Split Layout
         ═══════════════════════════════════════════════ */}
      {isAuthMode && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left visual panel — deep evergreen ink */}
          <div className="hidden lg:flex w-[42%] relative overflow-hidden items-center justify-center" style={{ background: 'linear-gradient(165deg, #0B1A15 0%, #0E2A21 45%, #134535 100%)' }}>
            {/* Decorative circles */}
            <div className="absolute top-10 left-10 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />
            <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full opacity-8" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />
            <svg className="absolute inset-0 w-full h-full opacity-[0.06]" aria-hidden="true">
              <defs><pattern id="auth-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0L0 0 0 32" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs>
              <rect width="100%" height="100%" fill="url(#auth-grid)" />
            </svg>

            <div className="relative z-10 text-center px-10 max-w-sm">
              <div className="w-16 h-16 rounded-[20px] bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center mx-auto mb-7 shadow-lg">
                <span className="font-display font-semibold text-3xl text-white leading-none translate-y-0.5">B</span>
              </div>

              {mode === 'login' && (<>
                <h2 className="font-display text-[34px] font-semibold text-white leading-tight">Welcome back</h2>
                <p className="mt-3 text-base text-white/70 leading-relaxed">Sign in to pick up right where you left off. Your pipeline is waiting.</p>
                <div className="mt-8 space-y-4 text-left">
                  {[
                    { icon: <Lock className="w-4 h-4" />, text: 'Enterprise-grade HMAC-SHA256 JWT authentication' },
                    { icon: <Shield className="w-4 h-4" />, text: 'MFA with TOTP authenticator app support' },
                    { icon: <Globe className="w-4 h-4" />, text: 'SSO with Google Workspace & Microsoft Entra ID' },
                  ].map((f, i) => (
                    <div key={i} className="flex items-start gap-3 text-white/80">
                      <span className="shrink-0 w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">{f.icon}</span>
                      <span className="text-sm font-medium">{f.text}</span>
                    </div>
                  ))}
                </div>
              </>)}

              {mode === 'signup' && (<>
                <h2 className="font-display text-[34px] font-semibold text-white leading-tight">Start your journey</h2>
                <p className="mt-3 text-base text-white/70 leading-relaxed">Create your organization in under a minute. No credit card required.</p>
                <div className="mt-8 space-y-4 text-left">
                  {[
                    { icon: <Zap className="w-4 h-4" />, text: 'Instant org provisioning with default pipeline & stages' },
                    { icon: <Users className="w-4 h-4" />, text: 'Invite your team with role-based access controls' },
                    { icon: <TrendingUp className="w-4 h-4" />, text: 'AI deal scoring & next-best actions from day one' },
                  ].map((f, i) => (
                    <div key={i} className="flex items-start gap-3 text-white/80">
                      <span className="shrink-0 w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">{f.icon}</span>
                      <span className="text-sm font-medium">{f.text}</span>
                    </div>
                  ))}
                </div>
              </>)}

              {(mode === 'mfa' || mode === 'forgot' || mode === 'reset') && (<>
                <h2 className="font-display text-[34px] font-semibold text-white leading-tight">
                  {mode === 'mfa' && 'Verify identity'}
                  {mode === 'forgot' && 'Reset access'}
                  {mode === 'reset' && 'New credentials'}
                </h2>
                <p className="mt-3 text-base text-white/70 leading-relaxed">
                  {mode === 'mfa' && 'Enter the 6-digit code from your authenticator app to continue.'}
                  {mode === 'forgot' && 'Enter your email and we will send you a secure reset link.'}
                  {mode === 'reset' && 'Enter your reset token and choose a strong new password.'}
                </p>
              </>)}
            </div>
          </div>

          {/* Right form panel */}
          <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto bg-theme-base">
            <div className="w-full max-w-md animate-overlay-in">
              {/* Mobile-only header */}
              <div className="lg:hidden text-center mb-8">
                <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-theme-accent to-theme-accent-strong flex items-center justify-center mx-auto mb-4 shadow-raised"><span className="font-display font-semibold text-xl text-white leading-none translate-y-px">B</span></div>
                 <h2 className="font-display text-[22px] font-semibold text-theme-primary">
                  {mode === 'login' && 'Welcome back'}
                  {mode === 'signup' && 'Create your account'}
                  {mode === 'mfa' && 'Two-factor authentication'}
                  {mode === 'forgot' && 'Reset your password'}
                  {mode === 'reset' && 'Set new password'}
                </h2>
                <p className="text-xs text-theme-secondary mt-1">
                  {mode === 'login' && 'Sign in to your workspace'}
                  {mode === 'signup' && 'Set up your organization and super admin account'}
                  {mode === 'mfa' && 'Enter the 6-digit code from your authenticator app'}
                  {mode === 'forgot' && "We'll send a reset link to your email"}
                  {mode === 'reset' && 'Choose a new strong password'}
                </p>
              </div>

              {/* Desktop subtitle (beside the visual panel, the form stands alone) */}
              <div className="hidden lg:block mb-8">
                <p className="text-xs font-bold text-theme-secondary uppercase tracking-widest">
                  {mode === 'login' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'mfa' && 'Verify'}
                  {mode === 'forgot' && 'Recover Access'}
                  {mode === 'reset' && 'Reset Password'}
                </p>
                 <h2 className="font-display text-[28px] font-semibold text-theme-primary mt-2 leading-tight">
                  {mode === 'login' && 'Welcome back'}
                  {mode === 'signup' && 'Get started free'}
                  {mode === 'mfa' && 'Two-factor authentication'}
                  {mode === 'forgot' && 'Forgot your password?'}
                  {mode === 'reset' && 'Set a new password'}
                </h2>
              </div>

              {successMsg && <div className="flex items-start gap-3 p-4 bg-success-soft border border-success/20 rounded-xl mb-6 animate-fade-in shadow-sm"><CheckCircle2 className="w-5 h-5 text-success mt-0.5 shrink-0" /><p className="text-sm text-success font-semibold whitespace-pre-wrap">{successMsg}</p></div>}
              {error && <div className="flex items-start gap-3 p-4 bg-danger-soft border border-danger/20 rounded-xl mb-6 animate-fade-in shadow-sm" role="alert"><AlertCircle className="w-5 h-5 text-danger mt-0.5 shrink-0" /><p className="text-sm text-danger font-semibold">{error}</p></div>}

              {/* ── LOGIN ── */}
              {mode === 'login' && (
                <div className="bg-theme-card rounded-2xl border border-theme-border shadow-raised p-6 lg:p-8">
                  {ssoButtons('Sign in')}
                  {ssoButtons('Sign in') && <div className="flex items-center gap-3 my-5"><div className="flex-1 h-px bg-theme-border" /><span className="text-2xs text-theme-secondary/60 font-bold uppercase tracking-widest">or</span><div className="flex-1 h-px bg-theme-border" /></div>}
                  <form onSubmit={handleLogin} className="space-y-4">
                    <Input label="Email" id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} placeholder="you@company.com" autoFocus />
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="password" className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Password</label>
                        <button type="button" onClick={() => { setMode('forgot'); setError(null); setSuccessMsg(null); }} className="text-2xs font-bold text-theme-accent hover:opacity-80 bg-transparent border-none cursor-pointer">Forgot?</button>
                      </div>
                      <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} placeholder="Enter your password"
                         className="w-full h-11 bg-theme-card text-theme-primary text-sm border border-theme-border rounded-lg px-3.5 placeholder:text-theme-secondary/50 focus:border-theme-accent focus:ring-2 focus:ring-theme-accent/10 disabled:opacity-50 transition-colors font-sans" />
                    </div>
                    <Button type="submit" loading={loading} className="w-full h-11 text-sm font-bold rounded-lg">{loading ? 'Signing in…' : 'Sign In'}</Button>
                  </form>
                  <p className="text-center text-xs text-theme-secondary mt-5">
                    Don&apos;t have an account?{' '}
                    <button type="button" onClick={() => { setMode('signup'); setError(null); }} className="text-theme-accent font-bold hover:opacity-80 bg-transparent border-none cursor-pointer">Create one</button>
                  </p>
                </div>
              )}

              {/* ── SIGNUP ── */}
              {mode === 'signup' && (
                <div className="bg-theme-card rounded-2xl border border-theme-border shadow-raised p-6 lg:p-8">
                  {ssoButtons('Sign up')}
                  {ssoButtons('Sign up') && <div className="flex items-center gap-3 my-5"><div className="flex-1 h-px bg-theme-border" /><span className="text-2xs text-theme-secondary/60 font-bold uppercase tracking-widest">or with email</span><div className="flex-1 h-px bg-theme-border" /></div>}
                  <form onSubmit={handleSignup} className="space-y-4">
                    <Input label="Full Name" id="signup-name" type="text" autoComplete="name" value={signupForm.name} onChange={e => setSignupForm(p => ({ ...p, name: e.target.value }))} disabled={loading} placeholder="Your full name" autoFocus />
                    <Input label="Company Name" id="signup-company" type="text" autoComplete="organization" value={signupForm.company_name} onChange={e => setSignupForm(p => ({ ...p, company_name: e.target.value }))} disabled={loading} placeholder="Your company" />
                    <Input label="Work Email" id="signup-email" type="email" autoComplete="email" value={signupForm.email} onChange={e => setSignupForm(p => ({ ...p, email: e.target.value }))} disabled={loading} placeholder="admin@company.com" />
                    <Input label="Password" id="signup-password" type="password" autoComplete="new-password" value={signupForm.password} onChange={e => setSignupForm(p => ({ ...p, password: e.target.value }))} disabled={loading} placeholder="Min. 8 characters" />
                    <p className="text-xs text-theme-secondary/80 leading-relaxed">
                      Your account is created as the <span className="font-semibold text-theme-accent">System Administrator</span> of your organization. Add teammates later from the Admin panel and assign their role there.
                    </p>
                    <Button type="submit" loading={loading} className="w-full h-11 text-sm font-bold rounded-lg">{loading ? 'Creating Account…' : 'Create Free Account'}</Button>
                  </form>
                  <p className="text-center text-xs text-theme-secondary mt-5">
                    Already have an account?{' '}
                    <button type="button" onClick={() => { setMode('login'); setError(null); }} className="text-theme-accent font-bold hover:opacity-80 bg-transparent border-none cursor-pointer">Sign in</button>
                  </p>
                </div>
              )}

              {/* ── MFA ── */}
              {mode === 'mfa' && (
                <div className="bg-theme-card rounded-2xl border border-theme-border shadow-raised p-6 lg:p-8">
                  <form onSubmit={handleMfa} className="space-y-5">
                    <div>
                      <label htmlFor="mfa-code" className="block text-xs font-semibold text-theme-secondary uppercase tracking-wider mb-2 text-center">Authentication Code</label>
                      <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={loading}
                         className="w-full bg-theme-card border-2 border-theme-border rounded-xl px-3 py-4 text-center text-3xl tracking-[0.6em] text-theme-primary placeholder:text-theme-secondary/30 focus:border-theme-accent focus:ring-4 focus:ring-theme-accent/10 disabled:opacity-50 font-mono font-semibold transition-all" placeholder="000000" autoFocus />
                      <p className="text-center text-2xs text-theme-secondary/60 mt-2 font-medium">Enter the 6-digit code from your authenticator app</p>
                    </div>
                    <Button type="submit" loading={loading} disabled={mfaCode.length !== 6} className="w-full h-11 text-sm font-bold rounded-lg">{loading ? 'Verifying…' : 'Verify & Sign In'}</Button>
                  </form>
                  <button type="button" onClick={() => { setMode('login'); setMfaToken(null); setMfaCode(''); setError(null); }} disabled={loading} className="w-full text-center text-xs text-theme-secondary hover:text-theme-primary font-semibold mt-4 bg-transparent border-none cursor-pointer py-2">← Back to sign in</button>
                </div>
              )}

              {/* ── FORGOT ── */}
              {mode === 'forgot' && (
                <div className="bg-theme-card rounded-2xl border border-theme-border shadow-raised p-6 lg:p-8">
                  <form onSubmit={handleForgot} className="space-y-4">
                    <Input label="Email Address" id="forgot-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} placeholder="you@company.com" autoFocus />
                    <Button type="submit" loading={loading} className="w-full h-11 text-sm font-bold rounded-lg">{loading ? 'Sending Link…' : 'Send Reset Link'}</Button>
                  </form>
                  <button type="button" onClick={() => { setMode('login'); setError(null); }} disabled={loading} className="w-full text-center text-xs text-theme-secondary hover:text-theme-primary font-semibold mt-4 bg-transparent border-none cursor-pointer py-2">← Back to sign in</button>
                </div>
              )}

              {/* ── RESET ── */}
              {mode === 'reset' && (
                <div className="bg-theme-card rounded-2xl border border-theme-border shadow-raised p-6 lg:p-8">
                  <form onSubmit={handleReset} className="space-y-4">
                    <Input label="Reset Token" id="reset-token" type="text" value={resetToken} onChange={e => setResetToken(e.target.value)} disabled={loading} placeholder="Paste reset token from email" autoFocus={!resetToken} />
                    <Input label="New Password" id="reset-password" type="password" autoComplete="new-password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} disabled={loading} placeholder="Min. 8 characters" help="At least 8 characters — make it strong." />
                    <Button type="submit" loading={loading} disabled={resetPassword.length < 8} className="w-full h-11 text-sm font-bold rounded-lg">{loading ? 'Resetting…' : 'Set New Password'}</Button>
                  </form>
                  <button type="button" onClick={() => { setMode('login'); setError(null); }} disabled={loading} className="w-full text-center text-xs text-theme-secondary hover:text-theme-primary font-semibold mt-4 bg-transparent border-none cursor-pointer py-2">← Back to sign in</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
