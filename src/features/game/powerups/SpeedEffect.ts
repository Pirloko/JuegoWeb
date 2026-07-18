import type { SpeedConfig } from '@/types/level';
import type { PowerUpContext, PowerUpEffect } from './PowerUpEffect';

/** Velocidad: multiplica la velocidad del jugador un tiempo limitado. */
export class SpeedEffect implements PowerUpEffect<SpeedConfig> {
  apply(ctx: PowerUpContext, config: SpeedConfig): void {
    const mult = Math.min(Math.max(config.params.multiplier, 1.05), 1.6);
    ctx.boostSpeed(mult, config.params.durationMs);
    ctx.scene.cameras.main.flash(80, 253, 224, 71);
  }
}
