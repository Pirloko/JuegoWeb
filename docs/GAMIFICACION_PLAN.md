# PLAN — Gamificación y contenido enriquecido (puntocachero)

Plan maestro del sistema de progresión/retención. Se actualiza al cerrar
cada fase. Regla: una fase no empieza hasta que la anterior está `hecho`
con `npm run build`, `npm run lint` y `npm run test` verdes.

## Modelo mental

Loop de retención (escala sobre el loop actual "pasar nivel → ver foto"):

```
conquistar territorio → revelar contenido (foto/GIF/video)
      → visitar el origen (source_url) → dejar reseña firmada
      → coleccionar (galería + medallas) → siguiente meta visible
```

Principios heredados del repo que este plan respeta:

- Phaser dueño del gameplay; React del shell; event bus tipado. Phaser no
  llama a Supabase y **no cambia** en este plan (solo sigue revelando una
  imagen estática; el video/GIF completo se reproduce en React).
- El cliente nunca decide recompensas → medallas se otorgan en RPC
  `SECURITY DEFINER` que recomputa desde `user_level_progress`.
- RLS en toda tabla nueva; esquema solo vía `supabase/migrations/*.sql`.
- Grid/progreso como fuente de verdad; galería derivada de progreso.
- Mobile-first portrait, `100dvh`, Pointer Events.

## Preguntas previas (método del proyecto)

1. **Problema real**: el progreso hoy es frío (`1/70`, ★★★ binarias) y el
   loop muere al revelar la foto. Falta meta próxima visible, colección con
   identidad y un "después" del revelado (origen + reseña).
2. **Lo más pequeño que lo resuelve**: progresión/hitos como funciones puras
   - un componente de barra (sin esquema); medallas como derivación del
     progreso existente (una tabla de otorgamientos, catálogo visual en TS);
     media mixta como columnas nuevas en `levels` + convención de paths ya
     cubierta por la policy `can_read_level_image` (`level-{n}/%`); reseñas
     como una tabla con RLS y una función de lectura con username.
3. **Qué se puede romper**: `LevelRow`/`LevelWriteInput` (admin, levels,
   gallery, game los importan); el retorno de `complete_level` (no se toca);
   storage RLS para paths nuevos de video (la rama `level-{n}/%` ya los
   gatea a unlocked); galería que asume `<img>`.
4. **Casos límite**: usuario con 0 completados; temporada sin niveles; media
   que falla al cargar (fallback a poster/imagen); reseña vacía/larguísima/
   duplicada; lector sin el nivel revelado pidiendo reseñas; nivel borrado
   con reseñas (cascade); sin conexión (la UI ya degrada con try/catch).
5. **Verificación**: vitest para lógica pura (hitos, estrellas, validación
   de reseña), build+lint verdes por fase, prueba manual mobile del flujo
   completar → celebrar → galería → reseña. Las migraciones se aplican con
   `supabase db push` (decisión del dueño del proyecto, no automática).
6. **NO hacemos** (a propósito): ranking/leaderboards/comparación entre
   jugadores, perfiles públicos, chat/amigos, drops aleatorios que compitan
   con el revelado, APK, reescritura del gameplay, economía/monedas.

## Decisiones de diseño (tomadas, con motivo)

- **Estrellas reales por nivel** (hoy ★★★ = completed): función pura
  `starsForLevel(bestPct, targetPct)` → 1★ completar, 2★ `bestPct ≥
targetPct + 15`, 3★ `bestPct ≥ 95`. Testeable, sin esquema nuevo
  (`best_pct` ya existe). La misma regla se replica en SQL para la medalla
  de 3★ (comentario cruzado en ambos lados).
- **Catálogo de medallas en TS, otorgamientos en DB**: el copy/ícono/nombre
  vive en `badgeCatalog.ts` (tipado, tono cachero); la DB solo guarda
  `user_badges(user_id, badge_id, awarded_at)`. La elegibilidad la decide
  la RPC `award_badges()` (server-authoritative, idempotente) que React
  llama tras `complete_level`. Evita tabla-catálogo + admin UI innecesarios.
- **Frontera de media**: Phaser recibe siempre una imagen (poster) y su
  máscara de revelado no cambia. El video/GIF completo se reproduce en
  React: overlay de resultado y detalle de galería. `<video playsinline
muted autoplay loop controls>` para políticas iOS/Android; fallback a
  poster si el media falla.
- **Reseñas: 1 por usuario por nivel** (`unique(level_id, user_id)`), con
  editar/borrar propia. Simplifica UX y es el anti-spam principal; se suma
  rate limit por trigger (máx 10 altas/hora por usuario). Lectura vía
  función `SECURITY DEFINER` `get_level_reviews(level_id)` que gatea por
  "lector tiene el nivel completado" y expone `username` sin abrir la RLS
  de `profiles` (que es select-own).
- **`source_url` opcional** en `levels`; si es null la UI no muestra CTA.
  Solo `http(s)`, validado en admin UI + check constraint. Se abre con
  `target="_blank" rel="noopener noreferrer"`.
- **Copy de marca**: "revela el contenido oculto" reemplaza a "la imagen"
  donde aplique; celebraciones cortas tipo "wena cachero", sin spam de
  emojis. Set centralizado en `src/features/progression/copy.ts`.

---

## Fase G1 — Progresión visible + hitos (sin esquema)

**Objetivo**: que el jugador siempre vea cuánto lleva, cuánto falta para el
próximo hito y una meta cercana en una frase.

**Alcance**

- Sí: módulo puro de progresión (hitos `5/10/25/50/70`, próximo hito,
  estrellas por nivel, frases de meta cercana); componente `SeasonProgress`
  (barra + hito) en Inicio y Niveles; estrellas 1–3 reales en la lista de
  niveles; tests vitest de la lógica pura.
- No: nada de DB, nada de medallas todavía, no rediseñar pantallas.

**Archivos (estimado)**

- Nuevo: `src/features/progression/progression.ts`, `progression.test.ts`,
  `copy.ts`, `SeasonProgress.tsx`, `season-progress.css`.
- Tocados: `HomeScreen.tsx`, `LevelsScreen.tsx` (+css puntual).

**Criterios de aceptación**

- [x] Barra de temporada con % y `X/Y` en Inicio y Niveles.
- [x] "Próximo hito" correcto en los bordes (0, exacto en hito, 70/70).
- [x] Frase de meta cercana con tono de marca en Inicio.
- [x] Estrellas 1–3 según `best_pct` en niveles completados, con tests.
- [x] Build + lint + test verdes.

**Estado**: `hecho`

---

## Fase G2 — Medallas (colección personal, no social)

**Objetivo**: colección de logros propia, visible en Perfil, celebrada al
ganarse.

**Alcance**

- Sí: migración `00015_user_badges.sql` (tabla + RLS select-own + RPC
  `award_badges()` idempotente); catálogo TS con copy cachero; servicio
  `badges.ts`; sección "Logros" en Perfil (`/logros`); toast/celebración de
  medalla nueva en el overlay de resultado tras `complete_level`.
- Medallas v1: `first_conquest` (1er nivel), `three_stars` (primer 3★),
  `free_block` (1–7 de una temporada), `season_10`, `season_25`,
  `season_50`, `season_70` (hitos de temporada). `first_special` (primer
  GIF/video) se define aquí pero se activa en G3.
- No: medallas comparativas, contadores públicos, admin UI de medallas.

**Criterios de aceptación**

- [x] `award_badges()` otorga solo lo elegible, nunca duplica, y devuelve
      las nuevas para celebrarlas.
- [x] RLS: un usuario solo lee sus medallas; sin escritura directa.
- [x] Pantalla Logros con ganadas/pendientes (pendientes sin spoiler raro).
- [x] Al completar nivel que gana medalla → celebración corta con copy.
- [x] Build + lint + test verdes.

**Estado**: `hecho`

---

## Fase G3 — Media mixta por nivel (foto / GIF / video)

**Objetivo**: el admin marca niveles especiales cuyo contenido oculto es un
GIF o video corto (≤20 s); el jugador lo revela y lo colecciona.

**Alcance**

- Sí: migración `00016_level_media.sql` (`media_type` check
  `image|gif|video` default `image`, `media_path` nullable; mime/size del
  bucket si hace falta); admin UI (selector de tipo, upload con validación
  de duración ≤20 s y peso; poster sigue obligatorio); reproducción en
  React (overlay de resultado y visor de galería) con fallback a poster;
  indicador sutil de tipo en lista de niveles y filtros/badges en galería;
  copy "contenido oculto"; medalla `first_special` activa.
- No: cambios en Phaser (sigue revelando el poster `image_path`); streaming
  o transcodificación server-side (archivo tal cual, límites de peso).

**Criterios de aceptación**

- [x] Admin puede crear/editar nivel `image|gif|video` y subir media ≤20 s.
- [x] Storage RLS: media completa solo con nivel unlocked/completed
      (convención `level-{n}/`); thumb visible siempre.
- [x] Al completar nivel especial, el video/GIF se reproduce inline en
      mobile (muted/playsinline) con fallback elegante.
- [x] Galería mixta: badges de tipo + filtro; visor reproduce el media.
- [x] Build + lint + test verdes.

**Estado**: `hecho`

---

## Fase G4 — Origen del contenido + reseñas

**Objetivo**: cerrar el loop: visitar de dónde viene el contenido y dejar
una reseña firmada con username, anclada al nivel.

**Alcance**

- Sí: migración `00017_source_url_reviews.sql` (`levels.source_url`;
  `level_reviews` con unique por usuario+nivel, checks de longitud, RLS
  escribir-propio-si-completado, admin borra cualquiera, rate limit por
  trigger; `get_level_reviews()` security definer con username); admin UI
  campo `source_url`; visor de galería: CTA "ver origen" + lista de
  reseñas + crear/editar/borrar la propia; validación pura de reseña con
  tests.
- No: muro social global, reseñas sobre niveles no revelados, respuestas
  anidadas, likes.

**Criterios de aceptación**

- [x] CTA al origen solo si hay `source_url` y el nivel está revelado.
- [x] Reseña: crear/editar/borrar la propia con username visible; 1 por
      nivel; longitud 3–500; rate limit.
- [x] RLS verificada: sin completar el nivel no se leen ni escriben
      reseñas de ese nivel; admin puede moderar (borrar).
- [x] Build + lint + test verdes.

**Estado**: `hecho`

---

## Fase G5 — Cierre: docs, copy y verificación global

**Objetivo**: dejar el repo coherente con lo construido.

**Alcance**: actualizar `docs/DATABASE.md` (tablas/RPC nuevas),
`docs/ROADMAP.md` (alcance v1 ampliado con gamificación, manteniendo el
"NO hace" de ranking/social), pasada de copy de marca, checklist global de
criterios del handoff, smoke test manual del flujo completo.

**Criterios de aceptación**

- [x] Docs actualizadas y consistentes con migraciones 00015–00017.
- [x] Checklist global del handoff repasada en este archivo.
- [x] Build + lint + test verdes.

**Estado**: `hecho`

---

## Checklist global del handoff (estado al cierre)

- [x] Existe `docs/GAMIFICACION_PLAN.md` con fases y estado actualizado.
- [x] Progresión de temporada con barra + próximo hito (Inicio y Niveles).
- [x] Medallas se otorgan (RPC) y se listan en Perfil → Logros (solo propias).
- [x] Admin puede marcar image/gif/video, subir media ≤20 s y `source_url`.
- [x] Nivel especial revela GIF/video en React con fallback a poster.
- [x] Galería mixta (badges de tipo + filtros) revelado/bloqueado.
- [x] Jugador abre el origen tras revelar (CTA con rel seguro).
- [x] Reseña propia: crear/editar/borrar con username visible.
- [x] Cero features de ranking/comparación entre jugadores.
- [x] Build + lint + test verdes.
- [x] Migraciones 00015–00018 aplicadas con `supabase db push` (2026-07-18;
  hubo que reparar el historial remoto: 00001–00014 estaban aplicadas sin
  registrar). Smoke test server-side vía REST con cuenta de prueba
  (`carlos.etier.cc+smoketest@gmail.com`): complete_level → medallas
  (first_conquest + three_stars, idempotente) → gates de reseñas (RLS
  bloquea nivel no revelado, longitud, trim, username, editar/borrar
  propia). Un bug real cazado y corregido: 00018 (badge_id ambiguo en
  award_badges). Falta solo el smoke visual en teléfono (barra/medallas/
  galería) y probar un nivel gif/video real cuando el admin suba uno.

## Registro de decisiones tomadas durante la implementación

- (G1) La barra vive en un componente único `SeasonProgress` con variante
  compacta (Niveles) y completa (Inicio) para no duplicar markup.
- (G1) Estrellas: umbrales 2★ = target+15 (cap 100) y 3★ = 95 fijos; si un
  nivel tiene target ≥ 95, 3★ = completar con ≥ target.
- (G2) `award_badges()` se llama tras cada `complete_level` exitoso; si la
  llamada falla, la medalla se otorgará en el próximo completado (la RPC
  recomputa todo, no depende del evento).
- (G2) `three_stars` en SQL usa la misma regla que `starsForLevel` (TS);
  comentario cruzado en `progression.ts` y `00015_user_badges.sql`.
- (G3) GIF se sirve como `.gif` en `<img>`; video como `.mp4|.webm` en
  `<video>`. Límite de peso de media: 12 MB (constante compartida en
  `prepareLevelMedia.ts`); duración validada client-side con metadata.
- (G3) `media_path` usa la convención `level-{n}/media.<ext>` para caer en
  la rama `level-{n}/%` de `can_read_level_image` (gate por unlocked) sin
  tocar la policy.
- (G4) Lectura de reseñas gateada por "lector completó el nivel" — más
  estricto que unlocked, coherente con "contenido revelado".
- (G4) `get_level_reviews` devuelve también `user_id` para que el cliente
  marque "la mía" sin otra query; el username sale del join en la función
  (security definer), sin abrir la RLS de profiles.
- (G5) `docs/DATABASE.md` documenta 00015–00017; el "NO hace" del roadmap
  se mantiene y se le añade explícitamente "sin ranking ni comparación
  entre jugadores" como decisión de producto de la gamificación.
