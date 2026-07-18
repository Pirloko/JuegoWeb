import type { LevelConfig } from '@/types/level';

/**
 * Config provisional del prototipo (FASE 2).
 * En la FASE 8 la config de niveles vivirá en Supabase (levels.config).
 */
export const PROTOTYPE_LEVEL: LevelConfig = {
  targetPct: 60,
  lives: 3,
  playerSpeed: 280,
  enemies: [{ type: 'basic', speed: 200 }],
};
