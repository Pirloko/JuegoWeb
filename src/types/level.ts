export interface EnemyConfig {
  type: 'basic';
  speed: number;
}

export interface LevelConfig {
  targetPct: number;
  lives: number;
  playerSpeed: number;
  enemies: EnemyConfig[];
  /** Imagen oculta que se revela al conquistar (URL o path servido). */
  imageUrl: string;
}

export interface LevelResultStats {
  conqueredPct: number;
  targetPct: number;
  timeMs: number;
  livesLeft: number;
}
