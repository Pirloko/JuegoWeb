# JuegoWeb — juego web móvil de conquista de territorio

Arcade tipo Qix/Gals Panic: React (shell) + Phaser 3 (gameplay) + TypeScript
+ Vite + Supabase. Mobile-first, portrait, touch, PWA opcional, sin APK.

## Estado

Fase 0 completada (documentación). Siguiente: Fase 1 (bootstrap Vite).
El roadmap completo y el alcance congelado de v1 están en `docs/ROADMAP.md`.

## Comandos

Todavía no hay proyecto Vite. Tras la Fase 1 serán:

```bash
npm install
npm run dev      # servidor local
npm run build    # build de producción (debe estar verde antes de cada commit)
npm run lint
```

## Documentación (leer antes de tocar el área correspondiente)

- `docs/ARCHITECTURE.md` — stack, frontera React↔Phaser, event bus, árbol de carpetas
- `docs/GAMEPLAY.md` — sistema de conquista por grid + flood-fill, casos límite
- `docs/DATABASE.md` — esquema Supabase, RLS, RPC `complete_level`
- `docs/MOBILE.md` — viewport/dvh, touch, fullscreen por capas, PWA
- `docs/POWERUPS.md` — bomba y arquitectura extensible
- `docs/ROADMAP.md` — fases, criterios de aceptación, riesgos, lo que v1 NO hace

## Convenciones

- Desarrollo estrictamente por fases; no adelantar features de fases futuras.
- Phaser es dueño del gameplay; React del shell. Comunicación solo por el
  event bus tipado (`GameEvents.ts`). React nunca toca estado de Phaser por
  frame; Phaser nunca llama a Supabase.
- El grid de territorio es la única fuente de verdad (conquista, revelado, %).
- Config de niveles vive en la base de datos (JSONB), nunca hardcodeada.
- Cambios de esquema solo vía `supabase/migrations/*.sql`.
- Diseño solo portrait/touch; `100dvh` (nunca `100vh` solo), Pointer Events.
- TypeScript estricto; sin abstracciones para problemas que aún no existen.
