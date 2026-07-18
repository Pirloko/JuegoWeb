import Phaser from 'phaser';
import type { PowerUpConfig } from '@/types/level';
import { COLS, ROWS } from '../core/constants';
import { CellState, type Cell, type TerritorySystem } from './TerritorySystem';
import { PowerUp } from '../entities/PowerUp';

const PICKUP_DIST_PX = 34;
const MIN_PLAYER_DIST_CELLS = 6;
const SPAWN_ATTEMPTS = 60;

interface Deps {
  territory: TerritorySystem;
  getPlayerCell: () => Cell;
  /** Despacho del efecto (powerups/registry vía la escena). */
  onPowerUp: (config: PowerUpConfig, cell: Cell) => void;
}

/**
 * Gestiona spawn y recogida de power-ups según la config del nivel.
 * Es agnóstico al tipo: el efecto lo resuelve el registro (powerups/).
 */
export class PowerUpSystem {
  private readonly active: PowerUp[] = [];
  private readonly timers: Phaser.Time.TimerEvent[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    configs: PowerUpConfig[],
    private readonly deps: Deps,
  ) {
    for (const config of configs) {
      let spawned = 0;
      const timer = scene.time.addEvent({
        delay: config.spawn.delayMs,
        loop: true,
        callback: () => {
          if (spawned >= config.spawn.max) {
            timer.remove();
            return;
          }
          const cell = this.findSpawnCell();
          if (!cell) return; // sin sitio válido: reintenta en el próximo tick
          spawned++;
          this.active.push(new PowerUp(this.scene, cell, config));
        },
      });
      this.timers.push(timer);
    }
  }

  update(playerX: number, playerY: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const powerUp = this.active[i];
      if (!powerUp) continue;
      if (Phaser.Math.Distance.Between(playerX, playerY, powerUp.x, powerUp.y) > PICKUP_DIST_PX) {
        continue;
      }
      this.active.splice(i, 1);
      const { cell, config } = powerUp;
      powerUp.consume();
      this.deps.onPowerUp(config, cell);
    }
  }

  /** Detiene los spawns pendientes (fin de nivel). */
  stop(): void {
    for (const timer of this.timers) timer.remove();
  }

  /** Celda libre aleatoria, lejos del jugador y sin otro power-up encima. */
  private findSpawnCell(): Cell | null {
    const player = this.deps.getPlayerCell();
    for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
      const col = Phaser.Math.Between(3, COLS - 4);
      const row = Phaser.Math.Between(3, ROWS - 4);
      if (this.deps.territory.stateAt(col, row) !== CellState.Free) continue;
      const farFromPlayer =
        Math.hypot(col - player.col, row - player.row) >= MIN_PLAYER_DIST_CELLS;
      const occupied = this.active.some((p) => p.cell.col === col && p.cell.row === row);
      if (farFromPlayer && !occupied) return { col, row };
    }
    return null;
  }
}
