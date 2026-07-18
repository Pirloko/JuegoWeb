-- Fix: jugadores autenticados deben poder leer las fotos de niveles
-- unlocked/completed. El admin ya podía (policy is_admin); los jugadores no
-- porque el EXISTS directo sobre storage.objects + RLS anidado fallaba o el
-- path no coincidía exacto (png/webp).
--
-- Solución: función SECURITY DEFINER que decide el acceso, + políticas
-- simples que la usan. Convención de carpeta: level-{sort_order}/*.

create or replace function public.can_read_level_image(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.levels l
    where l.is_active
      and (
        l.image_path = object_name
        or l.thumb_path = object_name
        or object_name like ('level-' || l.sort_order::text || '/%')
        or (
          position('/' in l.image_path) > 0
          and object_name like split_part(l.image_path, '/', 1) || '/%'
        )
      )
      and (
        -- Miniaturas: cualquier autenticado (la UI pone blur/candado).
        object_name like '%/thumb.%'
        or object_name = l.thumb_path
        -- Imagen completa: solo si el jugador tiene el nivel abierto.
        or exists (
          select 1
          from public.user_level_progress ulp
          where ulp.level_id = l.id
            and ulp.user_id = auth.uid()
            and ulp.status in ('unlocked', 'completed')
        )
      )
  );
$$;

comment on function public.can_read_level_image(text) is
  'True si el usuario actual puede leer ese path del bucket level-images.';

revoke all on function public.can_read_level_image(text) from public;
grant execute on function public.can_read_level_image(text) to authenticated;

drop policy if exists "level_images_select_thumbs" on storage.objects;
drop policy if exists "level_images_select_full_unlocked" on storage.objects;
drop policy if exists "level_images_select_playable" on storage.objects;

-- Una sola policy de lectura para jugadores (admin sigue con level_images_select_admin).
create policy "level_images_select_playable"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'level-images'
  and public.can_read_level_image(name)
);
