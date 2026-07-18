# POWER-UPS

## Modelo de datos

Los power-ups de un nivel se declaran en `levels.config.powerUps`:

```jsonc
{
  "type": "bomb",
  "spawn": { "mode": "random-free", "delayMs": 10000, "max": 2 },
  "params": { "radiusCells": 12, "damage": 999, "revealCounts": true }
}
```

## Arquitectura extensible

```ts
interface PowerUpEffect {
  readonly type: PowerUpType;
  apply(ctx: PowerUpContext): void;   // ctx: grid, enemies, player, reveal, fx
}
```

- `PowerUpSystem`: spawn (solo en celdas FREE), colisión con jugador,
  consumo, y despacho a un registro `Map<PowerUpType, PowerUpEffect>`.
- Añadir un power-up nuevo = una clase efecto + una entrada en el registro +
  config JSON. Cero cambios en el núcleo.
- La abstracción genérica se construye en la Fase 6, **después** de validar
  la bomba concreta (Fase 5). No antes.

## Bomba expansiva (el primero, Fase 5)

Flujo validable:

```text
Spawn en celda FREE → jugador la toca → consumo inmediato →
explosión radial (radiusCells) → celdas FREE dentro del radio pasan a
CONQUERED (mismo pipeline que un cierre: máscara + %) → enemigos dentro del
radio eliminados/dañados según params → enemigos fuera intactos →
'game:progress' actualizado → FX (onda expansiva, shake, sonido opcional).
```

Detalles (decisiones tomadas en la FASE 5):
- La conquista por bomba reutiliza `TerritorySystem.conquerCells(cells)` —
  no duplica lógica de revelado ni de porcentaje.
- **Trail activo**: la explosión solo conquista celdas libres; el trail
  sobrevive intacto y el jugador puede seguir su ruta (cubierto por test).
- **Sin resolución de regiones tras la bomba**: si la explosión deja un
  pocket libre sin enemigos, no se auto-conquista — el jugador debe
  trazarlo (mantiene la mecánica central como protagonista).
- Los enemigos cuya celda quede conquistada por el blast (sin morir) se
  recolocan a la celda libre más cercana.
- El spawn elige celda libre aleatoria, lejos del jugador (≥6 celdas) y sin
  otro power-up encima; `spawn.max` limita el total por nivel.
- Radio y cadencia vienen del config del nivel; nada hardcodeado.

## Catálogo futuro (una fase por power-up, bajo demanda)

| Tipo | Efecto | Nota de diseño |
|---|---|---|
| Rayo | Elimina 1 enemigo, encadenable | Target: enemigo más cercano |
| Escudo | Invulnerable N segundos | El trail sigue siendo vulnerable? → decidir |
| Imán | Atrae power-ups cercanos | Solo afecta a items, trivial |
| Congelación | Pausa enemigos N segundos | Estado `frozen` en Enemy base |
| Velocidad | +X% velocidad jugador N seg | Cuidado con tunneling en el grid |
| Fuego | Zona de daño temporal | Reusa el sistema de radio de la bomba |

Ninguno se implementa "porque sí": cada uno entra cuando un nivel lo usa.
