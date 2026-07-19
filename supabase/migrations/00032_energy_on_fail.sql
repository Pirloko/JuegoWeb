-- Corazones = vidas: se gastan al FALLAR (enemigo/tiempo), no al empezar.
-- Pase: no gasta. Sin corazones: no se puede iniciar partida.

-- begin_level_attempt: gate de corazones sin restar
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

  -- Hace falta ≥1 corazón para jugar (salvo pase), pero no se gasta aquí
  if not v_waive and v_row.hearts < 1 then
    raise exception 'out of energy' using errcode = 'P0001';
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

comment on function public.begin_level_attempt(uuid) is
  'Abre sesión de juego. Exige ≥1 corazón (salvo pase) pero no gasta; el gasto es al fallar.';

-- Cambiar return type: DROP + recreate
drop function if exists public.end_game_session(uuid, text, int);

-- end_game_session: al fallar resta 1 corazón (salvo pase)
create function public.end_game_session(
  p_session_id uuid,
  p_outcome text,
  p_duration_ms int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.game_sessions%rowtype;
  v_level public.levels%rowtype;
  v_energy public.user_energy%rowtype;
  v_waive boolean := false;
  v_max int := public.energy_max();
  v_sec int := public.energy_refill_seconds();
  v_next timestamptz;
  v_consumed boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_outcome is null or p_outcome not in ('completed', 'failed', 'abandoned') then
    raise exception 'invalid outcome' using errcode = '22023';
  end if;
  if p_duration_ms is null or p_duration_ms < 0 then
    raise exception 'invalid duration' using errcode = '22023';
  end if;

  update public.game_sessions s
  set
    outcome = p_outcome,
    ended_at = now(),
    duration_ms = p_duration_ms
  where s.id = p_session_id
    and s.user_id = v_uid
    and s.outcome = 'playing'
  returning * into v_row;

  if not found then
    raise exception 'session not found or already closed' using errcode = 'P0002';
  end if;

  select * into v_level from public.levels l where l.id = v_row.level_id;
  if found then
    v_waive := public.has_season_pass(v_level.season_id, v_uid);
  end if;

  v_energy := public.apply_energy_refill(v_uid);

  if p_outcome = 'failed' and not v_waive then
    if v_energy.hearts >= 1 then
      update public.user_energy
      set
        hearts = hearts - 1,
        last_refill_at = case
          when hearts >= v_max then now()
          else last_refill_at
        end,
        updated_at = now()
      where user_id = v_uid
      returning * into v_energy;
      v_consumed := true;
    end if;
  end if;

  if v_energy.hearts >= v_max then
    v_next := null;
  else
    v_next := v_energy.last_refill_at + make_interval(secs => v_sec);
  end if;

  return jsonb_build_object(
    'sessionId', v_row.id,
    'outcome', v_row.outcome,
    'energyConsumed', v_consumed,
    'energyWaived', v_waive,
    'hearts', v_energy.hearts,
    'max', v_max,
    'refillSec', v_sec,
    'nextRefillAt', v_next
  );
end;
$$;

revoke all on function public.end_game_session(uuid, text, int) from public;
grant execute on function public.end_game_session(uuid, text, int) to authenticated;

comment on function public.end_game_session(uuid, text, int) is
  'Cierra sesión. Si outcome=failed y no hay pase, resta 1 corazón.';
