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
}

export interface PowerUpEffect<C extends PowerUpConfig = PowerUpConfig> {
  apply(ctx: PowerUpContext, config: C): void;
}
