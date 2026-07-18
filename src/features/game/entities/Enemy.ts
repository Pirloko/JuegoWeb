import Phaser from 'phaser';
import { COLORS } from '../core/constants';
import { CellState } from '../systems/TerritorySystem';

const RADIUS = 16;
const MAX_DELTA_MS = 50;

/**
 * Enemigo básico: rebote diagonal dentro del área libre.
 * Rebota contra lo conquistado; el trail NO lo bloquea (tocarlo mata al
 * jugador — eso lo detecta la escena).
 */
export class Enemy extends Phaser.GameObjects.Arc {
  private vx: number;
  private vy: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    speed: number,
    private readonly stateAtPixel: (x: number, y: number) => CellState,
  ) {
    super(scene, x, y, RADIUS, 0, 360, false, COLORS.enemy);
    scene.add.existing(this);
    this.setDepth(5);
    const component = speed * Math.SQRT1_2;
    this.vx = Math.random() < 0.5 ? -component : component;
    this.vy = Math.random() < 0.5 ? -component : component;
  }

  override update(deltaMs: number): void {
    const dt = Math.min(deltaMs, MAX_DELTA_MS) / 1000;

    const nextX = this.x + this.vx * dt;
    if (this.stateAtPixel(nextX + Math.sign(this.vx) * RADIUS, this.y) === CellState.Conquered) {
      this.vx = -this.vx;
    } else {
      this.x = nextX;
    }

    const nextY = this.y + this.vy * dt;
    if (this.stateAtPixel(this.x, nextY + Math.sign(this.vy) * RADIUS) === CellState.Conquered) {
      this.vy = -this.vy;
    } else {
      this.y = nextY;
    }
  }
}
