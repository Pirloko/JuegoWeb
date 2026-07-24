import type Phaser from 'phaser';
import type { PowerUpConfig } from '@/types/level';

/** Claves de textura Phaser para sprites de gameplay. */
export const GAME_SPRITES = {
  player: 'game-player',
  enemy: 'game-enemy',
  bomb: 'game-pu-bomb',
  lightning: 'game-pu-lightning',
  shield: 'game-pu-shield',
  freeze: 'game-pu-freeze',
  speed: 'game-pu-speed',
  heart: 'game-pu-heart',
  clock: 'game-pu-clock',
} as const;

const FILES: Record<keyof typeof GAME_SPRITES, string> = {
  player: '/game/sprites/player.png',
  enemy: '/game/sprites/enemy.png',
  bomb: '/game/sprites/bomb.png',
  lightning: '/game/sprites/lightning.png',
  shield: '/game/sprites/shield.png',
  freeze: '/game/sprites/freeze.png',
  speed: '/game/sprites/speed.png',
  heart: '/game/sprites/heart.png',
  clock: '/game/sprites/clock.png',
};

export const POWERUP_SPRITE: Record<PowerUpConfig['type'], string> = {
  bomb: GAME_SPRITES.bomb,
  lightning: GAME_SPRITES.lightning,
  shield: GAME_SPRITES.shield,
  freeze: GAME_SPRITES.freeze,
  speed: GAME_SPRITES.speed,
  heart: GAME_SPRITES.heart,
  clock: GAME_SPRITES.clock,
};

export function preloadGameSprites(scene: Phaser.Scene): void {
  for (const key of Object.keys(GAME_SPRITES) as (keyof typeof GAME_SPRITES)[]) {
    scene.load.image(GAME_SPRITES[key], FILES[key]);
  }
}
