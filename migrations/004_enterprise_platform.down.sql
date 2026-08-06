drop policy if exists field_permissions_tenant on field_permissions;
drop table if exists field_permissions;

drop policy if exists approvals_tenant on approval_requests;
drop table if exists approval_requests;

drop policy if exists quotas_tenant on quotas;
drop table if exists quotas;

drop policy if exists webhook_deliveries_tenant on webhook_deliveries;
drop table if exists webhook_deliveries;
drop policy if exists webhooks_tenant on webhooks;
drop table if exists webhooks;

drop policy if exists api_keys_tenant on api_keys;
drop table if exists api_keys;

drop table if exists org_security_policies;

alter table accounts drop column if exists parent_account_id;
alter table deals drop column if exists forecast_category;

drop type if exists webhook_status;
drop type if exists quota_period;
drop type if exists approval_status;
drop type if exists forecast_category;
