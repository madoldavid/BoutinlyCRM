/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Global keyboard shortcuts + shortcuts cheatsheet modal.
 *
 *  ?            — open this cheatsheet
 *  g then r/b/c/l/o/t/e/a — navigate (Reports / Accounts / Contacts / Leads / Opportunities / Tasks / Emails / Admin)
 *  n            — create a new record in the active module
 *  ⌘K / Ctrl+K  — command palette (handled by CommandPalette)
 *
 * Shortcuts are suppressed while typing in inputs, textareas, or selects.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useCRM } from '../store';
import { UserRole } from '../types';
import { Keyboard, X } from 'lucide-react';

export const NEW_RECORD_EVENT = 'boutinly:new-record';
export const NAVIGATE_EVENT = 'boutinly:navigate';
export const SELECT_ENTITY_EVENT = 'boutinly:select-entity';
export const DRILL_DOWN_EVENT = 'boutinly:drill-down';

export interface DrillDownDetail {
  module: string;
  filterKey: string;
  filterValue: string;
}

export interface SelectEntityDetail {
  module: 'contacts' | 'deals' | 'tasks' | 'accounts' | 'leads';
  entityId: string;
}

export function dispatchDrillDown(detail: DrillDownDetail): void {
  window.dispatchEvent(new CustomEvent(DRILL_DOWN_EVENT, { detail }));
}

export function dispatchSelectEntity(detail: SelectEntityDetail): void {
  window.dispatchEvent(new CustomEvent(SELECT_ENTITY_EVENT, { detail }));
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function dispatchNewRecord(): void {
  window.dispatchEvent(new Event(NEW_RECORD_EVENT));
}

export function dispatchNavigate(module: string): void {
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { module } }));
}

const NAV_KEYS: Record<string, string> = {
  r: 'dashboard',
  b: 'accounts',
  c: 'contacts',
  l: 'leads',
  o: 'deals',
  t: 'tasks',
  e: 'emails',
  a: 'admin',
};

interface ShortcutRow {
  keys: string;
  label: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: '?', label: 'Show this shortcut cheatsheet' },
  { keys: 'g then r', label: 'Go to Reports & Dashboards' },
  { keys: 'g then b', label: 'Go to Accounts' },
  { keys: 'g then c', label: 'Go to Contacts' },
  { keys: 'g then l', label: 'Go to Leads' },
  { keys: 'g then o', label: 'Go to Opportunities' },
  { keys: 'g then t', label: 'Go to Tasks & Activities' },
  { keys: 'g then e', label: 'Go to Email & Comms' },
  { keys: 'g then a', label: 'Go to System Admin (admin only)' },
  { keys: 'n', label: 'New record in the active module' },
  { keys: '⌘K / Ctrl+K', label: 'Command palette — search everything' },
  { keys: 'Esc', label: 'Close dialogs & overlays' },
];

export default function GlobalShortcuts() {
  const { currentUser, setActiveModule } = useCRM();
  const [showModal, setShowModal] = useState(false);
  const [armedNav, setArmedNav] = useState(false);

  const close = useCallback(() => setShowModal(false), []);

  // Header help button + nav-mode indicator support
  useEffect(() => {
    const onOpenEvent = () => setShowModal(true);
    window.addEventListener('boutinly:open-shortcuts', onOpenEvent);
    return () => window.removeEventListener('boutinly:open-shortcuts', onOpenEvent);
  }, []);

  useEffect(() => {
    let navTimer: number | undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      // Escape closes the cheatsheet first
      if (e.key === 'Escape') {
        if (showModal) { setShowModal(false); e.preventDefault(); }
        return;
      }

      // While the cheatsheet is open, only Escape or "?" should do anything
      if (showModal) {
        if (e.key === '?') { e.preventDefault(); setShowModal(false); }
        return;
      }

      if (isTypingTarget(e.target)) return;

      // "g" arms navigation mode
      if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setArmedNav(true);
        window.clearTimeout(navTimer);
        navTimer = window.setTimeout(() => setArmedNav(false), 2000);
        return;
      }

      // While armed, the next letter navigates
      if (armedNav) {
        const module = NAV_KEYS[e.key.toLowerCase()];
        if (module) {
          e.preventDefault();
          if (module === 'admin' && currentUser?.role !== UserRole.SUPER_ADMIN && currentUser?.role !== UserRole.ADMIN) return;
          setActiveModule(module);
          setArmedNav(false);
          window.clearTimeout(navTimer);
          return;
        }
        // Any other key cancels nav mode
        setArmedNav(false);
        window.clearTimeout(navTimer);
      }

      if (e.key === '?') {
        e.preventDefault();
        setShowModal(s => !s);
        return;
      }

      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        dispatchNewRecord();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(navTimer);
    };
  }, [showModal, armedNav, currentUser?.role, setActiveModule]);

  useEffect(() => {
    if (!showModal) return;
    // Keep modal state in sync if the palette or another overlay closes first
    const onOpen = () => setShowModal(false);
    window.addEventListener('boutinly:open-palette', onOpen);
    return () => window.removeEventListener('boutinly:open-palette', onOpen);
  }, [showModal]);

  if (armedNav) {
    return (
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[97] animate-overlay-in" role="status" aria-live="polite">
        <div className="bg-theme-card border border-theme-accent/40 shadow-overlay rounded-full px-4 py-1.5 flex items-center gap-2 text-xs font-sans">
          <span className="w-1.5 h-1.5 rounded-full bg-theme-accent animate-pulse" aria-hidden="true" />
          <span className="text-theme-primary font-medium">Go to…</span>
          <span className="text-theme-secondary">
            <kbd className="bg-theme-inset border border-theme-border rounded px-1 font-mono text-[10px]">r</kbd> reports
            <span className="mx-1 text-theme-secondary/50">·</span>
            <kbd className="bg-theme-inset border border-theme-border rounded px-1 font-mono text-[10px]">b</kbd> accounts
            <span className="mx-1 text-theme-secondary/50">·</span>
            <kbd className="bg-theme-inset border border-theme-border rounded px-1 font-mono text-[10px]">c</kbd> contacts
            <span className="mx-1 text-theme-secondary/50">·</span>
            <kbd className="bg-theme-inset border border-theme-border rounded px-1 font-mono text-[10px]">l</kbd> leads
            <span className="mx-1 text-theme-secondary/50">·</span>
            <kbd className="bg-theme-inset border border-theme-border rounded px-1 font-mono text-[10px]">o</kbd> opportunities
            <span className="mx-1 text-theme-secondary/50">·</span>
            <kbd className="bg-theme-inset border border-theme-border rounded px-1 font-mono text-[10px]">t</kbd> tasks
            <span className="mx-1 text-theme-secondary/50">·</span>
            <kbd className="bg-theme-inset border border-theme-border rounded px-1 font-mono text-[10px]">e</kbd> email
          </span>
        </div>
      </div>
    );
  }

  if (!showModal) return null;

  return (
    <div
      className="fixed inset-0 z-[96] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in"
      onMouseDown={e => { if (e.target === e.currentTarget) close(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="w-full max-w-md bg-theme-card border border-theme-border rounded-xl shadow-overlay animate-overlay-in overflow-hidden">
        <div className="px-5 py-4 border-b border-theme-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-theme-accent-soft flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-theme-accent" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-theme-primary font-sans">Keyboard Shortcuts</h3>
              <p className="text-2xs text-theme-secondary">Move fast without leaving the keyboard</p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-1 -m-1 text-theme-secondary hover:text-theme-primary rounded cursor-pointer bg-transparent border-none"
            aria-label="Close shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-1 max-h-[60vh] overflow-y-auto">
          {SHORTCUTS.map(row => (
            <div key={row.keys} className="flex items-center justify-between py-1.5 gap-4">
              <span className="text-xs text-theme-primary font-sans">{row.label}</span>
              <kbd className="text-[10px] text-theme-secondary bg-theme-inset border border-theme-border rounded px-1.5 py-0.5 font-mono whitespace-nowrap">
                {row.keys}
              </kbd>
            </div>
          ))}
          <div className="pt-3 mt-3 border-t border-theme-border">
            <p className="text-2xs text-theme-secondary/80 leading-relaxed font-sans">
              Shortcuts are disabled while typing in a field. On the pipeline board, focus a deal card and
              press <kbd className="bg-theme-inset border border-theme-border rounded px-1 font-mono">Space</kbd>/<kbd className="bg-theme-inset border border-theme-border rounded px-1 font-mono">Enter</kbd> to lift it, then
              <kbd className="bg-theme-inset border border-theme-border rounded px-1 font-mono">←</kbd><kbd className="bg-theme-inset border border-theme-border rounded px-1 font-mono">→</kbd> to move it between stages — full keyboard drag-and-drop.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-theme-border bg-theme-inset/50 flex justify-end">
          <button
            onClick={close}
            className="text-xs font-medium text-theme-accent hover:opacity-80 cursor-pointer bg-transparent border-none"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
