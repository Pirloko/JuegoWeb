-- FASE 8 — Seed nivel 2 (bloqueo secuencial)
-- Ejecutar en SQL Editor tras las migraciones 00001–00005.
-- El nivel 2 queda locked hasta completar el nivel 1 vía complete_level.

insert into public.levels (sort_order, name, config, image_path, thumb_path)
values (
  2,
  'Nivel 2',
  '{
    "targetPct": 65,
    "lives": 3,
    "playerSpeed": 290,
    "minTimeMs": 8000,
    "cellSize": 8,
    "enemies": [
      { "type": "basic", "speed": 210 },
      { "type": "basic", "speed": 180 }
    ],
    "powerUps": [
      {
        "type": "bomb",
        "spawn": { "delayMs": 7000, "max": 3 },
        "params": { "radiusCells": 10 }
      },
      {
        "type": "lightning",
        "spawn": { "delayMs": 12000, "max": 2 },
        "params": { "targets": 2 }
      }
    ]
  }'::jsonb,
  'level-2/full.png',
  'level-2/thumb.png'
)
on conflict (sort_order) do nothing;
