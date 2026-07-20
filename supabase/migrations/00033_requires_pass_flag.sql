-- Paywall por flag admin (requires_pass), no por media_type.
-- Permite GIF/video gratis y niveles imagen premium.
-- Backfill: los actuales gif/video quedan como requires_pass = true.

alter table public.levels
  add column if not exists requires_pass boolean not null default false;

comment on column public.levels.requires_pass is
  'True = exige pase/membresía. Independiente de media_type (image/gif/video).';

update public.levels
set requires_pass = true
where coalesce(media_type, 'image') in ('gif', 'video')
  and requires_pass = false;

create index if not exists levels_requires_pass_idx
  on public.levels (season_id, requires_pass)
  where is_active;

-- Helper canónico (el viejo level_is_special(media) queda deprecado)
create or replace function public.level_requires_pass(p_requires_pass boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_requires_pass, false);
$$;

comment on function public.level_requires_pass(boolean) is
  'True si el nivel exige pase (columna levels.requires_pass).';

revoke all on function public.level_requires_pass(boolean) from public;
grant execute on function public.level_requires_pass(boolean) to authenticated;

-- Compat: level_is_special(text) ya no decide paywall; dejar aviso
comment on function public.level_is_special(text) is
  'DEPRECATED: usar levels.requires_pass / level_requires_pass(boolean). Histórico: gif/video.';

-- Techo free = 3 × niveles SIN pase
create or replace function public.season_star_cap_free(p_season_id uuid)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select count(*)::int * 3
      from public.levels l
      where l.season_id = p_season_id
        and l.is_active
        and not l.requires_pass
    ),
    0
  );
$$;

comment on function public.season_star_cap_free(uuid) is
  'Máximo de ★ sin pase (3 × niveles con requires_pass = false). Anti soft-lock.';

-- previous_required: premium sin pase = saltables
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
    select l.id, l.requires_pass, l.season_id
    from public.levels l
    where l.season_id = p_season_id
      and l.is_active
      and l.sort_order < p_sort_order
    order by l.sort_order asc
  loop
    if r.requires_pass
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

-- user_may_play: firma nueva (boolean). DROP de la vieja (text).
drop function if exists public.user_may_play_level_content(uuid, text, uuid);

create function public.user_may_play_level_content(
  p_season_id uuid,
  p_requires_pass boolean,
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
      not public.level_requires_pass(p_requires_pass)
      or public.has_season_pass(p_season_id, p_user_id)
    );
$$;

revoke all on function public.user_may_play_level_content(uuid, boolean, uuid) from public;
grant execute on function public.user_may_play_level_content(uuid, boolean, uuid) to authenticated;

comment on function public.user_may_play_level_content(uuid, boolean, uuid) is
  'Temporada liberada + pase si requires_pass.';

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
    select l.id, l.requires_pass, l.sort_order, l.season_id
    from public.levels l
    where l.season_id = p_season_id
      and l.is_active
      and l.sort_order > p_after_sort
    order by l.sort_order asc
  loop
    if not public.user_may_play_level_content(r.season_id, r.requires_pass, p_user_id) then
      continue;
    end if;

    if not public.previous_required_levels_completed(r.season_id, r.sort_order, p_user_id) then
      exit;
    end if;

    insert into public.user_level_progress (user_id, level_id, status)
    values (p_user_id, r.id, 'unlocked')
    on conflict (user_id, level_id) do nothing;

    exit;
  end loop;
end;
$$;

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
    select l.id, l.requires_pass, l.sort_order, l.season_id
    from public.levels l
    where l.is_active
      and (p_season_id is null or l.season_id = p_season_id)
    order by l.season_id, l.sort_order
  loop
    if not public.user_may_play_level_content(r.season_id, r.requires_pass, p_user_id) then
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

  if not public.user_may_play_level_content(v_level.season_id, v_level.requires_pass, v_uid) then
    return false;
  end if;

  select ulp.status into v_status
  from public.user_level_progress ulp
  where ulp.user_id = v_uid and ulp.level_id = p_level_id;

  return v_status in ('unlocked', 'completed');
end;
$$;

-- Trigger al crear/editar nivel
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
    where public.user_may_play_level_content(new.season_id, new.requires_pass, p.id)
    on conflict (user_id, level_id) do nothing;
  elsif new.is_active then
    insert into public.user_level_progress (user_id, level_id, status)
    select ulp.user_id, new.id, 'unlocked'
    from public.user_level_progress ulp
    join public.levels prev on prev.id = ulp.level_id
    where ulp.status = 'completed'
      and prev.season_id = new.season_id
      and prev.is_active
      and public.user_may_play_level_content(new.season_id, new.requires_pass, ulp.user_id)
      and public.previous_required_levels_completed(new.season_id, new.sort_order, ulp.user_id)
    on conflict (user_id, level_id) do nothing;
  end if;
  return new;
end;
$$;

-- begin_level_attempt: gate por requires_pass
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

  if v_level.requires_pass
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

-- complete_level: gate por requires_pass
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

  if v_level.requires_pass
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

-- Trigger anti soft-lock también al cambiar requires_pass
drop trigger if exists levels_enforce_star_gate on public.levels;
create trigger levels_enforce_star_gate
  after insert or update of requires_pass, media_type, is_active, season_id or delete
  on public.levels
  for each row
  execute function public.enforce_season_star_gate_on_levels();

-- Desbloquear gratis ahora alcanzables (gif/video free recién convertidos)
insert into public.user_level_progress (user_id, level_id, status)
select p.id, l.id, 'unlocked'
from public.profiles p
cross join public.levels l
where l.is_active
  and not l.requires_pass
  and public.can_access_season(l.season_id, p.id)
  and public.previous_required_levels_completed(l.season_id, l.sort_order, p.id)
  and not exists (
    select 1
    from public.user_level_progress ulp
    where ulp.user_id = p.id
      and ulp.level_id = l.id
  )
on conflict (user_id, level_id) do nothing;
