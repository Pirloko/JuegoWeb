# GAMEPLAY — Sistema de conquista

## Loop principal

```text
Salir de zona segura → trazar ruta por territorio libre → volver a zona
segura → la región encerrada se conquista → se revela la imagen → repetir
hasta alcanzar el % objetivo del nivel.
```

Derrota: un enemigo toca al jugador o su ruta activa, o el jugador cruza su
propia ruta, o se agota el tiempo → **nivel fallido** y se pierde **1 corazón**
(salvo pase activo). Ya no hay vidas in-match separadas: corazones = vidas.

## Modelo: grid de celdas

El área de juego es una matriz (`cols × rows`, celda ≈ 8 px lógicos).
Cada celda tiene un estado:

```ts
enum CellState { FREE, CONQUERED, TRAIL }
```

- Estado inicial: borde exterior `CONQUERED` (zona segura perimetral),
  interior `FREE`. El borde se pinta de color sólido (no perfora la foto).
- En partida Phaser usa la **full** nítida bajo la niebla. Media especial
  (GIF/video) solo tras completar.
- El jugador se mueve en coordenadas continuas pero el sistema muestrea su
  posición a celdas.
- Sobre `CONQUERED` el jugador está a salvo. Al entrar en `FREE` empieza a
  marcar `TRAIL`.

## Cierre de región (el algoritmo crítico)

Cuando el jugador vuelve a una celda `CONQUERED` con un trail activo:

1. Convertir todas las celdas `TRAIL` en `CONQUERED`.
2. Flood-fill desde la posición de **cada enemigo** sobre celdas `FREE`:
   toda región alcanzada por algún enemigo permanece `FREE`.
3. Toda región `FREE` **no** alcanzada por ningún enemigo pasa a `CONQUERED`
   (regla Gals Panic: se conquista lo que queda sin enemigos; funciona con
   múltiples regiones y múltiples enemigos sin casos especiales).
4. Recalcular porcentaje: `conquistadas / total_interior`.
5. Notificar a `RevealSystem` (máscara) y a `ProgressionSystem` (% y victoria).

Complejidad O(celdas) por cierre; con un grid de 90×140 es despreciable.

## Casos límite (checklist de pruebas de la FASE 3)

Los marcados con (test) están cubiertos por `TerritorySystem.test.ts`.

- [x] El jugador toca su propio trail → pierde vida siempre (ignora el
      periodo de gracia post-respawn), trail se borra, vuelve al spawn.
- [x] Un enemigo toca el trail activo → vida perdida (muestreo de 5 puntos
      del círculo del enemigo por frame).
- [x] (test) Ruta mínima de 1 celda → conquista solo esa celda, estado sano.
- [x] (test) Ruta que encierra al enemigo por ambos lados → ambas regiones
      vacías caen, la del enemigo sobrevive.
- [x] (test) Múltiples enemigos en regiones distintas → ninguna se conquista.
- [x] (test) Cierre contra una península ya conquistada (no solo el borde).
- [x] (test) Enemigo con centro en celda no-libre (o fuera del grid) en el
      instante del cierre → flood-fill anclado a la libre más cercana; y si
      queda atrapado en lo conquistado, la escena lo recoloca.
- [x] (test) Power-up bomba explotando sobre trail activo → el trail
      sobrevive intacto (conquerCells solo toca celdas libres), sin pérdida
      de vida.
- [x] % objetivo alcanzado en mitad de un cierre → victoria una sola vez
      (flag `finished` + corte del update).

## Enemigos

Entidad `Enemy` con dos comportamientos (`EnemyConfig.type`, en la config del
nivel):

- `basic` — rebote diagonal dentro del área `FREE` (Qix clásico).
- `chase` — rebota igual, pero **mientras el jugador tiene trazo abierto** gira
  hacia él para cortarlo. En zona segura vuelve al rebote: el respiro se
  mantiene. Giro limitado (`CHASE_TURN_RATE`) para que se pueda esquivar, y
  tras rebotar en un muro deja de corregir un instante para no vibrar contra el
  borde. Se distingue por su aura roja.

Restricción clave: los enemigos solo se mueven por celdas `FREE` — el
territorio conquistado los encierra progresivamente.

## Curva de dificultad por temporada

`src/features/progression/levelCurve.ts` decide la config según el **puesto**
del nivel dentro de su temporada, no según su contenido: el nivel 5 de Julio se
siente como el 5 de Agosto. Sube meta de conquista, baja el cronómetro, suma
enemigos hasta un tope de 7 (y perseguidores desde el 10) y estrena un
power-up cada pocos slots.

`SEASON_CURVE_SLOTS` (30) es solo el punto donde la curva llega a su tope; no
hay límite de niveles por temporada — más allá se mantiene el tramo final.

## Revelado de imagen

- La imagen del nivel se carga desde Supabase Storage (URL en la config).
- Se dibuja completa bajo una capa de cobertura; una `RenderTexture` usada
  como máscara se pinta a partir del grid: celda `CONQUERED` = zona visible.
- El grid es la única fuente de verdad: conquista y revelado no pueden
  desincronizarse.
- Al completar el nivel, animación de revelado total + registro del
  desbloqueo en backend.

## Victoria / derrota

- Victoria: `conqueredPct >= level.config.targetPct` (típico 75–80 %).
- Derrota: vidas = 0, **o** se acaba el cronómetro (`timeLimitSec`).
- Cronómetro: `timeLimitSec` en `levels.config` (default **120**). `0` = sin
  límite. El power-up Reloj (`clock`, `params.addSec`) suma segundos al
  tiempo restante.
- Al terminar, Phaser emite `game:completed` / `game:failed` con stats
  (tiempo, %, power-ups usados); React persiste y muestra resultado.
