-- Sesiones de juego: tiempo real en partida (dashboard admin).

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  level_id uuid not null references public.levels (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms int,
  outcome text not null default 'playing'
    check (outcome in ('playing', 'completed', 'failed', 'abandoned')),
  created_at timestamptz not null default now(),
  constraint game_sessions_duration_check
    check (duration_ms is null or duration_ms >= 0),
  constraint game_sessions_ended_check
    check (
      (outcome = 'playing' and ended_at is null and duration_ms is null)
      or (outcome <> 'playing' and ended_at is not null and duration_ms is not null)
    )
);

comment on table public.game_sessions is
  'Sesiones de partida. Jugador inserta/cierra las suyas; admin agrega vía RPC.';

create index game_sessions_user_started_idx
  on public.game_sessions (user_id, started_at desc);

create index game_sessions_started_idx
  on public.game_sessions (started_at desc);

alter table public.game_sessions enable row level security;

grant select, insert, update on table public.game_sessions to authenticated;
grant all on table public.game_sessions to service_role;

create policy "game_sessions_select_own"
on public.game_sessions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
);

create policy "game_sessions_insert_own"
on public.game_sessions
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "game_sessions_update_own"
on public.game_sessions
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Cierra una sesión abierta del usuario actual.
create or replace function public.end_game_session(
  p_session_id uuid,
  p_outcome text,
  p_duration_ms int
)
returns public.game_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.game_sessions%rowtype;
begin
  if p_outcome is null or p_outcome not in ('completed', 'failed', 'abandoned') then
    raise exception 'invalid outcome' using errcode = '22023';
  end if;
  if p_duration_ms is null or p_duration_ms < 0 then
    raise exception 'invalid duration' using errcode = '22023';
  end if;

  update public.game_sessions s
  set
    outcome = p_outcome,
    ended_at = now(),
    duration_ms = p_duration_ms
  where s.id = p_session_id
    and s.user_id = (select auth.uid())
    and s.outcome = 'playing'
  returning * into v_row;

  if not found then
    raise exception 'session not found or already closed' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.end_game_session(uuid, text, int) from public;
grant execute on function public.end_game_session(uuid, text, int) to authenticated;
