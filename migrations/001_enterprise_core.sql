-- Boutinly CRM enterprise core schema.
-- Target: PostgreSQL 15+
-- Apply with a migration runner in CI/CD, not manually from an application process.

create extension if not exists "citext";

create type user_role as enum ('super_admin', 'admin', 'manager', 'sales_rep', 'viewer');
create type stage_type as enum ('open', 'won', 'lost');
create type task_type as enum ('call', 'email', 'meeting', 'todo');
create type task_priority as enum ('low', 'medium', 'high');
create type activity_type as enum ('call', 'meeting', 'email_sent', 'note', 'stage_change', 'task_completed', 'file_uploaded');

create table organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  plan text not null default 'enterprise',
  ses_domain text,
  fiscal_year_start smallint not null default 1 check (fiscal_year_start between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table teams (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table users (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  team_id text references teams(id) on delete set null,
  email citext not null,
  name text not null,
  password_hash text,
  avatar_url text,
  role user_role not null default 'sales_rep',
  mfa_enabled boolean not null default false,
  totp_secret text,
  is_active boolean not null default true,
  timezone text not null default 'UTC',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

alter table teams
  add column manager_id text references users(id) on delete set null;

create table accounts (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  owner_id text not null references users(id) on delete restrict,
  name text not null,
  domain text,
  industry text,
  size text,
  website text,
  arr numeric(14, 2) not null default 0,
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contacts (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  account_id text not null references accounts(id) on delete cascade,
  owner_id text not null references users(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  email citext not null,
  phone text,
  title text,
  linkedin_url text,
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}',
  unsubscribed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table pipelines (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table stages (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  pipeline_id text not null references pipelines(id) on delete cascade,
  name text not null,
  probability smallint not null check (probability between 0 and 100),
  stage_order integer not null,
  type stage_type not null default 'open',
  unique (pipeline_id, stage_order)
);

create table deals (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  pipeline_id text not null references pipelines(id) on delete restrict,
  stage_id text not null references stages(id) on delete restrict,
  account_id text not null references accounts(id) on delete cascade,
  owner_id text not null references users(id) on delete restrict,
  name text not null,
  value numeric(14, 2) not null default 0,
  currency char(3) not null default 'USD',
  probability smallint check (probability between 0 and 100),
  close_date date not null,
  stage_entered_at timestamptz not null default now(),
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  custom_fields jsonb not null default '{}',
  line_items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tasks (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  assigned_to_id text not null references users(id) on delete restrict,
  created_by_id text not null references users(id) on delete restrict,
  contact_id text references contacts(id) on delete set null,
  deal_id text references deals(id) on delete set null,
  title text not null,
  type task_type not null,
  priority task_priority not null default 'medium',
  due_at timestamptz not null,
  completed_at timestamptz,
  recurrence_rule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table activities (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  user_id text not null references users(id) on delete restrict,
  contact_id text references contacts(id) on delete set null,
  deal_id text references deals(id) on delete set null,
  task_id text references tasks(id) on delete set null,
  type activity_type not null,
  title text not null,
  body text not null,
  outcome text,
  duration_seconds integer,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table notifications (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_type text not null,
  entity_id text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table custom_field_definitions (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('contact', 'account', 'deal')),
  key text not null,
  label text not null,
  field_type text not null check (field_type in ('text', 'number', 'date', 'dropdown', 'boolean')),
  options jsonb,
  is_required boolean not null default false,
  is_visible boolean not null default true,
  display_order integer not null default 0,
  unique (organization_id, entity_type, key)
);

create table email_templates (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  created_by_id text not null references users(id) on delete restrict,
  name text not null,
  subject text not null,
  body_html text not null,
  variables text[] not null default '{}',
  is_shared boolean not null default false,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table email_campaigns (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  template_id text not null references email_templates(id) on delete restrict,
  created_by_id text not null references users(id) on delete restrict,
  name text not null,
  status text not null check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_recipients integer not null default 0,
  delivered_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,
  bounced_count integer not null default 0,
  unsubscribed_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  user_id text references users(id) on delete set null,
  user_name text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  diff jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table password_reset_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_password_reset_tokens_hash on password_reset_tokens (token_hash);
create index idx_password_reset_tokens_expiry on password_reset_tokens (expires_at);

create index idx_accounts_org_owner on accounts (organization_id, owner_id);
create index idx_contacts_org_owner on contacts (organization_id, owner_id);
create index idx_contacts_account on contacts (account_id);
create index idx_deals_org_owner_stage on deals (organization_id, owner_id, stage_id);
create index idx_tasks_assignee_due on tasks (assigned_to_id, due_at) where completed_at is null;
create index idx_activities_contact_created on activities (contact_id, created_at desc);
create index idx_activities_deal_created on activities (deal_id, created_at desc);
create index idx_notifications_user_unread on notifications (user_id, created_at desc) where read_at is null;
create index idx_audit_org_created on audit_logs (organization_id, created_at desc);

alter table organizations enable row level security;
alter table teams enable row level security;
alter table users enable row level security;
alter table accounts enable row level security;
alter table contacts enable row level security;
alter table pipelines enable row level security;
alter table stages enable row level security;
alter table deals enable row level security;
alter table tasks enable row level security;
alter table activities enable row level security;
alter table notifications enable row level security;
alter table custom_field_definitions enable row level security;
alter table email_templates enable row level security;
alter table email_campaigns enable row level security;
alter table audit_logs enable row level security;

-- Application code should set app.organization_id per request after verifying JWT/session.
create policy tenant_isolation_accounts on accounts
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_contacts on contacts
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_deals on deals
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_tasks on tasks
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_activities on activities
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_notifications on notifications
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_audit_logs on audit_logs
  using (organization_id::text = current_setting('app.organization_id', true));

-- Missing policies for remaining tenant-scoped tables
create policy tenant_isolation_organizations on organizations
  using (id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_teams on teams
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_users on users
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_pipelines on pipelines
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_stages on stages
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_custom_field_definitions on custom_field_definitions
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_email_templates on email_templates
  using (organization_id::text = current_setting('app.organization_id', true));
create policy tenant_isolation_email_campaigns on email_campaigns
  using (organization_id::text = current_setting('app.organization_id', true));
