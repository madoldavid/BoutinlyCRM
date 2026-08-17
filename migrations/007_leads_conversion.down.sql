-- Reverse 007_leads_conversion.sql.
drop index if exists idx_leads_org_is_converted;
alter table leads drop column is_converted;
