# EXPERIENCIA MÓVIL — Portrait, touch, fullscreen, PWA

## Principio

El único target de diseño es un smartphone en vertical. Desktop se soporta
"de regalo" (canvas centrado con letterbox), nunca al revés.

## Viewport y layout

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1,
               viewport-fit=cover, user-scalable=no">
```

```css
#app { height: 100dvh; min-height: 100dvh; }        /* nunca 100vh solo */
.safe { padding: env(safe-area-inset-top) ... ; }    /* notch / home bar */
html, body { overscroll-behavior: none; }            /* sin pull-to-refresh */
canvas { touch-action: none; }                       /* sin scroll/zoom en juego */
```

- Resolución lógica del juego: **720×1280** (9:16), `Phaser.Scale.FIT` +
  `autoCenter`. En pantallas más altas (19.5:9) React rellena con la UI de
  HUD/controles, no se estira el juego.
- Prevención de zoom por doble tap: `touch-action: manipulation` en la UI,
  `none` en el canvas.
- Detectar orientación landscape → overlay "gira tu teléfono" (CSS media
  query, no JS del juego).

## Touch

- **Pointer Events** en todo (unifica touch/mouse/pen); nada de `touchstart`
  suelto salvo para `preventDefault` de gestos.
- Control principal: **joystick virtual flotante** — aparece donde el pulgar
  toca el tercio inferior de la pantalla, dead-zone pequeña, radio limitado,
  8 direcciones o analógico según pruebas de la Fase 2.
- Multi-touch: el joystick reserva su pointer id; un segundo dedo puede
  activar botón de acción futuro sin conflicto.
- Objetivo táctil mínimo 48 px.

## Fullscreen (FullscreenService)

Estrategia por capas, degradando sin romper nada:

1. **Chrome/Android**: `requestFullscreen()` en el gesto del botón JUGAR
   (requiere user gesture). Escuchar `fullscreenchange`; si el usuario sale,
   pausar y ofrecer botón de reingreso.
2. **iOS Safari**: la Fullscreen API **no existe para elementos div/canvas**.
   Plan: layout 100dvh + `viewport-fit=cover` (la barra de Safari se
   auto-oculta al hacer scroll-lock) y promover la instalación PWA, que en
   iOS sí da pantalla completa real (`display: standalone`).
3. Sin soporte alguno: el juego funciona igual dentro del viewport.

API del servicio: `isSupported()`, `request(el)`, `exit()`,
`onChange(cb)` — con try/catch, jamás lanza al llamador.

## PWA (opcional, nunca requisito)

- `vite-plugin-pwa`, estrategia `autoUpdate`.
- Manifest: `display: standalone`, `orientation: portrait`, iconos 192/512
  + maskable, theme color.
- Service Worker: precache del shell (HTML/JS/CSS); imágenes de niveles con
  cache runtime (stale-while-revalidate). El juego **online-first**: sin
  conexión se puede abrir el shell, pero jugar requiere red en v1.
- Prompt de instalación propio (capturar `beforeinstallprompt`), mostrado
  solo tras completar el primer nivel — nunca al entrar.

## Performance (presupuesto)

- 60 fps en un Android de gama media de ~2022; probar con CPU throttling 4×.
- Assets iniciales < 3 MB; imagen de nivel se descarga al seleccionarlo
  (thumb en la lista, full al entrar).
- Reveal por máscara: repintar la RenderTexture solo en cierres de región y
  explosiones, no por frame.

## Matriz de pruebas (Fase 10)

- Chrome Android (principal), Safari iOS, Firefox Android.
- Con y sin notch; con barra de navegación por gestos y por botones.
- PWA instalada vs. navegador.
