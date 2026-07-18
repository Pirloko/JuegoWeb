-- Suscripción mensual Mercado Pago (acceso 8–70 mientras authorized)
-- Compat: season_entitlements legacy / admin siguen valiendo

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null
    check (status in ('pending', 'authorized', 'paused', 'cancelled')),
  mp_preapproval_id text unique,
  amount_clp int not null check (amount_clp > 0),
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'Suscripción mensual MP: acceso a niveles 8-70 mientras status = authorized';

create index subscriptions_status_idx on public.subscriptions (status)
  where status = 'authorized';

alter table public.subscriptions enable row level security;

grant select on table public.subscriptions to authenticated;
grant select, insert, update, delete on table public.subscriptions to service_role;

create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "subscriptions_insert_admin" on public.subscriptions
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "subscriptions_update_admin" on public.subscriptions
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Acceso de pago: sub activa global O entitlement legacy por temporada
create or replace function public.has_season_pass(p_season_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = coalesce(p_user_id, (select auth.uid()))
      and s.status = 'authorized'
  )
  or exists (
    select 1
    from public.season_entitlements e
    where e.season_id = p_season_id
      and e.user_id = coalesce(p_user_id, (select auth.uid()))
  );
$$;

-- Helper: ¿tiene suscripción activa? (cualquier season)
create or replace function public.has_active_subscription(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = coalesce(p_user_id, (select auth.uid()))
      and s.status = 'authorized'
  );
$$;

revoke all on function public.has_active_subscription(uuid) from public;
grant execute on function public.has_active_subscription(uuid) to authenticated;

-- Upsert desde webhook MP (service_role o admin)
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

  -- Si acaba de autorizar: desbloquear nivel 8 de cada season activa donde completó el 7
  if p_status = 'authorized' then
    insert into public.user_level_progress (user_id, level_id, status)
    select p_user_id, l8.id, 'unlocked'
    from public.levels l7
    join public.levels l8
      on l8.season_id = l7.season_id
     and l8.sort_order = public.free_level_max() + 1
     and l8.is_active
    join public.user_level_progress ulp
      on ulp.user_id = p_user_id
     and ulp.level_id = l7.id
     and ulp.status = 'completed'
    where l7.sort_order = public.free_level_max()
      and l7.is_active
    on conflict (user_id, level_id) do nothing;
  end if;

  return v_row;
end;
$$;

revoke all on function public.upsert_subscription_from_mp(uuid, text, text, int, timestamptz) from public;
grant execute on function public.upsert_subscription_from_mp(uuid, text, text, int, timestamptz)
  to authenticated, service_role;
