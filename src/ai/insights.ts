/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Boutinly Intelligence — deterministic, explainable scoring & recommendation
 * engine. No external AI service is required: every score and suggestion is
 * computed from CRM data with transparent rules so the UI can always answer
 * "why?" (explainability is a first-class output, not a bolt-on).
 *
 * Roadmap alignment (see docs/INTELLIGENCE_FEATURES.md):
 *  - Deal scoring with factor-level explainability  (painkiller: predictive
 *    scoring wired into the pipeline workflow)
 *  - Next-best-action recommendations with reasons  (painkiller: segment-level
 *    next-best-action)
 *  - Duplicate / data-hygiene detection             (painkiller: data hygiene
 *    & dedup at the point of capture)
 */

import type { Account, Activity, Contact, Deal, Stage, Task, User } from '../types';
import { UserRole } from '../types';

// ─── Shared context ──────────────────────────────────────────────────────

export interface InsightContext {
  deals: Deal[];
  stages: Stage[];
  contacts: Contact[];
  accounts: Account[];
  tasks: Task[];
  activities: Activity[];
  users: User[];
  currentUserId: string;
  currentUserRole: UserRole;
  /** Injectable clock for deterministic tests */
  now?: Date;
}

export function nowOf(ctx: InsightContext): number {
  return (ctx.now ?? new Date()).getTime();
}

const DAY_MS = 86_400_000;

function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / DAY_MS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function stageById(ctx: InsightContext, stageId: string): Stage | undefined {
  return ctx.stages.find(s => s.id === stageId);
}

export function latestActivityForDeal(ctx: InsightContext, dealId: string): Activity | undefined {
  return ctx.activities
    .filter(a => a.deal_id === dealId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export function openTasksForDeal(ctx: InsightContext, dealId: string): Task[] {
  return ctx.tasks.filter(t => t.deal_id === dealId && !t.completed_at);
}

// ─── Deal scoring with explainability ────────────────────────────────────

export type FactorTone = 'positive' | 'negative' | 'neutral';

export interface ScoreFactor {
  key: string;
  label: string;
  detail: string;
  /** Signed contribution to the final score */
  impact: number;
  tone: FactorTone;
}

export type DealGrade = 'excellent' | 'good' | 'watch' | 'at_risk';

export interface DealScore {
  score: number; // 0–100
  grade: DealGrade;
  factors: ScoreFactor[];
  generated_at: string;
}

export function gradeOf(score: number): DealGrade {
  if (score >= 75) return 'excellent';
  if (score >= 55) return 'good';
  if (score >= 35) return 'watch';
  return 'at_risk';
}

export const GRADE_META: Record<DealGrade, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' }> = {
  excellent: { label: 'Excellent', tone: 'success' },
  good: { label: 'Good', tone: 'info' },
  watch: { label: 'Watch', tone: 'warning' },
  at_risk: { label: 'At Risk', tone: 'danger' },
};

/**
 * Score a deal 0–100 with a per-factor breakdown.
 *
 * Model (deliberately transparent):
 *   base = stage probability × 0.6
 *   ± urgency  (close date pressure)
 *   − stagnation (time stuck in stage)
 *   ± owner engagement (recency of linked activity)
 *   ± next-step readiness (open, non-overdue task on the deal)
 *   ± value momentum vs. team median
 *   + data completeness (line items, linked account)
 */
export function scoreDeal(deal: Deal, ctx: InsightContext): DealScore {
  const now = nowOf(ctx);
  const factors: ScoreFactor[] = [];
  const stage = stageById(ctx, deal.stage_id);

  // Closed deals are unambiguous — skip the open-deal model entirely
  if (stage?.type === 'won') {
    return {
      score: 100,
      grade: 'excellent',
      factors: [{ key: 'closed', label: 'Closed won', detail: 'This deal is closed and counted as revenue.', impact: 100, tone: 'positive' }],
      generated_at: new Date(now).toISOString(),
    };
  }
  if (stage?.type === 'lost') {
    return {
      score: 0,
      grade: 'at_risk',
      factors: [{ key: 'closed', label: 'Closed lost', detail: `This deal was lost${deal.lost_reason ? ` — ${deal.lost_reason}` : ''}.`, impact: -100, tone: 'negative' }],
      generated_at: new Date(now).toISOString(),
    };
  }

  const stageProb = stage?.probability ?? 0;

  // 1) Stage probability (base)
  const base = stageProb * 0.6;
  factors.push({
    key: 'stage',
    label: `Stage momentum — ${stage?.name ?? 'Unknown'}`,
    detail: `Stage carries a ${stageProb}% close probability, weighted at 60%.`,
    impact: Math.round(base),
    tone: stageProb >= 50 ? 'positive' : stageProb >= 25 ? 'neutral' : 'negative',
  });

  // 2) Urgency (close date)
  const daysToClose = daysBetween(now, new Date(deal.close_date).getTime());
  if (daysToClose < 0) {
    factors.push({ key: 'urgency', label: 'Close date passed', detail: `Close date was ${Math.abs(daysToClose)} day${Math.abs(daysToClose) === 1 ? '' : 's'} ago.`, impact: -12, tone: 'negative' });
  } else if (daysToClose <= 30) {
    factors.push({ key: 'urgency', label: 'Closing soon', detail: `Closes in ${daysToClose} day${daysToClose === 1 ? '' : 's'} — high momentum window.`, impact: 6, tone: 'positive' });
  } else if (daysToClose > 180) {
    factors.push({ key: 'urgency', label: 'Long cycle', detail: `Close date is ${daysToClose} days out — forecast drift risk.`, impact: -4, tone: 'negative' });
  } else {
    factors.push({ key: 'urgency', label: 'Normal cycle', detail: `Closes in ${daysToClose} days.`, impact: 0, tone: 'neutral' });
  }

  // 3) Stagnation
  const daysInStage = daysBetween(new Date(deal.stage_entered_at).getTime(), now);
  if (daysInStage > 21) {
    factors.push({ key: 'stagnation', label: 'Stalled in stage', detail: `No stage movement in ${daysInStage} days — deals over 21 days stall 3× more often.`, impact: -18, tone: 'negative' });
  } else if (daysInStage > 14) {
    factors.push({ key: 'stagnation', label: 'Long stage dwell', detail: `In current stage for ${daysInStage} days.`, impact: -12, tone: 'negative' });
  } else if (daysInStage > 7) {
    factors.push({ key: 'stagnation', label: 'Elevated dwell', detail: `In current stage for ${daysInStage} days.`, impact: -5, tone: 'negative' });
  } else {
    factors.push({ key: 'stagnation', label: 'Fresh movement', detail: `Stage entered ${daysInStage} day${daysInStage === 1 ? '' : 's'} ago.`, impact: 0, tone: 'neutral' });
  }

  // 4) Owner engagement
  const lastActivity = latestActivityForDeal(ctx, deal.id);
  if (lastActivity) {
    const ageDays = daysBetween(new Date(lastActivity.created_at).getTime(), now);
    if (ageDays <= 7) {
      factors.push({ key: 'activity', label: 'Recently engaged', detail: `Last activity ${ageDays} day${ageDays === 1 ? '' : 's'} ago.`, impact: 8, tone: 'positive' });
    } else if (ageDays <= 14) {
      factors.push({ key: 'activity', label: 'Moderate engagement', detail: `Last activity ${ageDays} days ago.`, impact: 3, tone: 'neutral' });
    } else {
      factors.push({ key: 'activity', label: 'Engagement slipping', detail: `No linked activity in ${ageDays} days.`, impact: -8, tone: 'negative' });
    }
  } else {
    factors.push({ key: 'activity', label: 'No logged activity', detail: 'No calls, meetings, or notes logged against this deal.', impact: -5, tone: 'negative' });
  }

  // 5) Next-step readiness
  const openTasks = openTasksForDeal(ctx, deal.id);
  const overdueTask = openTasks.find(t => new Date(t.due_at).getTime() < now);
  const soonTask = openTasks.find(t => {
    const due = new Date(t.due_at).getTime();
    return due >= now && daysBetween(now, due) <= 14;
  });
  if (overdueTask) {
    factors.push({ key: 'next_step', label: 'Overdue next step', detail: `"${overdueTask.title}" is past due.`, impact: -6, tone: 'negative' });
  } else if (soonTask) {
    factors.push({ key: 'next_step', label: 'Next step scheduled', detail: `"${soonTask.title}" due within 14 days.`, impact: 6, tone: 'positive' });
  } else if (openTasks.length > 0) {
    factors.push({ key: 'next_step', label: 'Next step on radar', detail: `${openTasks.length} open task${openTasks.length === 1 ? '' : 's'} scheduled.`, impact: 2, tone: 'neutral' });
  } else {
    factors.push({ key: 'next_step', label: 'No next step', detail: 'No open task is linked to this deal — add one to keep momentum.', impact: -2, tone: 'negative' });
  }

  // 6) Value momentum vs team median
  const openDealValues = ctx.deals
    .filter(d => d.id !== deal.id && d.stage_id !== undefined && stageById(ctx, d.stage_id)?.type === 'open')
    .map(d => d.value);
  const median = openDealValues.length
    ? [...openDealValues].sort((a, b) => a - b)[Math.floor(openDealValues.length / 2)]
    : 0;
  if (median > 0) {
    const ratio = deal.value / median;
    if (ratio >= 2) {
      factors.push({ key: 'value', label: 'High-value deal', detail: `$${deal.value.toLocaleString()} — ${Math.round(ratio)}× team median.`, impact: 5, tone: 'positive' });
    } else if (ratio >= 1) {
      factors.push({ key: 'value', label: 'Above-median value', detail: `$${deal.value.toLocaleString()} vs. team median $${median.toLocaleString()}.`, impact: 2, tone: 'positive' });
    } else if (ratio < 0.5) {
      factors.push({ key: 'value', label: 'Below-median value', detail: `$${deal.value.toLocaleString()} is under half the team median.`, impact: -3, tone: 'negative' });
    } else {
      factors.push({ key: 'value', label: 'Typical value', detail: `In line with the $${median.toLocaleString()} team median.`, impact: 0, tone: 'neutral' });
    }
  }

  // 7) Completeness
  const completenessPoints = (deal.line_items?.length ? 2 : 0) + (ctx.accounts.some(a => a.id === deal.account_id) ? 1 : 0);
  if (completenessPoints > 0) {
    factors.push({
      key: 'completeness',
      label: 'Record complete',
      detail: `${deal.line_items?.length ?? 0} line item${(deal.line_items?.length ?? 0) === 1 ? '' : 's'}${ctx.accounts.some(a => a.id === deal.account_id) ? ' · account linked' : ''}.`,
      impact: completenessPoints,
      tone: 'positive',
    });
  } else {
    factors.push({ key: 'completeness', label: 'Thin record', detail: 'No line items or linked account — forecasting quality suffers.', impact: -2, tone: 'negative' });
  }

  const total = Math.round(clamp(base + factors.reduce((sum, f) => sum + f.impact, 0), 0, 100));
  return { score: total, grade: gradeOf(total), factors, generated_at: new Date(now).toISOString() };
}

// ─── Next-best-action engine ─────────────────────────────────────────────

export type ActionPriority = 'high' | 'medium' | 'low';
export type ActionCategory = 'revenue' | 'task' | 'hygiene';

export interface NextBestAction {
  id: string;
  priority: ActionPriority;
  category: ActionCategory;
  title: string;
  /** Human-readable explanation — the "why" behind the suggestion */
  reason: string;
  module: 'deals' | 'tasks' | 'contacts';
  /** Optional entity to highlight when navigating */
  entityId?: string;
}

const PRIORITY_WEIGHT: Record<ActionPriority, number> = { high: 3, medium: 2, low: 1 };

/**
 * Build prioritized, explained suggestions from the current user's scoped
 * data. Rules mirror the deep-dive painkiller list: re-engage dormant deals,
 * unstick stalled ones, protect deals closing without a next step, clear
 * overdue work, and keep the database clean.
 */
export function buildNextBestActions(ctx: InsightContext, max = 8): NextBestAction[] {
  const now = nowOf(ctx);
  const actions: NextBestAction[] = [];

  for (const deal of ctx.deals) {
    const stage = stageById(ctx, deal.stage_id);
    if (!stage || stage.type !== 'open') continue;

    const daysInStage = daysBetween(new Date(deal.stage_entered_at).getTime(), now);
    if (daysInStage >= 14) {
      actions.push({
        id: `nba-stagnant-${deal.id}`,
        priority: daysInStage >= 21 ? 'high' : 'medium',
        category: 'revenue',
        title: `Unstick "${deal.name}"`,
        reason: `Sitting in ${stage.name} for ${daysInStage} days — deals this stale convert at less than half the rate.`,
        module: 'deals',
        entityId: deal.id,
      });
    }

    const lastActivity = latestActivityForDeal(ctx, deal.id);
    const activityAge = lastActivity ? daysBetween(new Date(lastActivity.created_at).getTime(), now) : null;
    if (activityAge === null || activityAge > 14) {
      const valueWeight = deal.value >= 100_000 ? 1 : 0;
      actions.push({
        id: `nba-engage-${deal.id}`,
        priority: activityAge === null || activityAge > 21 ? 'high' : 'medium',
        category: 'revenue',
        title: `Re-engage "${deal.name}"`,
        reason: activityAge === null
          ? 'No activity has ever been logged against this deal.'
          : `No logged activity in ${activityAge} days — momentum is cooling.`,
        module: 'deals',
        entityId: deal.id,
      });
      // rank by value
      (actions[actions.length - 1] as NextBestAction & { _value?: number })._value = deal.value + valueWeight * 500_000;
    }

    const daysToClose = daysBetween(now, new Date(deal.close_date).getTime());
    if (daysToClose >= 0 && daysToClose <= 14) {
      const hasNextStep = openTasksForDeal(ctx, deal.id).length > 0;
      if (!hasNextStep) {
        actions.push({
          id: `nba-close-${deal.id}`,
          priority: 'high',
          category: 'revenue',
          title: `Protect "${deal.name}"`,
          reason: `Closes in ${daysToClose} day${daysToClose === 1 ? '' : 's'} with no scheduled next step — book a follow-up now.`,
          module: 'deals',
          entityId: deal.id,
        });
      }
    }
  }

  const overdueTasks = ctx.tasks
    .filter(t => !t.completed_at && new Date(t.due_at).getTime() < now)
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
    .slice(0, 3);
  for (const task of overdueTasks) {
    actions.push({
      id: `nba-task-${task.id}`,
      priority: task.priority === 'high' ? 'high' : 'medium',
      category: 'task',
      title: `Complete "${task.title}"`,
      reason: `Overdue since ${new Date(task.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`,
      module: 'tasks',
      entityId: task.id,
    });
  }

  // Data hygiene — visible to leadership roles (org-wide view)
  if (ctx.currentUserRole === UserRole.SUPER_ADMIN || ctx.currentUserRole === UserRole.ADMIN || ctx.currentUserRole === UserRole.MANAGER) {
    const duplicates = findDuplicateContacts(ctx.contacts);
    for (const group of duplicates.slice(0, 2)) {
      actions.push({
        id: `nba-dupe-${group.key}`,
        priority: 'medium',
        category: 'hygiene',
        title: `Merge ${group.contacts.length} duplicate contacts`,
        reason: `${group.contacts.map(c => `${c.first_name} ${c.last_name}`).join(' & ')} share the same ${group.matchOn} — duplicates cost an estimated 15–25% of revenue in bad forecasts.`,
        module: 'contacts',
        entityId: group.contacts[0]?.id,
      });
    }

    const unenriched = ctx.contacts
      .filter(c => !c.phone || !c.title)
      .slice(0, 2);
    for (const contact of unenriched) {
      actions.push({
        id: `nba-enrich-${contact.id}`,
        priority: 'low',
        category: 'hygiene',
        title: `Enrich "${contact.first_name} ${contact.last_name}"`,
        reason: `Missing ${!contact.phone ? 'a phone number' : ''}${!contact.phone && !contact.title ? ' and ' : ''}${!contact.title ? 'a job title' : ''} — incomplete records degrade scoring and personalization.`,
        module: 'contacts',
        entityId: contact.id,
      });
    }
  }

  // Dedupe by id, sort high→low, secondary sort by value for revenue actions
  const seen = new Set<string>();
  const unique: (NextBestAction & { _value?: number })[] = [];
  for (const a of actions) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    unique.push(a);
  }
  unique.sort((a, b) => {
    const p = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (p !== 0) return p;
    const va = a._value ?? 0;
    const vb = b._value ?? 0;
    return vb - va;
  });
  return unique.slice(0, max).map(({ _value, ...action }) => action);
}

// ─── Data hygiene: duplicate detection ───────────────────────────────────

export interface DuplicateGroup {
  key: string;
  matchOn: 'email' | 'phone' | 'name+domain';
  contacts: Contact[];
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().replace(/\s+/g, '');
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function domainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}

/**
 * Group contacts that look like duplicates by, in order of confidence:
 * exact email → exact phone → identical first+last name on the same email
 * domain. Returns only groups with ≥ 2 members.
 */
export function findDuplicateContacts(contacts: Contact[]): DuplicateGroup[] {
  const byEmail = new Map<string, Contact[]>();
  const byPhone = new Map<string, Contact[]>();
  const byNameDomain = new Map<string, Contact[]>();

  for (const contact of contacts) {
    if (contact.email) {
      const key = normalizeEmail(contact.email);
      const bucket = byEmail.get(key) ?? [];
      bucket.push(contact);
      byEmail.set(key, bucket);
    }
    if (contact.phone) {
      const key = normalizePhone(contact.phone);
      if (key.length >= 7) {
        const bucket = byPhone.get(key) ?? [];
        bucket.push(contact);
        byPhone.set(key, bucket);
      }
    }
    if (contact.first_name && contact.last_name && contact.email) {
      const key = `${contact.first_name.trim().toLowerCase()}|${contact.last_name.trim().toLowerCase()}|${domainOf(contact.email)}`;
      const bucket = byNameDomain.get(key) ?? [];
      bucket.push(contact);
      byNameDomain.set(key, bucket);
    }
  }

  const groups: DuplicateGroup[] = [];
  const seenContactIds = new Set<string>();

  const addGroup = (map: Map<string, Contact[]>, matchOn: DuplicateGroup['matchOn']) => {
    for (const [key, members] of map) {
      if (members.length < 2) continue;
      const fresh = members.filter(c => !seenContactIds.has(c.id));
      if (fresh.length < 2) continue;
      fresh.forEach(c => seenContactIds.add(c.id));
      groups.push({ key, matchOn, contacts: fresh });
    }
  };

  addGroup(byEmail, 'email');
  addGroup(byPhone, 'phone');
  addGroup(byNameDomain, 'name+domain');
  return groups;
}

// ─── Forecast confidence (variance explanation) ──────────────────────────

export interface ForecastConfidence {
  committed: number; // sum of won + high-probability weighted
  weighted: number; // Σ value × probability
  expectedLow: number;
  expectedHigh: number;
  variancePct: number;
}

/**
 * Weighted forecast with an expected range. The range is derived from the
 * probability distribution of open deals — explains *why* the number could
 * move, instead of presenting a single false-precise figure.
 */
export function forecastConfidence(deals: Deal[], ctx: InsightContext): ForecastConfidence {
  const stageProb = (stageId: string) => stageById(ctx, stageId)?.probability ?? 0;
  let committed = 0;
  let weighted = 0;
  let varianceSum = 0;

  for (const deal of deals) {
    const p = stageProb(deal.stage_id) / 100;
    const value = deal.value;
    committed += p >= 0.75 ? value * p : 0;
    weighted += value * p;
    varianceSum += value * p * (1 - p);
  }

  const stdDev = Math.sqrt(varianceSum);
  return {
    committed: Math.round(committed),
    weighted: Math.round(weighted),
    expectedLow: Math.round(Math.max(0, weighted - stdDev)),
    expectedHigh: Math.round(weighted + stdDev),
    variancePct: weighted > 0 ? Math.round((stdDev / weighted) * 100) : 0,
  };
}
