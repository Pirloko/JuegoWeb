import Phaser from 'phaser';
import { CellState } from '../systems/TerritorySystem';
import { GAME_SPRITES } from '../assets/sprites';
import type { EnemyBehavior } from '@/types/level';

/** Radio de colisión / rebote (lógica). */
export const ENEMY_RADIUS = 16;
const DISPLAY = 52;
const MAX_DELTA_MS = 50;

/** Giro máximo del perseguidor (rad/s): deja escapatoria al jugador. */
const CHASE_TURN_RATE = 2.6;
/**
 * Tras rebotar en un muro el perseguidor deja de girar un instante: si
 * siguiera corrigiendo se quedaría vibrando contra el borde.
 */
const WALL_RECOVER_MS = 320;

export interface EnemyTarget {
  x: number;
  y: number;
}

/**
 * Enemigo como Container: animaciones en el hijo, escala estable.
 */
export class Enemy extends Phaser.GameObjects.Container {
  readonly radius = ENEMY_RADIUS;
  private readonly avatar: Phaser.GameObjects.Sprite;
  private readonly aura: Phaser.GameObjects.Arc;
  private readonly speed: number;
  private vx: number;
  private vy: number;
  private frozenUntil = 0;
  private steerBlockedUntil = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    speed: number,
    private readonly stateAtPixel: (x: number, y: number) => CellState,
    readonly behavior: EnemyBehavior = 'basic',
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(5);
    this.speed = speed;

    const auraColor = behavior === 'chase' ? 0xef4444 : 0xf472b6;
    this.aura = scene.add.circle(0, 0, DISPLAY * 0.5, auraColor, behavior === 'chase' ? 0.22 : 0.16);
    this.avatar = scene.add.sprite(0, 0, GAME_SPRITES.enemy);
    this.avatar.setDisplaySize(DISPLAY, DISPLAY);
    if (behavior === 'chase') {
      // Tinte cálido: el jugador debe distinguir al que lo persigue.
      this.avatar.setTint(0xffb4b4);
    }
    this.add([this.aura, this.avatar]);

    scene.tweens.add({
      targets: this.avatar,
      angle: { from: -5, to: 5 },
      duration: behavior === 'chase' ? 520 : 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: this.aura,
      alpha: { from: 0.1, to: behavior === 'chase' ? 0.38 : 0.28 },
      scale: { from: 0.9, to: 1.16 },
      duration: behavior === 'chase' ? 480 : 650,
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

  /**
   * `target` solo llega con valor cuando este enemigo debe perseguir (trazo
   * abierto). Sin target se comporta como el rebote de siempre.
   */
  override update(deltaMs: number, target?: EnemyTarget | null): void {
    const now = this.scene.time.now;
    if (now < this.frozenUntil) return;
    this.restoreLook();

    const dt = Math.min(deltaMs, MAX_DELTA_MS) / 1000;
    const r = this.radius;

    if (target && this.behavior === 'chase' && now >= this.steerBlockedUntil) {
      this.steerToward(target, dt);
    }

    const nextX = this.x + this.vx * dt;
    if (this.stateAtPixel(nextX + Math.sign(this.vx) * r, this.y) === CellState.Conquered) {
      this.vx = -this.vx;
      this.steerBlockedUntil = now + WALL_RECOVER_MS;
      this.avatar.setFlipX(this.vx < 0);
    } else {
      this.x = nextX;
    }

    const nextY = this.y + this.vy * dt;
    if (this.stateAtPixel(this.x, nextY + Math.sign(this.vy) * r) === CellState.Conquered) {
      this.vy = -this.vy;
      this.steerBlockedUntil = now + WALL_RECOVER_MS;
    } else {
      this.y = nextY;
    }
  }

  private restoreLook(): void {
    if (this.behavior === 'chase') {
      this.avatar.setTint(0xffb4b4);
      this.aura.setFillStyle(0xef4444, 0.22);
      return;
    }
    this.avatar.clearTint();
    this.aura.setFillStyle(0xf472b6, 0.16);
  }

  /** Gira la velocidad hacia el objetivo sin cambiar su magnitud. */
  private steerToward(target: EnemyTarget, dt: number): void {
    const desired = Math.atan2(target.y - this.y, target.x - this.x);
    const current = Math.atan2(this.vy, this.vx);
    const delta = Phaser.Math.Angle.Wrap(desired - current);
    const maxTurn = CHASE_TURN_RATE * dt;
    const next = current + Phaser.Math.Clamp(delta, -maxTurn, maxTurn);

    this.vx = Math.cos(next) * this.speed;
    this.vy = Math.sin(next) * this.speed;
    this.avatar.setFlipX(this.vx < 0);
  }
}
