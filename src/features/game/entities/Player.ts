import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../core/constants';

const SIZE = 20;
const MAX_DELTA_MS = 50; // evita saltarse celdas en un pico de lag

export class Player extends Phaser.GameObjects.Rectangle {
  private speedMult = 1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly speed: number,
  ) {
    super(scene, x, y, SIZE, SIZE, COLORS.player);
    scene.add.existing(this);
    this.setDepth(10);
  }

  setSpeedMultiplier(mult: number): void {
    this.speedMult = mult;
  }

  move(dir: { x: number; y: number }, deltaMs: number): void {
    if (dir.x === 0 && dir.y === 0) return;
    const dist = (this.speed * this.speedMult * Math.min(deltaMs, MAX_DELTA_MS)) / 1000;
    const half = SIZE / 2;
    this.x = Phaser.Math.Clamp(this.x + dir.x * dist, half, GAME_WIDTH - half);
    this.y = Phaser.Math.Clamp(this.y + dir.y * dist, half, GAME_HEIGHT - half);
  }
}
