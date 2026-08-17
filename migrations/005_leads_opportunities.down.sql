-- Boutinly CRM migration 005 rollback.

drop policy if exists tenant_isolation_leads on leads;
alter table leads disable row level security;

-- Recreate activity_type without the 'lead_converted' value (PG cannot drop enum values).
alter type activity_type rename to activity_type_old;
create type activity_type as enum ('call', 'meeting', 'email_sent', 'note', 'stage_change', 'task_completed', 'file_uploaded');
alter table activities alter column type type activity_type using type::text::activity_type;
drop type activity_type_old;

drop index if exists idx_activities_lead_created;
alter table activities drop column if exists lead_id;

drop index if exists idx_tasks_lead;
alter table tasks drop column if exists lead_id;

drop table if exists leads;
drop type if exists lead_status;
