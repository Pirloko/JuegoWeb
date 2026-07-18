-- FIX G2/G3: award_badges fallaba con «column reference "badge_id" is
-- ambiguous»: el parámetro OUT de RETURNS TABLE (badge_id) choca con la
-- columna homónima dentro del ON CONFLICT. El pragma variable_conflict
-- use_column hace que las referencias sin calificar resuelvan a la columna.
-- Misma lógica que 00016 (incluye first_special).

create or replace function public.award_badges()
returns table (badge_id text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
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
      l.media_type,
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

    select 'first_special'
    where exists (select 1 from my where my.media_type <> 'image')

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
