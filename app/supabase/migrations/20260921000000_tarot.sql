begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default (
    nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-id'), '')::uuid
  ),
  owner_token_hash bytea not null default (
    extensions.digest(
      coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), ''),
      'sha256'
    )
  ),
  author_name varchar(24) not null check (char_length(btrim(author_name)) between 1 and 24),
  question varchar(160) not null check (char_length(btrim(question)) between 1 and 160),
  mode varchar(8) not null check (mode in ('online', 'physical')),
  spread varchar(80) not null check (char_length(btrim(spread)) between 1 and 80),
  spread_data jsonb not null check (jsonb_typeof(spread_data) = 'object'),
  cards jsonb not null check (jsonb_typeof(cards) = 'array'),
  interpretation text not null default '' check (char_length(interpretation) <= 4000),
  ai_interpretation jsonb check (ai_interpretation is null or jsonb_typeof(ai_interpretation) = 'object'),
  tags text[] not null default '{}'::text[] check (cardinality(tags) <= 3),
  feedback varchar(200) not null default '' check (char_length(feedback) <= 200 and feedback !~ E'[\r\n]'),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists readings_created_at_idx on public.readings (created_at desc);
create index if not exists readings_owner_id_idx on public.readings (owner_id);

create table if not exists public.custom_spreads (
  id varchar(80) primary key check (char_length(btrim(id)) between 1 and 80),
  owner_id uuid not null default (
    nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-id'), '')::uuid
  ),
  owner_token_hash bytea not null default (
    extensions.digest(
      coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), ''),
      'sha256'
    )
  ),
  name varchar(40) not null check (char_length(btrim(name)) between 1 and 40),
  positions jsonb not null check (jsonb_typeof(positions) = 'array' and jsonb_array_length(positions) between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_spreads_owner_updated_idx
  on public.custom_spreads (owner_id, updated_at desc);

alter table public.readings enable row level security;
alter table public.custom_spreads enable row level security;

drop policy if exists readings_public_select on public.readings;
drop policy if exists readings_owner_insert on public.readings;
drop policy if exists readings_owner_update on public.readings;
drop policy if exists readings_owner_delete on public.readings;

create policy readings_public_select on public.readings
  for select to anon, authenticated
  using (true);

create policy readings_owner_insert on public.readings
  for insert to anon, authenticated
  with check (
    char_length(coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), '')) >= 32
    and owner_id = nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-id'), '')::uuid
    and owner_token_hash = extensions.digest(
      coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), ''),
      'sha256'
    )
  );

create policy readings_owner_update on public.readings
  for update to anon, authenticated
  using (
    char_length(coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), '')) >= 32
    and owner_id = nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-id'), '')::uuid
    and owner_token_hash = extensions.digest(
      coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), ''),
      'sha256'
    )
  )
  with check (
    char_length(coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), '')) >= 32
    and owner_id = nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-id'), '')::uuid
    and owner_token_hash = extensions.digest(
      coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), ''),
      'sha256'
    )
  );

create policy readings_owner_delete on public.readings
  for delete to anon, authenticated
  using (
    char_length(coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), '')) >= 32
    and owner_id = nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-id'), '')::uuid
    and owner_token_hash = extensions.digest(
      coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), ''),
      'sha256'
    )
  );

drop policy if exists custom_spreads_owner_select on public.custom_spreads;
drop policy if exists custom_spreads_owner_insert on public.custom_spreads;
drop policy if exists custom_spreads_owner_update on public.custom_spreads;
drop policy if exists custom_spreads_owner_delete on public.custom_spreads;

create policy custom_spreads_owner_select on public.custom_spreads
  for select to anon, authenticated
  using (
    char_length(coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), '')) >= 32
    and owner_id = nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-id'), '')::uuid
    and owner_token_hash = extensions.digest(
      coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), ''),
      'sha256'
    )
  );

create policy custom_spreads_owner_insert on public.custom_spreads
  for insert to anon, authenticated
  with check (
    char_length(coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), '')) >= 32
    and owner_id = nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-id'), '')::uuid
    and owner_token_hash = extensions.digest(
      coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), ''),
      'sha256'
    )
  );

create policy custom_spreads_owner_update on public.custom_spreads
  for update to anon, authenticated
  using (
    char_length(coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), '')) >= 32
    and owner_id = nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-id'), '')::uuid
    and owner_token_hash = extensions.digest(
      coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), ''),
      'sha256'
    )
  )
  with check (
    char_length(coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), '')) >= 32
    and owner_id = nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-id'), '')::uuid
    and owner_token_hash = extensions.digest(
      coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), ''),
      'sha256'
    )
  );

create policy custom_spreads_owner_delete on public.custom_spreads
  for delete to anon, authenticated
  using (
    char_length(coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), '')) >= 32
    and owner_id = nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-id'), '')::uuid
    and owner_token_hash = extensions.digest(
      coalesce(nullif((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-owner-token'), ''), ''),
      'sha256'
    )
  );

create or replace view public.reading_feed as
select
  id,
  owner_id,
  author_name,
  question,
  mode,
  spread,
  spread_data,
  cards,
  interpretation,
  ai_interpretation,
  tags,
  feedback,
  created_at,
  updated_at
from public.readings;

revoke all on public.readings from public, anon, authenticated;
revoke all on public.custom_spreads from public, anon, authenticated;
revoke all on public.reading_feed from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.reading_feed to anon, authenticated;

grant select (
  id, owner_id, author_name, question, mode, spread, spread_data, cards,
  interpretation, ai_interpretation, tags, feedback, created_at, updated_at
) on public.readings to anon, authenticated;

grant insert (
  author_name, question, mode, spread, spread_data, cards,
  interpretation, ai_interpretation, tags, feedback, idempotency_key
) on public.readings to anon, authenticated;

grant update (author_name, feedback, updated_at)
  on public.readings to anon, authenticated;
grant delete on public.readings to anon, authenticated;

grant select (id, name, positions, created_at, updated_at)
  on public.custom_spreads to anon, authenticated;
grant insert (id, name, positions)
  on public.custom_spreads to anon, authenticated;
grant update (name, positions, updated_at)
  on public.custom_spreads to anon, authenticated;
grant delete on public.custom_spreads to anon, authenticated;

commit;

notify pgrst, 'reload schema';
