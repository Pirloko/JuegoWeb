import Phaser from 'phaser';
import type { BombConfig } from '@/types/level';
import { CELL } from '../core/constants';
import type { PowerUpContext, PowerUpEffect } from './PowerUpEffect';

/**
 * Bomba expansiva: elimina enemigos dentro del radio y conquista (revela)
 * las celdas libres. El trail activo sobrevive (conquer solo toca libres).
 */
export class BombEffect implements PowerUpEffect<BombConfig> {
  apply(ctx: PowerUpContext, config: BombConfig): void {
    const { radiusCells } = config.params;
    const x = (ctx.cell.col + 0.5) * CELL;
    const y = (ctx.cell.row + 0.5) * CELL;
    const radiusPx = radiusCells * CELL;

    this.fx(ctx.scene, x, y, radiusPx);

    // Enemigos primero (con su posición original); la conquista después
    // recoloca a los supervivientes que queden sobre celdas conquistadas.
    for (const enemy of [...ctx.getEnemies()]) {
      if (Phaser.Math.Distance.Between(enemy.x, enemy.y, x, y) <= radiusPx + enemy.radius) {
        ctx.killEnemy(enemy);
      }
    }
    ctx.conquer(ctx.territory.cellsInRadius(ctx.cell, radiusCells));
  }

  private fx(scene: Phaser.Scene, x: number, y: number, radiusPx: number): void {
    scene.cameras.main.shake(200, 0.012);
    const flash = scene.add.circle(x, y, radiusPx, 0xfde68a, 0.35).setDepth(20);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 350,
      onComplete: () => flash.destroy(),
    });
    const ring = scene.add.circle(x, y, 12).setStrokeStyle(6, 0xfbbf24, 1).setDepth(21);
    scene.tweens.add({
      targets: ring,
      radius: radiusPx,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}
