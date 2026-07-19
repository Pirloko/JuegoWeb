-- Fase 3: paywall solo en GIF/video (rompe gate sort_order 1–7).
-- Free = niveles imagen. Pase = especiales, si la temporada está liberada por ★.
-- Ver docs/MODELO_NEGOCIO_Y_PROGRESION.md Fase 3.

-- ── Helpers ────────────────────────────────────────────────────────────
create or replace function public.level_is_special(p_media_type text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_media_type, 'image') in ('gif', 'video');
$$;

comment on function public.level_is_special(text) is
  'True si el nivel es GIF/video (requiere pase para jugar/revelar).';

revoke all on function public.level_is_special(text) from public;
grant execute on function public.level_is_special(text) to authenticated;

-- Niveles previos que el jugador DEBE haber completado (especiales sin pase = saltables)
create or replace function public.previous_required_levels_completed(
  p_season_id uuid,
  p_sort_order int,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  r record;
  v_status text;
begin
  for r in
    select l.id, l.media_type, l.season_id
    from public.levels l
    where l.season_id = p_season_id
      and l.is_active
      and l.sort_order < p_sort_order
    order by l.sort_order asc
  loop
    if public.level_is_special(r.media_type)
       and not public.has_season_pass(r.season_id, p_user_id) then
      continue;
    end if;

    select ulp.status into v_status
    from public.user_level_progress ulp
    where ulp.user_id = p_user_id
      and ulp.level_id = r.id;

    if v_status is distinct from 'completed' then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.previous_required_levels_completed(uuid, int, uuid) from public;
grant execute on function public.previous_required_levels_completed(uuid, int, uuid) to authenticated;

-- ¿Puede jugar el contenido de este nivel? (temporada + pase si especial)
create or replace function public.user_may_play_level_content(
  p_season_id uuid,
  p_media_type text,
  p_user_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.can_access_season(p_season_id, p_user_id)
    and (
      not public.level_is_special(p_media_type)
      or public.has_season_pass(p_season_id, p_user_id)
    );
$$;

revoke all on function public.user_may_play_level_content(uuid, text, uuid) from public;
grant execute on function public.user_may_play_level_content(uuid, text, uuid) to authenticated;

-- Desbloquea el siguiente nivel jugable tras completar `p_after_sort`
create or replace function public.unlock_next_playable_levels(
  p_user_id uuid,
  p_season_id uuid,
  p_after_sort int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select l.id, l.media_type, l.sort_order, l.season_id
    from public.levels l
    where l.season_id = p_season_id
      and l.is_active
      and l.sort_order > p_after_sort
    order by l.sort_order asc
  loop
    if not public.user_may_play_level_content(r.season_id, r.media_type, p_user_id) then
      continue;
    end if;

    if not public.previous_required_levels_completed(r.season_id, r.sort_order, p_user_id) then
      exit;
    end if;

    insert into public.user_level_progress (user_id, level_id, status)
    values (p_user_id, r.id, 'unlocked')
    on conflict (user_id, level_id) do nothing;

    -- Solo el próximo jugable (la cadena sigue al completar ese)
    exit;
  end loop;
end;
$$;

revoke all on function public.unlock_next_playable_levels(uuid, uuid, int) from public;
grant execute on function public.unlock_next_playable_levels(uuid, uuid, int) to service_role;

-- Al obtener pase: desbloquear especiales (y siguientes) ya alcanzables
create or replace function public.unlock_playable_levels_for_user(
  p_user_id uuid,
  p_season_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select l.id, l.media_type, l.sort_order, l.season_id
    from public.levels l
    where l.is_active
      and (p_season_id is null or l.season_id = p_season_id)
    order by l.season_id, l.sort_order
  loop
    if not public.user_may_play_level_content(r.season_id, r.media_type, p_user_id) then
      continue;
    end if;
    if not public.previous_required_levels_completed(r.season_id, r.sort_order, p_user_id) then
      continue;
    end if;

    insert into public.user_level_progress (user_id, level_id, status)
    values (p_user_id, r.id, 'unlocked')
    on conflict (user_id, level_id) do nothing;
  end loop;
end;
$$;

revoke all on function public.unlock_playable_levels_for_user(uuid, uuid) from public;
grant execute on function public.unlock_playable_levels_for_user(uuid, uuid) to service_role;

-- ── can_play_level ─────────────────────────────────────────────────────
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

  if not public.user_may_play_level_content(v_level.season_id, v_level.media_type, v_uid) then
    return false;
  end if;

  select ulp.status into v_status
  from public.user_level_progress ulp
  where ulp.user_id = v_uid and ulp.level_id = p_level_id;

  return v_status in ('unlocked', 'completed');
end;
$$;

-- ── complete_level ─────────────────────────────────────────────────────
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
  v_progress public.user_level_progress%rowtype;
  v_target_pct numeric;
  v_min_time_ms int;
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

  if not public.can_access_season(v_level.season_id, v_uid) then
    raise exception 'season locked by stars' using errcode = 'P0001';
  end if;

  if public.level_is_special(v_level.media_type)
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

  if not public.previous_required_levels_completed(
    v_level.season_id, v_level.sort_order, v_uid
  ) then
    raise exception 'previous level not completed' using errcode = 'P0001';
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

  perform public.unlock_next_playable_levels(v_uid, v_level.season_id, v_level.sort_order);

  return v_progress;
end;
$$;

-- ── Al crear nivel ─────────────────────────────────────────────────────
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
    where public.user_may_play_level_content(new.season_id, new.media_type, p.id)
    on conflict (user_id, level_id) do nothing;
  elsif new.is_active then
    insert into public.user_level_progress (user_id, level_id, status)
    select ulp.user_id, new.id, 'unlocked'
    from public.user_level_progress ulp
    join public.levels prev on prev.id = ulp.level_id
    where ulp.status = 'completed'
      and prev.season_id = new.season_id
      and prev.is_active
      and public.user_may_play_level_content(new.season_id, new.media_type, ulp.user_id)
      and public.previous_required_levels_completed(new.season_id, new.sort_order, ulp.user_id)
    on conflict (user_id, level_id) do nothing;
  end if;
  return new;
end;
$$;

-- ── grant_season_pass: desbloquear alcanzables (no solo nivel 8) ────────
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

  perform public.unlock_playable_levels_for_user(p_user_id, p_season_id);

  return v_row;
end;
$$;

-- ── upsert_subscription: igual, desbloquear especiales alcanzables ─────
create or replace function public.upsert_subscription_from_mp(
  p_user_id uuid,
  p_status text,
  p_mp_preapproval_id text,
  p_amount_clp int,
  p_current_period_end timestamptz default null
)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.subscriptions%rowtype;
  v_is_service boolean := (select auth.role()) = 'service_role';
begin
  if not v_is_service and not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'authorized', 'paused', 'cancelled') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  if p_user_id is null or p_mp_preapproval_id is null or p_amount_clp is null or p_amount_clp <= 0 then
    raise exception 'invalid args' using errcode = '22023';
  end if;

  insert into public.subscriptions as s (
    user_id, status, mp_preapproval_id, amount_clp, current_period_end, cancelled_at, updated_at
  )
  values (
    p_user_id,
    p_status,
    p_mp_preapproval_id,
    p_amount_clp,
    p_current_period_end,
    case when p_status in ('cancelled', 'paused') then now() else null end,
    now()
  )
  on conflict (user_id) do update
  set
    status = excluded.status,
    mp_preapproval_id = coalesce(excluded.mp_preapproval_id, s.mp_preapproval_id),
    amount_clp = excluded.amount_clp,
    current_period_end = coalesce(excluded.current_period_end, s.current_period_end),
    cancelled_at = case
      when excluded.status in ('cancelled', 'paused') then coalesce(s.cancelled_at, now())
      else null
    end,
    updated_at = now()
  returning * into v_row;

  if p_status = 'authorized' then
    perform public.unlock_playable_levels_for_user(p_user_id, null);
  end if;

  return v_row;
end;
$$;

-- ── Backfill: abrir imagenes ya alcanzables (rompe soft-lock post 1–7) ──
insert into public.user_level_progress (user_id, level_id, status)
select p.id, l.id, 'unlocked'
from public.profiles p
cross join public.levels l
where l.is_active
  and not public.level_is_special(l.media_type)
  and public.can_access_season(l.season_id, p.id)
  and public.previous_required_levels_completed(l.season_id, l.sort_order, p.id)
  and not exists (
    select 1
    from public.user_level_progress ulp
    where ulp.user_id = p.id
      and ulp.level_id = l.id
  )
on conflict (user_id, level_id) do nothing;

-- Quienes ya tienen pase: especiales alcanzables
insert into public.user_level_progress (user_id, level_id, status)
select p.id, l.id, 'unlocked'
from public.profiles p
cross join public.levels l
where l.is_active
  and public.level_is_special(l.media_type)
  and public.has_season_pass(l.season_id, p.id)
  and public.can_access_season(l.season_id, p.id)
  and public.previous_required_levels_completed(l.season_id, l.sort_order, p.id)
  and not exists (
    select 1
    from public.user_level_progress ulp
    where ulp.user_id = p.id
      and ulp.level_id = l.id
  )
on conflict (user_id, level_id) do nothing;

comment on function public.free_level_max() is
  'LEGACY (medallas free_block). El paywall ya no usa sort_order≤7; ver level_is_special.';
