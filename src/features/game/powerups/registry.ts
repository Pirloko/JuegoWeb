import type { PowerUpConfig } from '@/types/level';
import type { PowerUpContext, PowerUpEffect } from './PowerUpEffect';
import { BombEffect } from './BombEffect';
import { LightningEffect } from './LightningEffect';
import { ShieldEffect } from './ShieldEffect';
import { FreezeEffect } from './FreezeEffect';
import { SpeedEffect } from './SpeedEffect';
import { HeartEffect } from './HeartEffect';
import { ClockEffect } from './ClockEffect';

/**
 * Un efecto por cada tipo declarado en PowerUpConfig: si añades un tipo al
 * union y no lo registras aquí, el proyecto no compila.
 * Añadir un power-up = clase de efecto + entrada aquí + config JSON.
 */
const registry: {
  [K in PowerUpConfig['type']]: PowerUpEffect<Extract<PowerUpConfig, { type: K }>>;
} = {
  bomb: new BombEffect(),
  lightning: new LightningEffect(),
  shield: new ShieldEffect(),
  freeze: new FreezeEffect(),
  speed: new SpeedEffect(),
  heart: new HeartEffect(),
  clock: new ClockEffect(),
};

export function applyPowerUp(ctx: PowerUpContext, config: PowerUpConfig): void {
  (registry[config.type] as PowerUpEffect).apply(ctx, config);
}
