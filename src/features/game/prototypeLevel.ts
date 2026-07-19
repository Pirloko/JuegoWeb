import type { LevelConfig } from '@/types/level';

/**
 * Config provisional del prototipo (FASE 2).
 * En la FASE 8 la config de niveles vivirá en Supabase (levels.config).
 */
export const PROTOTYPE_LEVEL: LevelConfig = {
  targetPct: 60,
  lives: 3,
  playerSpeed: 280,
  timeLimitSec: 120,
  enemies: [{ type: 'basic', speed: 200 }],
  powerUps: [
    { type: 'bomb', spawn: { delayMs: 8000, max: 2 }, params: { radiusCells: 10 } },
    { type: 'lightning', spawn: { delayMs: 14000, max: 1 }, params: { targets: 1 } },
    { type: 'clock', spawn: { delayMs: 16000, max: 2 }, params: { addSec: 15 } },
  ],
  imageUrl: '/levels/level-1.png',
};
