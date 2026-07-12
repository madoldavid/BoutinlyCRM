/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '../store';
import { UserRole } from '../types';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CheckSquare,
  Mail,
  Sliders,
  Bell,
  Check,
  ShieldCheck,
  ChevronDown,
  UserCheck,
  Info
} from 'lucide-react';

export default function Sidebar() {
  const {
    currentUser,
    users,
    tasks,
    setCurrentUser,
    activeModule,
    setActiveModule,
    notifications,
    markNotificationRead,
    clearAllNotifications,
    activeTheme,
    setActiveTheme,
  } = useCRM();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Get unread notifications for current user
  const unreadNotifications = notifications.filter(
    n => n.user_id === currentUser.id && !n.read_at
  );

  const navigationItems = [
    { id: 'dashboard', label: 'Reports & Dashboards', icon: LayoutDashboard },
    { id: 'contacts', label: 'Contacts & Accounts', icon: Users },
    { id: 'deals', label: 'Sales Pipeline & Deals', icon: Briefcase },
    { id: 'tasks', label: 'Tasks & Activities', icon: CheckSquare },
    { id: 'emails', label: 'Email & Comms', icon: Mail },
    { id: 'admin', label: 'System Admin', icon: Sliders, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  ];

  const handleModuleClick = (moduleId: string) => {
    setActiveModule(moduleId);
  };

  const handleNotificationClick = (notifId: string, entityType: string) => {
    markNotificationRead(notifId);
    setShowNotifications(false);
    
    // Auto-navigate to appropriate tab
    if (entityType === 'task') {
      setActiveModule('tasks');
    } else if (entityType === 'deal') {
      setActiveModule('deals');
    } else if (entityType === 'contact') {
      setActiveModule('contacts');
    } else if (entityType === 'campaign') {
      setActiveModule('emails');
    }
  };

  // Human friendly names for roles
  const roleLabels: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Super Admin (Full Access)',
    [UserRole.ADMIN]: 'Admin (Full Access)',
    [UserRole.MANAGER]: 'Manager (Team Scope)',
    [UserRole.SALES_REP]: 'Sales Rep (Own Scope)',
    [UserRole.VIEWER]: 'Viewer (Read-Only)',
  };

  const roleDescriptions: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Full system access, manage custom fields, pipelines, audit logs, and invites.',
    [UserRole.ADMIN]: 'Full administrative control over all customer records, custom fields, and pipelines.',
    [UserRole.MANAGER]: 'Sees all records owned by their team members and aggregates team performance analytics.',
    [UserRole.SALES_REP]: 'Can only see and edit records they own. Ideal for high-security isolation.',
    [UserRole.VIEWER]: 'Can view all records and analytics across the entire organization, but cannot make edits.',
  };

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-100 flex flex-col h-screen border-r border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/10 rounded text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-wide text-white">Boutinly</h1>
            <span className="text-[10px] text-slate-400 font-sans">Active Workspace</span>
          </div>
        </div>
        
        {/* In-app Notification Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors relative cursor-pointer"
            id="notification-bell-btn"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications.length > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 text-slate-800 z-50 overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Notifications ({unreadNotifications.length})</span>
                {unreadNotifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-[10px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {unreadNotifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 font-sans">
                    No unread notifications
                  </div>
                ) : (
                  unreadNotifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, n.entity_type)}
                      className="p-3 hover:bg-slate-50 cursor-pointer transition-colors text-left"
                    >
                      <h4 className="text-xs font-semibold text-slate-800">{n.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-normal">{n.body}</p>
                      <span className="text-[9px] text-slate-400 mt-2 block font-sans">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Role Switcher & Profile Widget */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center justify-between p-2 hover:bg-slate-800 rounded-lg transition-colors text-left cursor-pointer group"
          id="role-switcher-btn"
        >
          <div className="flex items-center gap-2 min-w-0">
            {currentUser.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full border border-slate-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full border border-slate-700 bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">
                {currentUser.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{currentUser.name}</p>
              <p className="text-[10px] text-blue-400 truncate uppercase tracking-wider font-sans font-semibold">
                {currentUser.role.replace('_', ' ')}
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors shrink-0 ml-1" />
        </button>

        {showUserMenu && (
          <div className="absolute left-4 right-4 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 text-slate-800 z-50 py-1 divide-y divide-slate-100 max-h-80 overflow-y-auto">
            <div className="px-3 py-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Impersonate Role
            </div>
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => {
                  setCurrentUser(u.id);
                  setShowUserMenu(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                  u.id === currentUser.id ? 'bg-slate-50 text-blue-600 font-medium' : 'text-slate-800'
                }`}
              >
                <div>
                  <span className="block font-medium">{u.name}</span>
                  <span className="text-[10px] text-slate-500 uppercase font-sans tracking-wide">
                    {u.role.replace('_', ' ')}
                  </span>
                </div>
                {u.id === currentUser.id && <UserCheck className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            ))}
          </div>
        )}

        {/* Dynamic Role Capability Prompt */}
        <div className="mt-2.5 px-2 py-1.5 bg-slate-800/40 rounded border border-slate-800 flex gap-1.5 items-start">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-400 leading-normal font-sans">
            <strong>Scope Alert:</strong> {roleDescriptions[currentUser.role]}
          </p>
        </div>
      </div>

      {/* Navigation Modules */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-none">
        {navigationItems.map(item => {
          // If item is restricted to specific roles, check permission
          if (item.roles && !item.roles.includes(currentUser.role)) {
            return null;
          }

          const isActive = activeModule === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleModuleClick(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-all cursor-pointer group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
              id={`nav-${item.id}`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
              <span className="truncate">{item.label}</span>
              
              {/* Optional notifications bubble on side menu */}
              {item.id === 'tasks' && tasks.filter(t => t.assigned_to_id === currentUser.id && !t.completed_at && new Date(t.due_at) < new Date()).length > 0 && (
                <span className="ml-auto bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 text-[9px] rounded-full font-sans font-bold">
                  {tasks.filter(t => t.assigned_to_id === currentUser.id && !t.completed_at && new Date(t.due_at) < new Date()).length} OVERDUE
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Legal / Footnotes */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/40 text-[10px] text-slate-400 text-center font-sans">
        <div>Secure Environment</div>
        <div>boutinly.com</div>
      </div>
    </aside>
  );
}
