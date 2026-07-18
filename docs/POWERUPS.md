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

Detalles:
- La conquista por bomba reutiliza `TerritorySystem.conquerCells(cells)` —
  no duplica lógica de revelado ni de porcentaje.
- Si la explosión corta el trail activo del jugador, el trail sobreviviente
  se reancla o se cancela sin pérdida de vida (decidir en Fase 5 probándolo).
- Radio, daño y duración de FX vienen del config; nada hardcodeado.

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
