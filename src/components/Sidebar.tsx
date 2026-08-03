/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '../store';
import { runtimeConfig } from '../runtimeConfig';
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
  Info,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('boutinly_sidebar_collapsed') === '1'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem('boutinly_sidebar_collapsed', next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
    setShowUserMenu(false);
    setShowNotifications(false);
  };

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
    onNavigate?.();
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
    onNavigate?.();
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
    <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-theme-card text-theme-primary flex flex-col h-screen border-r border-theme-border shrink-0 select-none transition-[width] duration-200`}>
      {/* Brand Header */}
      <div className={`border-b border-theme-border flex items-center ${collapsed ? 'p-3 justify-center' : 'p-5 justify-between'}`}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-theme-accent/10 rounded text-theme-accent">
            <ShieldCheck className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-display font-extrabold text-sm tracking-tight text-theme-primary">Boutinly</h1>
              <span className="text-[10px] text-theme-secondary font-sans">Sovereign CRM</span>
            </div>
          )}
        </div>
        {/* In-app Notification Trigger */}
        {!collapsed && (
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1.5 hover:bg-theme-hover rounded-md text-theme-secondary hover:text-theme-primary transition-colors relative cursor-pointer"
            id="notification-bell-btn"
            aria-label={`Notifications, ${unreadNotifications.length} unread`}
            aria-expanded={showNotifications}
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications.length > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-theme-accent rounded-full animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-theme-card rounded-[10px] shadow-overlay border border-theme-border text-theme-primary z-50 overflow-hidden animate-overlay-in">
              <div className="p-3 bg-theme-inset border-b border-theme-border flex items-center justify-between">
                <span className="text-xs font-semibold text-theme-primary">Notifications ({unreadNotifications.length})</span>
                {unreadNotifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-[10px] font-medium text-theme-accent hover:opacity-80 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-theme-border">
                {unreadNotifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-theme-secondary font-sans">
                    No unread notifications
                  </div>
                ) : (
                  unreadNotifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, n.entity_type)}
                      className="p-3 hover:bg-theme-base cursor-pointer transition-colors text-left"
                    >
                      <h4 className="text-xs font-semibold text-theme-primary">{n.title}</h4>
                      <p className="text-[11px] text-theme-secondary mt-1 leading-normal">{n.body}</p>
                      <span className="text-[9px] text-theme-secondary/70 mt-2 block font-sans">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Role Switcher & Profile Widget */}
      <div className={`border-b border-theme-border bg-theme-base/50 relative ${collapsed ? 'p-2' : 'p-4'}`}>
        <button
          onClick={() => (collapsed ? toggleCollapsed() : setShowUserMenu(!showUserMenu))}
          className={`w-full flex items-center p-2 hover:bg-theme-base rounded-lg transition-colors text-left cursor-pointer group ${collapsed ? 'justify-center' : 'justify-between'}`}
          id="role-switcher-btn"
          title={collapsed ? `${currentUser.name} — expand sidebar` : undefined}
        >
          <div className="flex items-center gap-2 min-w-0">
            {currentUser.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full border border-theme-border object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full border border-theme-border bg-theme-accent/10 flex items-center justify-center text-theme-accent text-xs font-bold shrink-0">
                {currentUser.name.charAt(0)}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-medium text-theme-primary truncate">{currentUser.name}</p>
                <p className="text-[10px] text-theme-accent truncate uppercase tracking-wider font-sans font-semibold">
                  {currentUser.role.replace('_', ' ')}
                </p>
              </div>
            )}
          </div>
          {!collapsed && <ChevronDown className="w-4 h-4 text-theme-secondary group-hover:text-theme-primary transition-colors shrink-0 ml-1" />}
        </button>

        {showUserMenu && (
          <div className="absolute left-4 right-4 mt-2 bg-theme-card rounded-[10px] shadow-overlay border border-theme-border text-theme-primary z-50 py-1 divide-y divide-theme-border max-h-80 overflow-y-auto animate-overlay-in">
            <div className="px-3 py-2 text-[10px] text-theme-secondary font-semibold uppercase tracking-wider">
              {runtimeConfig.allowImpersonation ? 'Impersonate Role' : 'Switch View (demo)'}
            </div>
            {users.filter(u => runtimeConfig.allowImpersonation || u.id === currentUser.id).map(u => (
              <button
                key={u.id}
                onClick={() => {
                  setCurrentUser(u.id);
                  setShowUserMenu(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-theme-base transition-colors cursor-pointer ${
                  u.id === currentUser.id ? 'bg-theme-base text-theme-accent font-medium' : 'text-theme-primary'
                }`}
              >
                <div>
                  <span className="block font-medium">{u.name}</span>
                  <span className="text-[10px] text-theme-secondary uppercase font-sans tracking-wide">
                    {u.role.replace('_', ' ')}
                  </span>
                </div>
                {u.id === currentUser.id && <UserCheck className="w-3.5 h-3.5 text-theme-accent" />}
              </button>
            ))}
          </div>
        )}

        {/* Dynamic Role Capability Prompt */}
        {!collapsed && (
        <div className="mt-2.5 px-2 py-1.5 bg-theme-base/60 rounded border border-theme-border flex gap-1.5 items-start">
          <Info className="w-3.5 h-3.5 text-theme-accent shrink-0 mt-0.5" />
          <p className="text-[10px] text-theme-secondary leading-normal font-sans">
            <strong>Scope Alert:</strong> {roleDescriptions[currentUser.role]}
          </p>
        </div>
        )}
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
              className={`relative w-full flex items-center py-2.5 text-xs font-medium rounded-lg transition-all cursor-pointer group ${
                collapsed ? 'justify-center px-0' : 'gap-3 px-3'
              } ${
                isActive
                  ? 'bg-theme-accent-soft text-theme-accent'
                  : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover'
              }`}
              id={`nav-${item.id}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-theme-accent rounded-full" aria-hidden="true" />
              )}
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-theme-accent' : 'text-theme-secondary/60 group-hover:text-theme-primary'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}

              {/* Optional notifications bubble on side menu */}
              {!collapsed && item.id === 'tasks' && tasks.filter(t => t.assigned_to_id === currentUser.id && !t.completed_at && new Date(t.due_at) < new Date()).length > 0 && (
                <span className="ml-auto bg-danger-soft text-danger px-1.5 py-0.5 text-[9px] rounded-full font-sans font-bold tnum">
                  {tasks.filter(t => t.assigned_to_id === currentUser.id && !t.completed_at && new Date(t.due_at) < new Date()).length} OVERDUE
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Theme Switcher & Footer */}
      <div className={`border-t border-theme-border bg-theme-base/30 space-y-3 ${collapsed ? 'p-2' : 'p-4'}`}>
        <button
          onClick={toggleCollapsed}
          className={`w-full flex items-center gap-2 py-2 text-xs font-medium text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded-lg transition-colors cursor-pointer ${collapsed ? 'justify-center px-0' : 'px-3'}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
        {!collapsed && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-theme-secondary font-semibold uppercase tracking-wider font-sans">Theme</span>
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color theme">
            {[
              { id: 'dark', swatch: '#141418', label: 'Boutinly Dark (brand)' },
              { id: 'heritage', swatch: '#1A2E6B', label: 'Boutinly Light' },
              { id: 'artisan', swatch: '#C1751F', label: 'Artisan (warm)' },
              { id: 'operator', swatch: '#3B6FB6', label: 'Operator (steel)' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTheme(t.id)}
                role="radio"
                aria-checked={activeTheme === t.id}
                aria-label={t.label}
                title={t.label}
                className={`w-4.5 h-4.5 rounded-full border-2 cursor-pointer transition-all ${
                  activeTheme === t.id
                    ? 'border-theme-accent scale-110'
                    : 'border-theme-border hover:border-theme-secondary'
                }`}
                style={{ backgroundColor: t.swatch }}
              />
            ))}
          </div>
        </div>
        )}
        {!collapsed && (
        <div className="text-[10px] text-theme-secondary text-center font-sans">
          Secure Environment &middot; boutinly.com
        </div>
        )}
      </div>
    </aside>
  );
}
