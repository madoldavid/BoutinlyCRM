-- Reverse of 003_calendar_integration.sql
drop policy if exists tenant_isolation_calendar_tokens on calendar_tokens;
drop index if exists idx_calendar_tokens_user;
drop table if exists calendar_tokens cascade;
