-- Boutinly CRM lead conversion engine — archival mechanics.
-- Converted leads are never deleted (historical marketing data). Instead the
-- row is flagged with is_converted and hidden from active lead lists.
alter table leads add column is_converted boolean not null default false;
create index idx_leads_org_is_converted on leads (organization_id, is_converted);

-- Backfill: leads already marked with the terminal 'converted' status.
update leads set is_converted = true where status = 'converted';
