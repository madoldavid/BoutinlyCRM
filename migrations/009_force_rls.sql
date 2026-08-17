-- Boutinly CRM migration 009: actually enforce the tenant-isolation RLS policies.
--
-- Every tenant table already has `ENABLE ROW LEVEL SECURITY` plus a
-- `tenant_isolation_*` policy (see 001/002/003/004/005/008). But Postgres
-- exempts the table OWNER from RLS by default, and this app runs migrations
-- and serves traffic through the same DATABASE_URL connection — meaning the
-- role that owns these tables (because it CREATEd them) is also the role
-- running every application query. Without FORCE ROW LEVEL SECURITY, the
-- app's own connection silently bypasses every policy below, and the only
-- thing actually stopping a cross-organization read/write is whichever
-- WHERE clause a given repository query happened to include.
--
-- FORCE ROW LEVEL SECURITY makes the policies apply to the table owner too,
-- so a missing organization_id filter in application code fails closed
-- (returns/affects zero rows) instead of silently returning another
-- tenant's data.
--
-- Three tables are deliberately NOT forced here, because real,
-- unauthenticated-by-design request paths query them with no tenant
-- context set — forcing RLS on them would silently break those features
-- instead of protecting anything, since nothing sensitive is exposed by
-- the specific queries those paths run:
--
--  - `organizations` / `users` — login (verifyLogin), the forgot-password
--    flow, and the OIDC callback all look up a user by email *before* any
--    tenant context exists. That's by design: `users` has a composite
--    `unique (organization_id, email)`, not a global unique email, so the
--    same address can belong to a different user in a different org, and
--    login has to scan across all of them. These two are instead
--    protected by explicit organization_id filters added directly to the
--    postgresRepository.ts queries that act on a single user/org by id
--    (getUserById, updateUserRole, toggleUserStatus, deleteUser).
--  - `email_campaigns` — the open/click tracking pixel and redirect
--    (GET /api/emails/track/...) are hit directly by the recipient's mail
--    client with no auth token, and increment a campaign's counters by
--    the campaignId embedded in that tracking URL. Forcing RLS here would
--    make every open/click silently no-op.

alter table teams force row level security;
alter table accounts force row level security;
alter table contacts force row level security;
alter table pipelines force row level security;
alter table stages force row level security;
alter table deals force row level security;
alter table tasks force row level security;
alter table activities force row level security;
alter table notifications force row level security;
alter table custom_field_definitions force row level security;
alter table email_templates force row level security;
alter table audit_logs force row level security;
alter table files force row level security;
alter table calendar_tokens force row level security;
alter table api_keys force row level security;
alter table webhooks force row level security;
alter table webhook_deliveries force row level security;
alter table quotas force row level security;
alter table approval_requests force row level security;
alter table field_permissions force row level security;
alter table leads force row level security;
alter table record_tasks force row level security;
alter table call_logs force row level security;
