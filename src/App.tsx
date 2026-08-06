/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState, useRef, useEffect } from 'react';
import { CRMProvider, useCRM } from './store';
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import CommandPalette from './components/CommandPalette';
import GlobalShortcuts, { dispatchNewRecord } from './components/GlobalShortcuts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastViewport, Skeleton, AppLauncher, getDefaultApps } from './components/ui';
import {
  ShieldAlert, Loader2, WifiOff, Search, Menu, Plus, HelpCircle,
  LayoutDashboard, Users, Briefcase, CheckSquare, Mail, Sliders,
  ChevronDown, LogOut, Settings,
} from 'lucide-react';
import { UserRole } from './types';
import { useFeatureFlag } from './utils/featureFlags';

const ReportsModule = React.lazy(() => import('./components/ReportsModule'));
const ContactsModule = React.lazy(() => import('./components/ContactsModule'));
const PipelineModule = React.lazy(() => import('./components/PipelineModule'));
const TasksModule = React.lazy(() => import('./components/TasksModule'));
const EmailsModule = React.lazy(() => import('./components/EmailsModule'));
const AdminModule = React.lazy(() => import('./components/AdminModule'));

function ModuleSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-4 overflow-hidden bg-theme-base">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

function SplashScreen() {
  return (
    <div className="h-screen w-screen bg-theme-base flex flex-col items-center justify-center gap-6 select-none">
      <Loader2 className="w-8 h-8 text-theme-accent animate-spin" />
      <div className="text-center space-y-1">
        <p className="text-sm text-theme-primary font-sans font-medium">Loading Boutinly CRM</p>
        <p className="text-xs text-theme-secondary font-sans">Establishing secure enterprise session...</p>
      </div>
    </div>
  );
}

function OfflineBanner({ error }: { error: string }) {
  return (
    <div className="bg-warning-soft border-b border-warning/20 px-4 py-2 flex items-center gap-2" role="status">
      <WifiOff className="w-3.5 h-3.5 text-warning shrink-0" />
      <p className="text-[11px] text-warning font-sans">
        {error} Some features may be limited.
      </p>
    </div>
  );
}

function UserMenu({ currentUser, logout, setActiveModule }: {
  currentUser: { name?: string; email?: string; role?: string } | null;
  logout: () => void;
  setActiveModule: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (currentUser?.name || '?').charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const roleLabel = currentUser?.role?.replace(/_/g, ' ') ?? 'User';
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-theme-accent-soft text-theme-accent flex items-center justify-center text-xs font-semibold ring-1 ring-inset ring-theme-accent/15 hover:ring-theme-accent/40 transition-all cursor-pointer border-none"
        title={currentUser?.name}
        aria-label={`Signed in as ${currentUser?.name}. Click for account menu.`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-theme-card border border-theme-border rounded-xl shadow-overlay z-[90] animate-overlay-in overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-theme-border">
            <p className="text-sm font-semibold text-theme-primary font-sans truncate">{currentUser?.name || 'Unknown'}</p>
            <p className="text-xs text-theme-secondary mt-0.5 font-sans truncate">{currentUser?.email || ''}</p>
            <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-theme-accent-soft text-theme-accent font-sans">
              {roleLabel}
            </span>
          </div>

          {/* Actions */}
          <div className="py-1">
            {isAdmin && (
              <button
                onClick={() => { setActiveModule('admin'); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-theme-primary hover:bg-theme-hover transition-colors cursor-pointer border-none bg-transparent text-left font-sans"
              >
                <Settings className="w-3.5 h-3.5 text-theme-secondary" />
                Administration
              </button>
            )}
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-danger hover:bg-danger-soft/20 transition-colors cursor-pointer border-none bg-transparent text-left font-sans"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardLayout() {
  const { activeModule, setActiveModule, currentUser, logout, apiError } = useCRM();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [moduleSwitcherOpen, setModuleSwitcherOpen] = useState(false);
  const emailModuleEnabled = useFeatureFlag('email_module');

  // FR-AUTH-008: Immediate session lock upon user deactivation
  if (!currentUser?.is_active) {
    return (
      <div className="h-screen w-screen bg-theme-base flex flex-col items-center justify-center p-6 text-theme-primary select-none">
        <div className="max-w-md w-full bg-theme-card border border-danger/25 rounded-2xl p-8 text-center space-y-6 shadow-overlay animate-overlay-in">
          <div className="w-16 h-16 bg-danger-soft rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-danger animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold uppercase tracking-wider font-sans text-danger">Security Credentials Revoked</h2>
            <p className="text-xs text-theme-secondary leading-normal font-sans">
              Your session on tenant <strong>{currentUser.organization_id || 'this workspace'}</strong> has been deactivated by the system administrator. Database access privileges are revoked instantly.
            </p>
          </div>

          <div className="bg-theme-inset p-4 rounded-lg border border-theme-border text-left space-y-2.5 font-mono text-[10px]">
            <div className="flex justify-between">
              <span className="text-theme-secondary">USER ID:</span>
              <span className="text-theme-primary">{currentUser.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-theme-secondary">ROLE:</span>
              <span className="text-danger">{currentUser.role.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-theme-secondary">REASON:</span>
              <span className="text-warning">ADMINISTRATIVE_LOCK</span>
            </div>
          </div>

          <p className="text-[10px] text-theme-secondary/70 font-sans italic">
            This activity has been appended to the immutable system audit trail.
          </p>

          <button
            onClick={logout}
            className="text-[11px] text-theme-secondary hover:text-theme-primary font-sans underline cursor-pointer"
          >
            Return to login
          </button>
        </div>
      </div>
    );
  }

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <ReportsModule />;
      case 'contacts':
        return <ContactsModule />;
      case 'deals':
        return <PipelineModule />;
      case 'tasks':
        return <TasksModule />;
      case 'emails':
        return <EmailsModule />;
      case 'admin':
        return <AdminModule />;
      default:
        return <ReportsModule />;
    }
  };

  const enterpriseTabs = [
    { id: 'dashboard', label: 'Dashboards', icon: LayoutDashboard },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'deals', label: 'Pipeline', icon: Briefcase },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    ...(emailModuleEnabled ? [{ id: 'emails' as const, label: 'Email', icon: Mail }] : []),
    ...(currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.ADMIN
      ? [{ id: 'admin', label: 'Administration', icon: Sliders }]
      : []),
  ];

  const activeTab = enterpriseTabs.find(t => t.id === activeModule);
  const apps = React.useMemo(() => getDefaultApps(activeModule, (id) => setActiveModule(id)), [activeModule, setActiveModule]);

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans bg-theme-base text-theme-primary">

      {/* Mobile hamburger button */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-70 bg-black/40 backdrop-blur-[2px]" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Left Navigation Sidebar — fixed overlay on mobile, static on desktop */}
      <div className={`${mobileSidebarOpen ? 'sidebar-mobile-visible' : 'sidebar-mobile-hidden'} sidebar-mobile-overlay lg:relative lg:translate-x-0`}>
        <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main Container */}
      <div id="main-content" className="flex-1 flex flex-col overflow-hidden h-full" role="main">

        {/* Offline/Error Banner */}
        {apiError && <OfflineBanner error={apiError} />}

        {/* Workspace Header — slim utility bar */}
        <header className="shrink-0 bg-theme-card border-b border-theme-border select-none">
          <div className="h-14 px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="lg:hidden p-1.5 -ml-1 text-theme-secondary hover:text-theme-primary rounded-md cursor-pointer bg-transparent border-none"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5 min-w-0">
                {activeTab && <activeTab.icon className="w-4 h-4 text-theme-accent shrink-0 hidden sm:block" strokeWidth={2} />}
                <div className="relative">
                  <button
                    onClick={() => setModuleSwitcherOpen(o => !o)}
                    className="flex items-center gap-1 text-base font-semibold text-theme-primary font-sans tracking-tight truncate hover:text-theme-accent transition-colors cursor-pointer bg-transparent border-none"
                    title="Switch module"
                    aria-label={`Current module: ${activeTab?.label ?? 'Workspace'}. Click to switch.`}
                    aria-expanded={moduleSwitcherOpen}
                    aria-haspopup="true"
                  >
                    <h1 className="text-base font-semibold text-inherit font-sans tracking-tight truncate">
                      {activeTab?.label ?? 'Workspace'}
                    </h1>
                    <ChevronDown className={`w-3.5 h-3.5 text-theme-secondary shrink-0 transition-transform ${moduleSwitcherOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {moduleSwitcherOpen && (
                    <>
                      <div className="fixed inset-0 z-[90]" onClick={() => setModuleSwitcherOpen(false)} />
                      <div className="absolute top-full left-0 mt-1.5 w-52 bg-theme-card border border-theme-border rounded-xl shadow-overlay z-[91] animate-overlay-in overflow-hidden">
                        <div className="py-1">
                          {enterpriseTabs.map(tab => (
                            <button
                              key={tab.id}
                              onClick={() => { setActiveModule(tab.id); setModuleSwitcherOpen(false); }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer border-none text-left font-sans transition-colors ${
                                tab.id === activeModule
                                  ? 'bg-theme-accent-soft text-theme-accent font-semibold'
                                  : 'text-theme-primary hover:bg-theme-hover'
                              }`}
                            >
                              <tab.icon className="w-3.5 h-3.5 shrink-0" />
                              <span className="flex-1">{tab.label}</span>
                              {tab.id === activeModule && (
                                <span className="w-1.5 h-1.5 rounded-full bg-theme-accent" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.dispatchEvent(new Event('boutinly:open-palette'))}
                className="flex items-center gap-2 text-sm text-theme-primary bg-theme-inset hover:bg-theme-hover border border-theme-border rounded-lg px-3 h-9 cursor-pointer transition-colors w-36 sm:w-52 min-w-0"
                aria-label="Open global search (Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5 shrink-0 text-theme-secondary" />
                <span className="flex-1 text-left text-xs text-theme-secondary">Search…</span>
                <kbd className="shrink-0 hidden sm:block">⌘K</kbd>
              </button>
              <button
                onClick={dispatchNewRecord}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-theme-accent hover:bg-theme-accent-strong rounded-lg px-3.5 h-9 cursor-pointer transition-colors shadow-card shrink-0"
                aria-label="Create new record (N)"
                title="New record (N)"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
              <div className="w-px h-5 bg-theme-border mx-1 hidden sm:block" aria-hidden="true" />
              <button
                onClick={() => window.dispatchEvent(new Event('boutinly:open-shortcuts'))}
                className="p-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded-lg cursor-pointer bg-transparent border-none"
                aria-label="Keyboard shortcuts (?)"
                title="Keyboard shortcuts (?)"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <AppLauncher
                apps={apps}
                activeAppId={activeModule}
                onSelect={(id) => setActiveModule(id)}
                currentUserRole={currentUser?.role ?? 'viewer'}
              />
              <UserMenu
                currentUser={currentUser}
                logout={logout}
                setActiveModule={setActiveModule}
              />
            </div>
          </div>
        </header>

        {/* Dynamic Inner Sub-Module Workspace */}
        <div className="flex-1 overflow-hidden flex flex-col bg-theme-base">
          <ErrorBoundary moduleName={enterpriseTabs.find(t => t.id === activeModule)?.label || 'Module'}>
            <Suspense fallback={<ModuleSkeleton />}>
              {renderActiveModule()}
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>

      {/* Global overlays */}
      <CommandPalette />
      <GlobalShortcuts />
      <ToastViewport />

    </div>
  );
}

function AppContent() {
  const { isAuthenticated, initialLoading, refreshAuthFromClient } = useCRM();

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={refreshAuthFromClient} />;
  }

  if (initialLoading) {
    return <SplashScreen />;
  }

  return <DashboardLayout />;
}

export default function App() {
  return (
    <CRMProvider>
      <AppContent />
    </CRMProvider>
  );
}
