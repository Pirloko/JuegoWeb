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
desbloqueada. Los power-ups viven en `levels.config`. El tiempo de juego se
registra en `game_sessions` (migración `00021`) para el dashboard admin.

## Sesiones de juego y dashboard admin

Migraciones `00021_game_sessions.sql` + `00022_admin_dashboard.sql`:

- `game_sessions` — `started_at` / `ended_at` / `duration_ms` / `outcome`
  (`playing|completed|failed|abandoned`). Jugador INSERT/UPDATE propias;
  admin SELECT todas. Cierre vía RPC `end_game_session`.
- `admin_dashboard_stats(p_days)` — SECURITY DEFINER, solo `is_admin()`.
  Devuelve JSONB: usuarios (total/nuevos/recurrentes/pagados), tiempo de
  juego, sesiones, niveles completados, intentos, `subs_by_status`.
- Policies SELECT admin adicionales en `profiles`, `subscriptions`,
  `user_level_progress` y `game_sessions`.

## RLS

| Tabla               | SELECT                                                      | INSERT/UPDATE                                                 |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| profiles            | dueño o admin                                               | dueño (solo su fila)                                          |
| levels              | authenticated (is_active)                                   | nadie (solo service role / SQL admin)                         |
| user_level_progress | dueño o admin                                               | **solo vía RPC** (sin policy de escritura directa)            |
| game_sessions       | dueño o admin                                               | dueño (INSERT/UPDATE propias); cierre vía `end_game_session`   |
| subscriptions       | dueño o admin                                               | admin (INSERT/UPDATE); upsert MP vía service role             |
| user_badges         | dueño                                                       | **solo vía `award_badges()`** (sin escritura directa)         |
| level_reviews       | propia o admin (listado ajeno solo vía `get_level_reviews`) | propia y solo con el nivel `completed`; DELETE propia o admin |

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

## Gamificación (migraciones 00015–00017)

Ver plan y decisiones en `docs/GAMIFICACION_PLAN.md`.

- `user_badges` (00015) — otorgamientos de medallas. El catálogo visual
  (nombre/copy/ícono) vive en `src/features/progression/badgeCatalog.ts`.
  La elegibilidad la decide `award_badges()`: security definer, idempotente,
  recomputa todo desde `user_level_progress` y devuelve solo las medallas
  nuevas (React la llama tras `complete_level`). La regla de 3★ está
  replicada en `starsForLevel` (TS) y en la RPC (comentario cruzado).
- `levels.media_type` (`image|gif|video`) + `levels.media_path` (00016) —
  contenido oculto especial (video/GIF ≤ 20 s, ≤ 12 MB; el bucket acepta
  `image/gif`, `video/mp4`, `video/webm`). Phaser sigue revelando el poster
  (`image_path`); el media completo se reproduce en React (resultado y
  galería). `can_read_level_image` cubre `media_path` y la carpeta
  `level-{n}/` sigue gateada a unlocked/completed.
- `levels.source_url` (00017) — procedencia del contenido (solo http/https,
  opcional). El jugador la visita desde la galería tras revelar.
- `level_reviews` (00017) — 1 reseña por jugador por nivel (unique), body
  3–500 tras trim (check replicado en
  `src/features/reviews/reviewValidation.ts`). Escritura solo del autor con
  nivel `completed`; admin puede borrar (moderación). El listado con
  username sale por `get_level_reviews(level_id)` (security definer con
  gate "el lector completó el nivel"; no abre la RLS select-own de
  `profiles`). Rate limit por trigger: máx 10 reseñas nuevas/hora.

## Storage

- Bucket `level-images`: imagen completa + thumbnail por nivel.
- Imágenes de niveles bloqueados: bucket privado + signed URLs emitidas solo
  si el nivel está desbloqueado para el usuario (política por RPC/policy).
- Thumbnails públicos con blur/candado para la galería.

## Migraciones

Todo cambio de esquema vive en `supabase/migrations/*.sql` en el repo.
Nada de cambios manuales en el dashboard sin su migración correspondiente.
