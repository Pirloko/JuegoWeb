import type Phaser from 'phaser';
import type { LightningConfig } from '@/types/level';
import { CELL } from '../core/constants';
import type { PowerUpContext, PowerUpEffect } from './PowerUpEffect';

interface Point {
  x: number;
  y: number;
}

/**
 * Selección de objetivos del rayo: el más cercano al origen, y cada salto
 * sigue al más cercano de la víctima anterior. Pura, para poder testearla.
 */
export function selectChainTargets<T extends Point>(
  origin: Point,
  candidates: readonly T[],
  count: number,
): T[] {
  const remaining = [...candidates];
  const targets: T[] = [];
  let from: Point = origin;
  while (targets.length < count && remaining.length > 0) {
    let bestIndex = 0;
    let bestDist = Infinity;
    remaining.forEach((candidate, i) => {
      const d = (candidate.x - from.x) ** 2 + (candidate.y - from.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    });
    const [target] = remaining.splice(bestIndex, 1);
    if (!target) break;
    targets.push(target);
    from = target;
  }
  return targets;
}

/** Rayo: elimina al enemigo más cercano y encadena hasta params.targets. */
export class LightningEffect implements PowerUpEffect<LightningConfig> {
  apply(ctx: PowerUpContext, config: LightningConfig): void {
    const origin: Point = { x: (ctx.cell.col + 0.5) * CELL, y: (ctx.cell.row + 0.5) * CELL };
    const targets = selectChainTargets(origin, ctx.getEnemies(), config.params.targets);

    ctx.scene.cameras.main.flash(120, 255, 255, 220);
    let from = origin;
    for (const enemy of targets) {
      this.drawBolt(ctx.scene, from, { x: enemy.x, y: enemy.y });
      from = { x: enemy.x, y: enemy.y };
      ctx.killEnemy(enemy);
    }
  }

  private drawBolt(scene: Phaser.Scene, a: Point, b: Point): void {
    const g = scene.add.graphics().setDepth(22);
    g.lineStyle(4, 0xfef08a, 1);
    g.beginPath();
    g.moveTo(a.x, a.y);
    const segments = 6;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const jitter = (Math.random() - 0.5) * 36;
      // Perpendicular al segmento para el zigzag
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      g.lineTo(a.x + dx * t - (dy / len) * jitter, a.y + dy * t + (dx / len) * jitter);
    }
    g.lineTo(b.x, b.y);
    g.strokePath();
    scene.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
  }
}
