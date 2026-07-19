-- Fase 8: goteo por nivel (available_at) + enforce al jugar.
-- Null = disponible ya (comportamiento actual). Ver docs/MODELO_NEGOCIO_Y_PROGRESION.md.

alter table public.levels
  add column if not exists available_at timestamptz;

comment on column public.levels.available_at is
  'Si no es null, el nivel no se puede jugar hasta esa fecha (goteo). Null = ya disponible.';

create index if not exists levels_available_at_idx
  on public.levels (available_at)
  where available_at is not null;

create or replace function public.level_is_released(p_available_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_available_at is null or p_available_at <= now();
$$;

comment on function public.level_is_released(timestamptz) is
  'True si el nivel ya salió del goteo (available_at null o en el pasado).';

-- begin_level_attempt: + gate available_at
create or replace function public.begin_level_attempt(p_level_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_level public.levels%rowtype;
  v_status text;
  v_waive boolean := false;
  v_row public.user_energy%rowtype;
  v_session_id uuid;
  v_max int := public.energy_max();
  v_sec int := public.energy_refill_seconds();
  v_next timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_level
  from public.levels l
  where l.id = p_level_id and l.is_active;

  if not found then
    raise exception 'level not found' using errcode = 'P0002';
  end if;

  if not public.level_is_released(v_level.available_at) then
    raise exception 'level not yet available' using errcode = 'P0001';
  end if;

  if not public.can_access_season(v_level.season_id, v_uid) then
    raise exception 'season locked by stars' using errcode = 'P0001';
  end if;

  if public.level_is_special(v_level.media_type)
     and not public.has_season_pass(v_level.season_id, v_uid) then
    raise exception 'season pass required' using errcode = 'P0001';
  end if;

  select ulp.status into v_status
  from public.user_level_progress ulp
  where ulp.user_id = v_uid and ulp.level_id = p_level_id;

  if v_status is null or v_status not in ('unlocked', 'completed') then
    raise exception 'level locked' using errcode = 'P0001';
  end if;

  v_waive := public.has_season_pass(v_level.season_id, v_uid);
  v_row := public.apply_energy_refill(v_uid);

  if not v_waive then
    if v_row.hearts < 1 then
      raise exception 'out of energy' using errcode = 'P0001';
    end if;

    update public.user_energy
    set
      hearts = hearts - 1,
      last_refill_at = case
        when hearts >= v_max then now()
        else last_refill_at
      end,
      updated_at = now()
    where user_id = v_uid
    returning * into v_row;
  end if;

  insert into public.game_sessions (user_id, level_id, outcome)
  values (v_uid, p_level_id, 'playing')
  returning id into v_session_id;

  if v_row.hearts >= v_max then
    v_next := null;
  else
    v_next := v_row.last_refill_at + make_interval(secs => v_sec);
  end if;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'energyWaived', v_waive,
    'hearts', v_row.hearts,
    'max', v_max,
    'refillSec', v_sec,
    'nextRefillAt', v_next
  );
end;
$$;

revoke all on function public.begin_level_attempt(uuid) from public;
grant execute on function public.begin_level_attempt(uuid) to authenticated;

-- complete_level: + gate available_at (misma lógica que 00026)
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

  if not public.level_is_released(v_level.available_at) then
    raise exception 'level not yet available' using errcode = 'P0001';
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

revoke all on function public.complete_level(uuid, numeric, int, jsonb) from public;
grant execute on function public.complete_level(uuid, numeric, int, jsonb) to authenticated;
