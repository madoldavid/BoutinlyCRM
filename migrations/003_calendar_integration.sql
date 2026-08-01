-- Boutinly CRM calendar integration.
-- Stores encrypted OAuth tokens for Google/Microsoft calendar sync.

create table calendar_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  email text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  scope text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, email)
);

create index idx_calendar_tokens_user on calendar_tokens (user_id);

alter table calendar_tokens enable row level security;
create policy tenant_isolation_calendar_tokens on calendar_tokens
  using (user_id in (select id from users where organization_id::text = current_setting('app.organization_id', true)));
