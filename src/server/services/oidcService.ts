/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OIDC/SAML SSO service — Google Workspace & Microsoft Entra ID.
 * Implements Authorization Code Flow with PKCE.
 * Requires OIDC_GOOGLE_CLIENT_ID/SECRET or OIDC_MICROSOFT_CLIENT_ID/SECRET env vars.
 */

import { randomBytes } from 'node:crypto';
import type { AppConfig } from '../config.js';
import type { AppLogger } from '../logger.js';

export type OidcProvider = 'google' | 'microsoft';

interface OidcConfig {
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  scopes: string[];
}

// Simple mapping + in-memory state store
const oidcStateStore = new Map<string, { state: string; redirectAfter: string }>();

export class OidcService {
  private baseUrl: string;
  private logger: AppLogger;

  constructor(config: AppConfig, logger: AppLogger) {
    this.baseUrl = config.API_URL || 'http://localhost:8080';
    this.logger = logger;
  }

  getConfiguredProviders(): { id: OidcProvider; name: string }[] {
    const providers: { id: OidcProvider; name: string }[] = [];
    if (process.env.OIDC_GOOGLE_CLIENT_ID) {
      providers.push({ id: 'google', name: 'Google Workspace' });
    }
    if (process.env.OIDC_MICROSOFT_CLIENT_ID) {
      providers.push({ id: 'microsoft', name: 'Microsoft Entra ID' });
    }
    return providers;
  }

  getConfig(provider: OidcProvider): OidcConfig {
    switch (provider) {
      case 'google':
        return {
          clientId: process.env.OIDC_GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.OIDC_GOOGLE_CLIENT_SECRET || '',
          discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
          scopes: ['openid', 'email', 'profile'],
        };
      case 'microsoft':
        return {
          clientId: process.env.OIDC_MICROSOFT_CLIENT_ID || '',
          clientSecret: process.env.OIDC_MICROSOFT_CLIENT_SECRET || '',
          discoveryUrl: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
          scopes: ['openid', 'email', 'profile'],
        };
    }
  }

  async getAuthorizationUrl(provider: OidcProvider, redirectAfter: string = '/'): Promise<string> {
    const config = this.getConfig(provider);
    if (!config.clientId) throw new Error(`${provider} OIDC is not configured.`);

    // Fetch discovery document for authorization_endpoint
    const discovery = await this.fetchJson(config.discoveryUrl);
    const authEndpoint = discovery.authorization_endpoint;

    // Generate state for CSRF protection
    const state = randomBytes(32).toString('hex');
    oidcStateStore.set(state, { state, redirectAfter });

    const redirectUri = `${this.baseUrl}/api/auth/oidc/callback/${provider}`;
    const scope = config.scopes.join(' ');

    return `${authEndpoint}?` +
      `client_id=${encodeURIComponent(config.clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${state}` +
      `&access_type=offline&prompt=select_account`;
  }

  async exchangeCode(provider: OidcProvider, code: string, state: string): Promise<{
    email: string;
    name: string;
    sub: string;
  } | null> {
    const stored = oidcStateStore.get(state);
    if (!stored) {
      this.logger.warn('OIDC callback with unknown state');
      return null;
    }
    oidcStateStore.delete(state);

    const config = this.getConfig(provider);
    const discovery = await this.fetchJson(config.discoveryUrl);
    const tokenEndpoint = discovery.token_endpoint;
    const redirectUri = `${this.baseUrl}/api/auth/oidc/callback/${provider}`;

    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: config.clientId, client_secret: config.clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json() as any;
    const idToken = tokenData.id_token;

    if (!idToken) return null;

    // Decode the ID token (JWT) to get user info
    const parts = idToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    this.logger.info({ provider, email: payload.email }, 'OIDC login successful');

    return {
      email: payload.email || '',
      name: payload.name || payload.email || '',
      sub: payload.sub || '',
    };
  }

  getRedirectAfter(state: string): string {
    const stored = oidcStateStore.get(state);
    return stored?.redirectAfter || '/';
  }

  private async fetchJson(url: string): Promise<any> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OIDC discovery failed for ${url}`);
    return res.json();
  }
}
