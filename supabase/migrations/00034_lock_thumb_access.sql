-- Thumbs solo si unlocked/completed (evita spoiler de niveles locked vía signed URL).
-- Full/poster: unlocked|completed. Media: solo completed.

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
        -- Miniaturas: solo si ya puede jugar o ya reveló (no spoiler locked).
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

        -- Poster / full: unlocked o completed
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
  'Thumbs+full: unlocked/completed. media.*: solo completed. Locked = sin bytes.';
