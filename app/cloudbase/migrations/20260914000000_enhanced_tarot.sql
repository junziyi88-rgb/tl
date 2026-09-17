-- Additive upgrade: historical one/three/five rows and their original interpretations remain intact.
begin;
alter table public.readings drop constraint if exists readings_spread_check;
alter table public.readings alter column spread type varchar(80);
alter table public.readings add column if not exists spread_data jsonb;
alter table public.readings add column if not exists ai_interpretation jsonb;
alter table public.readings drop constraint if exists readings_interpretation_check;
alter table public.readings alter column interpretation drop not null;
alter table public.readings alter column interpretation set default '';
alter table public.readings add constraint readings_interpretation_check
  check (interpretation is null or char_length(interpretation) <= 4000);
alter table public.readings add constraint readings_spread_data_check
  check (spread_data is null or jsonb_typeof(spread_data) = 'object');
alter table public.readings add constraint readings_ai_interpretation_check
  check (ai_interpretation is null or jsonb_typeof(ai_interpretation) = 'object');

create or replace function public.valid_tarot_positions(value jsonb) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(value) <> 'array' then false
  else jsonb_array_length(value) between 1 and 12
    and not exists (
      select 1 from jsonb_array_elements(value) p
      where jsonb_typeof(p) <> 'object'
        or jsonb_typeof(p->'id') is distinct from 'string'
        or char_length(btrim(p->>'id')) not between 1 and 80
        or jsonb_typeof(p->'question') is distinct from 'string'
        or char_length(btrim(p->>'question')) not between 1 and 80
    )
    and (select count(distinct p->>'id') from jsonb_array_elements(value) p) = jsonb_array_length(value)
  end;
$$;
create table if not exists public.custom_spreads (
  id varchar(80) primary key check (char_length(btrim(id)) between 1 and 80),
  owner_id text not null default auth.uid(),
  name varchar(40) not null check (char_length(btrim(name)) between 1 and 40),
  positions jsonb not null check (public.valid_tarot_positions(positions)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_spreads_owner_updated_idx on public.custom_spreads(owner_id, updated_at desc);
alter table public.custom_spreads enable row level security;
revoke all on public.custom_spreads from anon, authenticated;
grant select, insert, delete on public.custom_spreads to anon;
grant update (name, positions, updated_at) on public.custom_spreads to anon;
grant all on public.custom_spreads to service_role;
create policy custom_spreads_select_own on public.custom_spreads
  for select to anon
  using (owner_id = (select auth.uid()));
create policy custom_spreads_insert_own on public.custom_spreads
  for insert to anon with check (owner_id = (select auth.uid()));
create policy custom_spreads_update_own on public.custom_spreads
  for update to anon using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy custom_spreads_delete_own on public.custom_spreads
  for delete to anon using (owner_id = (select auth.uid()));
-- Existing readings policies and feedback-only UPDATE grants are deliberately preserved.
commit;
