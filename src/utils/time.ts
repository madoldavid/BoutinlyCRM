/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Time & date intelligence (G-FE-13, client layer).
 *
 * All timestamps in the API are ISO-8601 (UTC). These helpers render them
 * relative to the signed-in user's timezone (user.timezone, falling back to
 * the browser zone) with human-friendly relative labels.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export function resolveTimezone(userTimezone?: string | null): string {
  if (userTimezone) {
    try {
      // Validate the IANA name; falls back on invalid values
      Intl.DateTimeFormat(undefined, { timeZone: userTimezone }).format();
      return userTimezone;
    } catch {
      /* fall through to browser zone */
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Absolute date-time in the user's timezone (e.g. "Aug 4, 2026, 2:30 PM"). */
export function formatDateTime(iso: string, userTimezone?: string | null): string {
  if (!iso) return '—';
  const tz = resolveTimezone(userTimezone);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
  }).format(new Date(iso));
}

/** Date only in the user's timezone (e.g. "Aug 4, 2026"). */
export function formatDate(iso: string, userTimezone?: string | null): string {
  if (!iso) return '—';
  const tz = resolveTimezone(userTimezone);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: tz,
  }).format(new Date(iso));
}

export interface RelativeLabel {
  text: string;
  /** Semantic tone for styling: due-soon (amber), overdue (red), normal */
  tone: 'normal' | 'soon' | 'overdue' | 'past';
}

/**
 * Relative label for a deadline: "in 3 days", "tomorrow", "overdue 2 days",
 * "due now", "yesterday". Computed on calendar-day boundaries in the user's
 * timezone so "due today" actually means today for the user.
 */
export function relativeDueLabel(iso: string, userTimezone?: string | null, now: Date = new Date()): RelativeLabel {
  if (!iso) return { text: '—', tone: 'normal' };
  const tz = resolveTimezone(userTimezone);
  const due = new Date(iso);

  const startOfDay = (d: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'numeric', day: 'numeric', timeZone: tz,
    }).formatToParts(d);
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
    return new Date(get('year'), get('month') - 1, get('day'));
  };

  const today = startOfDay(now).getTime();
  const dueDay = startOfDay(due).getTime();
  const diffDays = Math.round((dueDay - today) / DAY_MS);

  if (diffDays === 0) return { text: 'due today', tone: 'soon' };
  if (diffDays === 1) return { text: 'due tomorrow', tone: 'soon' };
  if (diffDays === -1) return { text: 'overdue 1 day', tone: 'overdue' };
  if (diffDays > 1) return { text: `in ${diffDays} days`, tone: 'normal' };
  return { text: `overdue ${Math.abs(diffDays)} days`, tone: 'overdue' };
}

/**
 * Compact "x ago" label: "just now", "5m ago", "3h ago", "2d ago",
 * then falls back to a short date.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const delta = now.getTime() - then;
  if (delta < MINUTE_MS) return 'just now';
  if (delta < HOUR_MS) return `${Math.floor(delta / MINUTE_MS)}m ago`;
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)}h ago`;
  if (delta < 7 * DAY_MS) return `${Math.floor(delta / DAY_MS)}d ago`;
  return formatDate(iso);
}

/** Days between today and a date; negative when past. Calendar-day aware. */
export function daysUntil(iso: string, userTimezone?: string | null, now: Date = new Date()): number {
  if (!iso) return 0;
  const tz = resolveTimezone(userTimezone);
  const parts = (d: Date) => new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'numeric', day: 'numeric', timeZone: tz,
  }).formatToParts(d);
  const dayOf = (d: Date) => {
    const p = parts(d);
    const get = (type: string) => Number(p.find(x => x.type === type)?.value ?? 0);
    return new Date(get('year'), get('month') - 1, get('day')).getTime();
  };
  return Math.round((dayOf(new Date(iso)) - dayOf(now)) / DAY_MS);
}
