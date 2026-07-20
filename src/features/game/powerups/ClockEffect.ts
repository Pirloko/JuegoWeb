import type { ClockConfig } from '@/types/level';
import { CELL } from '../core/constants';
import type { PowerUpContext, PowerUpEffect } from './PowerUpEffect';

/** Reloj: suma segundos al cronómetro del nivel (params.addSec). */
export class ClockEffect implements PowerUpEffect<ClockConfig> {
  apply(ctx: PowerUpContext, config: ClockConfig): void {
    const raw = Number(config.params?.addSec);
    const addSec = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 15;
    ctx.addTime(addSec);
    const x = (ctx.cell.col + 0.5) * CELL;
    const y = (ctx.cell.row + 0.5) * CELL;
    const pulse = ctx.scene.add.circle(x, y, 14, 0x38bdf8, 0.45).setDepth(21);
    const label = ctx.scene.add
      .text(x, y - 18, `+${addSec}s`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#7dd3fc',
      })
      .setOrigin(0.5)
      .setDepth(22);
    ctx.scene.tweens.add({
      targets: pulse,
      scale: 2.2,
      alpha: 0,
      duration: 450,
      onComplete: () => pulse.destroy(),
    });
    ctx.scene.tweens.add({
      targets: label,
      y: y - 48,
      alpha: 0,
      duration: 700,
      onComplete: () => label.destroy(),
    });
  }
}
