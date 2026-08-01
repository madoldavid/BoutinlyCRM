/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Calendar sync routes — Google & Microsoft OAuth connections,
 * status check, disconnect, and manual sync trigger.
 */

import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { authenticate, type AuthenticatedRequest } from '../security/rbac.js';
import { CalendarService } from '../services/calendarService.js';
import type { AppLogger } from '../logger.js';

export function registerCalendarRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
  logger: AppLogger,
) {
  const calendarService = new CalendarService(config, logger);

  // Get authorization URL for the selected provider
  app.post('/api/calendar/connect/:provider', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'microsoft') {
      throw new ApiError(400, 'Provider must be "google" or "microsoft".', 'invalid_provider');
    }

    const url = calendarService.getAuthorizationUrl(provider, req.principal.userId);
    res.json({ url });
  }));

  // OAuth callback
  app.get('/api/calendar/callback/:provider', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'microsoft') {
      throw new ApiError(400, 'Provider must be "google" or "microsoft".', 'invalid_provider');
    }

    const { code, state, error: oauthError } = req.query;
    if (oauthError) {
      // OAuth error — redirect to frontend with error
      res.redirect(`${config.APP_URL}?calendar_error=${encodeURIComponent(String(oauthError))}`);
      return;
    }

    if (!state || !code) {
      throw new ApiError(400, 'Missing OAuth code or state.', 'invalid_oauth_callback');
    }

    const parsed = calendarService.verifyState(String(state));
    if (!parsed || parsed.userId !== req.principal.userId) {
      throw new ApiError(400, 'Invalid OAuth state parameter.', 'invalid_state');
    }

    try {
      const tokens = await calendarService.exchangeCodeForTokens(parsed.provider, String(code));
      calendarService.storeTokens(req.principal.userId, {
        id: `cal-${req.principal.userId}-${parsed.provider}`,
        userId: req.principal.userId,
        provider: parsed.provider,
        email: tokens.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
      });

      await repository.addAuditLog({
        user_id: req.principal.userId,
        user_name: req.principal.email,
        action: 'calendar.connected',
        entity_type: 'calendar',
        diff: { provider: parsed.provider, email: tokens.email },
        ip_address: String(req.ip || ''),
        user_agent: String(req.get('user-agent') || ''),
      });

      // Redirect to frontend with success
      res.redirect(`${config.APP_URL}/tasks?calendar_connected=${parsed.provider}`);
    } catch (err) {
      res.redirect(`${config.APP_URL}?calendar_error=${encodeURIComponent(err instanceof Error ? err.message : 'Connection failed')}`);
    }
  }));

  // Connected accounts status
  app.get('/api/calendar/status', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const tokens = calendarService.getTokens(req.principal.userId);
    res.json({
      accounts: tokens.map(t => ({
        provider: t.provider,
        email: t.email,
        expires_at: t.expiresAt,
        scope: t.scope,
      })),
    });
  }));

  // Disconnect a provider
  app.post('/api/calendar/disconnect/:provider', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'microsoft') {
      throw new ApiError(400, 'Provider must be "google" or "microsoft".', 'invalid_provider');
    }

    calendarService.removeTokens(req.principal.userId, provider);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'calendar.disconnected',
      entity_type: 'calendar',
      diff: { provider },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ ok: true, message: `${provider} calendar disconnected.` });
  }));

  // Manual sync trigger — pulls events and creates tasks
  app.post('/api/calendar/sync', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const tokens = calendarService.getTokens(req.principal.userId);
    if (tokens.length === 0) {
      throw new ApiError(400, 'No calendar accounts connected.', 'no_calendars');
    }

    const timeMin = new Date();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Next 30 days
    let synced = 0;

    for (const token of tokens) {
      const events = await calendarService.fetchEvents(token, timeMin, timeMax);
      for (const event of events) {
        // Create tasks for calendar events that don't already have one
        const existingTasks = await repository.listTasks().then(all =>
          all.filter(t => t.assigned_to_id === req.principal.userId && t.title.includes(event.summary))
        );
        if (existingTasks.length > 0) continue; // Already synced

        await repository.addTask({
          title: event.summary,
          type: 'meeting',
          priority: 'medium',
          due_at: event.start,
          assigned_to_id: req.principal.userId,
          created_by_id: req.principal.userId,
          recurrence_rule: undefined,
        });
        synced++;
      }
    }

    res.json({
      ok: true,
      synced_events: synced,
      providers: tokens.map(t => t.provider),
      time_range: `${timeMin.toISOString()} to ${timeMax.toISOString()}`,
    });
  }));
}
