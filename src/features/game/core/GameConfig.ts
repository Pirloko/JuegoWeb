import Phaser from 'phaser';
import type { LevelConfig } from '@/types/level';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { GameScene } from '../scenes/GameScene';

export function createGame(parent: HTMLElement, level: LevelConfig): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0f1220',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    scene: [new GameScene(level)],
  });
}
