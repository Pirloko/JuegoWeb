-- Fase 5: pase ~30 días — has_season_pass respeta current_period_end / expires_at.
-- Ver docs/MODELO_NEGOCIO_Y_PROGRESION.md Fase 5.

-- ── Entitlements con vencimiento ───────────────────────────────────────
alter table public.season_entitlements
  add column if not exists expires_at timestamptz;

comment on column public.season_entitlements.expires_at is
  'Fin de vigencia del pase (típicamente purchased_at + 30 días). Null legacy = tratar como vencido tras backfill.';

comment on table public.season_entitlements is
  'Pase por temporada (admin / one-shot): acceso a especiales mientras expires_at > now().';

comment on table public.subscriptions is
  'Suscripción MP: especiales mientras status=authorized y current_period_end > now() (o +30d si null al autorizar).';

-- Backfill: 30 días desde compra
update public.season_entitlements
set expires_at = purchased_at + interval '30 days'
where expires_at is null;

create index if not exists season_entitlements_expires_idx
  on public.season_entitlements (expires_at)
  where expires_at is not null;

-- ── Suscripción vigente (periodo) ──────────────────────────────────────
create or replace function public.subscription_is_current(p_user_id uuid default auth.uid())
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
      and coalesce(s.current_period_end, s.updated_at + interval '30 days') > now()
  );
$$;

comment on function public.subscription_is_current(uuid) is
  'True si la sub está authorized y el periodo no ha vencido.';

revoke all on function public.subscription_is_current(uuid) from public;
grant execute on function public.subscription_is_current(uuid) to authenticated;

create or replace function public.has_active_subscription(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.subscription_is_current(p_user_id);
$$;

create or replace function public.has_season_pass(
  p_season_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.subscription_is_current(p_user_id)
  or exists (
    select 1
    from public.season_entitlements e
    where e.season_id = p_season_id
      and e.user_id = coalesce(p_user_id, (select auth.uid()))
      and e.expires_at is not null
      and e.expires_at > now()
  );
$$;

comment on function public.has_season_pass(uuid, uuid) is
  'Pase vigentes: sub con periodo activo O entitlement de esa season con expires_at > now().';

-- Fin de vigencia visible para el cliente (sub global o entitlement de season)
create or replace function public.pass_expires_at(
  p_season_id uuid,
  p_user_id uuid default auth.uid()
)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := coalesce(p_user_id, (select auth.uid()));
  v_sub_end timestamptz;
  v_ent_end timestamptz;
begin
  if v_uid is null then
    return null;
  end if;

  select coalesce(s.current_period_end, s.updated_at + interval '30 days')
    into v_sub_end
  from public.subscriptions s
  where s.user_id = v_uid
    and s.status = 'authorized'
    and coalesce(s.current_period_end, s.updated_at + interval '30 days') > now()
  limit 1;

  select e.expires_at
    into v_ent_end
  from public.season_entitlements e
  where e.user_id = v_uid
    and e.season_id = p_season_id
    and e.expires_at is not null
    and e.expires_at > now()
  limit 1;

  if v_sub_end is null then
    return v_ent_end;
  end if;
  if v_ent_end is null then
    return v_sub_end;
  end if;
  return greatest(v_sub_end, v_ent_end);
end;
$$;

revoke all on function public.pass_expires_at(uuid, uuid) from public;
grant execute on function public.pass_expires_at(uuid, uuid) to authenticated;

-- ── grant_season_pass: +30 días (extiende si renueva) ──────────────────
create or replace function public.grant_season_pass(
  p_user_id uuid,
  p_season_id uuid,
  p_amount_clp int,
  p_provider text default 'stripe',
  p_provider_ref text default null
)
returns public.season_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.season_entitlements%rowtype;
  v_caller uuid := (select auth.uid());
  v_is_service boolean := (select auth.role()) = 'service_role';
  v_expires timestamptz := now() + interval '30 days';
begin
  if not v_is_service and not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if not v_is_service and v_caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.season_entitlements as e (
    user_id, season_id, amount_clp, provider, provider_ref, expires_at
  )
  values (
    p_user_id, p_season_id, p_amount_clp, p_provider, p_provider_ref, v_expires
  )
  on conflict (user_id, season_id) do update
  set
    amount_clp = excluded.amount_clp,
    provider = excluded.provider,
    provider_ref = coalesce(excluded.provider_ref, e.provider_ref),
    expires_at = greatest(coalesce(e.expires_at, now()), now()) + interval '30 days',
    purchased_at = now()
  returning * into v_row;

  perform public.unlock_playable_levels_for_user(p_user_id, p_season_id);

  return v_row;
end;
$$;

-- ── upsert_subscription: default +30d si no viene period_end ───────────
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
  v_period timestamptz;
  v_prev_end timestamptz;
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

  select s.current_period_end into v_prev_end
  from public.subscriptions s
  where s.user_id = p_user_id;

  if p_current_period_end is not null then
    v_period := p_current_period_end;
  elsif p_status = 'authorized' then
    if v_prev_end is not null and v_prev_end > now() then
      v_period := v_prev_end;
    else
      v_period := now() + interval '30 days';
    end if;
  else
    v_period := v_prev_end;
  end if;

  insert into public.subscriptions as s (
    user_id, status, mp_preapproval_id, amount_clp, current_period_end, cancelled_at, updated_at
  )
  values (
    p_user_id,
    p_status,
    p_mp_preapproval_id,
    p_amount_clp,
    v_period,
    case when p_status in ('cancelled', 'paused') then now() else null end,
    now()
  )
  on conflict (user_id) do update
  set
    status = excluded.status,
    mp_preapproval_id = coalesce(excluded.mp_preapproval_id, s.mp_preapproval_id),
    amount_clp = excluded.amount_clp,
    current_period_end = excluded.current_period_end,
    cancelled_at = case
      when excluded.status in ('cancelled', 'paused') then coalesce(s.cancelled_at, now())
      else null
    end,
    updated_at = now()
  returning * into v_row;

  if p_status = 'authorized' then
    perform public.unlock_playable_levels_for_user(p_user_id, null);
  end if;

  return v_row;
end;
$$;

-- Subs authorized sin periodo: asignar ventana 30d desde updated_at
update public.subscriptions
set current_period_end = updated_at + interval '30 days'
where status = 'authorized'
  and current_period_end is null;
