-- Boutinly CRM migration 009 rollback.

alter table teams no force row level security;
alter table accounts no force row level security;
alter table contacts no force row level security;
alter table pipelines no force row level security;
alter table stages no force row level security;
alter table deals no force row level security;
alter table tasks no force row level security;
alter table activities no force row level security;
alter table notifications no force row level security;
alter table custom_field_definitions no force row level security;
alter table email_templates no force row level security;
alter table audit_logs no force row level security;
alter table files no force row level security;
alter table calendar_tokens no force row level security;
alter table api_keys no force row level security;
alter table webhooks no force row level security;
alter table webhook_deliveries no force row level security;
alter table quotas no force row level security;
alter table approval_requests no force row level security;
alter table field_permissions no force row level security;
alter table leads no force row level security;
alter table record_tasks no force row level security;
alter table call_logs no force row level security;
