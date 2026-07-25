/**
 * Curva de dificultad por posición dentro de la temporada.
 *
 * El "slot" es el puesto del nivel en su temporada (1 = primero). La curva es
 * la misma en todas las temporadas: el slot 5 de Julio se siente como el 5 de
 * Agosto. Así el jugador reconoce el ritmo aunque cambie el contenido.
 *
 * No hay tope duro: más allá de `SEASON_CURVE_SLOTS` se mantiene el tramo
 * final (el admin puede crear los niveles que quiera).
 */

import type { LevelConfigJson } from '@/types/database';
import type { EnemyConfig, PowerUpConfig } from '@/types/level';

/** Slots de referencia de una temporada (la curva llega a su tope aquí). */
export const SEASON_CURVE_SLOTS = 30;

/** Tope de enemigos en la curva (lotes y "aplicar curva"). */
export const MAX_ENEMIES_PER_LEVEL = 7;

/** Tramos de la curva, para explicar en el admin qué se está creando. */
export type CurveBand = 'intro' | 'ritmo' | 'exige' | 'cierre';

const BAND_LABEL: Record<CurveBand, string> = {
  intro: 'Intro',
  ritmo: 'Ritmo',
  exige: 'Exige',
  cierre: 'Cierre',
};

export function curveBandForSlot(slot: number): CurveBand {
  if (slot <= 5) return 'intro';
  if (slot <= 12) return 'ritmo';
  if (slot <= 20) return 'exige';
  return 'cierre';
}

export function curveBandLabel(slot: number): string {
  return BAND_LABEL[curveBandForSlot(slot)];
}

/** 0 en el slot 1, 1 en el slot final. Slots mayores se quedan en 1. */
function curveT(slot: number): number {
  const s = Math.max(1, Math.floor(slot));
  return Math.min(1, (s - 1) / (SEASON_CURVE_SLOTS - 1));
}

function ramp(from: number, to: number, t: number, step = 1): number {
  return Math.round((from + (to - from) * t) / step) * step;
}

function enemyCountForSlot(slot: number): number {
  if (slot <= 3) return 1;
  if (slot <= 7) return 2;
  if (slot <= 12) return 3;
  if (slot <= 17) return 4;
  if (slot <= 22) return 5;
  if (slot <= 26) return 6;
  return MAX_ENEMIES_PER_LEVEL;
}

/**
 * Enemigos que persiguen al jugador mientras traza. Aparecen cuando el
 * jugador ya domina el rebote clásico.
 */
function chaseCountForSlot(slot: number): number {
  if (slot < 10) return 0;
  if (slot < 20) return 1;
  return 2;
}

export function enemiesForSlot(slot: number): EnemyConfig[] {
  const t = curveT(slot);
  const total = enemyCountForSlot(slot);
  const chasers = Math.min(chaseCountForSlot(slot), total);
  const speed = ramp(150, 260, t, 5);

  return Array.from({ length: total }, (_, i) => {
    const isChaser = i >= total - chasers;
    return isChaser
      ? // Perseguir compensa: van algo más lentos que los de rebote.
        ({ type: 'chase', speed: Math.round(speed * 0.85) } satisfies EnemyConfig)
      : ({ type: 'basic', speed } satisfies EnemyConfig);
  });
}

/** Slot en que se estrena cada power-up. Un juguete nuevo cada pocos niveles. */
const POWERUP_UNLOCKS: ReadonlyArray<{
  slot: number;
  make: (t: number) => PowerUpConfig;
}> = [
  {
    slot: 1,
    make: (t) => ({
      type: 'bomb',
      spawn: { delayMs: ramp(7000, 9000, t, 500), max: ramp(3, 2, t) },
      params: { radiusCells: ramp(12, 9, t) },
    }),
  },
  {
    slot: 6,
    make: (t) => ({
      type: 'clock',
      spawn: { delayMs: ramp(16000, 12000, t, 500), max: 2 },
      params: { addSec: ramp(12, 18, t) },
    }),
  },
  {
    slot: 10,
    make: (t) => ({
      type: 'shield',
      spawn: { delayMs: ramp(12000, 9000, t, 500), max: 2 },
      params: { durationMs: ramp(4000, 6000, t, 500) },
    }),
  },
  {
    slot: 14,
    make: (t) => ({
      type: 'freeze',
      spawn: { delayMs: ramp(13000, 10000, t, 500), max: 2 },
      params: { durationMs: ramp(3500, 5000, t, 500) },
    }),
  },
  {
    slot: 18,
    make: (t) => ({
      type: 'lightning',
      spawn: { delayMs: ramp(14000, 11000, t, 500), max: ramp(1, 2, t) },
      params: { targets: ramp(1, 2, t) },
    }),
  },
  {
    slot: 22,
    make: (t) => ({
      type: 'speed',
      spawn: { delayMs: ramp(11000, 9000, t, 500), max: 2 },
      params: { multiplier: 1.4, durationMs: ramp(4000, 5500, t, 500) },
    }),
  },
  {
    slot: 26,
    make: () => ({
      type: 'heart',
      spawn: { delayMs: 15000, max: 1 },
      params: { lives: 1 },
    }),
  },
];

export function powerUpsForSlot(slot: number): PowerUpConfig[] {
  const t = curveT(slot);
  return POWERUP_UNLOCKS.filter((p) => slot >= p.slot).map((p) => p.make(t));
}

/**
 * Config completa del nivel en ese puesto de la temporada.
 * El admin puede editar cualquier valor después; esto es solo el punto de
 * partida para que la curva sea consistente entre temporadas.
 */
export function configForSeasonSlot(slot: number): LevelConfigJson {
  const s = Math.max(1, Math.floor(slot));
  const t = curveT(s);

  return {
    targetPct: ramp(50, 75, t),
    lives: 3,
    playerSpeed: 280,
    minTimeMs: 8000,
    timeLimitSec: ramp(150, 90, t, 5),
    cellSize: 8,
    enemies: enemiesForSlot(s),
    powerUps: powerUpsForSlot(s),
  };
}

/** Resumen corto para previsualizar un lote en el admin. */
export function describeSlot(slot: number): string {
  const config = configForSeasonSlot(slot);
  const chasers = config.enemies.filter((e) => e.type === 'chase').length;
  const enemyLabel = chasers > 0 ? `${config.enemies.length} enemigos (${chasers} persiguen)` : `${config.enemies.length} enemigos`;
  return `${curveBandLabel(slot)} · ${config.targetPct}% · ${enemyLabel} · ${config.timeLimitSec}s`;
}
