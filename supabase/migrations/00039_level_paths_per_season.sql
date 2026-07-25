-- sort_order reinicia en cada temporada (levels_season_sort_unique), así que
-- la regla `level-{sort_order}/%` deja que el nivel 3 de una temporada abra
-- los archivos del nivel 3 de otra. Los niveles nuevos usan carpeta propia
-- (`s-{slug}-level-{n}/`) y aquí se quita la regla global.
--
-- Los niveles antiguos siguen cubiertos: su image_path ya es `level-{n}/full…`
-- y la cláusula por carpeta (split_part) autoriza `level-{n}/%` para esa fila.

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
        or l.media_path = object_name
        or (
          position('/' in l.image_path) > 0
          and object_name like split_part(l.image_path, '/', 1) || '/%'
        )
      )
      and (
        -- Thumbs: jugable o revelado (listas unlocked; locked = sin bytes).
        (
          (
            object_name like '%/thumb.%'
            or object_name = l.thumb_path
          )
          and exists (
            select 1
            from public.user_level_progress ulp
            where ulp.level_id = l.id
              and ulp.user_id = auth.uid()
              and ulp.status in ('unlocked', 'completed')
          )
        )

        -- GIF/video: solo completed
        or (
          object_name like '%/media.%'
          and exists (
            select 1
            from public.user_level_progress ulp
            where ulp.level_id = l.id
              and ulp.user_id = auth.uid()
              and ulp.status = 'completed'
          )
        )

        -- Full / poster: unlocked o completed (partida + galería).
        or (
          object_name not like '%/media.%'
          and object_name not like '%/thumb.%'
          and object_name is distinct from l.thumb_path
          and (l.media_path is null or object_name is distinct from l.media_path)
          and exists (
            select 1
            from public.user_level_progress ulp
            where ulp.level_id = l.id
              and ulp.user_id = auth.uid()
              and ulp.status in ('unlocked', 'completed')
          )
        )
      )
  );
$$;

comment on function public.can_read_level_image(text) is
  'Acceso por carpeta del propio nivel. Thumb+full: unlocked/completed. media: solo completed.';
