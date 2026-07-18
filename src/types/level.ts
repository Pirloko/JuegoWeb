export interface EnemyConfig {
  type: 'basic';
  speed: number;
}

export interface BombConfig {
  type: 'bomb';
  spawn: {
    /** Cada cuánto intenta aparecer una bomba. */
    delayMs: number;
    /** Máximo de bombas que aparecen en el nivel. */
    max: number;
  };
  params: {
    /** Radio de la explosión en celdas. */
    radiusCells: number;
  };
}

/** Se ampliará con más tipos en la FASE 6. */
export type PowerUpConfig = BombConfig;

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
