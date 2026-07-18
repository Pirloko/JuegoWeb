-- Dashboard admin: agregados + lectura admin de perfiles/subs.

-- Admin puede listar perfiles (username) para suscripciones / panel.
create policy "profiles_select_admin"
on public.profiles
for select
to authenticated
using ((select public.is_admin()));

-- Admin puede listar todas las suscripciones (además de select_own).
drop policy if exists "subscriptions_select_admin" on public.subscriptions;
create policy "subscriptions_select_admin"
on public.subscriptions
for select
to authenticated
using ((select public.is_admin()));

-- Admin puede leer progreso (además de select_own).
drop policy if exists "ulp_select_admin" on public.user_level_progress;
create policy "ulp_select_admin"
on public.user_level_progress
for select
to authenticated
using ((select public.is_admin()));

create or replace function public.admin_dashboard_stats(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := greatest(coalesce(p_days, 30), 1);
  v_since timestamptz := now() - make_interval(days => v_days);
  v_users_total bigint;
  v_users_new bigint;
  v_users_returning bigint;
  v_users_paid bigint;
  v_play_total bigint;
  v_play_window bigint;
  v_sessions bigint;
  v_completed bigint;
  v_attempts bigint;
  v_subs jsonb;
begin
  if not (select public.is_admin()) then
    raise exception 'not admin' using errcode = '42501';
  end if;

  select count(*) into v_users_total from public.profiles;

  select count(*) into v_users_new
  from public.profiles p
  where p.created_at >= v_since;

  select count(*) into v_users_returning
  from (
    select gs.user_id
    from public.game_sessions gs
    where gs.started_at >= v_since
      and gs.outcome <> 'playing'
    group by gs.user_id
    having count(distinct (gs.started_at at time zone 'UTC')::date) >= 2
  ) r;

  select count(*) into v_users_paid
  from public.subscriptions s
  where s.status = 'authorized';

  select coalesce(sum(gs.duration_ms), 0) into v_play_total
  from public.game_sessions gs
  where gs.duration_ms is not null;

  select coalesce(sum(gs.duration_ms), 0) into v_play_window
  from public.game_sessions gs
  where gs.duration_ms is not null
    and gs.started_at >= v_since;

  select count(*) into v_sessions
  from public.game_sessions gs
  where gs.started_at >= v_since
    and gs.outcome <> 'playing';

  select count(*) into v_completed
  from public.user_level_progress ulp
  where ulp.status = 'completed'
    and ulp.completed_at is not null
    and ulp.completed_at >= v_since;

  select coalesce(sum(ulp.attempts), 0) into v_attempts
  from public.user_level_progress ulp;

  select coalesce(
    jsonb_object_agg(x.status, x.cnt),
    '{}'::jsonb
  )
  into v_subs
  from (
    select s.status, count(*)::bigint as cnt
    from public.subscriptions s
    group by s.status
  ) x;

  return jsonb_build_object(
    'window_days', v_days,
    'users_total', v_users_total,
    'users_new', v_users_new,
    'users_returning', v_users_returning,
    'users_paid', v_users_paid,
    'play_time_ms_total', v_play_total,
    'play_time_ms_window', v_play_window,
    'sessions_count', v_sessions,
    'levels_completed', v_completed,
    'attempts_total', v_attempts,
    'subs_by_status', v_subs
  );
end;
$$;

comment on function public.admin_dashboard_stats(int) is
  'Agregados del panel admin. Solo is_admin().';

revoke all on function public.admin_dashboard_stats(int) from public;
grant execute on function public.admin_dashboard_stats(int) to authenticated;
