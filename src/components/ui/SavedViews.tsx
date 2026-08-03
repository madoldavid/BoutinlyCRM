/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Saved views & filters (G-FE-01, client layer).
 *
 * Per-device persistence of named filter presets per module, with a default
 * view applied on mount. Preferences only — no customer data is stored
 * (NFR-SEC-02 compliant). Server-side shared views arrive with the
 * saved-view service; this hook keeps the same shape so the swap is local.
 */

import React, { useCallback, useState } from 'react';
import { Bookmark, Star, Trash2, Plus } from 'lucide-react';

export interface SavedView<F> {
  id: string;
  name: string;
  filters: F;
  isDefault?: boolean;
  createdAt: string;
}

function makeId(): string {
  try { return crypto.randomUUID(); } catch { return `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
}

export function useSavedViews<F>(module: string) {
  const storageKey = `boutinly_views_${module}`;

  const [views, setViews] = useState<SavedView<F>[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') as SavedView<F>[]; } catch { return []; }
  });

  const persist = useCallback((next: SavedView<F>[]) => {
    setViews(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* noop */ }
  }, [storageKey]);

  const saveView = useCallback((name: string, filters: F): SavedView<F> => {
    const view: SavedView<F> = { id: makeId(), name: name.trim(), filters, createdAt: new Date().toISOString() };
    persist([...views, view]);
    return view;
  }, [views, persist]);

  const deleteView = useCallback((id: string) => {
    persist(views.filter(v => v.id !== id));
  }, [views, persist]);

  const setDefaultView = useCallback((id: string) => {
    persist(views.map(v => ({ ...v, isDefault: v.id === id ? !v.isDefault : false })));
  }, [views, persist]);

  const defaultView = views.find(v => v.isDefault) ?? null;

  return { views, saveView, deleteView, setDefaultView, defaultView };
}

interface ViewSwitcherProps<F> {
  views: SavedView<F>[];
  /** Apply a saved view's filters */
  onApply: (view: SavedView<F>) => void;
  /** Persist the current filter state under a name */
  onSaveCurrent: (name: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export function ViewSwitcher<F>({ views, onApply, onSaveCurrent, onDelete, onSetDefault }: ViewSwitcherProps<F>) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSave = () => {
    if (!newName.trim()) return;
    onSaveCurrent(newName);
    setNewName('');
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        title="Saved views"
        className={`h-full flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
          views.length > 0
            ? 'border-theme-accent/40 text-theme-accent bg-theme-accent-soft hover:opacity-90'
            : 'border-theme-border text-theme-secondary hover:text-theme-primary hover:bg-theme-hover bg-theme-base'
        }`}
      >
        <Bookmark className="w-3.5 h-3.5" />
        Views{views.length > 0 ? ` (${views.length})` : ''}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-1.5 w-64 bg-theme-card border border-theme-border rounded-[10px] shadow-overlay z-50 py-1.5 animate-overlay-in" role="menu">
            <div className="px-3 py-1 text-[10px] font-semibold text-theme-secondary uppercase tracking-wider font-sans">
              Saved views
            </div>

            {views.length === 0 && (
              <p className="px-3 py-2 text-xs text-theme-secondary font-sans">
                No saved views yet. Set your filters, then save them here.
              </p>
            )}

            {views.map(view => (
              <div key={view.id} className="flex items-center gap-1 px-1.5 group">
                <button
                  onClick={() => { onApply(view); setOpen(false); }}
                  className="flex-1 text-left px-1.5 py-1.5 text-xs text-theme-primary hover:bg-theme-hover rounded-md cursor-pointer font-sans truncate"
                  title={`Apply "${view.name}"`}
                >
                  {view.name}
                  {view.isDefault && <span className="ml-1.5 text-[9px] text-theme-accent font-semibold uppercase">default</span>}
                </button>
                <button
                  onClick={() => onSetDefault(view.id)}
                  className={`p-1 rounded cursor-pointer transition-colors ${view.isDefault ? 'text-theme-accent' : 'text-theme-secondary/40 hover:text-theme-accent'}`}
                  title={view.isDefault ? 'Unset default' : 'Apply automatically on open'}
                  aria-label={`${view.isDefault ? 'Unset' : 'Set'} "${view.name}" as default view`}
                >
                  <Star className="w-3 h-3" fill={view.isDefault ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => onDelete(view.id)}
                  className="p-1 rounded text-theme-secondary/40 hover:text-danger cursor-pointer transition-colors"
                  title="Delete view"
                  aria-label={`Delete "${view.name}" view`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            <div className="flex items-center gap-1.5 px-3 pt-2 mt-1 border-t border-theme-border">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
                placeholder="Save current view as…"
                className="flex-1 bg-theme-base border border-theme-border rounded-md px-2 py-1.5 text-xs text-theme-primary placeholder:text-theme-secondary/50 focus:border-theme-accent focus:outline-none"
                aria-label="New view name"
              />
              <button
                onClick={handleSave}
                disabled={!newName.trim()}
                className="p-1.5 rounded-md bg-theme-accent text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                title="Save current filters as a view"
                aria-label="Save current filters as a view"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
