/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Template variable substitution engine for email templates.
 * Replaces {{path.to.field}} placeholders with values from the provided context.
 */

import type { Account, Contact, Deal, Organization, User } from '../../types.js';

export interface TemplateContext {
  contact?: Contact | null;
  account?: Account | null;
  deal?: Deal | null;
  sender?: Pick<User, 'name' | 'email'> | null;
  organization?: Pick<Organization, 'name'> | null;
  [key: string]: unknown;
}

/**
 * Render a template string by replacing all {{path.to.field}} placeholders
 * with values resolved from the context object. Unresolvable placeholders
 * are left as-is so the sender can spot missing data.
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_match: string, path: string) => {
    const value = resolvePath(path.trim(), context);
    if (value === undefined) return _match; // keep unresolved placeholders visible
    return escapeHtml(String(value));
  });
}

/**
 * Extract all variable paths from a template string.
 * Returns deduplicated array of paths like ['contact.first_name', 'account.name'].
 */
export function extractVariables(template: string): string[] {
  const seen = new Set<string>();
  const matches = template.matchAll(/\{\{([\w.]+)\}\}/g);
  for (const match of matches) {
    seen.add(match[1].trim());
  }
  return Array.from(seen).sort();
}

/**
 * Strip HTML tags from a string, returning plain text.
 * Used to generate a text/plain fallback from HTML templates.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Internal helpers ───────────────────────────────────

function resolvePath(path: string, context: TemplateContext): string | undefined {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  if (current === null || current === undefined) return undefined;

  // Format common types
  if (current instanceof Date) return current.toLocaleDateString();
  if (typeof current === 'number') {
    // Format currency-like numbers based on context
    if (path.endsWith('value') || path.endsWith('arr') || path.endsWith('amount')) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(current);
    }
    return new Intl.NumberFormat('en-US').format(current);
  }
  if (typeof current === 'boolean') return current ? 'Yes' : 'No';

  return String(current);
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
