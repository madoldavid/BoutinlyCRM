/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dependency-free toast system. Call `toast.success('...')` from anywhere;
 * <ToastViewport /> (mounted once in App) renders the stack.
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

type Listener = (toasts: ToastItem[]) => void;

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach(l => l([...items]));
}

function push(kind: ToastKind, title: string, body?: string) {
  const id = nextId++;
  items = [...items, { id, kind, title, body }];
  emit();
  window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
  return id;
}

function dismiss(id: number) {
  items = items.filter(t => t.id !== id);
  emit();
}

export const toast = {
  success: (title: string, body?: string) => push('success', title, body),
  error: (title: string, body?: string) => push('error', title, body),
  info: (title: string, body?: string) => push('info', title, body),
  dismiss,
};

const kindStyles: Record<ToastKind, { icon: React.ReactNode; bar: string }> = {
  success: { icon: <CheckCircle2 className="w-4 h-4 text-success" />, bar: 'bg-success' },
  error: { icon: <AlertCircle className="w-4 h-4 text-danger" />, bar: 'bg-danger' },
  info: { icon: <Info className="w-4 h-4 text-info" />, bar: 'bg-info' },
};

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const l: Listener = t => setToasts(t);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map(t => {
        const s = kindStyles[t.kind];
        return (
          <div
            key={t.id}
            className="relative bg-theme-card border border-theme-border rounded-[10px] shadow-overlay overflow-hidden animate-overlay-in flex items-start gap-2.5 p-3 pr-8"
            role="status"
          >
            <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${s.bar}`} aria-hidden="true" />
            <span className="shrink-0 mt-px">{s.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-theme-primary">{t.title}</p>
              {t.body && <p className="text-2xs text-theme-secondary mt-0.5 leading-snug">{t.body}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="absolute top-2.5 right-2.5 text-theme-secondary hover:text-theme-primary cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
