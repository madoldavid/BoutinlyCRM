-- Boutinly CRM leads redesign — the staging area.
-- Splits the lead name into first_name + last_name and introduces the
-- full status path: New -> Working -> Nurturing -> Qualified -> Unqualified.
-- Conversion stays a terminal state produced by the conversion engine.

-- Expand the status enum with the two new progression states.
alter type lead_status add value if not exists 'nurturing';
alter type lead_status add value if not exists 'unqualified';

-- Split the legacy single name column into first/last name.
alter table leads add column first_name text;
alter table leads add column last_name text;

update leads set
  first_name = split_part(name, ' ', 1),
  last_name = case
    when strpos(name, ' ') > 0 then substr(name, strpos(name, ' ') + 1)
    else ''
  end;

alter table leads alter column first_name set not null;
alter table leads alter column last_name set not null;

-- The legacy name column is fully replaced by first/last name.
alter table leads drop column name;

-- company_name is the required anchor of every staged lead.
alter table leads alter column company_name set not null;
