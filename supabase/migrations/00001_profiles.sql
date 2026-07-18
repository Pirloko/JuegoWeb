-- FASE 7 — Perfiles de usuario
-- Un perfil 1:1 con auth.users, creado automáticamente al registrarse.
-- Ejecutar en el SQL Editor del proyecto (o via supabase db push).
-- Orden: 1/5. Solo esto es obligatorio para la Fase 7.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 3 and 24),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]+$')
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

comment on table public.profiles is 'Perfil público 1:1 con auth.users';

alter table public.profiles enable row level security;

-- Acceso mínimo vía Data API (RLS filtra filas).
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

-- Cada usuario solo ve y edita su propio perfil.
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Sin policy de INSERT/DELETE para usuarios: el alta la hace el trigger
-- (security definer) y la baja llega en cascada desde auth.users.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'jugador'
  );

  -- Normalizar a formato permitido (3–24, alfanumérico + _).
  base_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base_username) < 3 then
    base_username := 'jugador';
  end if;
  if char_length(base_username) > 24 then
    base_username := left(base_username, 24);
  end if;

  final_username := base_username;

  -- Evitar colisión de username único (case-insensitive).
  while exists (
    select 1 from public.profiles p where lower(p.username) = lower(final_username)
  ) loop
    suffix := suffix + 1;
    final_username := left(base_username, greatest(3, 24 - char_length(suffix::text) - 1))
      || '_' || suffix::text;
  end loop;

  insert into public.profiles (id, username)
  values (new.id, final_username);

  return new;
end;
$$;

-- La función es SECURITY DEFINER: no debe ser invocable por clientes.
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
