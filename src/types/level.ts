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
    /** Corazones que suma al pool de energía (normalmente 1; cap energy_max). */
    lives: number;
  };
}

export interface ClockConfig {
  type: 'clock';
  spawn: PowerUpSpawnConfig;
  params: {
    /** Segundos que suma al cronómetro del nivel. */
    addSec: number;
  };
}

export type PowerUpConfig =
  | BombConfig
  | LightningConfig
  | ShieldConfig
  | FreezeConfig
  | SpeedConfig
  | HeartConfig
  | ClockConfig;

/** Límite de tiempo por defecto (segundos) si el nivel no define otro. */
export const DEFAULT_TIME_LIMIT_SEC = 120;

export interface LevelConfig {
  targetPct: number;
  lives: number;
  playerSpeed: number;
  /**
   * Límite de partida en segundos. `0` = sin límite.
   * Si falta en JSON, toLevelConfig aplica DEFAULT_TIME_LIMIT_SEC.
   */
  timeLimitSec: number;
  enemies: EnemyConfig[];
  powerUps: PowerUpConfig[];
  /** Full del nivel para Phaser (bajo la niebla). Overlay de victoria firma de nuevo tras completar. */
  imageUrl: string;
}

export interface LevelResultStats {
  conqueredPct: number;
  targetPct: number;
  timeMs: number;
  livesLeft: number;
}
