/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for the Boutinly Intelligence engine (src/ai/insights.ts).
 * The engine is pure and clock-injectable, so all expectations are deterministic.
 */

import { describe, it, expect } from 'vitest';
import type { Account, Activity, Contact, Deal, Stage, Task, User } from '../types';
import { UserRole } from '../types';
import {
  scoreDeal,
  gradeOf,
  buildNextBestActions,
  findDuplicateContacts,
  forecastConfidence,
  type InsightContext,
} from './insights';

const NOW = new Date('2026-08-04T12:00:00Z');

function makeStage(id: string, probability: number, type: Stage['type'] = 'open'): Stage {
  return { id, pipeline_id: 'pipe', name: id, probability, order: 1, type };
}

function makeDeal(overrides: Partial<Deal>): Deal {
  return {
    id: 'deal-1',
    organization_id: 'org',
    name: 'Test Deal',
    pipeline_id: 'pipe',
    stage_id: 'stg-demo',
    account_id: 'acc-1',
    owner_id: 'usr-1',
    value: 100000,
    currency: 'USD',
    close_date: '2026-09-15T00:00:00Z',
    stage_entered_at: '2026-07-01T00:00:00Z',
    custom_fields: {},
    line_items: [],
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity>): Activity {
  return {
    id: 'act-1',
    type: 'note',
    title: 'Note',
    body: '',
    user_id: 'usr-1',
    deal_id: 'deal-1',
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Follow up',
    type: 'todo',
    priority: 'medium',
    due_at: '2026-08-10T00:00:00Z',
    assigned_to_id: 'usr-1',
    created_by_id: 'usr-1',
    ...overrides,
  };
}

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: 'con-1',
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@acme.com',
    phone: '555-0101',
    title: 'VP Sales',
    account_id: 'acc-1',
    owner_id: 'usr-1',
    tags: [],
    custom_fields: {},
    unsubscribed: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    deals: [],
    stages: [makeStage('stg-lead', 10), makeStage('stg-demo', 50), makeStage('stg-won', 100, 'won')],
    contacts: [],
    accounts: [{ id: 'acc-1', name: 'Acme', domain: 'acme.com', industry: 'Tech', size: '51-200', website: '', arr: 1000, owner_id: 'usr-1', tags: [], custom_fields: {}, created_at: '' } as Account],
    tasks: [],
    activities: [],
    users: [{ id: 'usr-1', email: 'a@b.com', name: 'Alex', role: UserRole.SALES_REP, mfa_enabled: false, is_active: true, timezone: 'UTC' } as User],
    currentUserId: 'usr-1',
    currentUserRole: UserRole.SALES_REP,
    now: NOW,
    ...overrides,
  };
}

describe('scoreDeal', () => {
  it('returns a score within 0–100 with a matching grade', () => {
    const ctx = makeCtx();
    const score = scoreDeal(makeDeal({}), ctx);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(score.grade).toBe(gradeOf(score.score));
    // 7 factors, minus value-momentum when there are no peer deals to compare
    expect(score.factors.length).toBeGreaterThanOrEqual(6);
  });

  it('explains every factor with label, detail, impact, and tone', () => {
    const score = scoreDeal(makeDeal({}), makeCtx());
    for (const f of score.factors) {
      expect(f.label).toBeTruthy();
      expect(f.detail).toBeTruthy();
      expect(typeof f.impact).toBe('number');
      expect(['positive', 'negative', 'neutral']).toContain(f.tone);
    }
  });

  it('penalizes stagnation and rewards fresh stage movement', () => {
    const ctx = makeCtx();
    const stale = scoreDeal(makeDeal({ stage_entered_at: '2026-06-01T00:00:00Z' }), ctx);
    const fresh = scoreDeal(makeDeal({ stage_entered_at: '2026-08-03T00:00:00Z' }), ctx);
    const staleFactor = stale.factors.find(f => f.key === 'stagnation')!;
    const freshFactor = fresh.factors.find(f => f.key === 'stagnation')!;
    expect(staleFactor.impact).toBeLessThan(freshFactor.impact);
    expect(stale.score).toBeLessThan(fresh.score);
  });

  it('rewards a scheduled next step and penalizes an overdue one', () => {
    const overdue = makeCtx({ tasks: [makeTask({ deal_id: 'deal-1', due_at: '2026-07-01T00:00:00Z' })] });
    const scheduled = makeCtx({ tasks: [makeTask({ deal_id: 'deal-1', due_at: '2026-08-10T00:00:00Z' })] });
    const overdueScore = scoreDeal(makeDeal({}), overdue);
    const scheduledScore = scoreDeal(makeDeal({}), scheduled);
    expect(scheduledScore.factors.find(f => f.key === 'next_step')!.impact).toBeGreaterThan(
      overdueScore.factors.find(f => f.key === 'next_step')!.impact
    );
  });

  it('is deterministic for identical input', () => {
    const ctx = makeCtx();
    const a = scoreDeal(makeDeal({}), ctx);
    const b = scoreDeal(makeDeal({}), ctx);
    expect(a).toEqual(b);
  });
});

describe('buildNextBestActions', () => {
  it('flags stagnant deals with a reason', () => {
    const ctx = makeCtx({
      deals: [makeDeal({ name: 'Stuck Deal', stage_entered_at: '2026-06-01T00:00:00Z' })],
    });
    const actions = buildNextBestActions(ctx, 10);
    const stagnant = actions.find(a => a.id.includes('stagnant'));
    expect(stagnant).toBeDefined();
    expect(stagnant!.reason).toContain('day');
    expect(stagnant!.module).toBe('deals');
  });

  it('recommends re-engaging deals with no recent activity', () => {
    const ctx = makeCtx({
      deals: [makeDeal({ name: 'Cold Deal', stage_entered_at: '2026-08-01T00:00:00Z' })],
      activities: [makeActivity({ created_at: '2026-07-01T00:00:00Z' })],
    });
    const actions = buildNextBestActions(ctx, 10);
    expect(actions.some(a => a.id.includes('engage'))).toBe(true);
  });

  it('protects deals closing soon without a next step', () => {
    const ctx = makeCtx({
      deals: [makeDeal({ close_date: '2026-08-10T00:00:00Z', stage_entered_at: '2026-08-01T00:00:00Z' })],
      activities: [makeActivity({ created_at: '2026-08-02T00:00:00Z' })],
    });
    const actions = buildNextBestActions(ctx, 10);
    expect(actions.some(a => a.id.includes('close'))).toBe(true);
  });

  it('surfaces overdue tasks', () => {
    const ctx = makeCtx({
      deals: [],
      tasks: [makeTask({ priority: 'high', due_at: '2026-07-01T00:00:00Z' })],
    });
    const actions = buildNextBestActions(ctx, 10);
    expect(actions.some(a => a.id.includes('task') && a.priority === 'high')).toBe(true);
  });

  it('hides org-wide hygiene suggestions from sales reps', () => {
    const dupes = [
      makeContact({ id: 'c1', email: 'dup@x.com' }),
      makeContact({ id: 'c2', email: 'dup@x.com' }),
    ];
    const rep = buildNextBestActions(makeCtx({ contacts: dupes }), 10);
    expect(rep.some(a => a.category === 'hygiene')).toBe(false);

    const admin = buildNextBestActions(
      makeCtx({ contacts: dupes, currentUserRole: UserRole.ADMIN }),
      10
    );
    expect(admin.some(a => a.category === 'hygiene')).toBe(true);
  });

  it('sorts high-priority actions first', () => {
    const ctx = makeCtx({
      deals: [
        makeDeal({ id: 'd-stale', name: 'Stale', stage_entered_at: '2026-06-01T00:00:00Z' }),
        makeDeal({ id: 'd-fresh', name: 'Fresh', stage_entered_at: '2026-08-03T00:00:00Z' }),
      ],
      tasks: [makeTask({ id: 't-low', priority: 'low', due_at: '2026-07-01T00:00:00Z' })],
    });
    const actions = buildNextBestActions(ctx, 10);
    expect(actions[0].priority).toBe('high');
  });
});

describe('findDuplicateContacts', () => {
  it('groups contacts sharing an email', () => {
    const groups = findDuplicateContacts([
      makeContact({ id: 'a', email: 'jane@acme.com' }),
      makeContact({ id: 'b', email: '  JANE@Acme.COM ' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].matchOn).toBe('email');
    expect(groups[0].contacts).toHaveLength(2);
  });

  it('groups contacts sharing a phone number', () => {
    const groups = findDuplicateContacts([
      makeContact({ id: 'a', email: 'a@x.com', phone: '(555) 010-1234' }),
      makeContact({ id: 'b', email: 'b@x.com', phone: '5550101234' }),
    ]);
    expect(groups.some(g => g.matchOn === 'phone' && g.contacts.length === 2)).toBe(true);
  });

  it('groups same name + email domain', () => {
    const groups = findDuplicateContacts([
      makeContact({ id: 'a', email: 'jane@acme.com' }),
      makeContact({ id: 'b', email: 'jane.doe@acme.com', phone: '' }),
    ]);
    // first+last+domain match
    expect(groups.some(g => g.matchOn === 'name+domain' && g.contacts.length === 2)).toBe(true);
  });

  it('ignores unique contacts', () => {
    const groups = findDuplicateContacts([
      makeContact({ id: 'a', email: 'a@x.com', phone: '555-0001' }),
      makeContact({ id: 'b', email: 'b@y.com', phone: '555-0002' }),
    ]);
    expect(groups).toHaveLength(0);
  });
});

describe('forecastConfidence', () => {
  it('computes weighted, committed, and a sane range', () => {
    const ctx = makeCtx();
    const fc = forecastConfidence(
      [
        makeDeal({ id: 'd1', value: 100000, stage_id: 'stg-demo' }), // 50% → 50k
        makeDeal({ id: 'd2', value: 200000, stage_id: 'stg-won' }), // 100% → 200k
      ],
      ctx
    );
    expect(fc.weighted).toBe(250000);
    expect(fc.committed).toBe(200000);
    expect(fc.expectedLow).toBeLessThan(fc.weighted);
    expect(fc.expectedHigh).toBeGreaterThan(fc.weighted);
    expect(fc.variancePct).toBeGreaterThanOrEqual(0);
  });
});
