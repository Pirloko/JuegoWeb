-- FASE 11 — Políticas de administración de contenido
-- Admin = auth.users.raw_app_meta_data.role = 'admin' (NUNCA user_metadata).
--
-- Promover un usuario a admin (SQL Editor, cambia el email):
--   update auth.users
--   set raw_app_meta_data =
--     coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
--   where email = 'tu@email.com';
-- Luego el usuario debe cerrar sesión y volver a entrar (o refreshSession).

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

comment on function public.is_admin() is
  'True si app_metadata.role = admin. Usar en RLS; no confiar en user_metadata.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Lectura de niveles inactivos + escritura solo admin.
grant insert, update, delete on table public.levels to authenticated;

create policy "levels_select_admin_all" on public.levels
  for select to authenticated
  using ((select public.is_admin()));

create policy "levels_insert_admin" on public.levels
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "levels_update_admin" on public.levels
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "levels_delete_admin" on public.levels
  for delete to authenticated
  using ((select public.is_admin()));

-- Storage: admin puede leer/subir/actualizar/borrar en level-images.
create policy "level_images_select_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'level-images'
  and (select public.is_admin())
);

create policy "level_images_insert_admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'level-images'
  and (select public.is_admin())
);

create policy "level_images_update_admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'level-images'
  and (select public.is_admin())
)
with check (
  bucket_id = 'level-images'
  and (select public.is_admin())
);

create policy "level_images_delete_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'level-images'
  and (select public.is_admin())
);

-- Si se crea un nivel N y ya hay jugadores que completaron N-1, desbloquear N.
create or replace function public.unlock_level_for_eligible_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active then
    insert into public.user_level_progress (user_id, level_id, status)
    select ulp.user_id, new.id, 'unlocked'
    from public.user_level_progress ulp
    join public.levels prev on prev.id = ulp.level_id
    where ulp.status = 'completed'
      and prev.is_active
      and prev.sort_order = new.sort_order - 1
    on conflict (user_id, level_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.unlock_level_for_eligible_users() from public, anon, authenticated;

create trigger on_level_created_unlock_eligible
  after insert on public.levels
  for each row execute function public.unlock_level_for_eligible_users();
