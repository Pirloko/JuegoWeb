-- FASE G4 (gamificación) — Origen del contenido + reseñas por nivel.
-- Cada nivel puede tener una URL de procedencia (la define el admin) y los
-- jugadores que revelaron el contenido pueden dejar UNA reseña firmada con
-- su username. No es un muro social: la conversación vive anclada al nivel.

-- ── levels.source_url ──────────────────────────────────────────────────
alter table public.levels
  add column if not exists source_url text
    constraint levels_source_url_check check (
      source_url is null or source_url ~* '^https?://'
    );

comment on column public.levels.source_url is
  'URL de procedencia del contenido revelado. Opcional; solo http(s).';

-- ── level_reviews ──────────────────────────────────────────────────────
create table public.level_reviews (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (level_id, user_id),
  -- Longitud replicada en el cliente (src/features/reviews/reviewValidation.ts)
  constraint level_reviews_body_length check (char_length(btrim(body)) between 3 and 500)
);

comment on table public.level_reviews is
  'Reseña de un jugador sobre el contenido revelado de un nivel (1 por jugador).';

create index level_reviews_level_created_idx
  on public.level_reviews (level_id, created_at desc);

alter table public.level_reviews enable row level security;

grant select, insert, update, delete on table public.level_reviews to authenticated;
grant select, insert, update, delete on table public.level_reviews to service_role;

-- ¿El usuario actual completó (reveló) este nivel? Security invoker: lee
-- user_level_progress bajo su propia RLS (select own).
create or replace function public.has_completed_level(p_level_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_level_progress ulp
    where ulp.level_id = p_level_id
      and ulp.user_id = (select auth.uid())
      and ulp.status = 'completed'
  );
$$;

revoke all on function public.has_completed_level(uuid) from public;
grant execute on function public.has_completed_level(uuid) to authenticated;

-- Lectura directa: solo la propia (para precargar el editor) o admin
-- (moderación). El listado con username sale por get_level_reviews().
create policy "level_reviews_select_own_or_admin" on public.level_reviews
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy "level_reviews_insert_own_completed" on public.level_reviews
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.has_completed_level(level_id)
  );

create policy "level_reviews_update_own" on public.level_reviews
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and public.has_completed_level(level_id)
  );

create policy "level_reviews_delete_own_or_admin" on public.level_reviews
  for delete to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

-- Rate limit anti-spam (además del unique por nivel): máx 10 reseñas
-- nuevas por usuario por hora. También normaliza el body.
create or replace function public.level_reviews_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.level_reviews r
    where r.user_id = new.user_id
      and r.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'rate limit exceeded' using errcode = '54000';
  end if;

  new.body := btrim(new.body);
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.level_reviews_before_insert() from public, anon, authenticated;

create trigger level_reviews_before_insert
  before insert on public.level_reviews
  for each row execute function public.level_reviews_before_insert();

-- Al editar: normalizar, refrescar updated_at y congelar identidad/anclaje.
create or replace function public.level_reviews_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  new.level_id := old.level_id;
  new.created_at := old.created_at;
  new.body := btrim(new.body);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.level_reviews_before_update() from public, anon, authenticated;

create trigger level_reviews_before_update
  before update on public.level_reviews
  for each row execute function public.level_reviews_before_update();

-- ── Lectura de reseñas con username ────────────────────────────────────
-- Security definer para exponer profiles.username (cuya RLS es select-own)
-- SOLO en este contexto. Gate: el lector debe haber revelado el nivel
-- (o ser admin, para moderar).
create or replace function public.get_level_reviews(p_level_id uuid)
returns table (
  id uuid,
  user_id uuid,
  username text,
  body text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not public.is_admin() and not exists (
    select 1
    from public.user_level_progress ulp
    where ulp.level_id = p_level_id
      and ulp.user_id = v_uid
      and ulp.status = 'completed'
  ) then
    raise exception 'level not revealed' using errcode = '42501';
  end if;

  return query
  select r.id, r.user_id, p.username, r.body, r.created_at, r.updated_at
  from public.level_reviews r
  join public.profiles p on p.id = r.user_id
  where r.level_id = p_level_id
  order by r.created_at desc;
end;
$$;

comment on function public.get_level_reviews(uuid) is
  'Reseñas de un nivel con username. Solo si el lector reveló el nivel (o admin).';

revoke all on function public.get_level_reviews(uuid) from public;
grant execute on function public.get_level_reviews(uuid) to authenticated;
