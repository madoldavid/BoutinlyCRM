-- Reverse of 001_enterprise_core.sql
-- Drops all objects in reverse creation order.

-- Drop RLS policies first
drop policy if exists tenant_isolation_email_campaigns on email_campaigns;
drop policy if exists tenant_isolation_email_templates on email_templates;
drop policy if exists tenant_isolation_custom_field_definitions on custom_field_definitions;
drop policy if exists tenant_isolation_stages on stages;
drop policy if exists tenant_isolation_pipelines on pipelines;
drop policy if exists tenant_isolation_users on users;
drop policy if exists tenant_isolation_teams on teams;
drop policy if exists tenant_isolation_organizations on organizations;
drop policy if exists tenant_isolation_audit_logs on audit_logs;
drop policy if exists tenant_isolation_notifications on notifications;
drop policy if exists tenant_isolation_activities on activities;
drop policy if exists tenant_isolation_tasks on tasks;
drop policy if exists tenant_isolation_deals on deals;
drop policy if exists tenant_isolation_contacts on contacts;
drop policy if exists tenant_isolation_accounts on accounts;

-- Drop indexes
drop index if exists idx_audit_org_created;
drop index if exists idx_notifications_user_unread;
drop index if exists idx_activities_deal_created;
drop index if exists idx_activities_contact_created;
drop index if exists idx_tasks_assignee_due;
drop index if exists idx_deals_org_owner_stage;
drop index if exists idx_contacts_account;
drop index if exists idx_contacts_org_owner;
drop index if exists idx_accounts_org_owner;
drop index if exists idx_password_reset_tokens_expiry;
drop index if exists idx_password_reset_tokens_hash;

-- Drop tables in reverse dependency order
drop table if exists password_reset_tokens cascade;
drop table if exists audit_logs cascade;
drop table if exists email_campaigns cascade;
drop table if exists email_templates cascade;
drop table if exists custom_field_definitions cascade;
drop table if exists notifications cascade;
drop table if exists activities cascade;
drop table if exists tasks cascade;
drop table if exists deals cascade;
drop table if exists stages cascade;
drop table if exists pipelines cascade;
drop table if exists contacts cascade;
drop table if exists accounts cascade;

-- Drop users (after teams FK to users is resolved)
alter table if exists teams drop column if exists manager_id;
drop table if exists users cascade;
drop table if exists teams cascade;
drop table if exists organizations cascade;

-- Drop enum types
drop type if exists activity_type;
drop type if exists task_priority;
drop type if exists task_type;
drop type if exists stage_type;
drop type if exists user_role;

-- Drop extension
drop extension if exists "citext";
