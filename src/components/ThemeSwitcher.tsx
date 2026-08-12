/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';

const THEMES = [
  {
    id: 'gold',
    label: 'Slate',
    swatch: 'linear-gradient(135deg, #0B1F17 0%, #D4A017 100%)',
    description: 'Slate & Gold',
  },
  {
    id: 'forest',
    label: 'Forest',
    swatch: 'linear-gradient(135deg, #0B5343 0%, #00C896 100%)',
    description: 'Forest & Teal',
  },
  {
    id: 'steel',
    label: 'Midnight',
    swatch: 'linear-gradient(135deg, #0A1628 0%, #1D4ED8 100%)',
    description: 'Midnight & Steel',
  },
] as const;

export type ThemeId = typeof THEMES[number]['id'];

const STORAGE_KEY = 'boutinly_theme';

export function getStoredTheme(): ThemeId | null {
  try { return localStorage.getItem(STORAGE_KEY) as ThemeId | null; } catch { return null; }
}

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
}

export { applyTheme };

export function useTheme() {
  const [active, setActive] = useState<ThemeId>(() => getStoredTheme() ?? 'gold');

  useEffect(() => {
    applyTheme(active);
  }, [active]);

  return { active, setActive: (t: ThemeId) => { applyTheme(t); setActive(t); } };
}

export default function ThemeSwitcher() {
  const { active, setActive } = useTheme();
  const [open, setOpen] = useState(false);
  const current = THEMES.find(t => t.id === active) ?? THEMES[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-theme-switcher]')) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative shrink-0" data-theme-switcher>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Switch color theme"
        title="Switch color theme"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-theme-border bg-theme-card hover:bg-theme-hover cursor-pointer transition-colors"
      >
        <span
          className="w-4 h-4 rounded-full shadow-inner"
          style={{ background: current.swatch }}
          aria-hidden="true"
        />
        <Palette className="w-3.5 h-3.5 text-theme-secondary hidden sm:block" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 w-52 bg-theme-card border border-theme-border rounded-xl shadow-overlay z-50 py-1.5 animate-overlay-in">
            <div className="px-3 py-1 text-[10px] font-semibold text-theme-secondary uppercase tracking-wider font-sans">
              Color Theme
            </div>
            {THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => { setActive(theme.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer border-none bg-transparent ${
                  theme.id === active
                    ? 'bg-theme-accent-soft/50'
                    : 'hover:bg-theme-hover'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full shadow-inner shrink-0"
                  style={{ background: theme.swatch }}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0">
                  <span className={`block text-xs font-semibold ${theme.id === active ? 'text-theme-accent' : 'text-theme-primary'}`}>
                    {theme.label}
                  </span>
                  <span className="block text-[10px] text-theme-secondary">{theme.description}</span>
                </span>
                {theme.id === active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-theme-accent shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
