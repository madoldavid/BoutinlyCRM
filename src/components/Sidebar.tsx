/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '../store';
import { useFeatureFlag } from '../utils/featureFlags';
import { runtimeConfig } from '../runtimeConfig';
import { UserRole } from '../types';
import NotificationsCenter from './NotificationsCenter';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CheckSquare,
  Mail,
  Sliders,
  Bell,
  Check,
  ChevronsUpDown,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowRight,
  Building2,
  UserPlus,
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
  const [showNotificationsCenter, setShowNotificationsCenter] = useState(false);
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
  const unreadNotifications = currentUser
    ? notifications.filter(n => n.user_id === currentUser.id && !n.read_at)
    : [];

  // Compute overdue task count for sidebar badge (computed once, not twice inline)
  const overdueCount = tasks.filter(
    t => t.assigned_to_id === currentUser?.id && !t.completed_at && new Date(t.due_at) < new Date()
  ).length;

  const emailModuleEnabled = useFeatureFlag('email_module');

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboards', icon: LayoutDashboard },
    { id: 'accounts', label: 'Accounts', icon: Building2 },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'leads', label: 'Leads', icon: UserPlus },
    { id: 'deals', label: 'Opportunities', icon: Briefcase },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'emails', label: 'Email', icon: Mail, featureFlag: 'email_module' as const },
  ].filter(item => {
    if (item.featureFlag === 'email_module' && !emailModuleEnabled) return false;
    return true;
  });

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
    [UserRole.SUPER_ADMIN]: 'Super Admin',
    [UserRole.ADMIN]: 'Admin',
    [UserRole.MANAGER]: 'Manager',
    [UserRole.SALES_REP]: 'Sales Rep',
    [UserRole.VIEWER]: 'Viewer',
  };

  const roleDescriptions: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Full system access, manage custom fields, pipelines, audit logs, and invites.',
    [UserRole.ADMIN]: 'Full administrative control over all customer records, custom fields, and pipelines.',
    [UserRole.MANAGER]: 'Sees all records owned by their team members and aggregates team performance analytics.',
    [UserRole.SALES_REP]: 'Can only see and edit records they own. Ideal for high-security isolation.',
    [UserRole.VIEWER]: 'Can view all records and analytics across the entire organization, but cannot make edits.',
  };

  return (
    <aside className={`${collapsed ? 'w-[68px]' : 'w-60'} bg-sidebar-bg text-sidebar-text flex flex-col h-screen shrink-0 select-none transition-[width] duration-200`}>
      {/* Brand Header */}
      <div className={`flex items-center h-14 border-b border-sidebar-border ${collapsed ? 'justify-center px-3' : 'justify-between px-4'}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-theme-accent to-theme-accent-strong flex items-center justify-center shadow-raised shrink-0">
            <span className="font-display font-semibold text-[15px] text-white leading-none translate-y-px">B</span>
          </div>
          {!collapsed && (
            <div className="leading-none min-w-0">
              <h1 className="font-display font-semibold text-[17px] tracking-tight text-sidebar-text">Boutinly</h1>
            </div>
          )}
        </div>
        {/* In-app Notification Trigger */}
        {!collapsed && (
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-sidebar-hover rounded-lg transition-colors relative cursor-pointer text-sidebar-muted hover:text-sidebar-text"
            id="notification-bell-btn"
            aria-label={`Notifications, ${unreadNotifications.length} unread`}
            aria-expanded={showNotifications}
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-theme-pulse rounded-full ring-2 ring-sidebar-bg" />
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="absolute left-0 mt-2 w-80 bg-theme-card rounded-xl shadow-overlay border border-theme-border text-theme-primary z-50 overflow-hidden animate-overlay-in">
              <div className="px-4 py-3 border-b border-theme-border flex items-center justify-between">
                <span className="text-xs font-semibold text-theme-primary tracking-tight">Notifications ({unreadNotifications.length})</span>
                {unreadNotifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-[11px] font-semibold text-theme-accent hover:text-theme-accent-strong flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-theme-border">
                {unreadNotifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-theme-secondary font-sans">
                    You're all caught up
                  </div>
                ) : (
                  unreadNotifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, n.entity_type)}
                      className="px-4 py-3 hover:bg-theme-inset cursor-pointer transition-colors text-left"
                    >
                      <h4 className="text-xs font-semibold text-theme-primary">{n.title}</h4>
                      <p className="text-[11px] text-theme-secondary mt-0.5 leading-relaxed">{n.body}</p>
                      <span className="text-[10px] text-theme-secondary/70 mt-1.5 block font-sans">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {/* Footer: open the full notifications center */}
              <button
                onClick={() => { setShowNotifications(false); setShowNotificationsCenter(true); }}
                className="w-full py-2.5 bg-theme-inset border-t border-theme-border text-[11px] font-semibold text-theme-accent hover:text-theme-accent-strong flex items-center justify-center gap-1 cursor-pointer"
              >
                View all notifications <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Navigation Modules */}
      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto scrollbar-none">
        {!collapsed && (
          <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/80">Workspace</p>
        )}
        {navigationItems.map(item => {
          const isActive = activeModule === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleModuleClick(item.id)}
              className={`relative w-full flex items-center text-[13px] font-medium rounded-lg transition-colors cursor-pointer ${
                collapsed ? 'justify-center py-2.5 px-0' : 'gap-2.5 px-2.5 py-2'
              } ${
                isActive
                  ? 'bg-sidebar-active text-sidebar-text font-semibold'
                  : 'text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-hover'
              }`}
              id={`nav-${item.id}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
            >
              {/* Left accent bar — visible on active */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-theme-pulse rounded-full" aria-hidden="true" />
              )}
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-theme-pulse' : ''}`} strokeWidth={isActive ? 2.2 : 1.8} />
              {!collapsed && <span className="truncate">{item.label}</span>}

              {/* Optional notifications bubble on side menu */}
              {!collapsed && item.id === 'tasks' && overdueCount > 0 && (
                <span className="ml-auto bg-danger text-white px-1.5 py-0.5 text-[10px] rounded-full font-sans font-semibold tnum">
                  {overdueCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: theme, collapse, user */}
      <div className={`border-t border-sidebar-border space-y-1 ${collapsed ? 'p-2' : 'p-2.5'}`}>
        {!collapsed && (
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-[10px] text-sidebar-muted/80 font-semibold uppercase tracking-[0.14em] font-sans">Theme</span>
          <div className="flex items-center gap-2" role="radiogroup" aria-label="Color theme">
            {[
              { id: 'light', swatch: '#0D5F4A', label: 'Atelier Light' },
              { id: 'dark', swatch: '#161513', label: 'Atelier Dark' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTheme(t.id)}
                role="radio"
                aria-checked={activeTheme === t.id}
                aria-label={t.label}
                title={t.label}
                className={`w-4.5 h-4.5 rounded-full cursor-pointer transition-all border-2 ${
                  activeTheme === t.id
                    ? 'border-theme-pulse scale-110'
                    : 'border-sidebar-border hover:border-sidebar-muted'
                }`}
                style={{ backgroundColor: t.swatch }}
              />
            ))}
          </div>
        </div>
        )}

        {/* User card / role switcher */}
        <div className="relative">
          <button
            onClick={() => (collapsed ? toggleCollapsed() : setShowUserMenu(!showUserMenu))}
            className={`w-full flex items-center rounded-lg transition-colors text-left cursor-pointer ${collapsed ? 'justify-center p-1.5 hover:bg-sidebar-hover' : 'justify-between gap-2 p-2 hover:bg-sidebar-hover'}`}
            id="role-switcher-btn"
            title={collapsed ? `${currentUser.name} — expand sidebar` : undefined}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-sidebar-border"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-theme-accent flex items-center justify-center text-white text-xs font-semibold shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0 leading-tight">
                  <p className="text-[13px] font-semibold text-sidebar-text truncate">{currentUser.name}</p>
                  <p className="text-[10px] text-sidebar-muted truncate font-sans font-medium">
                    {roleLabels[currentUser.role]}
                  </p>
                </div>
              )}
            </div>
            {!collapsed && <ChevronsUpDown className="w-3.5 h-3.5 text-sidebar-muted shrink-0" />}
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-theme-card rounded-xl shadow-overlay border border-theme-border text-theme-primary z-50 py-1.5 max-h-80 overflow-y-auto animate-overlay-in">
              <div className="px-3 pt-1.5 pb-2 border-b border-theme-border mb-1">
                <p className="text-[10px] text-theme-secondary font-semibold uppercase tracking-[0.12em]">
                  {runtimeConfig.allowImpersonation ? 'Impersonate Role' : 'Your Account'}
                </p>
                <p className="text-[10px] text-theme-secondary/80 mt-1 leading-relaxed font-sans">
                  {roleDescriptions[currentUser.role]}
                </p>
              </div>
              {users.filter(u => runtimeConfig.allowImpersonation || u.id === currentUser.id).map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUser(u.id);
                    setShowUserMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-theme-inset transition-colors cursor-pointer ${
                    u.id === currentUser.id ? 'text-theme-accent font-semibold' : 'text-theme-primary'
                  }`}
                >
                  <div>
                    <span className="block font-semibold">{u.name}</span>
                    <span className="text-[10px] text-theme-secondary font-sans">
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {u.id === currentUser.id && <UserCheck className="w-3.5 h-3.5 text-theme-accent" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Administration — kept below the workspace modules so the nav stays focused */}
        {(currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN) && (
          <button
            onClick={() => handleModuleClick('admin')}
            className={`relative w-full flex items-center text-[13px] font-medium rounded-lg transition-colors cursor-pointer ${
              collapsed ? 'justify-center py-2.5 px-0' : 'gap-2.5 px-2.5 py-2'
            } ${
              activeModule === 'admin'
                ? 'bg-sidebar-active text-sidebar-text font-semibold'
                : 'text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-hover'
            }`}
            id="nav-admin"
            aria-current={activeModule === 'admin' ? 'page' : undefined}
            aria-label="Administration"
            title={collapsed ? 'Administration' : undefined}
          >
            {activeModule === 'admin' && (
              <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-theme-pulse rounded-full" aria-hidden="true" />
            )}
            <Sliders className={`w-4 h-4 shrink-0 ${activeModule === 'admin' ? 'text-theme-pulse' : ''}`} strokeWidth={activeModule === 'admin' ? 2.2 : 1.8} />
            {!collapsed && <span className="truncate">Administration</span>}
          </button>
        )}

        <button
          onClick={toggleCollapsed}
          className={`w-full flex items-center gap-2.5 py-2 text-[13px] font-medium text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-hover rounded-lg transition-colors cursor-pointer ${collapsed ? 'justify-center px-0' : 'px-2.5'}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* Notifications center modal */}
      <NotificationsCenter open={showNotificationsCenter} onClose={() => setShowNotificationsCenter(false)} />
    </aside>
  );
}
