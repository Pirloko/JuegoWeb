export interface EnemyConfig {
  type: 'basic';
  speed: number;
}

export interface LevelConfig {
  targetPct: number;
  lives: number;
  playerSpeed: number;
  enemies: EnemyConfig[];
}

export interface LevelResultStats {
  conqueredPct: number;
  targetPct: number;
  timeMs: number;
  livesLeft: number;
}
