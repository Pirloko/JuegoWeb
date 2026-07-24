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

## Arquitectura extensible (implementada en la FASE 6)

```text
src/features/game/powerups/
├── PowerUpEffect.ts    # PowerUpContext (capacidades) + interface del efecto
├── registry.ts         # tipo → efecto; exhaustivo por compilación
├── BombEffect.ts
├── LightningEffect.ts
├── ShieldEffect.ts
├── FreezeEffect.ts
├── SpeedEffect.ts
├── HeartEffect.ts
└── ClockEffect.ts
```
- `PowerUpSystem` (systems/): spawn por config y recogida; agnóstico al tipo.
- `PowerUpContext`: lo único que un efecto conoce de la escena — `territory`,
  `cell`, `getEnemies()`, `killEnemy()`, `conquer(cells)`, `grantShield`,
  `freezeEnemies`, `boostSpeed`, `grantEnergyHearts`, `addTime` y `scene` para FX.
- El registro es un mapped type sobre `PowerUpConfig['type']`: declarar un
  tipo nuevo en el union sin registrar su efecto **no compila**.
- Añadir un power-up = clase de efecto + entrada en el registro + config
  JSON + sprite en `public/game/sprites/` (`POWERUP_SPRITE`). Cero cambios
  en el núcleo.
- Visuales: sprites glossy en `public/game/sprites/` (jugador, enemigo,
  power-ups). El tipo `heart` es un ícono de senos (energía). Regenerar con
  `npm run sprites:game` si hace falta.

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

## Catálogo

| Tipo | Efecto | Estado |
|---|---|---|
| Bomba | Conquista radio + mata enemigos en zona | ✓ |
| Rayo | Elimina al más cercano, encadena hasta `params.targets` | ✓ |
| Escudo | Invulnerabilidad del cuerpo N ms; **el trail sigue letal** | ✓ |
| Congelación | Pausa enemigos N ms | ✓ |
| Velocidad | Multiplicador de velocidad del jugador (cap 1.6×) | ✓ |
| Corazón (senos) | +N al pool de energía (`params.lives`, máx 5); sprite sensual + RPC `grant_energy_hearts` | ✓ |
| Reloj | Suma segundos al cronómetro (`params.addSec`) | ✓ |
| Imán | Atrae power-ups cercanos | Pendiente |
| Fuego | Zona de daño temporal | Pendiente |

Ninguno se implementa "porque sí": cada uno se activa en un nivel vía Admin / `levels.config`.
