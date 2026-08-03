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

## Done — 2026-08-04 (frontend brand & power-user session)

### Brand alignment with boutinly.com ✅
- Extracted real brand tokens from the live site: charcoal `#141418`, cream `#f4f4f2`, cobalt `#1a2e6b`, pulse `#3e63dd`, destructive `#cb234a`, Urbanist 800 display / Geist body, premium easing `cubic-bezier(.16,1,.3,1)`.
- `index.css`: default light theme rebuilt on brand palette; `.theme-dark` now mirrors boutinly.com exactly (glow shadows included); `--accent-pulse` + `--shadow-glow` tokens added; Urbanist applied to h1–h3 and `.font-display`.
- Brand dark is the default theme for new users; sidebar swatches relabeled (Boutinly Dark / Boutinly Light / Artisan / Operator).
- Login page: marketing panel rewritten with sovereignty positioning ("Your pipeline. Your data. Your rules."), display typography, brand-dark panel.
- `index.html`: brand title, description, theme-color, inline SVG "B" favicon.
- Primary buttons gain the cobalt glow on hover.

### G-FE-02 — Column visibility & list preferences (client layer) ✅
- DataTable: `tableId` prop enables a column picker (show/hide, keep-one guard, reset) and persists hidden columns + density per device. Wired into Contacts and Deals tables.

### G-FE-01 — Saved views & filters (client layer) ✅
- `ui/SavedViews.tsx`: `useSavedViews` hook + `ViewSwitcher` dropdown (save current filters, apply, delete, default-on-open). Wired into Contacts (tab, view mode, search, tag). Preferences only — no customer data stored.
- Remaining for full G-FE-01/02: server-side persistence + shared/admin-published views; roll ViewSwitcher out to Tasks/Emails.

### Cleanup note
- `src/components/ui/SavedViews.tssx` is an accidental empty file (typo) — safe to delete.

## Suggested next (per PRD Section 15 quick-wins)
1. G-SEC-02 hash-chained audit trail (pure code + migration, no infra needed)
2. G-AI-01/02/03 server-side intelligence (port `src/ai/insights.ts` to API endpoints)
3. G-DAT-08 keyset pagination + server search
4. G-REP-01 report persistence, G-FE-01 saved views
