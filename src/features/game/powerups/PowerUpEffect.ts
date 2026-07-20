import type Phaser from 'phaser';
import type { PowerUpConfig } from '@/types/level';
import type { Cell, TerritorySystem } from '../systems/TerritorySystem';
import type { Enemy } from '../entities/Enemy';

/**
 * Contexto que la escena entrega a un efecto al consumirse un power-up.
 * Los efectos no conocen GameScene: solo estas capacidades.
 */
export interface PowerUpContext {
  scene: Phaser.Scene;
  territory: TerritorySystem;
  /** Celda donde se consumió el power-up. */
  cell: Cell;
  getEnemies(): readonly Enemy[];
  killEnemy(enemy: Enemy): void;
  /** Conquista celdas libres + revela + recoloca enemigos + progreso + victoria. */
  conquer(cells: Cell[]): void;
  /** Invulnerabilidad del cuerpo del jugador; el trail sigue letal. */
  grantShield(durationMs: number): void;
  /** Congela a todos los enemigos vivos. */
  freezeEnemies(durationMs: number): void;
  /** Multiplicador temporal de velocidad del jugador. */
  boostSpeed(multiplier: number, durationMs: number): void;
  /** Suma corazones al pool de energía del jugador (máx 5). Async vía React/RPC. */
  grantEnergyHearts(amount: number): void;
  /** Suma segundos al cronómetro del nivel (si hay límite activo). */
  addTime(addSec: number): void;
}

export interface PowerUpEffect<C extends PowerUpConfig = PowerUpConfig> {
  apply(ctx: PowerUpContext, config: C): void;
}
