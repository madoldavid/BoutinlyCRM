/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Boutinly Intelligence API — explainable deal scoring, next-best-action
 * recommendations, duplicate detection, and forecast confidence.
 * Powered by the deterministic rules engine in src/ai/insights.ts.
 */

import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { scopeSnapshot } from '../repositories/scope.js';
import { authenticate, type AuthenticatedRequest } from '../security/rbac.js';
import type { FeatureFlagService } from '../services/featureFlags.js';
import {
  scoreDeal,
  buildNextBestActions,
  findDuplicateContacts,
  forecastConfidence,
  type InsightContext,
  type DealScore,
} from '../../ai/insights.js';

function buildContext(snapshot: ReturnType<typeof scopeSnapshot> extends infer S ? S : never, principal: AuthenticatedRequest['principal']): InsightContext {
  return {
    deals: (snapshot as any).deals ?? [],
    stages: (snapshot as any).stages ?? [],
    contacts: (snapshot as any).contacts ?? [],
    accounts: (snapshot as any).accounts ?? [],
    tasks: (snapshot as any).tasks ?? [],
    activities: (snapshot as any).activities ?? [],
    users: (snapshot as any).users ?? [],
    currentUserId: principal.userId,
    currentUserRole: principal.role,
  };
}

export function registerInsightsRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
  flags: FeatureFlagService,
) {
  // Score a single deal with factor-level explainability
  app.get('/api/insights/deals/:id/score', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const deal = await repository.getDealById(req.params.id);
    if (!deal) {
      // Return a null score for unknown deals
      res.json({ deal_id: req.params.id, score: null, message: 'Deal not found.' });
      return;
    }

    // Load context needed for scoring
    const snapshot = await repository.snapshot();
    const scoped = scopeSnapshot(snapshot, req.principal);
    const ctx = buildContext(scoped as any, req.principal);
    const result = scoreDeal(deal, ctx);

    res.json({
      deal_id: deal.id,
      deal_name: deal.name,
      ...result,
    });
  }));

  // Next-best-action recommendations for the current user
  app.get('/api/insights/next-best-actions', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    if (!flags.isEnabled('ai.next_best_actions', req.principal.organizationId)) {
      res.json({ actions: [], message: 'Next-best actions are disabled.' });
      return;
    }

    const snapshot = await repository.snapshot();
    const scoped = scopeSnapshot(snapshot, req.principal);
    const ctx = buildContext(scoped as any, req.principal);
    const actions = buildNextBestActions(ctx);

    res.json({ actions, generated_at: new Date().toISOString() });
  }));

  // Duplicate contact detection
  app.get('/api/insights/duplicates', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    if (!flags.isEnabled('ai.duplicate_detection', req.principal.organizationId)) {
      res.json({ groups: [], message: 'Duplicate detection is disabled.' });
      return;
    }

    const snapshot = await repository.snapshot();
    const scoped = scopeSnapshot(snapshot, req.principal);
    const groups = findDuplicateContacts(scoped.contacts);

    res.json({ groups, generated_at: new Date().toISOString() });
  }));

  // Forecast confidence ranges
  app.get('/api/insights/forecast', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    if (!flags.isEnabled('ai.forecasting', req.principal.organizationId)) {
      res.json({ forecast: null, message: 'Forecasting is disabled.' });
      return;
    }

    const snapshot = await repository.snapshot();
    const scoped = scopeSnapshot(snapshot, req.principal);
    const ctx = buildContext(scoped as any, req.principal);
    const forecast = forecastConfidence(scoped.deals, ctx);

    res.json({ forecast, generated_at: new Date().toISOString() });
  }));
}
