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

export interface ShieldConfig {
  type: 'shield';
  spawn: PowerUpSpawnConfig;
  params: {
    /** Duración de invulnerabilidad del jugador (ms). El trail sigue siendo letal. */
    durationMs: number;
  };
}

export interface FreezeConfig {
  type: 'freeze';
  spawn: PowerUpSpawnConfig;
  params: {
    /** Tiempo que los enemigos quedan quietos (ms). */
    durationMs: number;
  };
}

export interface SpeedConfig {
  type: 'speed';
  spawn: PowerUpSpawnConfig;
  params: {
    /** Multiplicador de velocidad del jugador (p. ej. 1.4). */
    multiplier: number;
    durationMs: number;
  };
}

export interface HeartConfig {
  type: 'heart';
  spawn: PowerUpSpawnConfig;
  params: {
    /** Vidas que suma (normalmente 1). */
    lives: number;
  };
}

export type PowerUpConfig =
  | BombConfig
  | LightningConfig
  | ShieldConfig
  | FreezeConfig
  | SpeedConfig
  | HeartConfig;

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
