-- FASE 9 — Storage: bucket level-images + políticas
-- Imágenes privadas; acceso vía signed URLs desde el cliente (Fase 9).
-- Ejecutar en el SQL Editor tras 00004_complete_level.sql.
-- Orden: 5/5.
--
-- Nota: en el Dashboard también puedes crear el bucket manualmente
-- (Storage → New bucket → name: level-images → Private).
-- Esta migración lo hace por SQL para versionarlo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'level-images',
  'level-images',
  false,
  524288, -- 512 KB
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura:
-- - thumb_path: cualquier usuario autenticado (galería con candado/blur en UI)
-- - image_path: solo si el nivel está unlocked o completed

create policy "level_images_select_thumbs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'level-images'
  and exists (
    select 1
    from public.levels l
    where l.is_active
      and l.thumb_path = name
  )
);

create policy "level_images_select_full_unlocked"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'level-images'
  and exists (
    select 1
    from public.levels l
    join public.user_level_progress ulp
      on ulp.level_id = l.id
    where ulp.user_id = (select auth.uid())
      and ulp.status in ('unlocked', 'completed')
      and l.is_active
      and l.image_path = name
  )
);

-- Sin INSERT/UPDATE/DELETE para authenticated: subida solo con service role / Dashboard.
-- (service_role bypasa RLS de storage en operaciones admin.)
