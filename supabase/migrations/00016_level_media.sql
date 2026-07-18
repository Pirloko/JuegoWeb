-- FASE G3 (gamificación) — Media mixta por nivel: foto / GIF / video corto.
-- El contenido oculto de un nivel puede ser un GIF o video (≤ 20 s, límite
-- validado en el admin UI). Phaser sigue revelando el poster (image_path);
-- el media completo se reproduce en React (resultado y galería).

-- ── levels: tipo de media + path del archivo especial ──────────────────
alter table public.levels
  add column if not exists media_type text not null default 'image'
    constraint levels_media_type_check check (media_type in ('image', 'gif', 'video')),
  add column if not exists media_path text;

comment on column public.levels.media_type is
  'Tipo de contenido oculto: image (default) | gif | video (≤20 s).';
comment on column public.levels.media_path is
  'Path en Storage del GIF/video (convención level-{sort_order}/media.*). Null si image.';

alter table public.levels
  add constraint levels_media_path_required
  check (media_type = 'image' or media_path is not null);

-- ── bucket: aceptar gif/video y subir el límite de peso ────────────────
update storage.buckets
set
  file_size_limit = 12582912, -- 12 MB (LEVEL_MEDIA_MAX_BYTES en el cliente)
  allowed_mime_types = array[
    'image/webp', 'image/png', 'image/jpeg',
    'image/gif', 'video/mp4', 'video/webm'
  ]
where id = 'level-images';

-- ── can_read_level_image: cubrir media_path explícito ──────────────────
-- (la convención level-{n}/% ya lo cubre; esto protege paths legacy que no
-- sigan la carpeta). Mismo contrato que 00014.
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
        -- Miniaturas: cualquier autenticado (la UI pone blur/candado).
        object_name like '%/thumb.%'
        or object_name = l.thumb_path
        -- Imagen/media completa: solo si el jugador tiene el nivel abierto.
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

-- ── award_badges: activar first_special (primer GIF/video revelado) ────
create or replace function public.award_badges()
returns table (badge_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
  with my as (
    select
      l.season_id,
      l.sort_order,
      l.media_type,
      ulp.best_pct,
      coalesce((l.config ->> 'targetPct')::numeric, 100) as target_pct
    from public.user_level_progress ulp
    join public.levels l on l.id = ulp.level_id and l.is_active
    where ulp.user_id = v_uid
      and ulp.status = 'completed'
  ),
  season_counts as (
    select my.season_id, count(*) as n
    from my
    group by my.season_id
  ),
  eligible as (
    select 'first_conquest'::text as b
    where exists (select 1 from my)

    union all

    -- Misma regla que starsForLevel en
    -- src/features/progression/progression.ts: 3★ = best_pct >= max(95, target)
    select 'three_stars'
    where exists (
      select 1 from my
      where my.best_pct >= greatest(95, my.target_pct)
    )

    union all

    select 'free_block'
    where exists (
      select 1 from my
      where my.sort_order between 1 and public.free_level_max()
      group by my.season_id
      having count(*) >= public.free_level_max()
    )

    union all

    select 'first_special'
    where exists (select 1 from my where my.media_type <> 'image')

    union all
    select 'season_10' where exists (select 1 from season_counts sc where sc.n >= 10)
    union all
    select 'season_25' where exists (select 1 from season_counts sc where sc.n >= 25)
    union all
    select 'season_50' where exists (select 1 from season_counts sc where sc.n >= 50)
    union all
    select 'season_70' where exists (select 1 from season_counts sc where sc.n >= 70)
  ),
  inserted as (
    insert into public.user_badges (user_id, badge_id)
    select v_uid, e.b
    from eligible e
    on conflict (user_id, badge_id) do nothing
    returning user_badges.badge_id
  )
  select inserted.badge_id from inserted;
end;
$$;
