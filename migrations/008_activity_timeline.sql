-- Boutinly CRM activity timeline sub-system.
-- Two auxiliary tables — record-linked to-do items and historical call notes —
-- sharing a polymorphic `associated_to_id`. The id is a loose UUID that may
-- point at a lead, contact, or opportunity row (the records the timeline is
-- shown on), so no hard foreign key is declared on that column.
--
-- Both tables carry the spec'd fields: id, subject, description, due_date,
-- associated_to_id — plus user_id (who logged it) and created_at (feed ordering).

create table record_tasks (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  user_id text not null references users(id) on delete restrict,
  subject text not null,
  description text not null default '',
  due_date timestamptz,
  associated_to_id text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_record_tasks_associated_created on record_tasks (associated_to_id, created_at desc);
create index idx_record_tasks_org on record_tasks (organization_id, created_at desc);

create table call_logs (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  user_id text not null references users(id) on delete restrict,
  subject text not null,
  description text not null default '',
  due_date timestamptz,
  associated_to_id text not null,
  created_at timestamptz not null default now()
);

create index idx_call_logs_associated_created on call_logs (associated_to_id, created_at desc);
create index idx_call_logs_org on call_logs (organization_id, created_at desc);

alter table record_tasks enable row level security;
create policy tenant_isolation_record_tasks on record_tasks
  using (organization_id::text = current_setting('app.organization_id', true));

alter table call_logs enable row level security;
create policy tenant_isolation_call_logs on call_logs
  using (organization_id::text = current_setting('app.organization_id', true));
