-- Permitir leer cualquier objeto del prefijo del nivel (full.webp / full.png / thumb.*)
-- si el usuario tiene el nivel unlocked/completed. Evita fallos png↔webp tras re-upload.

drop policy if exists "level_images_select_full_unlocked" on storage.objects;
drop policy if exists "level_images_select_thumbs" on storage.objects;

-- Thumbs: autenticados, si el path es el thumb del nivel o está en la carpeta del nivel
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
      and (
        l.thumb_path = name
        or l.image_path = name
        or (
          position('/' in l.thumb_path) > 0
          and name like split_part(l.thumb_path, '/', 1) || '/%'
        )
        or (
          position('/' in l.image_path) > 0
          and name like split_part(l.image_path, '/', 1) || '/%'
        )
      )
  )
);

-- Full: solo si progreso unlocked/completed (misma carpeta o path exacto)
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
      and (
        l.image_path = name
        or l.thumb_path = name
        or (
          position('/' in l.image_path) > 0
          and name like split_part(l.image_path, '/', 1) || '/%'
        )
      )
  )
);
