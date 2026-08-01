-- Boutinly CRM file attachments.
-- Applied after 001_enterprise_core.sql.

create table files (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  user_id text not null references users(id) on delete restrict,
  entity_type text not null check (entity_type in ('contact', 'account', 'deal', 'task')),
  entity_id text not null,
  filename text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  storage_provider text not null default 'local',
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index idx_files_entity on files (entity_type, entity_id);
create index idx_files_org on files (organization_id, created_at desc);

alter table files enable row level security;
create policy tenant_isolation_files on files
  using (organization_id::text = current_setting('app.organization_id', true));
