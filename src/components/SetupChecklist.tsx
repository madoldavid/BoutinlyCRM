/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Getting Started setup checklist (G-FE-10, client layer).
 *
 * Data-aware onboarding card shown on the Reports dashboard until the
 * tenant has completed the core setup steps (or the user dismisses it).
 * Dismissal + completion state are local preferences only.
 */

import React, { useMemo, useState } from 'react';
import { useCRM } from '../store';
import { Check, ChevronRight, Rocket, X, Building2 } from 'lucide-react';

const DISMISS_KEY = 'boutinly_setup_dismissed';

export default function SetupChecklist() {
  const {
    contacts,
    accounts,
    deals,
    activities,
    users,
    emailTemplates,
    setActiveModule,
  } = useCRM();

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const items = useMemo(() => [
    {
      id: 'account',
      label: 'Create your company account',
      hint: 'Add your organization as the primary account.',
      done: accounts.length > 0,
      module: 'contacts' as const,
    },
    {
      id: 'contact',
      label: 'Add your first contact',
      hint: 'Create a contact or import your list from CSV.',
      done: contacts.length > 0,
      module: 'contacts' as const,
    },
    {
      id: 'deal',
      label: 'Create your first deal',
      hint: 'Start a pipeline opportunity with a value and close date.',
      done: deals.length > 0,
      module: 'deals' as const,
    },
    {
      id: 'activity',
      label: 'Log an activity',
      hint: 'Calls, meetings, and notes power timelines and scores.',
      done: activities.length > 0,
      module: 'tasks' as const,
    },
    {
      id: 'team',
      label: 'Invite your team',
      hint: 'Add teammates with roles so records have owners.',
      done: users.length > 1,
      module: 'admin' as const,
    },
    {
      id: 'email',
      label: 'Set up email templates',
      hint: 'Templates power one-off sends and future campaigns.',
      done: emailTemplates.length > 0,
      module: 'emails' as const,
    },
  ], [contacts.length, accounts.length, deals.length, activities.length, users.length, emailTemplates.length]);

  const doneCount = items.filter(i => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div className="bg-theme-card p-5 rounded-xl shadow-xs border border-theme-border animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="shrink-0 w-9 h-9 rounded-lg bg-theme-accent-soft text-theme-accent flex items-center justify-center">
            <Rocket className="w-4.5 h-4.5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary">
                Getting Started
              </h4>
              <span className="text-[10px] font-semibold text-theme-accent bg-theme-accent-soft px-1.5 py-0.5 rounded-full tabular-nums">
                {doneCount}/{items.length} · {pct}%
              </span>
            </div>
            <p className="text-[11px] text-theme-secondary mt-0.5">
              Complete these steps to unlock the full Boutinly workspace.
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 p-1 text-theme-secondary/60 hover:text-theme-primary rounded cursor-pointer bg-transparent border-none"
          aria-label="Dismiss getting started checklist"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-theme-inset rounded-full overflow-hidden mt-3">
        <div
          className="h-full bg-theme-accent rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveModule(item.module)}
            disabled={item.done}
            className={`text-left p-3 rounded-lg border transition-colors ${
              item.done
                ? 'border-success/20 bg-success-soft/40 cursor-default'
                : 'border-theme-border bg-theme-base/40 hover:border-theme-accent/40 hover:bg-theme-accent-soft/30 cursor-pointer'
            }`}
            aria-label={item.done ? `${item.label} — complete` : item.label}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center mb-1.5 ${
                item.done ? 'bg-success text-white' : 'bg-theme-inset text-theme-secondary/50'
              }`}
              aria-hidden="true"
            >
              {item.done ? <Check className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
            <span className={`block text-[11px] font-semibold leading-tight ${item.done ? 'text-theme-secondary line-through' : 'text-theme-primary'}`}>
              {item.label}
            </span>
            <span className="block text-[10px] text-theme-secondary mt-0.5 leading-snug">
              {item.hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
