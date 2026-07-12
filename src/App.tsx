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
import { ShieldAlert, Cpu, Database, CheckCircle } from 'lucide-react';

function DashboardLayout() {
  const { activeModule, currentUser } = useCRM();

  // FR-AUTH-008: Immediate session lock upon user deactivation
  if (!currentUser.is_active) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white select-none">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-lg font-bold uppercase tracking-wider font-sans text-red-500">Security Credentials Revoked</h2>
            <p className="text-xs text-slate-400 leading-normal font-sans">
              Your session on tenant **boutinly.com** has been deactivated by the system administrator. Database access privileges are revoked instantly.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left space-y-2.5 font-sans text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-500">USER ID:</span>
              <span className="text-slate-300">{currentUser.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ROLE:</span>
              <span className="text-red-400">{currentUser.role.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">REASON:</span>
              <span className="text-amber-500">ADMINISTRATIVE_LOCK</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 font-sans italic">
            This activity has been appended to the immutable system audit trail.
          </p>
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
        
        {/* Global Security / Status Top Bar */}
        <header className="h-14 bg-theme-card border-b border-theme-border px-6 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold text-theme-primary uppercase tracking-wider font-sans">
              {getModuleTitle()}
            </h2>
          </div>

          <div className="text-[11px] text-theme-secondary">
            System Active
          </div>
        </header>

        {/* Dynamic Inner Sub-Module Workspace */}
        <div className="flex-1 overflow-hidden flex flex-col bg-theme-base">
          {renderActiveModule()}
        </div>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <CRMProvider>
      <DashboardLayout />
    </CRMProvider>
  );
}
