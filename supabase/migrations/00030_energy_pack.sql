-- Fase 7: pack de corazones (recarga inmediata). Secundario al pase.
-- Ver docs/MODELO_NEGOCIO_Y_PROGRESION.md Fase 7.

create table if not exists public.energy_pack_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  hearts_granted int not null check (hearts_granted > 0),
  amount_clp int not null check (amount_clp > 0),
  provider text not null default 'mercadopago',
  provider_ref text,
  created_at timestamptz not null default now()
);

create unique index if not exists energy_pack_purchases_provider_ref_idx
  on public.energy_pack_purchases (provider, provider_ref)
  where provider_ref is not null;

comment on table public.energy_pack_purchases is
  'Compras one-shot de pack de corazones (no sustituye al pase).';

alter table public.energy_pack_purchases enable row level security;

grant select on table public.energy_pack_purchases to authenticated;
grant select, insert, update, delete on table public.energy_pack_purchases to service_role;

create policy "energy_pack_select_own" on public.energy_pack_purchases
  for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.energy_pack_price_clp()
returns int language sql immutable set search_path = '' as $$ select 990 $$;

create or replace function public.energy_pack_hearts()
returns int language sql immutable set search_path = '' as $$ select 5 $$;

-- Rellena corazones al máximo y registra la compra (idempotente por provider_ref)
create or replace function public.grant_energy_pack(
  p_user_id uuid,
  p_amount_clp int default null,
  p_provider text default 'admin',
  p_provider_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_is_service boolean := (select auth.role()) = 'service_role';
  v_amount int := coalesce(p_amount_clp, public.energy_pack_price_clp());
  v_hearts int := public.energy_pack_hearts();
  v_max int := public.energy_max();
  v_row public.user_energy%rowtype;
  v_existing uuid;
begin
  if not v_is_service and not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if not v_is_service and v_caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_user_id is null or v_amount <= 0 then
    raise exception 'invalid args' using errcode = '22023';
  end if;

  -- Idempotencia
  if p_provider_ref is not null then
    select id into v_existing
    from public.energy_pack_purchases
    where provider = p_provider
      and provider_ref = p_provider_ref
    limit 1;

    if v_existing is not null then
      v_row := public.apply_energy_refill(p_user_id);
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'hearts', v_row.hearts,
        'max', v_max
      );
    end if;
  end if;

  perform public.ensure_user_energy(p_user_id);

  update public.user_energy
  set
    hearts = v_max,
    last_refill_at = now(),
    updated_at = now()
  where user_id = p_user_id
  returning * into v_row;

  insert into public.energy_pack_purchases (
    user_id, hearts_granted, amount_clp, provider, provider_ref
  )
  values (p_user_id, v_hearts, v_amount, p_provider, p_provider_ref);

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'hearts', v_row.hearts,
    'max', v_max,
    'heartsGranted', v_hearts,
    'amountClp', v_amount
  );
end;
$$;

revoke all on function public.grant_energy_pack(uuid, int, text, text) from public;
grant execute on function public.grant_energy_pack(uuid, int, text, text)
  to authenticated, service_role;

comment on function public.grant_energy_pack(uuid, int, text, text) is
  'Rellena corazones al máximo (pack). Solo admin o service_role (webhook MP).';
