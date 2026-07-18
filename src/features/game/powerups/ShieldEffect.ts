import type { ShieldConfig } from '@/types/level';
import { CELL } from '../core/constants';
import type { PowerUpContext, PowerUpEffect } from './PowerUpEffect';

/** Escudo: invulnerabilidad del jugador N ms. El trail sigue siendo letal. */
export class ShieldEffect implements PowerUpEffect<ShieldConfig> {
  apply(ctx: PowerUpContext, config: ShieldConfig): void {
    ctx.grantShield(config.params.durationMs);
    const x = (ctx.cell.col + 0.5) * CELL;
    const y = (ctx.cell.row + 0.5) * CELL;
    const ring = ctx.scene.add.circle(x, y, 18).setStrokeStyle(4, 0x38bdf8, 1).setDepth(21);
    ctx.scene.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 450,
      onComplete: () => ring.destroy(),
    });
  }
}
