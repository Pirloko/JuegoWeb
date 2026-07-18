/**
 * Lógica pura de progresión de temporada e hitos. Sin dependencias de
 * React/Phaser/Supabase para que sea testeable con vitest.
 */

/** Hitos de temporada en niveles completados. */
export const SEASON_MILESTONES = [5, 10, 25, 50, 70] as const;

export interface SeasonProgressInfo {
  completed: number;
  total: number;
  /** 0..100 sobre el total de la temporada. */
  pct: number;
  nextMilestone: number | null;
  remainingToMilestone: number | null;
  reachedMilestones: number[];
}

/**
 * Hitos aplicables a una temporada de `total` niveles: los fijos que quepan
 * y siempre el total como hito final.
 */
export function milestonesForTotal(total: number): number[] {
  if (total <= 0) return [];
  const base = SEASON_MILESTONES.filter((m) => m < total).map(Number);
  base.push(total);
  return base;
}

export function nextMilestone(completed: number, total: number): number | null {
  return milestonesForTotal(total).find((m) => m > completed) ?? null;
}

export function seasonProgress(completed: number, total: number): SeasonProgressInfo {
  const safeTotal = Math.max(0, total);
  const done = Math.min(Math.max(0, completed), safeTotal);
  const next = nextMilestone(done, safeTotal);
  return {
    completed: done,
    total: safeTotal,
    pct: safeTotal > 0 ? (done / safeTotal) * 100 : 0,
    nextMilestone: next,
    remainingToMilestone: next == null ? null : next - done,
    reachedMilestones: milestonesForTotal(safeTotal).filter((m) => m <= done),
  };
}

/**
 * Estrellas de un nivel según su mejor conquista.
 * 1★ completar (>= targetPct) · 2★ >= targetPct + 15 · 3★ >= 95
 * (si targetPct >= 95, 3★ = completar; si target+15 pasa el umbral de 3★,
 * se salta de 1★ a 3★).
 *
 * REGLA REPLICADA EN SQL: supabase/migrations/00015_user_badges.sql
 * (medalla three_stars). Cambiarla aquí exige cambiarla allá.
 */
export function starsForLevel(bestPct: number | null, targetPct: number): 0 | 1 | 2 | 3 {
  if (bestPct == null) return 0;
  const three = Math.max(95, targetPct);
  const two = Math.min(targetPct + 15, three);
  if (bestPct >= three) return 3;
  if (bestPct >= two) return 2;
  if (bestPct >= targetPct) return 1;
  return 0;
}
