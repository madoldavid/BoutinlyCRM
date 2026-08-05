/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Notifications Center (G-FE-08, client layer).
 *
 * Full-screen modal with All/Unread tabs, per-type filtering, per-type
 * preference toggles (persisted locally — preferences only, no customer
 * data), mark-read per item, and mark-all-read. Replaces the single
 * dropdown surface with a proper center.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '../store';
import {
  Bell,
  X,
  CheckCheck,
  Check,
  Mail,
  Briefcase,
  User,
  CalendarClock,
  Megaphone,
  Settings2,
  Inbox,
} from 'lucide-react';

export const OPEN_NOTIFICATIONS_EVENT = 'boutinly:open-notifications';

const PREFS_KEY = 'boutinly_notif_prefs';

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  deal: { label: 'Deals', icon: <Briefcase className="w-3.5 h-3.5" /> },
  task: { label: 'Tasks', icon: <CalendarClock className="w-3.5 h-3.5" /> },
  contact: { label: 'Contacts', icon: <User className="w-3.5 h-3.5" /> },
  email: { label: 'Email', icon: <Mail className="w-3.5 h-3.5" /> },
  campaign: { label: 'Campaigns', icon: <Megaphone className="w-3.5 h-3.5" /> },
  system: { label: 'System', icon: <Settings2 className="w-3.5 h-3.5" /> },
};

function loadPrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch { /* ignore */ }
  return {};
}

function savePrefs(prefs: Record<string, boolean>): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

export default function NotificationsCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications, currentUser, markNotificationRead, clearAllNotifications } = useCRM();

  const [tab, setTab] = useState<'all' | 'unread'>('unread');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [prefs, setPrefs] = useState<Record<string, boolean>>(loadPrefs);
  const [showPrefs, setShowPrefs] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Scoped to the signed-in user, newest first (matches the sidebar bell)
  const sorted = useMemo(
    () => notifications
      .filter(n => n.user_id === currentUser?.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [notifications, currentUser?.id],
  );

  const visibleTypes = useMemo(() => {
    const set = new Set<string>(sorted.map(n => n.type || 'system'));
    return ['deal', 'task', 'contact', 'email', 'campaign', 'system'].filter(t => set.has(t) || prefs[t] !== false);
  }, [sorted, prefs]);

  const filtered = useMemo(() => {
    let list = sorted;
    if (tab === 'unread') list = list.filter(n => !n.read_at);
    if (typeFilter !== 'all') list = list.filter(n => n.type === typeFilter);
    // Hide muted types entirely
    list = list.filter(n => prefs[n.type || 'system'] !== false);
    return list;
  }, [sorted, tab, typeFilter, prefs]);

  const unreadCount = sorted.filter(n => !n.read_at).length;

  const togglePref = (type: string) => {
    setPrefs(prev => {
      const next = { ...prev, [type]: prev[type] === false };
      savePrefs(next);
      return next;
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[96] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Notifications center"
    >
      <div className="w-full max-w-lg bg-theme-card border border-theme-border rounded-[14px] shadow-overlay animate-overlay-in flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-theme-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-theme-accent-soft flex items-center justify-center">
              <Bell className="w-4 h-4 text-theme-accent" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-theme-primary font-sans">Notifications</h3>
              <p className="text-2xs text-theme-secondary">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowPrefs(s => !s)}
              className={`p-1.5 rounded-md cursor-pointer bg-transparent border-none ${
                showPrefs ? 'text-theme-accent bg-theme-accent-soft' : 'text-theme-secondary hover:text-theme-primary'
              }`}
              aria-label="Notification preferences"
              title="Preferences"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-theme-secondary hover:text-theme-primary rounded-md cursor-pointer bg-transparent border-none"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs + filter row */}
        <div className="px-5 pt-3 pb-2 border-b border-theme-border flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-theme-inset p-0.5 rounded-lg border border-theme-border">
            <button
              onClick={() => setTab('unread')}
              className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                tab === 'unread' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
              }`}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                tab === 'all' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
              }`}
            >
              All
            </button>
          </div>
          {!showPrefs && (
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="ml-auto text-xs bg-theme-inset border border-theme-border rounded-md px-2 py-1 cursor-pointer text-theme-secondary"
              aria-label="Filter by type"
            >
              <option value="all">All types</option>
              {visibleTypes.map(t => (
                <option key={t} value={t}>{TYPE_META[t]?.label ?? t}</option>
              ))}
            </select>
          )}
          {unreadCount > 0 && tab !== 'unread' && (
            <button
              onClick={clearAllNotifications}
              className="ml-auto flex items-center gap-1 text-[11px] font-medium text-theme-accent hover:opacity-80 cursor-pointer bg-transparent border-none"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>

        {/* Preferences panel */}
        {showPrefs ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <p className="text-xs font-semibold text-theme-primary">Type preferences</p>
            <p className="text-2xs text-theme-secondary -mt-2">
              Muted types are hidden from this center. Server-side delivery preferences arrive with the
              notification engine (G-DAT-06).
            </p>
            {(['deal', 'task', 'contact', 'email', 'campaign', 'system'] as const).map(type => (
              <div key={type} className="flex items-center justify-between p-3 rounded-lg border border-theme-border bg-theme-base/40">
                <span className="flex items-center gap-2 text-xs text-theme-primary">
                  {TYPE_META[type].icon} {TYPE_META[type].label}
                </span>
                <button
                  onClick={() => togglePref(type)}
                  role="switch"
                  aria-checked={prefs[type] !== false}
                  className={`w-8 h-4.5 rounded-full transition-colors cursor-pointer border-none ${
                    prefs[type] !== false ? 'bg-theme-accent' : 'bg-theme-border'
                  }`}
                  style={{ height: '18px' }}
                  aria-label={`Toggle ${TYPE_META[type].label} notifications`}
                >
                  <span
                    className="block w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform"
                    style={{ transform: prefs[type] !== false ? 'translateX(18px)' : 'translateX(2px)' }}
                    aria-hidden="true"
                  />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-theme-border">
            {filtered.length === 0 ? (
              <div className="py-14 text-center">
                <Inbox className="w-8 h-8 mx-auto text-theme-secondary/30 mb-2" />
                <p className="text-xs text-theme-secondary font-sans">
                  {tab === 'unread' ? 'No unread notifications.' : 'No notifications in this view.'}
                </p>
              </div>
            ) : (
              filtered.map(n => (
                <div
                  key={n.id}
                  className={`px-5 py-3.5 flex items-start gap-3 ${
                    n.read_at ? 'opacity-55' : ''
                  }`}
                >
                  <span className="shrink-0 mt-0.5 text-theme-secondary">
                    {TYPE_META[n.type]?.icon ?? <Bell className="w-3.5 h-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-theme-primary">{n.title}</p>
                      {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-theme-accent shrink-0" aria-hidden="true" />}
                    </div>
                    {n.body && <p className="text-2xs text-theme-secondary mt-0.5 leading-relaxed">{n.body}</p>}
                    <p className="text-[10px] text-theme-secondary/70 mt-1 font-sans" title={new Date(n.created_at).toLocaleString()}>
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.read_at && (
                    <button
                      onClick={() => markNotificationRead(n.id)}
                      className="shrink-0 p-1 text-theme-secondary hover:text-theme-accent rounded cursor-pointer bg-transparent border-none"
                      aria-label="Mark as read"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-theme-border bg-theme-inset/50 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-theme-secondary font-sans">
            {sorted.length} total · {unreadCount} unread
          </span>
          {unreadCount > 0 && (
            <button
              onClick={clearAllNotifications}
              className="text-[11px] font-medium text-theme-accent hover:opacity-80 cursor-pointer bg-transparent border-none"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
