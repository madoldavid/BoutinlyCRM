-- Reverse of 002_files.sql
drop policy if exists tenant_isolation_files on files;
drop index if exists idx_files_org;
drop index if exists idx_files_entity;
drop table if exists files cascade;
