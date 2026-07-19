-- Fase 2 modelo de negocio: gate T→T+1 por estrellas
-- Ver docs/MODELO_NEGOCIO_Y_PROGRESION.md §2.3–2.4 y Fase 2.

-- ── Columna en seasons ─────────────────────────────────────────────────
alter table public.seasons
  add column if not exists stars_required_to_unlock_next int not null default 20
    check (stars_required_to_unlock_next >= 0);

comment on column public.seasons.stars_required_to_unlock_next is
  '★ mínimas en ESTA temporada para liberar la siguiente. Debe ser ≤ season_star_cap_free(id).';

-- ── ★ por % (misma regla que starsForLevel en progression.ts) ──────────
create or replace function public.level_stars_from_pct(p_best numeric, p_target numeric)
returns int
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_target numeric := coalesce(p_target, 100);
  v_three numeric := greatest(95, v_target);
  v_two numeric := least(v_target + 15, v_three);
begin
  if p_best is null then
    return 0;
  end if;
  if p_best >= v_three then
    return 3;
  end if;
  if p_best >= v_two then
    return 2;
  end if;
  if p_best >= v_target then
    return 1;
  end if;
  return 0;
end;
$$;

comment on function public.level_stars_from_pct(numeric, numeric) is
  '1★ target · 2★ target+15 · 3★ max(95,target). Réplica de starsForLevel (TS).';

revoke all on function public.level_stars_from_pct(numeric, numeric) from public;
grant execute on function public.level_stars_from_pct(numeric, numeric) to authenticated;

-- ── Techo free: 3 × niveles imagen activos ─────────────────────────────
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
        and coalesce(l.media_type, 'image') = 'image'
    ),
    0
  );
$$;

comment on function public.season_star_cap_free(uuid) is
  'Máximo de ★ obtenibles sin pase (solo media_type = image). Anti soft-lock.';

revoke all on function public.season_star_cap_free(uuid) from public;
grant execute on function public.season_star_cap_free(uuid) to authenticated;

-- ── ★ contables hacia el gate (solo niveles completed) ─────────────────
create or replace function public.season_countable_stars(
  p_season_id uuid,
  p_user_id uuid default auth.uid()
)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select sum(
        public.level_stars_from_pct(
          ulp.best_pct,
          coalesce((l.config ->> 'targetPct')::numeric, 100)
        )
      )::int
      from public.levels l
      join public.user_level_progress ulp
        on ulp.level_id = l.id
       and ulp.user_id = coalesce(p_user_id, (select auth.uid()))
       and ulp.status = 'completed'
      where l.season_id = p_season_id
        and l.is_active
    ),
    0
  );
$$;

comment on function public.season_countable_stars(uuid, uuid) is
  '★ que cuentan para liberar la siguiente temporada (niveles completed).';

revoke all on function public.season_countable_stars(uuid, uuid) from public;
grant execute on function public.season_countable_stars(uuid, uuid) to authenticated;

-- ── ¿Puede acceder a esta temporada? ──────────────────────────────────
create or replace function public.can_access_season(
  p_season_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := coalesce(p_user_id, (select auth.uid()));
  v_starts timestamptz;
  v_prev_id uuid;
  v_prev_required int;
begin
  if v_uid is null then
    return false;
  end if;

  if (select public.is_admin()) then
    return true;
  end if;

  select s.starts_at into v_starts
  from public.seasons s
  where s.id = p_season_id;

  if v_starts is null then
    return false;
  end if;

  select s.id, s.stars_required_to_unlock_next
    into v_prev_id, v_prev_required
  from public.seasons s
  where s.starts_at < v_starts
  order by s.starts_at desc
  limit 1;

  if v_prev_id is null then
    return true;
  end if;

  return public.season_countable_stars(v_prev_id, v_uid) >= v_prev_required;
end;
$$;

comment on function public.can_access_season(uuid, uuid) is
  'True si es la primera temporada (por starts_at) o el jugador cumplió ★ de la anterior.';

revoke all on function public.can_access_season(uuid, uuid) from public;
grant execute on function public.can_access_season(uuid, uuid) to authenticated;

create or replace function public.season_star_gate_is_valid(p_season_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_required int;
  v_cap int;
begin
  select s.stars_required_to_unlock_next into v_required
  from public.seasons s
  where s.id = p_season_id;

  if v_required is null then
    return false;
  end if;

  v_cap := public.season_star_cap_free(p_season_id);

  if v_cap = 0 then
    return v_required = 0;
  end if;

  return v_required <= v_cap;
end;
$$;

revoke all on function public.season_star_gate_is_valid(uuid) from public;
grant execute on function public.season_star_gate_is_valid(uuid) to authenticated;

-- Clamp en seasons (BEFORE): nunca dejar required > cap free
create or replace function public.enforce_season_star_gate_on_seasons()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap int;
begin
  v_cap := public.season_star_cap_free(new.id);
  if v_cap = 0 then
    new.stars_required_to_unlock_next := 0;
  elsif new.stars_required_to_unlock_next > v_cap then
    new.stars_required_to_unlock_next := v_cap;
  end if;
  return new;
end;
$$;

drop trigger if exists seasons_enforce_star_gate on public.seasons;
create trigger seasons_enforce_star_gate
  before insert or update of stars_required_to_unlock_next
  on public.seasons
  for each row
  execute function public.enforce_season_star_gate_on_seasons();

-- Si cambian niveles imagen/especial, baja el gate automáticamente
create or replace function public.enforce_season_star_gate_on_levels()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
  v_cap int;
begin
  if tg_op = 'DELETE' then
    v_season_id := old.season_id;
  else
    v_season_id := new.season_id;
  end if;

  if v_season_id is not null then
    v_cap := public.season_star_cap_free(v_season_id);
    update public.seasons s
    set stars_required_to_unlock_next = v_cap
    where s.id = v_season_id
      and s.stars_required_to_unlock_next > v_cap;
  end if;

  -- Al mover de temporada, también revisar la anterior
  if tg_op = 'UPDATE' and old.season_id is distinct from new.season_id then
    v_cap := public.season_star_cap_free(old.season_id);
    update public.seasons s
    set stars_required_to_unlock_next = v_cap
    where s.id = old.season_id
      and s.stars_required_to_unlock_next > v_cap;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists levels_enforce_star_gate on public.levels;
create trigger levels_enforce_star_gate
  after insert or update of media_type, is_active, season_id or delete
  on public.levels
  for each row
  execute function public.enforce_season_star_gate_on_levels();

-- Backfill: least(20, cap) para no soft-lock con el contenido actual
update public.seasons s
set stars_required_to_unlock_next = least(20, public.season_star_cap_free(s.id));
