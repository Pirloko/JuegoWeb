-- FASE 8 — Catálogo de niveles
-- Contenido administrado por SQL/migraciones. Lectura para usuarios autenticados.
-- Ejecutar en el SQL Editor tras 00001_profiles.sql.
-- Orden: 2/5.

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null,
  name text not null,
  config jsonb not null,
  image_path text not null,
  thumb_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint levels_sort_order_unique unique (sort_order),
  constraint levels_config_is_object check (jsonb_typeof(config) = 'object')
);

comment on table public.levels is 'Niveles jugables; config JSONB versionada (targetPct, lives, enemies, powerUps, …)';
comment on column public.levels.config is '{ targetPct, lives, playerSpeed, minTimeMs, enemies[], powerUps[], cellSize }';
comment on column public.levels.image_path is 'Path en Storage bucket level-images (imagen completa)';
comment on column public.levels.thumb_path is 'Path en Storage bucket level-images (thumbnail)';

create index levels_active_sort_idx on public.levels (sort_order) where is_active;

alter table public.levels enable row level security;

grant select on table public.levels to authenticated;
grant select, insert, update, delete on table public.levels to service_role;

-- Usuarios autenticados solo leen niveles activos. Escritura solo service role / SQL admin.
create policy "levels_select_active" on public.levels
  for select to authenticated
  using (is_active = true);

-- Seed: nivel 1 alineado con el prototipo actual (PROTOTYPE_LEVEL).
insert into public.levels (sort_order, name, config, image_path, thumb_path)
values (
  1,
  'Nivel 1',
  '{
    "targetPct": 60,
    "lives": 3,
    "playerSpeed": 280,
    "minTimeMs": 8000,
    "cellSize": 8,
    "enemies": [{ "type": "basic", "speed": 200 }],
    "powerUps": [
      {
        "type": "bomb",
        "spawn": { "delayMs": 8000, "max": 2 },
        "params": { "radiusCells": 10 }
      },
      {
        "type": "lightning",
        "spawn": { "delayMs": 14000, "max": 1 },
        "params": { "targets": 1 }
      }
    ]
  }'::jsonb,
  'level-1/full.png',
  'level-1/thumb.png'
);
