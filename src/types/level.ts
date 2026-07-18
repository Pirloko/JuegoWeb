export interface EnemyConfig {
  type: 'basic';
  speed: number;
}

export interface PowerUpSpawnConfig {
  /** Cada cuánto intenta aparecer. */
  delayMs: number;
  /** Máximo de apariciones en el nivel. */
  max: number;
}

export interface BombConfig {
  type: 'bomb';
  spawn: PowerUpSpawnConfig;
  params: {
    /** Radio de la explosión en celdas. */
    radiusCells: number;
  };
}

export interface LightningConfig {
  type: 'lightning';
  spawn: PowerUpSpawnConfig;
  params: {
    /** Nº de enemigos que encadena (el más cercano primero). */
    targets: number;
  };
}

export type PowerUpConfig = BombConfig | LightningConfig;

export interface LevelConfig {
  targetPct: number;
  lives: number;
  playerSpeed: number;
  enemies: EnemyConfig[];
  powerUps: PowerUpConfig[];
  /** Imagen oculta que se revela al conquistar (URL o path servido). */
  imageUrl: string;
}

export interface LevelResultStats {
  conqueredPct: number;
  targetPct: number;
  timeMs: number;
  livesLeft: number;
}
