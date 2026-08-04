/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
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
} from 'lucide-react';
import { UserRole } from './types';

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

function DashboardLayout() {
  const { activeModule, setActiveModule, currentUser, logout, apiError } = useCRM();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  // FR-AUTH-008: Immediate session lock upon user deactivation
  if (!currentUser?.is_active) {
    return (
      <div className="h-screen w-screen bg-theme-base flex flex-col items-center justify-center p-6 text-theme-primary select-none">
        <div className="max-w-md w-full bg-theme-card border border-danger/25 rounded-[14px] p-8 text-center space-y-6 shadow-overlay animate-overlay-in">
          <div className="w-16 h-16 bg-danger-soft rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-danger animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold uppercase tracking-wider font-sans text-danger">Security Credentials Revoked</h2>
            <p className="text-xs text-theme-secondary leading-normal font-sans">
              Your session on tenant <strong>{currentUser.organization_id || 'this workspace'}</strong> has been deactivated by the system administrator. Database access privileges are revoked instantly.
            </p>
          </div>

          <div className="bg-theme-inset p-4 rounded-xl border border-theme-border text-left space-y-2.5 font-mono text-[10px]">
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
    { id: 'emails', label: 'Email', icon: Mail },
    ...(currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.ADMIN
      ? [{ id: 'admin', label: 'Admin', icon: Sliders }]
      : []),
  ];

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

        {/* Enterprise Header Bar */}
        <header className="shrink-0 bg-theme-card border-b border-theme-border select-none">
          {/* Top row: breadcrumb + global actions */}
          <div className="h-12 px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <button
                className="lg:hidden p-1.5 -ml-1 text-theme-secondary hover:text-theme-primary rounded cursor-pointer bg-transparent border-none"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="text-xs text-theme-secondary font-sans font-medium hidden sm:block">Boutinly CRM</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.dispatchEvent(new Event('boutinly:open-palette'))}
                className="flex items-center gap-2 text-xs text-theme-secondary bg-theme-inset hover:bg-theme-hover border border-theme-border rounded-md px-3 py-1.5 cursor-pointer transition-colors w-44 sm:w-52"
                aria-label="Open global search (Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 text-left truncate">Search…</span>
                <kbd className="text-[9px] bg-theme-card border border-theme-border rounded px-1 py-px font-sans shrink-0">⌘K</kbd>
              </button>
              <button
                onClick={dispatchNewRecord}
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-white bg-theme-accent hover:opacity-90 rounded-md px-3 py-1.5 cursor-pointer transition-opacity shadow-card"
                aria-label="Create new record (N)"
                title="New record (N)"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
              <button
                onClick={() => window.dispatchEvent(new Event('boutinly:open-shortcuts'))}
                className="p-1.5 text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded-md cursor-pointer bg-transparent border-none"
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
              <div
                className="w-7 h-7 rounded-full bg-theme-accent-soft text-theme-accent flex items-center justify-center text-xs font-bold border border-theme-border"
                title={currentUser?.name}
                aria-label={`Signed in as ${currentUser?.name}`}
              >
                {currentUser?.name?.charAt(0)}
              </div>
            </div>
          </div>

          {/* Bottom row: enterprise tabs navigation */}
          <div className="flex items-center border-t border-theme-border overflow-x-auto scrollbar-none">
            <div className="flex px-2">
              {enterpriseTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveModule(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium font-sans whitespace-nowrap cursor-pointer transition-colors relative ${
                    activeModule === tab.id
                      ? 'text-theme-accent'
                      : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover/50'
                  }`}
                  aria-current={activeModule === tab.id ? 'page' : undefined}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {activeModule === tab.id && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-theme-accent rounded-full" />
                  )}
                </button>
              ))}
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
