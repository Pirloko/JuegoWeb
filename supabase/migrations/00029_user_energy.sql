-- Fase 6: energía / corazones persistentes.
-- Máx 5; refill 1 cada 20 min; gastar 1 al iniciar intento.
-- Con pase vigente (has_season_pass de la season del nivel): no se gasta.
-- Ver docs/MODELO_NEGOCIO_Y_PROGRESION.md §2.6 / Fase 6.

create table if not exists public.user_energy (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  hearts int not null default 5
    check (hearts >= 0 and hearts <= 5),
  last_refill_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_energy is
  'Energía global del jugador (corazones). Refill temporal; pase no consume.';

alter table public.user_energy enable row level security;

grant select on table public.user_energy to authenticated;
grant select, insert, update, delete on table public.user_energy to service_role;

create policy "user_energy_select_own" on public.user_energy
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Constantes
create or replace function public.energy_max()
returns int language sql immutable set search_path = '' as $$ select 5 $$;

create or replace function public.energy_refill_seconds()
returns int language sql immutable set search_path = '' as $$ select 1200 $$; -- 20 min

-- Asegura fila
create or replace function public.ensure_user_energy(p_user_id uuid)
returns public.user_energy
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.user_energy%rowtype;
begin
  insert into public.user_energy (user_id, hearts, last_refill_at)
  values (p_user_id, public.energy_max(), now())
  on conflict (user_id) do nothing;

  select * into v_row from public.user_energy where user_id = p_user_id;
  return v_row;
end;
$$;

-- Aplica refill por tiempo transcurrido
create or replace function public.apply_energy_refill(p_user_id uuid)
returns public.user_energy
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.user_energy%rowtype;
  v_max int := public.energy_max();
  v_sec int := public.energy_refill_seconds();
  v_elapsed interval;
  v_gained int;
begin
  v_row := public.ensure_user_energy(p_user_id);

  if v_row.hearts >= v_max then
    update public.user_energy
    set last_refill_at = now(), updated_at = now()
    where user_id = p_user_id
      and hearts >= v_max
    returning * into v_row;
    return v_row;
  end if;

  v_elapsed := now() - v_row.last_refill_at;
  v_gained := floor(extract(epoch from v_elapsed) / v_sec)::int;

  if v_gained <= 0 then
    return v_row;
  end if;

  update public.user_energy
  set
    hearts = least(v_max, hearts + v_gained),
    last_refill_at = last_refill_at + make_interval(secs => v_gained * v_sec),
    updated_at = now()
  where user_id = p_user_id
  returning * into v_row;

  if v_row.hearts >= v_max then
    update public.user_energy
    set last_refill_at = now(), updated_at = now()
    where user_id = p_user_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.energy_snapshot(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.user_energy%rowtype;
  v_max int := public.energy_max();
  v_sec int := public.energy_refill_seconds();
  v_next timestamptz;
begin
  -- Nota: stable + apply mutates — usamos security definer y apply en get vía spend path.
  -- Para lectura pura calculamos sin escribir si posible; get_user_energy hará apply.
  v_row := public.ensure_user_energy(p_user_id);

  if v_row.hearts >= v_max then
    v_next := null;
  else
    v_next := v_row.last_refill_at + make_interval(secs => v_sec);
  end if;

  return jsonb_build_object(
    'hearts', v_row.hearts,
    'max', v_max,
    'refillSec', v_sec,
    'nextRefillAt', v_next,
    'lastRefillAt', v_row.last_refill_at
  );
end;
$$;

-- Estado con refill aplicado (para UI)
create or replace function public.get_user_energy()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.user_energy%rowtype;
  v_max int := public.energy_max();
  v_sec int := public.energy_refill_seconds();
  v_next timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  v_row := public.apply_energy_refill(v_uid);

  if v_row.hearts >= v_max then
    v_next := null;
  else
    v_next := v_row.last_refill_at + make_interval(secs => v_sec);
  end if;

  return jsonb_build_object(
    'hearts', v_row.hearts,
    'max', v_max,
    'refillSec', v_sec,
    'nextRefillAt', v_next,
    'lastRefillAt', v_row.last_refill_at
  );
end;
$$;

revoke all on function public.get_user_energy() from public;
grant execute on function public.get_user_energy() to authenticated;

-- Inicia intento: gasta energía (salvo pase) + crea game_session
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
      -- Si estaba lleno, el reloj de refill arranca al gastar
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

-- Alta de energía al crear perfil
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'jugador'
  );

  base_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base_username) < 3 then
    base_username := 'jugador';
  end if;
  if char_length(base_username) > 24 then
    base_username := left(base_username, 24);
  end if;

  final_username := base_username;

  while exists (
    select 1 from public.profiles p where lower(p.username) = lower(final_username)
  ) loop
    suffix := suffix + 1;
    final_username := left(base_username, greatest(3, 24 - char_length(suffix::text) - 1))
      || '_' || suffix::text;
  end loop;

  insert into public.profiles (id, username)
  values (new.id, final_username);

  insert into public.user_energy (user_id, hearts, last_refill_at)
  values (new.id, public.energy_max(), now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Backfill perfiles existentes
insert into public.user_energy (user_id, hearts, last_refill_at)
select p.id, public.energy_max(), now()
from public.profiles p
on conflict (user_id) do nothing;
