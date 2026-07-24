import Phaser from 'phaser';
import { CellState } from '../systems/TerritorySystem';
import { GAME_SPRITES } from '../assets/sprites';

/** Radio de colisión / rebote (lógica). */
export const ENEMY_RADIUS = 16;
const DISPLAY = 52;
const MAX_DELTA_MS = 50;

/**
 * Enemigo como Container: animaciones en el hijo, escala estable.
 */
export class Enemy extends Phaser.GameObjects.Container {
  readonly radius = ENEMY_RADIUS;
  private readonly avatar: Phaser.GameObjects.Sprite;
  private readonly aura: Phaser.GameObjects.Arc;
  private vx: number;
  private vy: number;
  private frozenUntil = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    speed: number,
    private readonly stateAtPixel: (x: number, y: number) => CellState,
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(5);

    this.aura = scene.add.circle(0, 0, DISPLAY * 0.5, 0xf472b6, 0.16);
    this.avatar = scene.add.sprite(0, 0, GAME_SPRITES.enemy);
    this.avatar.setDisplaySize(DISPLAY, DISPLAY);
    this.add([this.aura, this.avatar]);

    scene.tweens.add({
      targets: this.avatar,
      angle: { from: -5, to: 5 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: this.aura,
      alpha: { from: 0.1, to: 0.28 },
      scale: { from: 0.9, to: 1.16 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const component = speed * Math.SQRT1_2;
    this.vx = Math.random() < 0.5 ? -component : component;
    this.vy = Math.random() < 0.5 ? -component : component;
  }

  freezeUntil(timeMs: number): void {
    this.frozenUntil = Math.max(this.frozenUntil, timeMs);
    this.avatar.setTint(0x7dd3fc);
    this.aura.setFillStyle(0x7dd3fc, 0.3);
  }

  override update(deltaMs: number): void {
    if (this.scene.time.now < this.frozenUntil) return;
    this.avatar.clearTint();
    this.aura.setFillStyle(0xf472b6, 0.16);

    const dt = Math.min(deltaMs, MAX_DELTA_MS) / 1000;
    const r = this.radius;

    const nextX = this.x + this.vx * dt;
    if (this.stateAtPixel(nextX + Math.sign(this.vx) * r, this.y) === CellState.Conquered) {
      this.vx = -this.vx;
      this.avatar.setFlipX(this.vx < 0);
    } else {
      this.x = nextX;
    }

    const nextY = this.y + this.vy * dt;
    if (this.stateAtPixel(this.x, nextY + Math.sign(this.vy) * r) === CellState.Conquered) {
      this.vy = -this.vy;
    } else {
      this.y = nextY;
    }
  }
}
