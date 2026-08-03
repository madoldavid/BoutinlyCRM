/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Feature-flag service (G-AI-14 / G-OPS-06 minimal implementation).
 *
 * Precedence: per-organization override > global override > catalog default.
 * Seeded from the FEATURE_FLAGS env var ("key=on,other=off"); toggled at
 * runtime through the admin API with instant effect (in-process store).
 *
 * NOTE: This is the single-instance store behind a stable interface. The
 * DB-backed, multi-instance version arrives with the distributed-state work
 * (G-SEC-01) — swap the store, keep the interface.
 */

export interface FlagDefinition {
  key: string;
  description: string;
  defaultEnabled: boolean;
}

/** Known flags. Unknown keys resolve to disabled unless explicitly set. */
export const FLAG_CATALOG: FlagDefinition[] = [
  { key: 'ai.deal_scoring', description: 'Explainable deal scoring (kill switch per G-AI-08)', defaultEnabled: true },
  { key: 'ai.next_best_actions', description: 'Next-best-action assistant', defaultEnabled: true },
  { key: 'ai.duplicate_detection', description: 'Duplicate detection & merge suggestions', defaultEnabled: true },
  { key: 'ai.forecasting', description: 'Forecast confidence ranges', defaultEnabled: true },
  { key: 'email.campaigns', description: 'Email campaign sending', defaultEnabled: true },
  { key: 'calendar.sync', description: 'Calendar integration & sync', defaultEnabled: true },
];

export interface EffectiveFlag extends FlagDefinition {
  enabled: boolean;
  source: 'default' | 'global' | 'organization';
}

export class FeatureFlagService {
  private globalOverrides = new Map<string, boolean>();
  private orgOverrides = new Map<string, Map<string, boolean>>();
  private defaults = new Map<string, FlagDefinition>();

  /**
   * @param envSeed optional "key=on,key2=off" string (FEATURE_FLAGS env var)
   *                applied as global overrides at startup.
   */
  constructor(envSeed?: string) {
    for (const def of FLAG_CATALOG) this.defaults.set(def.key, def);
    if (envSeed) {
      for (const pair of envSeed.split(',')) {
        const [key, value] = pair.split('=').map(s => s.trim());
        if (!key || !value) continue;
        this.globalOverrides.set(key, ['on', 'true', '1', 'enabled'].includes(value.toLowerCase()));
      }
    }
  }

  /** Effective state for a flag, honoring org > global > default precedence. */
  isEnabled(key: string, organizationId?: string): boolean {
    if (organizationId) {
      const org = this.orgOverrides.get(organizationId);
      if (org?.has(key)) return org.get(key)!;
    }
    if (this.globalOverrides.has(key)) return this.globalOverrides.get(key)!;
    return this.defaults.get(key)?.defaultEnabled ?? false;
  }

  setGlobal(key: string, enabled: boolean): void {
    this.globalOverrides.set(key, enabled);
  }

  setForOrganization(organizationId: string, key: string, enabled: boolean): void {
    let org = this.orgOverrides.get(organizationId);
    if (!org) {
      org = new Map();
      this.orgOverrides.set(organizationId, org);
    }
    org.set(key, enabled);
  }

  clearOrganizationOverride(organizationId: string, key: string): boolean {
    return this.orgOverrides.get(organizationId)?.delete(key) ?? false;
  }

  /** All known flags (catalog + any ad-hoc overridden keys) with effective state. */
  list(organizationId?: string): EffectiveFlag[] {
    const keys = new Set<string>([
      ...this.defaults.keys(),
      ...this.globalOverrides.keys(),
      ...(organizationId ? this.orgOverrides.get(organizationId)?.keys() ?? [] : []),
    ]);
    return [...keys].sort().map(key => {
      const def = this.defaults.get(key);
      let source: EffectiveFlag['source'] = 'default';
      if (this.globalOverrides.has(key)) source = 'global';
      if (organizationId && this.orgOverrides.get(organizationId)?.has(key)) source = 'organization';
      return {
        key,
        description: def?.description ?? '(ad-hoc flag)',
        defaultEnabled: def?.defaultEnabled ?? false,
        enabled: this.isEnabled(key, organizationId),
        source,
      };
    });
  }
}
