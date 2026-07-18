# ARQUITECTURA

Juego web móvil HTML5 de conquista de territorio (estilo Qix/Gals Panic), jugable
desde el navegador de un smartphone en vertical, sin instalación.

## Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| Shell / UI | React 18 + TypeScript + Vite | Menús, login, galería; ecosistema maduro |
| Motor de juego | Phaser 3 + TypeScript | Game loop, física arcade, render WebGL/Canvas |
| Backend | Supabase (Auth, PostgreSQL, Storage, RLS) | Backend gestionado, sin servidor propio |
| PWA | vite-plugin-pwa | Manifest + Service Worker con mínimo esfuerzo |
| Hosting | Vercel | Deploy estático de Vite, previews por rama |

## Frontera React ↔ Phaser (regla de oro)

**Phaser es dueño del gameplay. React es dueño de todo lo demás.**

- Phaser: game loop, movimiento, colisiones, enemigos, power-ups, sistema de
  territorio, revelado de imagen, HUD interno del nivel.
- React: router, login/registro, selección de niveles, galería, perfil,
  configuración, modales de resultado (fuera del canvas).
- React **nunca** lee ni escribe estado de Phaser por frame. Phaser **nunca**
  llama a Supabase directamente.

### Comunicación: Event Bus tipado

Un único `EventEmitter` compartido (`GameEvents.ts`) con contrato explícito:

```ts
// React → Phaser
'game:start'        { levelConfig: LevelConfig, imageUrl: string }
'game:pause' | 'game:resume' | 'game:quit'

// Phaser → React
'game:progress'     { conqueredPct: number }   // throttled, no por frame
'game:life-lost'    { livesLeft: number }
'game:completed'    { stats: LevelResultStats }
'game:failed'       { stats: LevelResultStats }
'game:ready'        {}
```

Ciclo de vida: React monta `<GameCanvas>` → crea la instancia de Phaser →
emite `game:start` con la config del nivel (descargada por React desde
Supabase) → Phaser juega → emite `game:completed` → React persiste el
resultado en Supabase y navega a la pantalla de resultado.

## Árbol de carpetas

```text
src/
├── app/                # Router, providers (Auth, Query), config global
├── components/         # UI React reutilizable (botones, modales, loading)
├── features/
│   ├── auth/           # Login, registro, sesión (React)
│   ├── levels/         # Lista/selección de niveles (React)
│   ├── gallery/        # Galería de imágenes desbloqueadas (React)
│   └── game/           # TODO el código Phaser
│       ├── core/       # GameConfig, GameBootstrap, GameEvents (event bus)
│       ├── scenes/     # Boot, Preload, Game, Result
│       ├── entities/   # Player, Enemy, PowerUp
│       ├── systems/    # Territory, Reveal, Collision, Enemy, PowerUp, Progression
│       └── input/      # TouchInput, VirtualJoystick
├── services/
│   ├── supabase/       # Cliente, queries tipadas, tipos generados
│   ├── fullscreen/     # FullscreenService
│   └── pwa/            # Registro SW, prompt de instalación
├── types/              # Tipos compartidos (LevelConfig, etc.)
└── utils/
docs/                   # Esta documentación
supabase/               # Migraciones SQL versionadas
```

Regla anti-sobre-ingeniería: una carpeta/abstracción solo existe cuando la usa
código real. Los `systems/` de Phaser nacen en la fase que los necesita, no antes.

## Decisiones clave (y por qué)

1. **Territorio basado en grid, no en geometría vectorial.** El campo de juego
   es una matriz de celdas (~8 px lógicos). Cierre de regiones por flood-fill.
   Es la decisión más importante del proyecto: simple, robusta ante casos
   límite, y el grid alimenta directamente la máscara de revelado. Ver
   `GAMEPLAY.md`.
2. **Revelado por máscara de textura** derivada del mismo grid (una
   `RenderTexture` como máscara de la imagen). Una sola fuente de verdad.
3. **Config de nivel como JSON en PostgreSQL** (`levels.config`): enemigos,
   power-ups, porcentaje objetivo. El contenido crece sin tocar código.
4. **Validación server-side de recompensas** vía RPC de PostgreSQL con checks
   de plausibilidad; Edge Functions solo si se demuestra necesidad. Ver
   `DATABASE.md`.
5. **Resolución lógica fija en vertical** (ej. 720×1280) con `Phaser.Scale.FIT`;
   React posiciona el canvas respetando safe areas. Ver `MOBILE.md`.
