/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CRMProvider, useCRM } from './store';
import Sidebar from './components/Sidebar';
import ReportsModule from './components/ReportsModule';
import ContactsModule from './components/ContactsModule';
import PipelineModule from './components/PipelineModule';
import TasksModule from './components/TasksModule';
import EmailsModule from './components/EmailsModule';
import AdminModule from './components/AdminModule';
import LoginPage from './components/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShieldAlert, Loader2, WifiOff } from 'lucide-react';

function SplashScreen() {
  return (
    <div className="h-screen w-screen bg-gray-50 flex flex-col items-center justify-center gap-6 select-none">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      <div className="text-center space-y-1">
        <p className="text-sm text-gray-900 font-sans font-medium">Loading Boutinly CRM</p>
        <p className="text-xs text-gray-500 font-sans">Establishing secure enterprise session...</p>
      </div>
    </div>
  );
}

function OfflineBanner({ error }: { error: string }) {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2">
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <p className="text-[11px] text-amber-400 font-sans">
        {error} Some features may be limited.
      </p>
    </div>
  );
}

function DashboardLayout() {
  const { activeModule, currentUser, logout, apiError } = useCRM();

  // FR-AUTH-008: Immediate session lock upon user deactivation
  if (!currentUser?.is_active) {
    return (
      <div className="h-screen w-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-gray-900 select-none">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-8 text-center space-y-6 shadow-lg">
          <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-red-600 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold uppercase tracking-wider font-sans text-red-600">Security Credentials Revoked</h2>
            <p className="text-xs text-gray-500 leading-normal font-sans">
              Your session on tenant <strong>{currentUser.organization_id || 'this workspace'}</strong> has been deactivated by the system administrator. Database access privileges are revoked instantly.
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left space-y-2.5 font-sans text-[10px]">
            <div className="flex justify-between">
              <span className="text-gray-500">USER ID:</span>
              <span className="text-gray-700">{currentUser.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ROLE:</span>
              <span className="text-red-600">{currentUser.role.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">REASON:</span>
              <span className="text-amber-600">ADMINISTRATIVE_LOCK</span>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 font-sans italic">
            This activity has been appended to the immutable system audit trail.
          </p>

          <button
            onClick={logout}
            className="text-[11px] text-gray-500 hover:text-gray-700 font-sans underline"
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

  const getModuleTitle = () => {
    switch (activeModule) {
      case 'dashboard':
        return 'Reports & Analytics Dashboard';
      case 'contacts':
        return 'Contacts & Accounts';
      case 'deals':
        return 'Sales Pipeline & Opportunities';
      case 'tasks':
        return 'Tasks & Activity Timeline';
      case 'emails':
        return 'Email Outbox & Templates';
      case 'admin':
        return 'Boutinly CRM System Administration';
      default:
        return 'Boutinly';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans bg-theme-base text-theme-primary">

      {/* Left Navigation Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden h-full">

        {/* Offline/Error Banner */}
        {apiError && <OfflineBanner error={apiError} />}

        {/* Global Security / Status Top Bar */}
        <header className="h-14 bg-theme-card border-b border-theme-border px-6 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold text-theme-primary uppercase tracking-wider font-sans">
              {getModuleTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] text-theme-secondary">
              {currentUser?.name} &middot; {currentUser?.role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </div>
        </header>

        {/* Dynamic Inner Sub-Module Workspace */}
        <div className="flex-1 overflow-hidden flex flex-col bg-theme-base">
          <ErrorBoundary moduleName={getModuleTitle()}>
            {renderActiveModule()}
          </ErrorBoundary>
        </div>
      </div>

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
