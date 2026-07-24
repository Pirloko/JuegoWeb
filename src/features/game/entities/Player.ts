import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { GAME_SPRITES } from '../assets/sprites';

/** Hitbox lógica (independiente del display del sprite). */
export const PLAYER_HIT = 22;
const DISPLAY = 52;

const MAX_DELTA_MS = 50;

/**
 * Jugador como Container: el bob mueve el sprite hijo sin romper la escala.
 */
export class Player extends Phaser.GameObjects.Container {
  private readonly avatar: Phaser.GameObjects.Sprite;
  private readonly glow: Phaser.GameObjects.Arc;
  private speedMult = 1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly speed: number,
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(10);

    this.glow = scene.add.circle(0, 0, DISPLAY * 0.58, 0xf472b6, 0.2);
    this.avatar = scene.add.sprite(0, 0, GAME_SPRITES.player);
    this.avatar.setDisplaySize(DISPLAY, DISPLAY);
    this.add([this.glow, this.avatar]);

    scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.12, to: 0.32 },
      scale: { from: 0.92, to: 1.14 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: this.avatar,
      y: -3,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  setSpeedMultiplier(mult: number): void {
    this.speedMult = mult;
  }

  setBoostVisual(active: boolean): void {
    if (active) this.avatar.setTint(0xfde68a);
    else this.avatar.clearTint();
  }

  move(dir: { x: number; y: number }, deltaMs: number): void {
    if (dir.x !== 0) this.avatar.setFlipX(dir.x < 0);
    if (dir.x === 0 && dir.y === 0) return;
    const dist = (this.speed * this.speedMult * Math.min(deltaMs, MAX_DELTA_MS)) / 1000;
    const half = PLAYER_HIT / 2;
    this.x = Phaser.Math.Clamp(this.x + dir.x * dist, half, GAME_WIDTH - half);
    this.y = Phaser.Math.Clamp(this.y + dir.y * dist, half, GAME_HEIGHT - half);
  }
}
