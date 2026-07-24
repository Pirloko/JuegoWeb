-- Full/poster solo si completed (no spoiler al jugar unlocked).
-- Thumb: unlocked|completed (partida usa miniatura blur).
-- Media: solo completed.

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
        -- Miniaturas: jugable o ya revelado.
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

        -- Full / poster: SOLO completed (nunca al empezar a jugar).
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
              and ulp.status = 'completed'
          )
        )
      )
  );
$$;

comment on function public.can_read_level_image(text) is
  'Thumb: unlocked/completed. Full+media: solo completed. Evita spoiler en partida.';
