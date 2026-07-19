import type { HeartConfig } from '@/types/level';
import { CELL } from '../core/constants';
import type { PowerUpContext, PowerUpEffect } from './PowerUpEffect';

/** Corazón: ya no suma vidas in-match; da tiempo extra (+15s × params.lives). */
export class HeartEffect implements PowerUpEffect<HeartConfig> {
  apply(ctx: PowerUpContext, config: HeartConfig): void {
    const amount = Math.max(1, Math.floor(config.params.lives));
    ctx.addTime(amount * 15);
    const x = (ctx.cell.col + 0.5) * CELL;
    const y = (ctx.cell.row + 0.5) * CELL;
    const pulse = ctx.scene.add.circle(x, y, 14, 0xf472b6, 0.5).setDepth(21);
    ctx.scene.tweens.add({
      targets: pulse,
      scale: 2,
      alpha: 0,
      duration: 400,
      onComplete: () => pulse.destroy(),
    });
  }
}
