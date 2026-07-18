# BASE DE DATOS — Supabase

## Principios

- Esquema mínimo al inicio; las tablas se crean en la fase que las usa.
- RLS activado en **todas** las tablas desde el día uno.
- Config de nivel = JSONB versionado, no columnas rígidas por parámetro.
- El cliente nunca decide recompensas: se validan en una RPC.

## Esquema v1 (fases 7–9)

```sql
-- Perfil 1:1 con auth.users (trigger on signup)
profiles (
  id uuid PK REFERENCES auth.users,
  username text UNIQUE,
  created_at timestamptz
)

-- Contenido administrado (solo lectura para usuarios)
levels (
  id uuid PK,
  sort_order int UNIQUE,        -- orden y dependencia de desbloqueo
  name text,
  config jsonb,                 -- { targetPct, lives, enemies[], powerUps[], cellSize }
  image_path text,              -- path en Storage (bucket level-images)
  thumb_path text,
  is_active boolean DEFAULT true
)

-- Progreso por usuario y nivel
user_level_progress (
  user_id uuid REFERENCES profiles,
  level_id uuid REFERENCES levels,
  status text CHECK (status IN ('locked','unlocked','completed')),
  best_pct numeric,
  best_time_ms int,
  attempts int DEFAULT 0,
  completed_at timestamptz,
  PRIMARY KEY (user_id, level_id)
)
```

`user_unlocked_images` se deriva de `user_level_progress.status = 'completed'`
(vista), no es tabla propia — una fila de progreso ya dice qué imagen está
desbloqueada. `power_up_definitions`, `level_power_ups`, `game_sessions` y
`user_statistics` **no se crean en v1**: los power-ups viven en
`levels.config` y las estadísticas se añaden cuando exista una pantalla que
las muestre.

## RLS

| Tabla | SELECT | INSERT/UPDATE |
|---|---|---|
| profiles | dueño | dueño (solo su fila) |
| levels | authenticated (is_active) | nadie (solo service role / SQL admin) |
| user_level_progress | dueño | **solo vía RPC** (sin policy de escritura directa) |

## Validación server-side de recompensas

La finalización de nivel pasa por una función RPC `SECURITY DEFINER`:

```sql
complete_level(level_id uuid, pct numeric, time_ms int, session_payload jsonb)
```

Checks de plausibilidad dentro de la función:
- El nivel anterior (`sort_order - 1`) está `completed` para este usuario.
- `pct >= targetPct` del config del nivel.
- `time_ms` supera un mínimo razonable (config del nivel) — bloquea
  completados instantáneos.
- Rate limit simple: no más de N completados del mismo nivel por minuto.

Esto no hace el juego a prueba de balas (el cliente sigue siendo JS), pero
elimina el desbloqueo trivial por UPDATE directo, que es la amenaza real.
Anti-cheat más fuerte (replay de inputs en Edge Function) queda fuera de v1.

## Temporadas y pase (negocio)

Migración `00009_seasons_and_entitlements.sql` + `00011_subscriptions.sql`:

- `seasons` — precios CLP, oferta opcional, fechas.
- `levels.season_id` — unique `(season_id, sort_order)`.
- `season_entitlements` — acceso legacy / admin (permanente).
- `subscriptions` — suscripción mensual MP (`authorized` = acceso 8–70).
- Helpers: `has_season_pass` (sub **o** entitlement), `has_active_subscription`,
  `upsert_subscription_from_mp`, `grant_season_pass`.
- `complete_level` scoped a la temporada + gate free (1–7) / pago (8+).

## Storage

- Bucket `level-images`: imagen completa + thumbnail por nivel.
- Imágenes de niveles bloqueados: bucket privado + signed URLs emitidas solo
  si el nivel está desbloqueado para el usuario (política por RPC/policy).
- Thumbnails públicos con blur/candado para la galería.

## Migraciones

Todo cambio de esquema vive en `supabase/migrations/*.sql` en el repo.
Nada de cambios manuales en el dashboard sin su migración correspondiente.
