-- Boutinly CRM leads + opportunities rebrand.
-- Introduces the Leads entity as stage 3 of the 5-step model
-- (Accounts -> Contacts -> Leads -> Conversion -> Opportunities) and
-- extends tasks/activities with lead linkage.

create type lead_status as enum ('new', 'working', 'qualified', 'converted');

create table leads (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  owner_id text not null references users(id) on delete restrict,
  name text not null,
  company_name text not null default '',
  email citext not null,
  phone text,
  source text,
  status lead_status not null default 'new',
  converted_account_id text references accounts(id) on delete set null,
  converted_contact_id text references contacts(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_org_owner_status on leads (organization_id, owner_id, status);
create index idx_leads_org_email on leads (organization_id, email);
create index idx_leads_owner_created on leads (owner_id, created_at desc);

alter table tasks add column lead_id text references leads(id) on delete set null;
create index idx_tasks_lead on tasks (lead_id);

alter table activities add column lead_id text references leads(id) on delete set null;
create index idx_activities_lead_created on activities (lead_id, created_at desc);

-- Lead conversion emits an activity of this type.
alter type activity_type add value 'lead_converted';

alter table leads enable row level security;
create policy tenant_isolation_leads on leads
  using (organization_id::text = current_setting('app.organization_id', true));
