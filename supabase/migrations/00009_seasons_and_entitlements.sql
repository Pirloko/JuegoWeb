-- FASE negocio — Temporadas + pase permanente (CLP)
-- Free: sort_order 1..7 | Pago: 8..70 por temporada
-- Ejecutar tras 00008_admin_policies.sql

-- ── seasons ────────────────────────────────────────────────────────────
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,           -- '2026-07'
  name text not null,                  -- 'Julio 2026'
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_clp int not null default 5990 check (price_clp > 0),
  offer_price_clp int check (offer_price_clp is null or offer_price_clp > 0),
  offer_starts_at timestamptz,
  offer_ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint seasons_dates check (ends_at > starts_at)
);

comment on table public.seasons is 'Temporadas mensuales; pase = acceso permanente a niveles 8-70';

alter table public.seasons enable row level security;

grant select on table public.seasons to authenticated, anon;
grant select, insert, update, delete on table public.seasons to service_role;
grant insert, update, delete on table public.seasons to authenticated;

create policy "seasons_select_all" on public.seasons
  for select to authenticated, anon
  using (true);

create policy "seasons_write_admin" on public.seasons
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Temporada seed: Julio 2026 (activa)
insert into public.seasons (slug, name, starts_at, ends_at, price_clp, offer_price_clp, offer_starts_at, offer_ends_at, is_active)
values (
  '2026-07',
  'Julio 2026',
  '2026-07-01 00:00:00+00',
  '2026-08-01 00:00:00+00',
  5990,
  3590,
  '2026-07-01 00:00:00+00',
  '2026-07-15 00:00:00+00',
  true
);

-- ── levels: season_id + unique por temporada ───────────────────────────
alter table public.levels
  add column if not exists season_id uuid references public.seasons (id) on delete cascade;

update public.levels
set season_id = (select id from public.seasons where slug = '2026-07' limit 1)
where season_id is null;

alter table public.levels
  alter column season_id set not null;

alter table public.levels
  drop constraint if exists levels_sort_order_unique;

alter table public.levels
  add constraint levels_season_sort_unique unique (season_id, sort_order);

create index if not exists levels_season_sort_idx
  on public.levels (season_id, sort_order)
  where is_active;

-- ── entitlements (pase permanente) ─────────────────────────────────────
create table public.season_entitlements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  purchased_at timestamptz not null default now(),
  amount_clp int not null check (amount_clp > 0),
  provider text not null default 'stripe',
  provider_ref text,
  primary key (user_id, season_id)
);

create unique index season_entitlements_provider_ref_idx
  on public.season_entitlements (provider, provider_ref)
  where provider_ref is not null;

comment on table public.season_entitlements is
  'Pase de temporada comprado: acceso permanente a niveles 8-70 de esa season';

alter table public.season_entitlements enable row level security;

grant select on table public.season_entitlements to authenticated;
grant select, insert, update, delete on table public.season_entitlements to service_role;

create policy "entitlements_select_own" on public.season_entitlements
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Insert solo service role / RPC security definer (webhook Stripe)
-- Admin puede otorgar pase (testing / soporte)
create policy "entitlements_insert_admin" on public.season_entitlements
  for insert to authenticated
  with check ((select public.is_admin()));

-- ── helpers ────────────────────────────────────────────────────────────
create or replace function public.free_level_max()
returns int
language sql
immutable
as $$ select 7 $$;

create or replace function public.has_season_pass(p_season_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.season_entitlements e
    where e.season_id = p_season_id
      and e.user_id = coalesce(p_user_id, (select auth.uid()))
  );
$$;

revoke all on function public.has_season_pass(uuid, uuid) from public;
grant execute on function public.has_season_pass(uuid, uuid) to authenticated;

create or replace function public.can_play_level(p_level_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_level public.levels%rowtype;
  v_status text;
begin
  if v_uid is null then
    return false;
  end if;

  select * into v_level
  from public.levels l
  where l.id = p_level_id and l.is_active;

  if not found then
    return false;
  end if;

  -- Free gate
  if v_level.sort_order <= public.free_level_max() then
    null; -- ok por precio
  elsif not public.has_season_pass(v_level.season_id, v_uid) then
    return false;
  end if;

  select ulp.status into v_status
  from public.user_level_progress ulp
  where ulp.user_id = v_uid and ulp.level_id = p_level_id;

  return v_status in ('unlocked', 'completed');
end;
$$;

revoke all on function public.can_play_level(uuid) from public;
grant execute on function public.can_play_level(uuid) to authenticated;

-- Precio efectivo (lista u oferta vigente)
create or replace function public.season_effective_price_clp(p_season public.seasons)
returns int
language sql
stable
as $$
  select case
    when p_season.offer_price_clp is not null
      and p_season.offer_starts_at is not null
      and p_season.offer_ends_at is not null
      and now() >= p_season.offer_starts_at
      and now() < p_season.offer_ends_at
    then p_season.offer_price_clp
    else p_season.price_clp
  end;
$$;

-- Otorgar pase (llamado por webhook service_role o admin)
create or replace function public.grant_season_pass(
  p_user_id uuid,
  p_season_id uuid,
  p_amount_clp int,
  p_provider text default 'stripe',
  p_provider_ref text default null
)
returns public.season_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.season_entitlements%rowtype;
  v_caller uuid := (select auth.uid());
  v_is_service boolean := (select auth.role()) = 'service_role';
begin
  if not v_is_service and not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if not v_is_service and v_caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.season_entitlements as e (user_id, season_id, amount_clp, provider, provider_ref)
  values (p_user_id, p_season_id, p_amount_clp, p_provider, p_provider_ref)
  on conflict (user_id, season_id) do update
  set
    amount_clp = excluded.amount_clp,
    provider = excluded.provider,
    provider_ref = coalesce(excluded.provider_ref, e.provider_ref)
  returning * into v_row;

  -- Desbloquear nivel 8 si ya completó el 7 (o el máximo free desbloqueado)
  insert into public.user_level_progress (user_id, level_id, status)
  select p_user_id, l8.id, 'unlocked'
  from public.levels l7
  join public.levels l8
    on l8.season_id = l7.season_id
   and l8.sort_order = public.free_level_max() + 1
   and l8.is_active
  join public.user_level_progress ulp
    on ulp.user_id = p_user_id
   and ulp.level_id = l7.id
   and ulp.status = 'completed'
  where l7.season_id = p_season_id
    and l7.sort_order = public.free_level_max()
    and l7.is_active
  on conflict (user_id, level_id) do nothing;

  return v_row;
end;
$$;

revoke all on function public.grant_season_pass(uuid, uuid, int, text, text) from public;
grant execute on function public.grant_season_pass(uuid, uuid, int, text, text) to authenticated, service_role;

-- ── complete_level: scoped a temporada + gate de pase ──────────────────
create or replace function public.complete_level(
  p_level_id uuid,
  p_pct numeric,
  p_time_ms int,
  p_session_payload jsonb default '{}'::jsonb
)
returns public.user_level_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_level public.levels%rowtype;
  v_prev_level_id uuid;
  v_prev_status text;
  v_progress public.user_level_progress%rowtype;
  v_target_pct numeric;
  v_min_time_ms int;
  v_next_level_id uuid;
  v_next_sort int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'invalid pct' using errcode = '22023';
  end if;

  if p_time_ms is null or p_time_ms < 0 then
    raise exception 'invalid time_ms' using errcode = '22023';
  end if;

  select * into v_level
  from public.levels l
  where l.id = p_level_id
    and l.is_active
  for share;

  if not found then
    raise exception 'level not found or inactive' using errcode = 'P0002';
  end if;

  -- Gate de pase para niveles de pago
  if v_level.sort_order > public.free_level_max()
     and not public.has_season_pass(v_level.season_id, v_uid) then
    raise exception 'season pass required' using errcode = 'P0001';
  end if;

  v_target_pct := coalesce((v_level.config ->> 'targetPct')::numeric, 100);
  v_min_time_ms := coalesce((v_level.config ->> 'minTimeMs')::int, 5000);

  if p_pct < v_target_pct then
    raise exception 'pct below target' using errcode = 'P0001';
  end if;

  if p_time_ms < v_min_time_ms then
    raise exception 'time_ms below minimum' using errcode = 'P0001';
  end if;

  -- Nivel anterior en LA MISMA temporada
  select l.id into v_prev_level_id
  from public.levels l
  where l.is_active
    and l.season_id = v_level.season_id
    and l.sort_order = v_level.sort_order - 1
  limit 1;

  if v_prev_level_id is not null then
    select ulp.status into v_prev_status
    from public.user_level_progress ulp
    where ulp.user_id = v_uid
      and ulp.level_id = v_prev_level_id;

    if v_prev_status is distinct from 'completed' then
      raise exception 'previous level not completed' using errcode = 'P0001';
    end if;
  end if;

  select * into v_progress
  from public.user_level_progress ulp
  where ulp.user_id = v_uid
    and ulp.level_id = p_level_id
  for update;

  if not found then
    raise exception 'level not unlocked' using errcode = 'P0001';
  end if;

  if v_progress.status = 'locked' then
    raise exception 'level locked' using errcode = 'P0001';
  end if;

  if v_progress.status = 'completed'
    and v_progress.updated_at > now() - interval '1 minute' then
    raise exception 'rate limit exceeded' using errcode = '54000';
  end if;

  insert into public.user_level_progress as ulp (
    user_id, level_id, status, best_pct, best_time_ms, attempts, completed_at, updated_at
  )
  values (
    v_uid, p_level_id, 'completed', p_pct, p_time_ms, 1, now(), now()
  )
  on conflict (user_id, level_id) do update
  set
    status = 'completed',
    best_pct = greatest(coalesce(ulp.best_pct, 0), excluded.best_pct),
    best_time_ms = case
      when ulp.best_time_ms is null then excluded.best_time_ms
      else least(ulp.best_time_ms, excluded.best_time_ms)
    end,
    attempts = ulp.attempts + 1,
    completed_at = coalesce(ulp.completed_at, excluded.completed_at),
    updated_at = now()
  returning * into v_progress;

  -- Siguiente nivel: misma temporada; si es 8+ requiere pase
  v_next_sort := v_level.sort_order + 1;
  select l.id into v_next_level_id
  from public.levels l
  where l.is_active
    and l.season_id = v_level.season_id
    and l.sort_order = v_next_sort
  limit 1;

  if v_next_level_id is not null then
    if v_next_sort <= public.free_level_max()
       or public.has_season_pass(v_level.season_id, v_uid) then
      insert into public.user_level_progress (user_id, level_id, status)
      values (v_uid, v_next_level_id, 'unlocked')
      on conflict (user_id, level_id) do nothing;
    end if;
  end if;

  return v_progress;
end;
$$;

-- Unlock primer nivel: del season activo (o todos los activos)
create or replace function public.unlock_first_level_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_level_progress (user_id, level_id, status)
  select new.id, first_level.id, 'unlocked'
  from public.seasons s
  cross join lateral (
    select l.id
    from public.levels l
    where l.season_id = s.id
      and l.is_active
    order by l.sort_order asc
    limit 1
  ) first_level
  where s.is_active
  on conflict (user_id, level_id) do nothing;

  return new;
end;
$$;

-- Al crear nivel sort_order=1 de una season, unlock para perfiles existentes
-- (ya cubierto parcialmente); al crear nivel tras completar N-1 sigue el trigger de levels

create or replace function public.unlock_level_for_eligible_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and new.sort_order = 1 then
    insert into public.user_level_progress (user_id, level_id, status)
    select p.id, new.id, 'unlocked'
    from public.profiles p
    on conflict (user_id, level_id) do nothing;
  elsif new.is_active then
    insert into public.user_level_progress (user_id, level_id, status)
    select ulp.user_id, new.id, 'unlocked'
    from public.user_level_progress ulp
    join public.levels prev on prev.id = ulp.level_id
    where ulp.status = 'completed'
      and prev.season_id = new.season_id
      and prev.is_active
      and prev.sort_order = new.sort_order - 1
      and (
        new.sort_order <= public.free_level_max()
        or public.has_season_pass(new.season_id, ulp.user_id)
      )
    on conflict (user_id, level_id) do nothing;
  end if;
  return new;
end;
$$;
