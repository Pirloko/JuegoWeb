import Phaser from 'phaser';
import { CELL, COLORS, GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { CellState, type TerritorySystem } from './TerritorySystem';

const STAMP_KEY = 'reveal-cell-stamp';

/**
 * Revelado de imagen: la imagen del nivel vive debajo de una capa de
 * cobertura (RenderTexture). Conquistar una celda la "perfora" (erase) y la
 * imagen aparece. El grid de TerritorySystem es la única fuente de verdad:
 * este sistema solo traduce estados de celda a píxeles.
 */
export class RevealSystem {
  private readonly cover: Phaser.GameObjects.RenderTexture;
  private readonly stamp: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    imageKey: string,
  ) {
    scene.add.image(0, 0, imageKey).setOrigin(0).setDepth(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    if (!scene.textures.exists(STAMP_KEY)) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(0xffffff).fillRect(0, 0, CELL, CELL);
      g.generateTexture(STAMP_KEY, CELL, CELL);
      g.destroy();
    }
    this.stamp = scene.make.image({ key: STAMP_KEY, add: false }).setOrigin(0);

    this.cover = scene.add.renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0).setDepth(1);
  }

  /** Pintado completo desde el grid (arranque de nivel). */
  paintAll(territory: TerritorySystem): void {
    this.cover.fill(COLORS.free, 1, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let row = 0; row < territory.rows; row++) {
      for (let col = 0; col < territory.cols; col++) {
        const state = territory.stateAt(col, row);
        if (state === CellState.Free) continue;
        const x = col * CELL;
        const y = row * CELL;
        // Borde inicial CONQUERED: color sólido, NUNCA perforar (evita spoiler del perímetro).
        if (state === CellState.Conquered) {
          this.cover.fill(COLORS.conquered, 1, x, y, CELL, CELL);
        } else if (state === CellState.Trail) {
          this.cover.fill(COLORS.trail, 1, x, y, CELL, CELL);
        }
      }
    }
  }

  setCellState(col: number, row: number, state: CellState): void {
    const x = col * CELL;
    const y = row * CELL;
    switch (state) {
      case CellState.Conquered:
        this.cover.erase(this.stamp, x, y); // perfora: la imagen se ve
        break;
      case CellState.Trail:
        this.cover.fill(COLORS.trail, 1, x, y, CELL, CELL);
        break;
      case CellState.Free:
        this.cover.fill(COLORS.free, 1, x, y, CELL, CELL);
        break;
    }
  }

  /** Victoria: desvanece la cobertura y muestra la imagen completa. */
  celebrate(): void {
    this.scene.tweens.add({
      targets: this.cover,
      alpha: 0,
      duration: 700,
      ease: 'Sine.easeIn',
    });
  }
}
