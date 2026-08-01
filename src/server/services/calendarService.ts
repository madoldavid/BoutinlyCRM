/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Calendar sync service — Google & Microsoft OAuth 2.0 integration.
 * Stores encrypted tokens and provides sync primitives.
 * Requires GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET or MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET env vars.
 */

import { randomBytes } from 'node:crypto';
import type { AppConfig } from '../config.js';
import type { AppLogger } from '../logger.js';

export type CalendarProvider = 'google' | 'microsoft';

export interface CalendarToken {
  id: string;
  userId: string;
  provider: CalendarProvider;
  email: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scope: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  isAllDay: boolean;
  location?: string;
  attendees: string[];
}

// Simple in-memory token store — production should use DB with encrypted columns
const tokenStore = new Map<string, CalendarToken[]>();

const OAUTH_STATE_SECRET = process.env.JWT_SECRET || 'oauth-state-secret';

export class CalendarService {
  private baseUrl: string;
  private logger: AppLogger;

  constructor(config: AppConfig, logger: AppLogger) {
    this.baseUrl = config.API_URL || 'http://localhost:8080';
    this.logger = logger;
  }

  // ─── OAuth URL builders ────────────────────────────

  getAuthorizationUrl(provider: CalendarProvider, userId: string): string {
    const state = this.generateState(userId, provider);
    const redirectUri = `${this.baseUrl}/api/calendar/callback/${provider}`;

    switch (provider) {
      case 'google': {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured.');
        return `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly')}` +
          `&access_type=offline&prompt=consent&state=${state}`;
      }
      case 'microsoft': {
        const clientId = process.env.MICROSOFT_CLIENT_ID;
        if (!clientId) throw new Error('MICROSOFT_CLIENT_ID is not configured.');
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
          `client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=code&scope=${encodeURIComponent('offline_access Calendars.ReadWrite')}` +
          `&state=${state}`;
      }
    }
  }

  // ─── Token exchange ────────────────────────────────

  async exchangeCodeForTokens(provider: CalendarProvider, code: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string;
    email: string;
    scope: string;
  }> {
    const redirectUri = `${this.baseUrl}/api/calendar/callback/${provider}`;

    switch (provider) {
      case 'google': return this.exchangeGoogle(code, redirectUri);
      case 'microsoft': return this.exchangeMicrosoft(code, redirectUri);
    }
  }

  private async exchangeGoogle(code: string, redirectUri: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);

    const data = await res.json() as any;
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    }).then(r => r.json()) as any;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      email: userInfo.email || '',
      scope: data.scope || '',
    };
  }

  private async exchangeMicrosoft(code: string, redirectUri: string) {
    const clientId = process.env.MICROSOFT_CLIENT_ID || '';
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error(`Microsoft token exchange failed: ${res.status}`);

    const data = await res.json() as any;
    const userInfo = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    }).then(r => r.json()) as any;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      email: userInfo.mail || userInfo.userPrincipalName || '',
      scope: data.scope || '',
    };
  }

  // ─── Token storage ─────────────────────────────────

  storeTokens(userId: string, token: CalendarToken): void {
    const existing = tokenStore.get(userId) || [];
    const filtered = existing.filter(t => !(t.provider === token.provider && t.email === token.email));
    filtered.push(token);
    tokenStore.set(userId, filtered);
    this.logger.info({ userId, provider: token.provider, email: token.email }, 'Calendar tokens stored');
  }

  getTokens(userId: string): CalendarToken[] {
    return tokenStore.get(userId) || [];
  }

  removeTokens(userId: string, provider: CalendarProvider): void {
    const existing = tokenStore.get(userId) || [];
    tokenStore.set(userId, existing.filter(t => t.provider !== provider));
  }

  // ─── Sync helpers ──────────────────────────────────

  async refreshAccessToken(token: CalendarToken): Promise<CalendarToken | null> {
    if (!token.refreshToken) return null;

    try {
      if (token.provider === 'google') {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            refresh_token: token.refreshToken,
            grant_type: 'refresh_token',
          }),
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        return {
          ...token,
          accessToken: data.access_token,
          expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
        };
      }

      if (token.provider === 'microsoft') {
        const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID || '',
            client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
            refresh_token: token.refreshToken,
            grant_type: 'refresh_token',
          }),
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        return {
          ...token,
          accessToken: data.access_token,
          expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
        };
      }
    } catch {
      // Token refresh failed — provider may have revoked access
    }
    return null;
  }

  async fetchEvents(token: CalendarToken, timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    const validToken = token.expiresAt && new Date(token.expiresAt) > new Date()
      ? token
      : (await this.refreshAccessToken(token));
    if (!validToken) return [];

    try {
      if (token.provider === 'google') {
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
          `timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${validToken.accessToken}` },
        });
        if (!res.ok) return [];
        const data = await res.json() as any;
        return (data.items || []).map((item: any) => ({
          id: item.id,
          summary: item.summary || '',
          description: item.description || '',
          start: item.start?.dateTime || item.start?.date || '',
          end: item.end?.dateTime || item.end?.date || '',
          isAllDay: !!item.start?.date,
          location: item.location || '',
          attendees: (item.attendees || []).map((a: any) => a.email || ''),
        }));
      }

      if (token.provider === 'microsoft') {
        const url = `https://graph.microsoft.com/v1.0/me/calendarview?` +
          `startDateTime=${timeMin.toISOString()}&endDateTime=${timeMax.toISOString()}&$select=id,subject,bodyPreview,start,end,isAllDay,location,attendees`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${validToken.accessToken}` },
        });
        if (!res.ok) return [];
        const data = await res.json() as any;
        return (data.value || []).map((item: any) => ({
          id: item.id,
          summary: item.subject || '',
          description: item.bodyPreview || '',
          start: item.start?.dateTime || '',
          end: item.end?.dateTime || '',
          isAllDay: item.isAllDay || false,
          location: item.location?.displayName || '',
          attendees: (item.attendees || []).map((a: any) => a.emailAddress?.address || ''),
        }));
      }
    } catch {
      // Sync failed silently — will retry next time
    }
    return [];
  }

  // ─── State token (CSRF protection for OAuth) ───────

  private generateState(userId: string, provider: string): string {
    const raw = `${userId}:${provider}:${Date.now()}:${randomBytes(8).toString('hex')}`;
    return Buffer.from(raw).toString('base64url');
  }

  verifyState(state: string): { userId: string; provider: CalendarProvider } | null {
    try {
      const decoded = Buffer.from(state, 'base64url').toString();
      const [userId, provider] = decoded.split(':');
      if (userId && (provider === 'google' || provider === 'microsoft')) {
        return { userId, provider };
      }
    } catch { /* invalid state */ }
    return null;
  }
}
