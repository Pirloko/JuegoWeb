import type { HeartConfig } from '@/types/level';
import { CELL } from '../core/constants';
import type { PowerUpContext, PowerUpEffect } from './PowerUpEffect';

/** Corazón: +N al pool de energía del jugador (máx 5), no al cronómetro. */
export class HeartEffect implements PowerUpEffect<HeartConfig> {
  apply(ctx: PowerUpContext, config: HeartConfig): void {
    const raw = Number(config.params?.lives);
    const amount = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
    ctx.grantEnergyHearts(amount);

    const x = (ctx.cell.col + 0.5) * CELL;
    const y = (ctx.cell.row + 0.5) * CELL;
    const pulse = ctx.scene.add.circle(x, y, 14, 0xf472b6, 0.5).setDepth(21);
    const label = ctx.scene.add
      .text(x, y - 18, `+${amount}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#fda4af',
        stroke: '#831843',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(22);
    ctx.scene.tweens.add({
      targets: pulse,
      scale: 2,
      alpha: 0,
      duration: 400,
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
