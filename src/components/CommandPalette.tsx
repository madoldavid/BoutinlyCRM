/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cmd/Ctrl+K global command palette — searches contacts, accounts, deals,
 * and tasks (RBAC-scoped) plus navigation and quick actions. Dependency-free.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useCRM } from '../store';
import { UserRole } from '../types';
import {
  Search,
  User,
  Building2,
  Briefcase,
  CheckSquare,
  LayoutDashboard,
  Mail,
  Sliders,
  ArrowRight,
  CornerDownLeft,
} from 'lucide-react';

interface PaletteItem {
  id: string;
  kind: 'nav' | 'contact' | 'account' | 'deal' | 'task';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  run: () => void;
}

const kindLabels: Record<string, string> = {
  nav: 'Navigation',
  contact: 'Contacts',
  account: 'Accounts',
  deal: 'Deals',
  task: 'Tasks',
};

export default function CommandPalette() {
  const {
    currentUser,
    setActiveModule,
    getScopedContacts,
    getScopedAccounts,
    getScopedDeals,
    getScopedTasks,
  } = useCRM();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setSelected(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpenEvent = () => { setOpen(true); setQuery(''); setSelected(0); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('boutinly:open-palette', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('boutinly:open-palette', onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const items = useMemo<PaletteItem[]>(() => {
    if (!open) return [];
    const q = query.trim().toLowerCase();

    const navItems: PaletteItem[] = [
      { id: 'nav-dashboard', kind: 'nav', title: 'Go to Reports & Dashboards', icon: <LayoutDashboard className="w-4 h-4" />, run: () => { setActiveModule('dashboard'); close(); } },
      { id: 'nav-contacts', kind: 'nav', title: 'Go to Contacts & Accounts', icon: <User className="w-4 h-4" />, run: () => { setActiveModule('contacts'); close(); } },
      { id: 'nav-deals', kind: 'nav', title: 'Go to Sales Pipeline', icon: <Briefcase className="w-4 h-4" />, run: () => { setActiveModule('deals'); close(); } },
      { id: 'nav-tasks', kind: 'nav', title: 'Go to Tasks & Activities', icon: <CheckSquare className="w-4 h-4" />, run: () => { setActiveModule('tasks'); close(); } },
      { id: 'nav-emails', kind: 'nav', title: 'Go to Email & Comms', icon: <Mail className="w-4 h-4" />, run: () => { setActiveModule('emails'); close(); } },
      ...([UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(currentUser.role)
        ? [{ id: 'nav-admin', kind: 'nav' as const, title: 'Go to System Admin', icon: <Sliders className="w-4 h-4" />, run: () => { setActiveModule('admin'); close(); } }]
        : []),
    ];

    if (q.length === 0) return navItems;

    const matchNav = navItems.filter(n => n.title.toLowerCase().includes(q));

    const contacts = getScopedContacts()
      .filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map<PaletteItem>(c => ({
        id: `contact-${c.id}`,
        kind: 'contact',
        title: `${c.first_name} ${c.last_name}`,
        subtitle: `${c.title || 'Contact'} · ${c.email}`,
        icon: <User className="w-4 h-4" />,
        run: () => { setActiveModule('contacts'); close(); },
      }));

    const accounts = getScopedAccounts()
      .filter(a => a.name.toLowerCase().includes(q) || (a.domain || '').toLowerCase().includes(q) || (a.industry || '').toLowerCase().includes(q))
      .slice(0, 5)
      .map<PaletteItem>(a => ({
        id: `account-${a.id}`,
        kind: 'account',
        title: a.name,
        subtitle: `${a.industry || 'Account'} · ${a.domain}`,
        icon: <Building2 className="w-4 h-4" />,
        run: () => { setActiveModule('contacts'); close(); },
      }));

    const deals = getScopedDeals()
      .filter(d => d.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map<PaletteItem>(d => ({
        id: `deal-${d.id}`,
        kind: 'deal',
        title: d.name,
        subtitle: `$${d.value.toLocaleString()} · closes ${new Date(d.close_date).toLocaleDateString()}`,
        icon: <Briefcase className="w-4 h-4" />,
        run: () => { setActiveModule('deals'); close(); },
      }));

    const tasks = getScopedTasks()
      .filter(t => t.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map<PaletteItem>(t => ({
        id: `task-${t.id}`,
        kind: 'task',
        title: t.title,
        subtitle: `${t.type} · due ${new Date(t.due_at).toLocaleDateString()}${t.completed_at ? ' · done' : ''}`,
        icon: <CheckSquare className="w-4 h-4" />,
        run: () => { setActiveModule('tasks'); close(); },
      }));

    return [...matchNav, ...contacts, ...accounts, ...deals, ...tasks];
  }, [open, query, currentUser.role, getScopedContacts, getScopedAccounts, getScopedDeals, getScopedTasks, setActiveModule, close]);

  // Keep selection in bounds
  useEffect(() => { setSelected(0); }, [query]);

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && items[selected]) {
      e.preventDefault();
      items[selected].run();
    }
  };

  // Scroll selected into view
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  // Group by kind, preserving order
  const groups: { kind: string; items: { item: PaletteItem; idx: number }[] }[] = [];
  items.forEach((item, idx) => {
    const last = groups[groups.length - 1];
    if (last && last.kind === item.kind) last.items.push({ item, idx });
    else groups.push({ kind: item.kind, items: [{ item, idx }] });
  });

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-[2px] flex items-start justify-center pt-[14vh] px-4 animate-fade-in"
      onMouseDown={e => { if (e.target === e.currentTarget) close(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="w-full max-w-xl bg-theme-card border border-theme-border rounded-xl shadow-overlay animate-overlay-in overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 border-b border-theme-border">
          <Search className="w-4 h-4 text-theme-secondary shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search contacts, accounts, deals, tasks…"
            className="w-full bg-transparent text-sm text-theme-primary placeholder:text-theme-secondary/60 py-3.5 outline-none font-sans"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
          />
          <kbd className="text-[9px] text-theme-secondary bg-theme-inset border border-theme-border rounded px-1.5 py-0.5 font-sans shrink-0">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1.5" role="listbox">
          {items.length === 0 ? (
            <p className="text-xs text-theme-secondary text-center py-8">No results for “{query}”</p>
          ) : (
            groups.map(g => (
              <div key={g.kind}>
                <p className="px-4 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wider text-theme-secondary/70 font-sans">
                  {kindLabels[g.kind]}
                </p>
                {g.items.map(({ item, idx }) => (
                  <button
                    key={item.id}
                    data-idx={idx}
                    onClick={item.run}
                    onMouseEnter={() => setSelected(idx)}
                    role="option"
                    aria-selected={idx === selected}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer ${
                      idx === selected ? 'bg-theme-accent-soft' : ''
                    }`}
                  >
                    <span className={idx === selected ? 'text-theme-accent' : 'text-theme-secondary/60'}>
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-xs font-medium truncate ${idx === selected ? 'text-theme-accent' : 'text-theme-primary'}`}>
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="block text-2xs text-theme-secondary truncate">{item.subtitle}</span>
                      )}
                    </span>
                    {idx === selected && <CornerDownLeft className="w-3.5 h-3.5 text-theme-secondary shrink-0" />}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-theme-border bg-theme-inset/50 flex items-center gap-4 text-[9px] text-theme-secondary font-sans">
          <span className="flex items-center gap-1"><kbd className="bg-theme-card border border-theme-border rounded px-1">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-theme-card border border-theme-border rounded px-1">↵</kbd> open</span>
          <span className="ml-auto flex items-center gap-1"><ArrowRight className="w-3 h-3" /> RBAC-scoped results</span>
        </div>
      </div>
    </div>
  );
}
