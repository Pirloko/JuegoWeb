# ROADMAP POR FASES

Regla: una fase no empieza hasta que la anterior corre, está probada y
committeada. `npm run build` verde al final de cada fase.

## Lo que la v1 NO hace (alcance congelado)

- Sin tienda, monedas ni economía.
- Sin multijugador, ranking global ni social.
- Sin modo offline jugable (el shell PWA carga, jugar requiere red).
- Sin panel de administración con UI (el contenido se administra por SQL/
  migraciones hasta la Fase 11).
- Sin anti-cheat avanzado (solo validación de plausibilidad server-side).
- Sin soporte landscape ni desktop optimizado.
- Un solo tipo de enemigo y un solo power-up (bomba) hasta las fases 6+.

## Fases

| Fase   | Entregable                                                                                               | Criterio de aceptación                                                 |
| ------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **0**  | Docs de arquitectura (este directorio) + repo                                                            | Decisiones clave escritas; riesgos identificados                       |
| **1**  | Bootstrap: Vite + React + TS + Phaser + ESLint/Prettier + env + PWA base + deploy "hola" en Vercel       | `npm install && npm run dev && npm run build` verdes; URL pública viva |
| **2**  | Prototipo jugable: canvas vertical, jugador, joystick táctil, 1 enemigo, trail, conquista básica, muerte | Se puede jugar en un teléfono real y "se siente" bien                  |
| **3**  | Sistema real de conquista: flood-fill, regiones múltiples, %, victoria/derrota                           | Checklist de casos límite de GAMEPLAY.md en verde                      |
| **4**  | Revelado de imagen: máscara desde el grid, imagen de prueba, nivel completado                            | Cambiar la imagen no toca código de gameplay                           |
| **5**  | Power-up bomba completo                                                                                  | Flujo validable de POWERUPS.md en verde                                |
| **6**  | Arquitectura genérica de power-ups (+ los siguientes, uno a uno)                                         | Añadir un power-up no toca el núcleo                                   |
| **7**  | Supabase Auth: registro, login, logout, sesión, rutas protegidas                                         | Sesión persiste tras cerrar el navegador                               |
| **8**  | Niveles y progreso: lista, bloqueo secuencial, RPC `complete_level`, intentos/mejor %                    | RLS impide escribir progreso ajeno o directo                           |
| **9**  | Imágenes en Storage + galería (bloqueada/desbloqueada)                                                   | Signed URLs solo para imágenes desbloqueadas                           |
| **10** | Fullscreen, PWA instalable, safe areas, performance                                                      | Matriz de pruebas de MOBILE.md en verde                                |
| **11** | Administración de contenido (niveles/imágenes sin tocar código)                                          | Crear nivel nuevo = datos, cero deploy                                 |

Las fases de gamificación (G1–G5: progresión visible + hitos, medallas,
media mixta foto/GIF/video, origen del contenido + reseñas) viven en
`docs/GAMIFICACION_PLAN.md`. Amplían la v1 sin tocar el alcance congelado:
sigue sin haber ranking, comparación entre jugadores ni social abierto —
las reseñas son conversación anclada al contenido revelado, no un muro.

**Admin (post-Fase 11):** shell separado sin gameplay. Dashboard en `/admin`
con métricas vía `admin_dashboard_stats` + `game_sessions`; contenido en
`/admin/niveles|seasons|sitios`; suscripciones en `/admin/suscripciones`.
Admins no acceden a Niveles/Galería/Jugar del jugador.

## Riesgos técnicos principales

1. **Algoritmo de cierre de regiones** — el corazón del juego; si falla, no
   hay juego. Mitigación: grid + flood-fill (simple y testeable), fase 3
   dedicada solo a esto con checklist de casos límite y tests unitarios del
   sistema puro (sin Phaser).
2. **iOS Safari** — sin Fullscreen API para canvas, viewport caprichoso,
   audio restringido. Mitigación: estrategia por capas de MOBILE.md; nunca
   depender de fullscreen para que el juego sea jugable.
3. **Performance del revelado en gama baja** — repintar máscaras es caro.
   Mitigación: RenderTexture actualizada solo en eventos, presupuesto de
   60 fps con throttling 4× desde la Fase 4.
4. **Confianza en el cliente** — todo el gameplay es JS del navegador.
   Mitigación: RPC con checks de plausibilidad (DATABASE.md); aceptar
   explícitamente que v1 no es a prueba de tramposos dedicados.
5. **Scope creep** — el prompt describe ~7 power-ups, 5 enemigos, admin, etc.
   Mitigación: la lista "NO hace" de arriba y desarrollo estrictamente por
   fases.
6. **Latencia/red móvil** — imágenes pesadas en 4G. Mitigación: thumbnails,
   descarga al seleccionar nivel, límite de peso por imagen (< 400 KB webp).
