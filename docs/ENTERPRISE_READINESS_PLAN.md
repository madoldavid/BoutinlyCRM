# Boutinly CRM Enterprise Readiness Plan

This project started as a rich browser-only prototype. Enterprise readiness means moving CRM authority out of the browser and into authenticated, audited, tested, observable backend services.

## Target Architecture

- Frontend: Vite React app, API-driven, no trusted authorization logic in the browser.
- API: Node/Express service with request validation, security headers, CORS allow-listing, structured logs, and RBAC middleware.
- Database: PostgreSQL 15+ with migrations, foreign keys, indexes, tenant isolation, audit logs, and row-level security.
- Identity: production SSO/OIDC provider, MFA enforcement, short-lived sessions, refresh-token rotation, emergency user revocation.
- Authorization: server-enforced tenant, team, owner, and role permissions.
- Email: verified SES or equivalent provider, DKIM/SPF/DMARC, unsubscribe enforcement, bounce processing, webhook signature validation.
- Files: private object storage, malware scanning, signed URLs, content-type/size validation, retention policy.
- Observability: JSON logs, request IDs, metrics, traces, uptime checks, alerting, audit exports.
- Delivery: CI checks, dependency audit, migration gate, environment validation, deploy previews, staged rollout.

## Production Phases

1. Foundation
   - Add API service, auth middleware, validation, repository boundary, PostgreSQL schema, tests, env contract.
   - Fix seed data and local role scoping.

2. Backend Completeness
   - Implement PostgreSQL repository for every entity.
   - Move all CRUD, reporting, email actions, tasks, pipeline transitions, and admin actions to server endpoints.
   - Add audit log writes for every mutation.

3. Identity and Security
   - Replace demo login with OIDC/SAML SSO.
   - Enforce MFA and account lifecycle states.
   - Add rate limits, account lockout, CSRF strategy where applicable, and security event alerts.

4. Enterprise Data Controls
   - Tenant-aware exports, backups, PITR, retention policies, GDPR/DSAR flows, soft delete/legal hold where required.
   - Add data import jobs with validation, dedupe, rollback, and progress tracking.

5. Communication Integrations
   - Real SES/domain verification, campaign sending, bounce/open/click webhooks, unsubscribe rules.
   - Google/Microsoft calendar OAuth apps with encrypted token storage and background sync workers.

6. Quality and Operations
   - Unit, API, integration, E2E, visual, accessibility, load, and security tests.
   - CI/CD pipeline, production runbooks, incident response, monitoring dashboards.

## Non-Negotiable Production Gates

- No customer data stored only in `localStorage`.
- No client-side-only RBAC.
- No demo login or shared demo password in production.
- No claims of SES, S3, OAuth, OWASP, immutable audit, or compliance unless implemented and tested.
- No deployment without backups, migrations, observability, and rollback.

## Current Implementation Added

- Express API foundation in `src/server`.
- Environment validation in `src/server/config.ts`.
- HMAC JWT issuing/verifying in `src/server/security/token.ts`.
- RBAC middleware in `src/server/security/rbac.ts`.
- PostgreSQL schema in `migrations/001_enterprise_core.sql`.
- API tests in `src/server/app.test.ts`.

## Remaining Work

The API scaffold is intentionally small and production-shaped. The next large milestone is replacing the in-memory repository with a full PostgreSQL implementation and migrating the React context store to fetch from `/api/crm/bootstrap` and mutation endpoints.
