import type { FreezeConfig } from '@/types/level';
import type { PowerUpContext, PowerUpEffect } from './PowerUpEffect';

/** Congelación: enemigos quietos durante durationMs. */
export class FreezeEffect implements PowerUpEffect<FreezeConfig> {
  apply(ctx: PowerUpContext, config: FreezeConfig): void {
    ctx.freezeEnemies(config.params.durationMs);
    ctx.scene.cameras.main.flash(100, 180, 220, 255);
  }
}
