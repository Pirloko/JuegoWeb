-- FASE G2 (gamificación) — Medallas personales (colección, no social)
-- El catálogo visual (nombre/copy/ícono) vive en el cliente
-- (src/features/progression/badgeCatalog.ts). Aquí solo se guardan los
-- otorgamientos y la elegibilidad se decide server-side en award_badges():
-- el cliente nunca decide recompensas (docs/DATABASE.md).

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id),
  constraint user_badges_badge_id_format check (badge_id ~ '^[a-z0-9_]{2,40}$')
);

comment on table public.user_badges is
  'Medallas ganadas por jugador. Solo propias (sin ranking ni comparación).';

alter table public.user_badges enable row level security;

grant select on table public.user_badges to authenticated;
grant select, insert, update, delete on table public.user_badges to service_role;

create policy "user_badges_select_own" on public.user_badges
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Sin policy de INSERT/UPDATE/DELETE para authenticated: la única vía de
-- escritura es award_badges() (security definer).

-- Recomputa la elegibilidad completa desde user_level_progress y otorga lo
-- que falte. Idempotente: nunca duplica ni revoca. Devuelve solo las
-- medallas nuevas para que el cliente las celebre.
create or replace function public.award_badges()
returns table (badge_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
  with my as (
    select
      l.season_id,
      l.sort_order,
      ulp.best_pct,
      coalesce((l.config ->> 'targetPct')::numeric, 100) as target_pct
    from public.user_level_progress ulp
    join public.levels l on l.id = ulp.level_id and l.is_active
    where ulp.user_id = v_uid
      and ulp.status = 'completed'
  ),
  season_counts as (
    select my.season_id, count(*) as n
    from my
    group by my.season_id
  ),
  eligible as (
    select 'first_conquest'::text as b
    where exists (select 1 from my)

    union all

    -- Misma regla que starsForLevel en
    -- src/features/progression/progression.ts: 3★ = best_pct >= max(95, target)
    select 'three_stars'
    where exists (
      select 1 from my
      where my.best_pct >= greatest(95, my.target_pct)
    )

    union all

    select 'free_block'
    where exists (
      select 1 from my
      where my.sort_order between 1 and public.free_level_max()
      group by my.season_id
      having count(*) >= public.free_level_max()
    )

    union all
    select 'season_10' where exists (select 1 from season_counts sc where sc.n >= 10)
    union all
    select 'season_25' where exists (select 1 from season_counts sc where sc.n >= 25)
    union all
    select 'season_50' where exists (select 1 from season_counts sc where sc.n >= 50)
    union all
    select 'season_70' where exists (select 1 from season_counts sc where sc.n >= 70)
  ),
  inserted as (
    insert into public.user_badges (user_id, badge_id)
    select v_uid, e.b
    from eligible e
    on conflict (user_id, badge_id) do nothing
    returning user_badges.badge_id
  )
  select inserted.badge_id from inserted;
end;
$$;

comment on function public.award_badges() is
  'Otorga al usuario actual las medallas elegibles que le falten y devuelve las nuevas.';

revoke all on function public.award_badges() from public;
grant execute on function public.award_badges() to authenticated;
