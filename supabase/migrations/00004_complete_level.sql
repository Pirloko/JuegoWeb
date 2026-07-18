-- FASE 8 — RPC complete_level
-- Validación server-side de recompensas (SECURITY DEFINER + checks de plausibilidad).
-- Ejecutar en el SQL Editor tras 00003_user_level_progress.sql.
-- Orden: 4/5.

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

  v_target_pct := coalesce((v_level.config ->> 'targetPct')::numeric, 100);
  v_min_time_ms := coalesce((v_level.config ->> 'minTimeMs')::int, 5000);

  if p_pct < v_target_pct then
    raise exception 'pct below target' using errcode = 'P0001';
  end if;

  if p_time_ms < v_min_time_ms then
    raise exception 'time_ms below minimum' using errcode = 'P0001';
  end if;

  -- El nivel anterior (sort_order - 1) debe estar completed, salvo el primero.
  select l.id into v_prev_level_id
  from public.levels l
  where l.is_active
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

  -- Debe estar unlocked o already completed (replay para mejorar marca).
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

  -- Rate limit simple: no más de 1 escritura de completado por nivel / minuto.
  if v_progress.status = 'completed'
    and v_progress.updated_at > now() - interval '1 minute' then
    raise exception 'rate limit exceeded' using errcode = '54000';
  end if;

  insert into public.user_level_progress as ulp (
    user_id,
    level_id,
    status,
    best_pct,
    best_time_ms,
    attempts,
    completed_at,
    updated_at
  )
  values (
    v_uid,
    p_level_id,
    'completed',
    p_pct,
    p_time_ms,
    1,
    now(),
    now()
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

  -- Desbloquear siguiente nivel activo.
  select l.id into v_next_level_id
  from public.levels l
  where l.is_active
    and l.sort_order = v_level.sort_order + 1
  limit 1;

  if v_next_level_id is not null then
    insert into public.user_level_progress (user_id, level_id, status)
    values (v_uid, v_next_level_id, 'unlocked')
    on conflict (user_id, level_id) do nothing;
  end if;

  -- p_session_payload queda para auditoría futura; v1 no lo persiste.
  return v_progress;
end;
$$;

comment on function public.complete_level(uuid, numeric, int, jsonb) is
  'Marca un nivel como completado tras checks de plausibilidad. Desbloquea el siguiente.';

revoke all on function public.complete_level(uuid, numeric, int, jsonb) from public;
grant execute on function public.complete_level(uuid, numeric, int, jsonb) to authenticated;
