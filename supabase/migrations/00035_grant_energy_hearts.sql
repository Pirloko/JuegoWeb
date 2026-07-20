-- Corazón in-match: +N al pool de energía (máx energy_max), no vidas de partida.

create or replace function public.grant_energy_hearts(p_amount int default 1)
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
  v_before int;
  v_gained int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_amount is null or p_amount < 1 then
    p_amount := 1;
  end if;
  if p_amount > v_max then
    p_amount := v_max;
  end if;

  v_row := public.apply_energy_refill(v_uid);
  v_before := v_row.hearts;

  update public.user_energy
  set
    hearts = least(v_max, hearts + p_amount),
    last_refill_at = case
      when least(v_max, hearts + p_amount) >= v_max then now()
      else last_refill_at
    end,
    updated_at = now()
  where user_id = v_uid
  returning * into v_row;

  v_gained := v_row.hearts - v_before;

  if v_row.hearts >= v_max then
    v_next := null;
  else
    v_next := v_row.last_refill_at + make_interval(secs => v_sec);
  end if;

  return jsonb_build_object(
    'ok', true,
    'hearts', v_row.hearts,
    'max', v_max,
    'gained', v_gained,
    'refillSec', v_sec,
    'nextRefillAt', v_next
  );
end;
$$;

revoke all on function public.grant_energy_hearts(int) from public;
grant execute on function public.grant_energy_hearts(int) to authenticated;

comment on function public.grant_energy_hearts(int) is
  'Suma corazones al pool (power-up corazón in-match). Cap = energy_max().';
