import Phaser from 'phaser';
import type { PowerUpConfig } from '@/types/level';
import { CELL } from '../core/constants';
import type { Cell } from '../systems/TerritorySystem';
import { POWERUP_SPRITE } from '../assets/sprites';

const DISPLAY = 56;

const AURA: Record<PowerUpConfig['type'], number> = {
  bomb: 0xf97316,
  lightning: 0x67e8f9,
  shield: 0x38bdf8,
  freeze: 0xa5f3fc,
  speed: 0xfbbf24,
  heart: 0xfb7185,
  clock: 0xc084fc,
};

/** Power-up recogible en el mapa. El efecto lo resuelve powerups/registry. */
export class PowerUp extends Phaser.GameObjects.Container {
  readonly cell: Cell;
  readonly config: PowerUpConfig;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly aura: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, cell: Cell, config: PowerUpConfig) {
    const x = (cell.col + 0.5) * CELL;
    const y = (cell.row + 0.5) * CELL;
    super(scene, x, y);
    this.cell = cell;
    this.config = config;

    this.aura = scene.add.circle(0, 0, DISPLAY * 0.55, AURA[config.type], 0.22);
    this.sprite = scene.add.sprite(0, 0, POWERUP_SPRITE[config.type]);
    this.sprite.setDisplaySize(DISPLAY, DISPLAY);

    this.add([this.aura, this.sprite]);
    this.setDepth(8);
    scene.add.existing(this);

    scene.tweens.add({
      targets: this,
      y: y - 6,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: this.aura,
      scale: { from: 0.92, to: 1.2 },
      alpha: { from: 0.16, to: 0.34 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: this.sprite,
      angle: config.type === 'clock' ? 360 : { from: -6, to: 6 },
      duration: config.type === 'clock' ? 4000 : 900,
      repeat: -1,
      yoyo: config.type !== 'clock',
      ease: config.type === 'clock' ? 'Linear' : 'Sine.easeInOut',
    });
  }

  /** Animación de consumo; destruye el container al terminar. */
  consume(): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.aura);

    const burst = this.scene.add
      .circle(this.x, this.y, 10, AURA[this.config.type], 0.65)
      .setDepth(21);
    this.scene.tweens.add({
      targets: burst,
      scale: 3.2,
      alpha: 0,
      duration: 280,
      onComplete: () => burst.destroy(),
    });

    this.scene.tweens.add({
      targets: this,
      scale: 1.55,
      alpha: 0,
      duration: 180,
      onComplete: () => this.destroy(),
    });
  }
}
