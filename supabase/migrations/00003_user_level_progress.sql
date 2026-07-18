-- FASE 8 — Progreso por usuario y nivel
-- Escritura directa prohibida: solo vía RPC complete_level (00004) y triggers.
-- Ejecutar en el SQL Editor tras 00002_levels.sql.
-- Orden: 3/5.

create table public.user_level_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  level_id uuid not null references public.levels (id) on delete cascade,
  status text not null,
  best_pct numeric(5, 2),
  best_time_ms int,
  attempts int not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, level_id),
  constraint user_level_progress_status_check
    check (status in ('locked', 'unlocked', 'completed')),
  constraint user_level_progress_best_pct_check
    check (best_pct is null or (best_pct >= 0 and best_pct <= 100)),
  constraint user_level_progress_best_time_check
    check (best_time_ms is null or best_time_ms >= 0),
  constraint user_level_progress_attempts_check
    check (attempts >= 0)
);

comment on table public.user_level_progress is 'Progreso por usuario/nivel. INSERT/UPDATE solo vía RPC o triggers internos.';

create index user_level_progress_user_status_idx
  on public.user_level_progress (user_id, status);

alter table public.user_level_progress enable row level security;

-- Lectura propia. Sin policies de INSERT/UPDATE/DELETE para authenticated.
grant select on table public.user_level_progress to authenticated;
grant select, insert, update, delete on table public.user_level_progress to service_role;

create policy "ulp_select_own" on public.user_level_progress
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Desbloquea el primer nivel activo al crear un perfil (signup).
create or replace function public.unlock_first_level_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_level_id uuid;
begin
  select l.id into first_level_id
  from public.levels l
  where l.is_active
  order by l.sort_order asc
  limit 1;

  if first_level_id is not null then
    insert into public.user_level_progress (user_id, level_id, status)
    values (new.id, first_level_id, 'unlocked')
    on conflict (user_id, level_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.unlock_first_level_for_profile() from public, anon, authenticated;

create trigger on_profile_created_unlock_first_level
  after insert on public.profiles
  for each row execute function public.unlock_first_level_for_profile();

-- Vista: imágenes desbloqueadas = niveles completed (no es tabla propia).
create or replace view public.user_unlocked_images
with (security_invoker = true)
as
select
  ulp.user_id,
  ulp.level_id,
  l.name as level_name,
  l.image_path,
  l.thumb_path,
  ulp.completed_at
from public.user_level_progress ulp
join public.levels l on l.id = ulp.level_id
where ulp.status = 'completed'
  and l.is_active;

comment on view public.user_unlocked_images is
  'Imágenes desbloqueadas derivadas de user_level_progress.status = completed';

grant select on public.user_unlocked_images to authenticated;

-- Backfill: perfiles ya existentes (si 00001 se corrió antes que este archivo).
insert into public.user_level_progress (user_id, level_id, status)
select p.id, first_level.id, 'unlocked'
from public.profiles p
cross join lateral (
  select l.id
  from public.levels l
  where l.is_active
  order by l.sort_order asc
  limit 1
) first_level
on conflict (user_id, level_id) do nothing;
