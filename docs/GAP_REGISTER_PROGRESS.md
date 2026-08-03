# Gap Register Progress

Tracks implementation against `Boutinly_Enterprise_CRM_Gap_Analysis_PRD.txt` (BOUTINLY-PRD-GAP-001 v1.0).

## Done — 2026-08-04 (quick-wins session)

### G-SEC-09 — Lockout fix + configurable thresholds (P1, S) ✅
- `security/lockout.ts`: thresholds configurable (`LOCKOUT_MAX_FAILURES`, `LOCKOUT_DURATION_MS`, `LOCKOUT_WINDOW_MS`), injectable clock, `resetAll()`/`dispose()`.
- Known flaky test replaced with a deterministic, config-driven version in `app.test.ts`; boundary unit suite added in `security/lockout.test.ts` (threshold edges, expiry, window reset, key independence).
- Lockout error message now reflects the configured duration.

### G-SEC-08 (subset) — Password & session policy configuration (P1, S) ✅
- Env-configurable: `PASSWORD_MIN_LENGTH`, `PASSWORD_REQUIRE_COMPLEXITY`, `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS`. Defaults preserve prior behavior exactly.
- `security/passwordPolicy.ts` enforced on signup and password reset.
- Remaining for full G-SEC-08: per-organization policy objects, reuse history, idle timeout, concurrent-session limits (needs org_policies table + admin UI).

### G-AI-14 / G-OPS-06 (subset) — Feature flags & kill switches (P1, S) ✅
- `services/featureFlags.ts`: catalog of kill-switch flags (AI scoring, next-best actions, duplicate detection, forecasting, campaigns, calendar sync); org override > global override > default; env seed via `FEATURE_FLAGS`.
- `routes/flags.routes.ts`: `GET /api/flags` (effective flags for caller), `GET/PUT /api/admin/flags` (+ org-override delete), global scope restricted to super_admin, all changes audit-logged. `requireFlag()` middleware exported for gating future endpoints.
- Remaining: DB persistence (in-process store today — flags reset on restart), Admin UI toggles, frontend consumption of `/api/flags`.

### G-DAT-12 (subset) — Idempotency & safe retry (P1, M) ✅
- `middleware/idempotency.ts`: opt-in `Idempotency-Key` header on any POST; successful responses cached for `IDEMPOTENCY_TTL_MS` (default 24h) and replayed with `Idempotency-Replayed: true`; failures never cached; in-flight duplicates get 409; keys scoped per caller + endpoint.
- API tests added in `app.test.ts`.
- Remaining: shared store for multi-instance (G-SEC-01), documented client retry semantics in the frontend fetch layer.

## Notes
- All new state stores are in-process, matching the codebase's current single-instance posture. They sit behind stable interfaces so the Redis/DB migration (G-SEC-01 / G-DAT-01) swaps the store, not the callers.
- `.env.example` updated with all new variables.

## Suggested next (per PRD Section 15 quick-wins)
1. G-SEC-02 hash-chained audit trail (pure code + migration, no infra needed)
2. G-AI-01/02/03 server-side intelligence (port `src/ai/insights.ts` to API endpoints)
3. G-DAT-08 keyset pagination + server search
4. G-REP-01 report persistence, G-FE-01 saved views
