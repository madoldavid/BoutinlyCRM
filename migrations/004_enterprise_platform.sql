-- Enterprise platform: API keys, webhooks, quotas, forecast categories,
-- account hierarchy, approvals, org security policies, field permissions.

create type forecast_category as enum ('pipeline', 'best_case', 'commit', 'omitted', 'closed');
create type approval_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type quota_period as enum ('monthly', 'quarterly', 'annual');
create type webhook_status as enum ('active', 'paused', 'disabled');

-- ── Deal forecast category ──────────────────────────────
alter table deals
  add column if not exists forecast_category forecast_category not null default 'pipeline';

create index if not exists idx_deals_forecast_category
  on deals (organization_id, forecast_category);

-- ── Account hierarchy ───────────────────────────────────
alter table accounts
  add column if not exists parent_account_id text references accounts(id) on delete set null;

create index if not exists idx_accounts_parent
  on accounts (organization_id, parent_account_id);

-- ── Org security policy ─────────────────────────────────
create table if not exists org_security_policies (
  organization_id text primary key references organizations(id) on delete cascade,
  ip_allowlist text[] not null default '{}',
  session_idle_minutes integer not null default 480 check (session_idle_minutes between 5 and 10080),
  max_sessions_per_user integer not null default 10 check (max_sessions_per_user between 1 and 100),
  enforce_mfa boolean not null default false,
  enforce_sso boolean not null default false,
  password_min_length integer not null default 8 check (password_min_length between 8 and 128),
  updated_at timestamptz not null default now()
);

-- ── API keys ────────────────────────────────────────────
create table if not exists api_keys (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{read,write}',
  created_by_id text references users(id) on delete set null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists idx_api_keys_org on api_keys (organization_id) where revoked_at is null;
create index if not exists idx_api_keys_prefix on api_keys (key_prefix);

alter table api_keys enable row level security;
drop policy if exists api_keys_tenant on api_keys;
create policy api_keys_tenant on api_keys
  using (organization_id = current_setting('app.organization_id', true));

-- ── Webhooks ────────────────────────────────────────────
create table if not exists webhooks (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  url text not null,
  secret text not null,
  events text[] not null default '{}',
  status webhook_status not null default 'active',
  created_by_id text references users(id) on delete set null,
  last_triggered_at timestamptz,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists webhook_deliveries (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  webhook_id text not null references webhooks(id) on delete cascade,
  event text not null,
  payload jsonb not null default '{}',
  response_status integer,
  response_body text,
  success boolean not null default false,
  attempt integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhooks_org on webhooks (organization_id);
create index if not exists idx_webhook_deliveries_wh on webhook_deliveries (webhook_id, created_at desc);

alter table webhooks enable row level security;
drop policy if exists webhooks_tenant on webhooks;
create policy webhooks_tenant on webhooks
  using (organization_id = current_setting('app.organization_id', true));

alter table webhook_deliveries enable row level security;
drop policy if exists webhook_deliveries_tenant on webhook_deliveries;
create policy webhook_deliveries_tenant on webhook_deliveries
  using (organization_id = current_setting('app.organization_id', true));

-- ── Quotas ──────────────────────────────────────────────
create table if not exists quotas (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  team_id text references teams(id) on delete cascade,
  period quota_period not null default 'quarterly',
  amount numeric(14, 2) not null check (amount >= 0),
  currency char(3) not null default 'USD',
  fiscal_year integer not null,
  fiscal_period integer not null check (fiscal_period >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or team_id is not null)
);

create index if not exists idx_quotas_org on quotas (organization_id, fiscal_year);

alter table quotas enable row level security;
drop policy if exists quotas_tenant on quotas;
create policy quotas_tenant on quotas
  using (organization_id = current_setting('app.organization_id', true));

-- ── Approvals ───────────────────────────────────────────
create table if not exists approval_requests (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('deal', 'discount', 'stage_change')),
  entity_id text not null,
  requested_by_id text not null references users(id) on delete restrict,
  approver_id text references users(id) on delete set null,
  status approval_status not null default 'pending',
  title text not null,
  reason text,
  payload jsonb not null default '{}',
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_approvals_org_status
  on approval_requests (organization_id, status, created_at desc);

alter table approval_requests enable row level security;
drop policy if exists approvals_tenant on approval_requests;
create policy approvals_tenant on approval_requests
  using (organization_id = current_setting('app.organization_id', true));

-- ── Field-level permissions ─────────────────────────────
create table if not exists field_permissions (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('contact', 'account', 'deal')),
  field_key text not null,
  role user_role not null,
  can_read boolean not null default true,
  can_write boolean not null default false,
  unique (organization_id, entity_type, field_key, role)
);

alter table field_permissions enable row level security;
drop policy if exists field_permissions_tenant on field_permissions;
create policy field_permissions_tenant on field_permissions
  using (organization_id = current_setting('app.organization_id', true));
