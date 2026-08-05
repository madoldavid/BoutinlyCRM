/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Boutinly UI primitives — shared, dependency-free component library.
 * All modules should consume these instead of hand-rolling controls.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';

export { toast, ToastViewport } from './toast';
export { default as ActivityTimeline } from './ActivityTimeline';
export { default as RecordDetailPage, RelatedList, FieldRow, HighlightsPanel, DetailTabs } from './RecordDetailPage';
export type { RecordDetailPageProps } from './RecordDetailPage';
export { default as DashboardWidgetGrid } from './DashboardWidgetGrid';
export type { DashboardWidget } from './DashboardWidgetGrid';
export { default as AppLauncher, getDefaultApps } from './AppLauncher';
export { default as MentionInput } from './MentionInput';

/* ────────────────────────── Button ────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-theme-accent text-white hover:opacity-90 shadow-card hover:shadow-[var(--shadow-glow)]',
  secondary: 'bg-theme-card text-theme-primary border border-theme-border hover:bg-theme-hover',
  ghost: 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover',
  danger: 'bg-danger text-white hover:opacity-90',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'text-2xs px-2.5 py-1.5 gap-1.5 rounded-md',
  md: 'text-xs px-3.5 py-2 gap-2 rounded-md',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium font-sans cursor-pointer transition-all select-none disabled:opacity-50 disabled:cursor-not-allowed ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ────────────────────────── Form fields ────────────────────────── */

interface FieldWrapperProps {
  label?: string;
  error?: string;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
}

function FieldWrapper({ label, error, help, required, children }: FieldWrapperProps) {
  return (
    <label className="block text-left">
      {label && (
        <span className="block text-2xs font-medium text-theme-secondary mb-1 font-sans">
          {label} {required && <span className="text-danger">*</span>}
        </span>
      )}
      {children}
      {error && <span className="block text-2xs text-danger mt-1">{error}</span>}
      {!error && help && <span className="block text-2xs text-theme-secondary/70 mt-1">{help}</span>}
    </label>
  );
}

const fieldClass =
  'w-full bg-theme-card text-theme-primary text-xs border border-theme-border rounded-md px-2.5 py-2 placeholder:text-theme-secondary/50 focus:border-theme-accent transition-colors font-sans';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  help?: string;
}

export function Input({ label, error, help, required, className = '', ...rest }: InputProps) {
  return (
    <FieldWrapper label={label} error={error} help={help} required={required}>
      <input
        className={`${fieldClass} ${error ? 'border-danger' : ''} ${className}`}
        aria-invalid={!!error}
        required={required}
        {...rest}
      />
    </FieldWrapper>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  help?: string;
}

export function Select({ label, error, help, required, className = '', children, ...rest }: SelectProps) {
  return (
    <FieldWrapper label={label} error={error} help={help} required={required}>
      <select
        className={`${fieldClass} cursor-pointer ${error ? 'border-danger' : ''} ${className}`}
        aria-invalid={!!error}
        required={required}
        {...rest}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  help?: string;
}

export function Textarea({ label, error, help, required, className = '', ...rest }: TextareaProps) {
  return (
    <FieldWrapper label={label} error={error} help={help} required={required}>
      <textarea
        className={`${fieldClass} min-h-20 resize-y ${error ? 'border-danger' : ''} ${className}`}
        aria-invalid={!!error}
        required={required}
        {...rest}
      />
    </FieldWrapper>
  );
}

/* ────────────────────────── Modal ────────────────────────── */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const modalWidths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

export function Modal({ open, onClose, title, subtitle, children, footer, width = 'md' }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Esc to close + rudimentary focus trap
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onKeyDown);
    // Focus first focusable on open
    const t = window.setTimeout(() => {
      ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    }, 50);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(t);
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={ref}
        className={`w-full ${modalWidths[width]} bg-theme-card border border-theme-border rounded-[14px] shadow-overlay animate-overlay-in flex flex-col max-h-[85vh]`}
      >
        <div className="px-5 py-4 border-b border-theme-border flex items-start justify-between shrink-0">
          <div>
            <h3 className="text-base font-semibold text-theme-primary font-sans">{title}</h3>
            {subtitle && <p className="text-2xs text-theme-secondary mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 -m-1 text-theme-secondary hover:text-theme-primary rounded cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-theme-border bg-theme-inset/50 rounded-b-[14px] flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── ConfirmDialog ────────────────────────── */

interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {destructive && (
          <span className="shrink-0 w-8 h-8 rounded-full bg-danger-soft flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-danger" />
          </span>
        )}
        <p className="text-xs text-theme-secondary leading-relaxed">{body || 'This action cannot be undone.'}</p>
      </div>
    </Modal>
  );
}

/* ────────────────────────── Badge / StatusDot ────────────────────────── */

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-theme-inset text-theme-secondary',
  accent: 'bg-theme-accent-soft text-theme-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium font-sans whitespace-nowrap ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = 'neutral' }: { tone?: BadgeTone }) {
  const colors: Record<BadgeTone, string> = {
    neutral: 'bg-theme-secondary',
    accent: 'bg-theme-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors[tone]}`} aria-hidden="true" />;
}

/* ────────────────────────── EmptyState ────────────────────────── */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && (
        <div className="w-11 h-11 rounded-full bg-theme-inset flex items-center justify-center mb-3 text-theme-secondary/60">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-semibold text-theme-primary font-sans">{title}</h4>
      {body && <p className="text-xs text-theme-secondary mt-1 max-w-xs leading-relaxed">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ────────────────────────── Skeleton ────────────────────────── */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-theme-inset rounded-md ${className}`} aria-hidden="true" />;
}

/* ────────────────────────── Avatar ────────────────────────── */

export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm' };
  if (src) {
    return <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover border border-theme-border`} />;
  }
  return (
    <span
      className={`${sizes[size]} rounded-full bg-theme-accent-soft text-theme-accent border border-theme-border flex items-center justify-center font-bold shrink-0`}
      aria-label={name}
    >
      {name.split(' ').map(w => w.charAt(0)).slice(0, 2).join('')}
    </span>
  );
}

/* ────────────────────────── KpiCard ────────────────────────── */

export function KpiCard({
  label,
  value,
  icon,
  delta,
  deltaTone = 'neutral',
  footer,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  delta?: string;
  deltaTone?: BadgeTone;
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-theme-card border border-theme-border rounded-[10px] p-4 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs font-medium text-theme-secondary uppercase tracking-wider font-sans">{label}</span>
        {icon && <span className="text-theme-secondary/50">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold text-theme-primary font-sans tnum" data-metric>{value}</span>
        {delta && <Badge tone={deltaTone}>{delta}</Badge>}
      </div>
      {footer && <div className="mt-2 text-2xs text-theme-secondary">{footer}</div>}
    </div>
  );
}
