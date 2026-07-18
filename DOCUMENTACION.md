# JuegoWeb — Documentación completa del proyecto

Documento maestro del estado actual del proyecto (v1 + power-ups post-roadmap).
Los detalles históricos por tema también viven en `docs/` (ARCHITECTURE, GAMEPLAY, DATABASE, MOBILE, POWERUPS, ROADMAP).

**Última actualización:** julio 2026 · Fases 0–11 completadas · Power-ups extendidos (escudo, congelación, velocidad, corazón).

---

## 1. Qué es

Arcade móvil web tipo **Qix / Gals Panic**:

- Trazas una ruta por territorio libre.
- Al volver a zona segura, se conquista la región sin enemigos (flood-fill).
- Se revela una imagen oculta bajo el territorio conquistado.
- Objetivo: alcanzar el `%` configurado del nivel.

**Target:** smartphone en vertical (portrait), navegador, sin APK. PWA opcional.

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión aprox. | Rol |
|---|---|---|---|
| UI / shell | React + TypeScript | React 19, TS 5.9 | Menús, auth, niveles, galería, admin, HUD |
| Build | Vite | 7.x | Dev server, build estático |
| Motor | Phaser 3 | 3.90 | Game loop, render, input joystick |
| Backend | Supabase | JS client 2.58 | Auth, PostgreSQL, Storage, RLS, RPC |
| Routing | react-router-dom | 7.x | Rutas SPA |
| PWA | vite-plugin-pwa | 1.x | Manifest + Service Worker |
| Tests | Vitest | 4.x | Unitarios (territorio, rayo) |
| Lint/format | ESLint + Prettier | — | Calidad de código |
| Hosting previsto | Vercel | — | Deploy del build estático |

### Variables de entorno

Archivo `.env` (ver `.env.example`):

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...          # clave pública (anon / publishable)

# Solo scripts de máquina (NUNCA con prefijo VITE_ ni en el cliente):
SUPABASE_SERVICE_ROLE_KEY=eyJ...       # para npm run upload:images
```

---

## 3. Comandos

```bash
npm install
npm run dev              # http://localhost:5173
npm run dev -- --host    # accesible desde el móvil en la misma Wi‑Fi
npm run build            # tsc + vite build (debe estar verde)
npm run lint
npm test
npm run format
npm run upload:images    # sube public/levels/level-N.png → Storage
node scripts/generate-icons.mjs
```

En el móvil (misma red): `http://<IP-de-la-Mac>:5173` (requiere `--host`).

---

## 4. Arquitectura (regla de oro)

**Phaser es dueño del gameplay. React es dueño de todo lo demás.**

- React **nunca** lee/escribe estado de Phaser por frame.
- Phaser **nunca** llama a Supabase.
- Comunicación solo por el **event bus** tipado `src/features/game/core/GameEvents.ts`.

### Eventos

| Dirección | Evento | Payload |
|---|---|---|
| React → Phaser | `game:pause` / `game:resume` | `{}` |
| Phaser → React | `game:progress` | `{ conqueredPct }` |
| Phaser → React | `game:life-lost` | `{ livesLeft }` |
| Phaser → React | `game:completed` / `game:failed` | `LevelResultStats` |

### Ciclo de una partida

1. React carga nivel + progreso desde Supabase.
2. Obtiene signed URL de la imagen (Storage) o fallback local.
3. Monta `<GameCanvas>` → Phaser `GameScene`.
4. Al ganar → React llama RPC `complete_level`.
5. Modal de resultado; navegación a `/levels`.

### Resolución lógica del juego

- Canvas: **720 × 1280** (9:16).
- Celda: **16 px** → grid **45 × 80**.
- Escala: `Phaser.Scale.FIT` + `autoCenter`.
- Borde seguro inicial: `BORDER_CELLS = 2`.

---

## 5. Árbol de carpetas (actual)

```text
JuegoWeb/
├── docs/                      # Docs temáticas
│   ├── ARCHITECTURE.md
│   ├── GAMEPLAY.md
│   ├── DATABASE.md
│   ├── MOBILE.md
│   ├── POWERUPS.md
│   └── ROADMAP.md
├── supabase/migrations/       # SQL versionado (ejecutar en orden)
├── scripts/
│   ├── upload-level-images.mjs
│   └── generate-icons.mjs
├── public/
│   ├── icons/                 # PWA
│   └── levels/                # Fallback local level-N.png
├── src/
│   ├── app/App.tsx            # Router
│   ├── main.tsx
│   ├── components/            # OrientationGate, InstallBanner
│   ├── features/
│   │   ├── auth/              # Login, registro, AuthProvider, RequireAuth
│   │   ├── home/
│   │   ├── levels/
│   │   ├── gallery/
│   │   ├── admin/             # Panel contenido (rol admin)
│   │   └── game/              # Phaser
│   │       ├── core/          # GameConfig, GameEvents, constants
│   │       ├── scenes/GameScene.ts
│   │       ├── entities/      # Player, Enemy, PowerUp
│   │       ├── systems/       # Territory, Reveal, PowerUpSystem
│   │       ├── powerups/      # Registro tipo → efecto
│   │       └── input/VirtualJoystick.ts
│   ├── services/
│   │   ├── supabase/          # client, levels, storage, admin
│   │   ├── fullscreen/
│   │   └── pwa/
│   ├── types/                 # level.ts, database.ts
│   └── styles/global.css
└── DOCUMENTACION.md           # Este archivo
```

---

## 6. Rutas de la app

| Ruta | Acceso | Pantalla |
|---|---|---|
| `/` | Público | Home |
| `/login` | Público | Entrar |
| `/registro` | Público | Crear cuenta |
| `/levels` | Autenticado | Lista de niveles + progreso |
| `/play/:levelId` | Autenticado + nivel unlocked/completed | Partida Phaser |
| `/gallery` | Autenticado | Galería (blur si no completado) |
| `/admin` | Admin (`app_metadata.role`) | Lista de niveles (CRUD) |
| `/admin/levels/:levelId` | Admin | Crear/editar (`new` = alta) |

---

## 7. Gameplay (resumen)

### Loop

```text
Zona segura → trazar TRAIL por FREE → volver a CONQUERED →
flood-fill: regiones sin enemigos se conquistán → revelar imagen →
repetir hasta targetPct.
```

### Estados de celda

`FREE` | `CONQUERED` | `TRAIL`

### Derrota

- Enemigo toca al jugador (fuera de zona segura / sin escudo).
- Enemigo toca el **trail** (el escudo **no** protege el trail).
- Jugador cruza su propio trail.
- Sin vidas → `game:failed`.

### Cierre de región

1. Trail → conquered.
2. Flood-fill desde cada enemigo sobre FREE.
3. FREE no alcanzada por enemigos → conquered.
4. Recalcular `%` = conquistadas / interior.

Detalle y checklist: `docs/GAMEPLAY.md`. Tests: `TerritorySystem.test.ts`.

---

## 8. Power-ups

Declarados en `levels.config.powerUps` (JSONB). Arquitectura: registro exhaustivo en `src/features/game/powerups/registry.ts`.

| Tipo | Efecto | Parámetros típicos |
|---|---|---|
| `bomb` | Conquista radio + mata enemigos en zona | `radiusCells` |
| `lightning` | Mata en cadena al más cercano | `targets` |
| `shield` | Invulnerabilidad del **cuerpo** N ms | `durationMs` |
| `freeze` | Enemigos quietos N ms | `durationMs` |
| `speed` | Multiplicador velocidad (cap 1.6×) | `multiplier`, `durationMs` |
| `heart` | Suma vidas | `lives` |
| Imán / Fuego | Pendientes | — |

Spawn: celda FREE aleatoria, lejos del jugador, `delayMs` + `max` por tipo.

Admin: checkboxes al editar nivel (sin deploy).

Más detalle: `docs/POWERUPS.md`.

---

## 9. Móvil, fullscreen y PWA

- Viewport: `viewport-fit=cover`, `100dvh`, safe-area insets.
- Landscape táctil → overlay “Gira tu teléfono”.
- Fullscreen (Chrome/Android): al tocar un nivel; si sales → pausa + reentrar.
- iOS: sin Fullscreen API en canvas; PWA `standalone` = pantalla completa real.
- Install banner: solo **después** de completar un nivel (`beforeinstallprompt`).
- SW: precache shell; runtime cache de `/levels/*` y signed URLs de Supabase Storage.

Detalle: `docs/MOBILE.md`.

---

## 10. Supabase — visión general

Productos usados:

1. **Auth** — email/password, sesión persistente.
2. **PostgreSQL** — perfiles, niveles, progreso, RPC.
3. **Storage** — bucket privado `level-images`.
4. **RLS** — en todas las tablas expuestas.

Principios:

- Config de nivel = **JSONB**, no columnas rígidas.
- El cliente **no** escribe progreso directo: solo RPC `complete_level`.
- Admin = `auth.users.raw_app_meta_data.role = 'admin'` (**nunca** `user_metadata`).

---

## 11. Esquema de base de datos

### `public.profiles`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `auth.users.id`, cascade |
| `username` | text | 3–24, alfanumérico + `_`, único case-insensitive |
| `created_at` | timestamptz | default now() |

- Trigger `on_auth_user_created` → `handle_new_user()` crea perfil.
- RLS: SELECT/UPDATE solo dueño. INSERT vía trigger (security definer).

### `public.levels`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `sort_order` | int UNIQUE | orden y desbloqueo secuencial |
| `name` | text | |
| `config` | jsonb | gameplay (ver §12) |
| `image_path` | text | path en Storage (`level-N/full.png`) |
| `thumb_path` | text | path thumb (`level-N/thumb.png`) |
| `is_active` | boolean | default true |
| `created_at` | timestamptz | |

- Jugadores: SELECT solo `is_active = true`.
- Admin: SELECT/INSERT/UPDATE/DELETE vía `is_admin()`.

### `public.user_level_progress`

| Columna | Tipo | Notas |
|---|---|---|
| `user_id` | uuid | FK profiles |
| `level_id` | uuid | FK levels |
| PK | `(user_id, level_id)` | |
| `status` | text | `locked` \| `unlocked` \| `completed` |
| `best_pct` | numeric | |
| `best_time_ms` | int | |
| `attempts` | int | |
| `completed_at` | timestamptz | |
| `updated_at` | timestamptz | |

- SELECT solo dueño.
- **Sin** policies de escritura para `authenticated` → solo RPC / triggers.

### Vista `public.user_unlocked_images`

Imágenes con `status = 'completed'` (security_invoker).

### Triggers útiles

| Trigger | Efecto |
|---|---|
| Alta en `auth.users` | Crea `profiles` |
| Alta en `profiles` | Desbloquea el primer nivel activo |
| Alta en `levels` | Desbloquea el nuevo nivel a quien ya completó el anterior |

---

## 12. Formato de `levels.config` (JSONB)

```jsonc
{
  "targetPct": 60,
  "lives": 3,
  "playerSpeed": 280,
  "minTimeMs": 8000,   // anti-cheat: tiempo mínimo para complete_level
  "cellSize": 8,       // documentado; el motor usa CELL=16 en constants
  "enemies": [
    { "type": "basic", "speed": 200 }
  ],
  "powerUps": [
    {
      "type": "bomb",
      "spawn": { "delayMs": 8000, "max": 2 },
      "params": { "radiusCells": 10 }
    },
    {
      "type": "shield",
      "spawn": { "delayMs": 10000, "max": 2 },
      "params": { "durationMs": 5000 }
    }
    // lightning | freeze | speed | heart …
  ]
}
```

La URL de imagen **no** va en el JSON: se resuelve con `image_path` → signed URL.

---

## 13. RPC `complete_level`

```sql
complete_level(
  p_level_id uuid,
  p_pct numeric,
  p_time_ms int,
  p_session_payload jsonb default '{}'
) returns user_level_progress
```

`SECURITY DEFINER`, `search_path = ''`, execute solo `authenticated`.

Checks:

1. Usuario autenticado.
2. `pct` / `time_ms` válidos.
3. Nivel activo existe.
4. `pct >= config.targetPct`.
5. `time_ms >= config.minTimeMs` (default 5000).
6. Nivel anterior (`sort_order - 1`) en `completed` (si existe).
7. Progreso propio no `locked`.
8. Rate limit: ≤ 1 escritura de completado por nivel / minuto.
9. Upsert: `completed`, mejores marcas, `attempts++`.
10. Desbloquea siguiente nivel activo.

---

## 14. Storage

- Bucket: **`level-images`** (privado).
- Límite: 512 KB; MIME: png / webp / jpeg.
- Paths típicos: `level-1/full.png`, `level-1/thumb.png`.

### Políticas

| Quién | Qué |
|---|---|
| Autenticado | Leer **thumbs** de niveles activos |
| Autenticado + unlocked/completed | Leer **full** de ese nivel |
| Admin (`is_admin()`) | SELECT/INSERT/UPDATE/DELETE en el bucket |

Cliente: `createSignedUrl(path, 3600)`. Fallback: `/levels/level-N.png` en `public/`.

Subida masiva:

```bash
# .env con SUPABASE_SERVICE_ROLE_KEY
npm run upload:images
```

O desde Admin (usuario admin, RLS).

---

## 15. Migraciones SQL (orden de ejecución)

Ejecutar **en orden** en Supabase → SQL Editor (o CLI):

| Archivo | Fase | Contenido |
|---|---|---|
| `00001_profiles.sql` | 7 | Tabla profiles, RLS, trigger signup |
| `00002_levels.sql` | 8 | Tabla levels + seed nivel 1 |
| `00003_user_level_progress.sql` | 8 | Progreso, unlock 1º nivel, vista |
| `00004_complete_level.sql` | 8 | RPC complete_level |
| `00005_storage.sql` | 9 | Bucket + policies lectura |
| `00006_seed_level_2.sql` | 8 | Seed nivel 2 |
| `00007_level_image_paths_png.sql` | 9 | Paths `.png` |
| `00008_admin_policies.sql` | 11 | `is_admin()`, CRUD levels, storage admin, trigger unlock |

Los archivos en `supabase/migrations/` son la fuente de verdad del esquema.

---

## 16. Auth y roles

### Flujo jugador

1. Registro (`/registro`) → Auth + trigger perfil + unlock nivel 1.
2. Login → sesión en localStorage (persiste al cerrar navegador).
3. Rutas protegidas con `RequireAuth`.

### Promover admin

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'tu@email.com';
-- Debe devolver UPDATE 1
```

Luego **cerrar sesión y volver a entrar** (el JWT debe traer `app_metadata.role`).

Verificación:

```sql
select email, raw_app_meta_data ->> 'role' as role
from auth.users
where email ilike '%tu%';
```

En la app: `user.app_metadata.role === 'admin'` → botón Admin en Home.

---

## 17. Admin de contenido (Fase 11)

Sin tocar código ni redeploy:

1. Entrar como admin → **Admin**.
2. Crear/editar nivel: nombre, orden, activo, gameplay, power-ups.
3. Subir imagen completa (+ thumb opcional).
4. Guardar → aparece en `/levels` para jugadores.

Criterio: **nuevo nivel = datos**.

---

## 18. Roadmap v1 — estado

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Docs | ✓ |
| 1 | Bootstrap Vite/React/Phaser/PWA | ✓ |
| 2 | Prototipo jugable | ✓ |
| 3 | Flood-fill / conquista real | ✓ |
| 4 | Revelado de imagen | ✓ |
| 5 | Bomba | ✓ |
| 6 | Arquitectura power-ups + rayo | ✓ |
| 7 | Auth | ✓ |
| 8 | Niveles + progreso + RPC | ✓ |
| 9 | Storage + galería | ✓ |
| 10 | Fullscreen / PWA / safe areas | ✓ |
| 11 | Admin UI | ✓ |

### Fuera de alcance v1 (congelado)

- Tienda / monedas / economía.
- Multijugador / ranking social.
- Offline jugable completo.
- Anti-cheat avanzado (solo plausibilidad en RPC).
- Landscape / desktop como target principal.

### Posibles siguientes pasos

- Deploy producción (Vercel).
- Más niveles/imágenes vía Admin.
- Power-ups pendientes (imán, fuego).
- Más tipos de enemigo.

---

## 19. Seguridad (checklist breve)

- RLS en todas las tablas públicas.
- Progreso: sin INSERT/UPDATE directo desde el cliente.
- Admin solo por `app_metadata` (no editable por el usuario).
- `service_role` solo en scripts locales / servidor, nunca en el bundle.
- Funciones `SECURITY DEFINER` con `search_path = ''` y revoke a `public` donde aplica.
- Signed URLs de Storage con TTL; full image solo si unlocked/completed.

---

## 20. Docs relacionadas

| Archivo | Tema |
|---|---|
| `docs/ARCHITECTURE.md` | Stack, frontera React↔Phaser |
| `docs/GAMEPLAY.md` | Grid, flood-fill, casos límite |
| `docs/DATABASE.md` | Esquema y principios DB |
| `docs/MOBILE.md` | Viewport, touch, fullscreen, PWA |
| `docs/POWERUPS.md` | Arquitectura y catálogo de power-ups |
| `docs/ROADMAP.md` | Fases y alcance |
| `docs/NEGOCIO.md` | Pase de temporada, precios CLP, reglas free/pago |
| `CLAUDE.md` | Contexto rápido para agentes/IDE |
| `DOCUMENTACION.md` | **Este documento (visión completa)** |

---

## 21. Checklist de arranque en un proyecto Supabase nuevo

1. Crear proyecto Supabase.
2. Copiar `.env.example` → `.env` con URL + anon key.
3. Ejecutar migraciones `00001` … `00008` en orden.
4. (Opcional) Desactivar “Confirm email” en Auth para desarrollo.
5. `npm install && npm run dev -- --host`.
6. Registrarse; comprobar fila en `profiles`.
7. `npm run upload:images` **o** subir desde Admin tras promover admin.
8. Promover admin (SQL §16) → re-login → crear niveles.

---

*Fin del documento maestro. Si hay conflicto entre este archivo y el código, prevalece el código + las migraciones SQL en `supabase/migrations/`.*
