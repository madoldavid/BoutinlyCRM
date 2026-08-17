-- Reverse 006_leads_redesign.sql — restore the legacy single name column.
alter table leads add column name text;

update leads set
  name = case
    when last_name <> '' then first_name || ' ' || last_name
    else first_name
  end;

alter table leads alter column name set not null;

alter table leads drop column first_name;
alter table leads drop column last_name;
