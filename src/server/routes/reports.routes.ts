/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reports & analytics endpoints — leaderboard, custom reports, pipeline health.
 */

import type { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { scopeSnapshot } from '../repositories/scope.js';
import { authenticate, type AuthenticatedRequest } from '../security/rbac.js';

// ─── Leaderboard query schema ────────────────────

const leaderboardQuerySchema = z.object({
  period: z.enum(['month', 'quarter', 'year']).default('month'),
});

// ─── Custom report query schema ──────────────────
//
// `entity` accepts both singular ("deal", "contact", ...) and plural
// ("deals", "contacts", ...) spellings; the legacy frontend had been sending
// the singular form for years, which failed zod validation with HTTP 400 and
// silently surfaced as an empty UI. Normalize here so any reasonable spelling
// returns a 200 with possibly-empty data instead.

const ENTITY_ALIASES: Record<string, string> = {
  deal: 'deals',
  deals: 'deals',
  contact: 'contacts',
  contacts: 'contacts',
  account: 'accounts',
  accounts: 'accounts',
  task: 'tasks',
  tasks: 'tasks',
  activity: 'activities',
  activities: 'activities',
};

const customReportSchema = z.object({
  entity: z.string().transform(s => ENTITY_ALIASES[s] ?? s).pipe(
    z.enum(['deals', 'contacts', 'accounts', 'tasks', 'activities']),
  ),
  group_by: z.string().optional(),
  aggregate: z.enum(['count', 'sum', 'avg', 'min', 'max']).default('count'),
  aggregate_field: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export function registerReportsRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  // ─── Team Leaderboard ──────────────────────────

  app.get('/api/reports/leaderboard', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = leaderboardQuerySchema.parse(req.query);
    const snapshot = await repository.snapshot();
    const scoped = scopeSnapshot(snapshot, req.principal);

    const now = new Date();
    let periodStart: Date;

    switch (query.period) {
      case 'month': periodStart = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'quarter': periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
      case 'year': periodStart = new Date(now.getFullYear(), 0, 1); break;
    }

    const periodStartStr = periodStart.toISOString();

    // Build per-rep stats
    const repStats = scoped.users.map(user => {
      const userDeals = scoped.deals.filter(d => d.owner_id === user.id);
      const wonDeals = userDeals.filter(d => d.won_at && new Date(d.won_at) >= periodStart);
      const openDeals = userDeals.filter(d => !d.won_at && !d.lost_at);
      const lostDeals = userDeals.filter(d => d.lost_at && new Date(d.lost_at) >= periodStart);
      const totalClosed = wonDeals.length + lostDeals.length;
      const winRate = totalClosed > 0 ? Math.round((wonDeals.length / totalClosed) * 100) : 0;

      const userActivities = scoped.activities.filter(a =>
        a.user_id === user.id && new Date(a.created_at) >= periodStart
      );

      const userTasks = scoped.tasks.filter(t =>
        t.assigned_to_id === user.id && t.completed_at && new Date(t.completed_at) >= periodStart
      );

      return {
        user_id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        won_revenue: wonDeals.reduce((sum, d) => sum + d.value, 0),
        won_count: wonDeals.length,
        lost_count: lostDeals.length,
        win_rate: winRate,
        open_deals_count: openDeals.length,
        open_deals_value: openDeals.reduce((sum, d) => sum + d.value, 0),
        activities_count: userActivities.length,
        tasks_completed: userTasks.length,
        period: query.period,
      };
    });

    // Sort by won revenue descending
    repStats.sort((a, b) => b.won_revenue - a.won_revenue);

    res.json({
      leaderboard: repStats,
      period: query.period,
      period_start: periodStartStr,
      generated_at: new Date().toISOString(),
    });
  }));

  // ─── Custom Report Builder ─────────────────────

  app.get('/api/reports/custom', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = customReportSchema.parse(req.query);
    const snapshot = await repository.snapshot();
    const scoped = scopeSnapshot(snapshot, req.principal);

    // Get the data set for the requested entity
    let data: Record<string, unknown>[];
    switch (query.entity) {
      case 'deals': data = scoped.deals as unknown as Record<string, unknown>[]; break;
      case 'contacts': data = scoped.contacts as unknown as Record<string, unknown>[]; break;
      case 'accounts': data = scoped.accounts as unknown as Record<string, unknown>[]; break;
      case 'tasks': data = scoped.tasks as unknown as Record<string, unknown>[]; break;
      case 'activities': data = scoped.activities as unknown as Record<string, unknown>[]; break;
      default: data = [];
    }

    // Apply date filter
    if (query.date_from || query.date_to) {
      const from = query.date_from ? new Date(query.date_from).getTime() : 0;
      const to = query.date_to ? new Date(query.date_to).getTime() : Infinity;
      data = data.filter(row => {
        const createdAt = row.created_at ? new Date(row.created_at as string).getTime() : 0;
        return createdAt >= from && createdAt <= to;
      });
    }

    // Apply custom filters
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        if (value !== undefined && value !== null && value !== '') {
          data = data.filter(row => {
            const rowVal = row[key];
            if (typeof value === 'string' && typeof rowVal === 'string') {
              return rowVal.toLowerCase().includes(value.toLowerCase());
            }
            return rowVal === value;
          });
        }
      }
    }

    // Group and aggregate
    let result: Record<string, unknown>[];
    const groupField = query.group_by;

    if (groupField && data.length > 0) {
      const groups = new Map<string, Record<string, unknown>[]>();

      for (const row of data) {
        const key = String(row[groupField] ?? 'undefined');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      result = Array.from(groups.entries()).map(([group, rows]) => {
        const entry: Record<string, unknown> = { group, count: rows.length };

        if (query.aggregate === 'sum' && query.aggregate_field) {
          entry.sum = rows.reduce((acc, r) => acc + (Number(r[query.aggregate_field!]) || 0), 0);
        }
        if (query.aggregate === 'avg' && query.aggregate_field) {
          const total = rows.reduce((acc, r) => acc + (Number(r[query.aggregate_field!]) || 0), 0);
          entry.avg = rows.length > 0 ? Math.round((total / rows.length) * 100) / 100 : 0;
        }
        if (query.aggregate === 'min' && query.aggregate_field) {
          entry.min = Math.min(...rows.map(r => Number(r[query.aggregate_field!]) || 0));
        }
        if (query.aggregate === 'max' && query.aggregate_field) {
          entry.max = Math.max(...rows.map(r => Number(r[query.aggregate_field!]) || 0));
        }

        return entry;
      });

      result.sort((a, b) => Number(b.count) - Number(a.count));
    } else {
      result = data.map(row => ({ ...row }));
    }

    res.json({
      entity: query.entity,
      total_rows: result.length,
      aggregate: query.aggregate,
      group_by: groupField || null,
      date_from: query.date_from || null,
      date_to: query.date_to || null,
      data: result,
      generated_at: new Date().toISOString(),
    });
  }));

  // ─── Pipeline Health ───────────────────────────

  const pipelineHealthQuerySchema = z.object({
    pipeline_id: z.string().optional(),
  });

  app.get('/api/reports/pipeline-health', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = pipelineHealthQuerySchema.parse(req.query);
    const snapshot = await repository.snapshot();
    const scoped = scopeSnapshot(snapshot, req.principal);

    // Restrict stages to a single pipeline so duplicate pipelines (e.g. a stale
    // seed file or a default pipeline that was provisioned twice at signup)
    // never render every stage twice in the funnel / donut / stage cards.
    // Prefer the explicitly requested pipeline, then the default, then the first.
    const targetPipeline =
      (query.pipeline_id && scoped.pipelines.find(p => p.id === query.pipeline_id)) ||
      scoped.pipelines.find(p => p.is_default) ||
      scoped.pipelines[0];

    const pipelineStageIds = new Set(
      targetPipeline ? scoped.stages.filter(s => s.pipeline_id === targetPipeline.id).map(s => s.id) : [],
    );

    // Defensive de-dup: keep only the first row per stage id, so even legacy
    // duplicated stage rows collapse to a single entry in every widget.
    const seenStageIds = new Set<string>();
    const stages = scoped.stages
      .filter(s => s.type === 'open' && (!targetPipeline || pipelineStageIds.has(s.id)))
      .filter(s => {
        if (seenStageIds.has(s.id)) return false;
        seenStageIds.add(s.id);
        return true;
      })
      .sort((a, b) => a.order - b.order);

    const deals = scoped.deals.filter(d =>
      !d.won_at && !d.lost_at && (!targetPipeline || d.pipeline_id === targetPipeline.id),
    );

    // Funnel: count of deals per stage
    const funnel = stages.map(stage => {
      const stageDeals = deals.filter(d => d.stage_id === stage.id);
      return {
        stage_id: stage.id,
        stage_name: stage.name,
        count: stageDeals.length,
        value: stageDeals.reduce((sum, d) => sum + d.value, 0),
        probability: stage.probability,
      };
    });

    // Stagnant deals (no stage change in 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const stagnant = deals.filter(d => d.stage_entered_at < thirtyDaysAgo && !d.won_at && !d.lost_at);

    // Velocity: average days in each stage for closed deals this quarter
    const quarterStart = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1);
    const closedThisQuarter = scoped.deals.filter(d =>
      (d.won_at || d.lost_at) && new Date(d.won_at || d.lost_at || '') >= quarterStart
    );

    // Total pipeline value
    const totalPipeline = deals.reduce((sum, d) => sum + d.value, 0);
    const weightedValue = deals.reduce((sum, d) => sum + d.value * (d.probability || 0) / 100, 0);

    // Average probability of OPEN deals (uses deal-level override when present,
    // falls back to the stage default). Reported as 0 when there are no open
    // deals — never a fabricated "50%" from averaging stage defaults.
    const avgProbability = deals.length > 0
      ? Math.round(
          deals.reduce((sum, d) => {
            const stage = scoped.stages.find(s => s.id === d.stage_id);
            return sum + (d.probability ?? stage?.probability ?? 0);
          }, 0) / deals.length,
        )
      : 0;

    // Real win rate: won / (won + lost) across all deals in scope. 0 when no
    // closed deals exist — matches the leaderboard widget, never a fabricated 50%.
    const wonCount = scoped.deals.filter(d => d.won_at).length;
    const lostCount = scoped.deals.filter(d => d.lost_at).length;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

    res.json({
      funnel,
      pipeline_id: targetPipeline?.id ?? null,
      stagnant_deals_count: stagnant.length,
      stagnant_deals_value: stagnant.reduce((sum, d) => sum + d.value, 0),
      closed_this_quarter_count: closedThisQuarter.length,
      total_pipeline_value: totalPipeline,
      weighted_pipeline_value: Math.round(weightedValue),
      avg_probability: avgProbability,
      open_deals_count: deals.length,
      won_count: wonCount,
      lost_count: lostCount,
      closed_count: closedCount,
      win_rate: winRate,
      generated_at: new Date().toISOString(),
    });
  }));
}
