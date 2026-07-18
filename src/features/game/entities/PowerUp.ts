import Phaser from 'phaser';
import type { PowerUpConfig } from '@/types/level';
import { CELL } from '../core/constants';
import type { Cell } from '../systems/TerritorySystem';

const EMOJI: Record<PowerUpConfig['type'], string> = {
  bomb: '💣',
  lightning: '⚡',
};

/** Power-up recogible en el mapa. El efecto lo resuelve powerups/registry. */
export class PowerUp extends Phaser.GameObjects.Text {
  constructor(
    scene: Phaser.Scene,
    readonly cell: Cell,
    readonly config: PowerUpConfig,
  ) {
    super(scene, (cell.col + 0.5) * CELL, (cell.row + 0.5) * CELL, EMOJI[config.type], {
      fontSize: '44px',
    });
    this.setOrigin(0.5).setDepth(8);
    scene.add.existing(this);
    scene.tweens.add({
      targets: this,
      scale: { from: 1, to: 1.18 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Animación de consumo; destruye el sprite al terminar. */
  consume(): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scale: 1.6,
      alpha: 0,
      duration: 150,
      onComplete: () => this.destroy(),
    });
  }
}
