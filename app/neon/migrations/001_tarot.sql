create extension if not exists pgcrypto;

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  owner_token_hash bytea not null,
  author_name varchar(24) not null check (char_length(btrim(author_name)) between 1 and 24),
  question varchar(160) not null check (char_length(btrim(question)) between 1 and 160),
  mode varchar(8) not null check (mode in ('online', 'physical')),
  spread varchar(80) not null,
  spread_data jsonb,
  cards jsonb not null check (jsonb_typeof(cards) = 'array'),
  interpretation text not null default '' check (char_length(interpretation) <= 4000),
  ai_interpretation jsonb,
  tags text[] not null default '{}'::text[] check (cardinality(tags) <= 3),
  feedback varchar(200) not null default '' check (feedback !~ E'[\r\n]'),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists readings_created_at_idx on public.readings (created_at desc);
create index if not exists readings_owner_id_idx on public.readings (owner_id);

create table if not exists public.custom_spreads (
  id varchar(80) primary key check (char_length(btrim(id)) between 1 and 80),
  owner_id uuid not null,
  owner_token_hash bytea not null,
  name varchar(40) not null check (char_length(btrim(name)) between 1 and 40),
  positions jsonb not null check (jsonb_typeof(positions) = 'array' and jsonb_array_length(positions) between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_spreads_owner_updated_idx
  on public.custom_spreads (owner_id, updated_at desc);

create or replace view public.reading_feed as
select id, owner_id, author_name, question, mode, spread, spread_data, cards,
       interpretation, ai_interpretation, tags, feedback, created_at, updated_at
from public.readings;

create or replace function public.reading_json(value public.readings) returns jsonb
language sql immutable set search_path = public, pg_catalog as $$
  select to_jsonb(value) - 'owner_token_hash' - 'idempotency_key';
$$;

create or replace function public.create_reading(
  p_owner_id uuid, p_token text, p_author_name text, p_question text,
  p_mode text, p_spread text, p_spread_data jsonb, p_cards jsonb,
  p_interpretation text, p_ai_interpretation jsonb, p_tags text[],
  p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_catalog as $$
declare value public.readings;
begin
  if char_length(p_token) < 32 then raise exception 'INVALID_SESSION'; end if;
  insert into public.readings (
    owner_id, owner_token_hash, author_name, question, mode, spread, spread_data,
    cards, interpretation, ai_interpretation, tags, idempotency_key
  ) values (
    p_owner_id, digest(p_token, 'sha256'), btrim(p_author_name), btrim(p_question),
    p_mode, p_spread, p_spread_data, p_cards, coalesce(p_interpretation, ''),
    p_ai_interpretation, coalesce(p_tags, '{}'::text[]), p_idempotency_key
  )
  on conflict (idempotency_key) do update
    set idempotency_key = excluded.idempotency_key
  returning * into value;
  if value.owner_id <> p_owner_id or value.owner_token_hash <> digest(p_token, 'sha256') then
    raise exception 'INVALID_SESSION';
  end if;
  return public.reading_json(value);
end;
$$;

create or replace function public.update_reading_feedback(
  p_id uuid, p_owner_id uuid, p_token text, p_feedback text
) returns jsonb
language plpgsql security definer set search_path = public, pg_catalog as $$
declare value public.readings;
begin
  update public.readings set feedback = p_feedback, updated_at = now()
  where id = p_id and owner_id = p_owner_id
    and owner_token_hash = digest(p_token, 'sha256')
  returning * into value;
  if value.id is null then raise exception 'NOT_FOUND'; end if;
  return public.reading_json(value);
end;
$$;

create or replace function public.delete_reading(
  p_id uuid, p_owner_id uuid, p_token text
) returns boolean
language plpgsql security definer set search_path = public, pg_catalog as $$
declare affected integer;
begin
  delete from public.readings
  where id = p_id and owner_id = p_owner_id
    and owner_token_hash = digest(p_token, 'sha256');
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

create or replace function public.update_member_nickname(
  p_owner_id uuid, p_token text, p_nickname text
) returns integer
language plpgsql security definer set search_path = public, pg_catalog as $$
declare affected integer;
begin
  if char_length(btrim(p_nickname)) not between 1 and 24 then raise exception 'INVALID_NICKNAME'; end if;
  update public.readings set author_name = btrim(p_nickname), updated_at = now()
  where owner_id = p_owner_id and owner_token_hash = digest(p_token, 'sha256');
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.list_custom_spreads(
  p_owner_id uuid, p_token text
) returns table (id varchar, name varchar, positions jsonb, created_at timestamptz, updated_at timestamptz)
language sql security definer set search_path = public, pg_catalog as $$
  select s.id, s.name, s.positions, s.created_at, s.updated_at
  from public.custom_spreads s
  where s.owner_id = p_owner_id and s.owner_token_hash = digest(p_token, 'sha256')
  order by s.updated_at desc;
$$;

create or replace function public.create_custom_spread(
  p_id text, p_owner_id uuid, p_token text, p_name text, p_positions jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_catalog as $$
declare value public.custom_spreads;
begin
  if char_length(p_token) < 32 then raise exception 'INVALID_SESSION'; end if;
  insert into public.custom_spreads (id, owner_id, owner_token_hash, name, positions)
  values (p_id, p_owner_id, digest(p_token, 'sha256'), btrim(p_name), p_positions)
  on conflict (id) do update set id = excluded.id
  returning * into value;
  if value.owner_id <> p_owner_id or value.owner_token_hash <> digest(p_token, 'sha256') then
    raise exception 'INVALID_SESSION';
  end if;
  return to_jsonb(value) - 'owner_token_hash' - 'owner_id';
end;
$$;

create or replace function public.update_custom_spread(
  p_id text, p_owner_id uuid, p_token text, p_name text, p_positions jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_catalog as $$
declare value public.custom_spreads;
begin
  update public.custom_spreads
  set name = btrim(p_name), positions = p_positions, updated_at = now()
  where id = p_id and owner_id = p_owner_id
    and owner_token_hash = digest(p_token, 'sha256')
  returning * into value;
  if value.id is null then raise exception 'NOT_FOUND'; end if;
  return to_jsonb(value) - 'owner_token_hash' - 'owner_id';
end;
$$;

create or replace function public.delete_custom_spread(
  p_id text, p_owner_id uuid, p_token text
) returns boolean
language plpgsql security definer set search_path = public, pg_catalog as $$
declare affected integer;
begin
  delete from public.custom_spreads
  where id = p_id and owner_id = p_owner_id
    and owner_token_hash = digest(p_token, 'sha256');
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on public.readings, public.custom_spreads from public, anonymous, authenticated;
grant usage on schema public to anonymous, authenticated;
grant select on public.reading_feed to anonymous, authenticated;

revoke all on function public.create_reading(uuid,text,text,text,text,text,jsonb,jsonb,text,jsonb,text[],uuid) from public;
revoke all on function public.update_reading_feedback(uuid,uuid,text,text) from public;
revoke all on function public.delete_reading(uuid,uuid,text) from public;
revoke all on function public.update_member_nickname(uuid,text,text) from public;
revoke all on function public.list_custom_spreads(uuid,text) from public;
revoke all on function public.create_custom_spread(text,uuid,text,text,jsonb) from public;
revoke all on function public.update_custom_spread(text,uuid,text,text,jsonb) from public;
revoke all on function public.delete_custom_spread(text,uuid,text) from public;

grant execute on function public.create_reading(uuid,text,text,text,text,text,jsonb,jsonb,text,jsonb,text[],uuid) to anonymous, authenticated;
grant execute on function public.update_reading_feedback(uuid,uuid,text,text) to anonymous, authenticated;
grant execute on function public.delete_reading(uuid,uuid,text) to anonymous, authenticated;
grant execute on function public.update_member_nickname(uuid,text,text) to anonymous, authenticated;
grant execute on function public.list_custom_spreads(uuid,text) to anonymous, authenticated;
grant execute on function public.create_custom_spread(text,uuid,text,text,jsonb) to anonymous, authenticated;
grant execute on function public.update_custom_spread(text,uuid,text,text,jsonb) to anonymous, authenticated;
grant execute on function public.delete_custom_spread(text,uuid,text) to anonymous, authenticated;
