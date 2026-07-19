-- Fase 4: media revelado (GIF/video) legible si completed, aunque no haya pase.
-- Jugar de nuevo el especial sigue exigiendo pase (can_play_level / cliente).
-- Ver docs/MODELO_NEGOCIO_Y_PROGRESION.md Fase 4.

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
        or object_name like ('level-' || l.sort_order::text || '/%')
        or (
          position('/' in l.image_path) > 0
          and object_name like split_part(l.image_path, '/', 1) || '/%'
        )
      )
      and (
        -- Miniaturas: cualquier autenticado (UI con blur/candado).
        object_name like '%/thumb.%'
        or object_name = l.thumb_path

        -- GIF/video: solo si YA lo reveló (completed). Persiste sin pase activo.
        or (
          (
            (l.media_path is not null and object_name = l.media_path)
            or object_name like ('level-' || l.sort_order::text || '/media.%')
          )
          and exists (
            select 1
            from public.user_level_progress ulp
            where ulp.level_id = l.id
              and ulp.user_id = auth.uid()
              and ulp.status = 'completed'
          )
        )

        -- Poster / full (partida): unlocked o completed.
        or (
          object_name not like '%/media.%'
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
  'Thumbs: auth. Poster: unlocked/completed. media.* (GIF/video): solo completed (colección sin pase).';
