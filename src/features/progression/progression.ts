/**
 * Lógica pura de progresión de temporada e hitos. Sin dependencias de
 * React/Phaser/Supabase para que sea testeable con vitest.
 *
 * Reglas de negocio (gates ★, free vs especiales): ver
 * `docs/MODELO_NEGOCIO_Y_PROGRESION.md`.
 */

/** Hitos de temporada en niveles completados. */
export const SEASON_MILESTONES = [5, 10, 25, 50, 70] as const;

/**
 * ★ mínimas por defecto para liberar la temporada siguiente.
 * Índice 0 = T1→T2, 1 = T2→T3, … A partir del 4.º escalón: +8 (cap 60).
 * En DB: `seasons.stars_required_to_unlock_next` (migración 00025).
 */
export const DEFAULT_STARS_TO_UNLOCK_NEXT = [20, 28, 36, 44] as const;
const STARS_STEP_AFTER_TABLE = 8;
const STARS_REQUIRED_CAP = 60;

export type LevelMediaKind = 'image' | 'gif' | 'video';

/** Nivel mínimo para calcular ★ de temporada / anti soft-lock. */
export interface SeasonStarLevelInput {
  mediaType: LevelMediaKind;
  /** Mejor % del jugador; null = no completado / sin intento válido. */
  bestPct: number | null;
  targetPct: number;
}

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

export function isSpecialMedia(mediaType: LevelMediaKind): boolean {
  return mediaType === 'gif' || mediaType === 'video';
}

/**
 * ★ pedidas para abrir la siguiente temporada.
 * `seasonIndex` es 0-based (0 = primera temporada del catálogo).
 */
export function defaultStarsRequiredToUnlockNext(seasonIndex: number): number {
  const table = DEFAULT_STARS_TO_UNLOCK_NEXT;
  const first = 20;
  const last = 44;
  if (seasonIndex < 0) return first;
  if (seasonIndex < table.length) {
    return table[seasonIndex] ?? first;
  }
  const extra = seasonIndex - (table.length - 1);
  const raw = last + extra * STARS_STEP_AFTER_TABLE;
  return Math.min(raw, STARS_REQUIRED_CAP);
}

/** Techo de ★ obtenibles solo con niveles imagen (sin pase). */
export function freeStarCap(levels: ReadonlyArray<{ mediaType: LevelMediaKind }>): number {
  return levels.reduce((sum, l) => sum + (isSpecialMedia(l.mediaType) ? 0 : 3), 0);
}

/**
 * True si el gate free es alcanzable: required ≤ 3 × |niveles imagen|.
 * Si no hay niveles imagen, solo es válido required === 0.
 */
export function isSeasonStarGateValid(
  levels: ReadonlyArray<{ mediaType: LevelMediaKind }>,
  starsRequiredToUnlockNext: number,
): boolean {
  if (starsRequiredToUnlockNext < 0) return false;
  const cap = freeStarCap(levels);
  if (cap === 0) return starsRequiredToUnlockNext === 0;
  return starsRequiredToUnlockNext <= cap;
}

/**
 * ★ que cuentan para liberar la siguiente temporada.
 * - Imagen: siempre (0–3 según bestPct).
 * - GIF/video: solo si ya hay progreso (completado con derecho a jugarlo);
 *   sin bestPct aportan 0 (free no queda bloqueado).
 */
export function countableStarsTowardSeasonGate(levels: ReadonlyArray<SeasonStarLevelInput>): number {
  return levels.reduce((sum, l) => {
    const stars = starsForLevel(l.bestPct, l.targetPct);
    if (isSpecialMedia(l.mediaType) && l.bestPct == null) return sum;
    return sum + stars;
  }, 0);
}

export function isSeasonStarGateMet(
  levels: ReadonlyArray<SeasonStarLevelInput>,
  starsRequiredToUnlockNext: number,
): boolean {
  if (starsRequiredToUnlockNext <= 0) return true;
  return countableStarsTowardSeasonGate(levels) >= starsRequiredToUnlockNext;
}

/** Días antes de ends_at en que se muestra teaser de T+1. */
export const SEASON_TEASER_DAYS = 7;

/** Null o pasado = ya salió del goteo. */
export function isLevelReleased(
  availableAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (availableAt == null || availableAt === '') return true;
  const t = new Date(availableAt).getTime();
  if (!Number.isFinite(t)) return true;
  return t <= now;
}

/** Últimos `days` de la temporada (antes de ends_at). */
export function isSeasonTeaserWindow(
  endsAt: string,
  now = Date.now(),
  days = SEASON_TEASER_DAYS,
): boolean {
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return false;
  const start = end - days * 24 * 60 * 60 * 1000;
  return now >= start && now < end;
}

export interface RhythmLevelInput {
  status: 'locked' | 'unlocked' | 'completed' | 'gated' | 'upcoming';
  availableAt: string | null | undefined;
  bestPct: number | null;
  targetPct: number;
}

/**
 * Copy de ritmo post-binge: goteo pendiente y/o caza de 3★.
 * Null si aún hay niveles liberados por jugar (unlocked).
 */
export function seasonRhythmHint(
  levels: ReadonlyArray<RhythmLevelInput>,
  now = Date.now(),
): { kind: 'drip' | 'stars' | 'caught_up'; nextAt: string | null; imperfect: number } | null {
  const hasOpen = levels.some(
    (l) => isLevelReleased(l.availableAt, now) && l.status === 'unlocked',
  );
  if (hasOpen) return null;

  const upcoming = levels
    .filter((l) => !isLevelReleased(l.availableAt, now))
    .map((l) => l.availableAt as string)
    .filter(Boolean)
    .sort();
  const imperfect = levels.filter(
    (l) => l.status === 'completed' && starsForLevel(l.bestPct, l.targetPct) < 3,
  ).length;

  if (upcoming.length > 0) {
    return { kind: 'drip', nextAt: upcoming[0] ?? null, imperfect };
  }
  if (imperfect > 0) {
    return { kind: 'stars', nextAt: null, imperfect };
  }
  if (levels.length === 0) return null;
  return { kind: 'caught_up', nextAt: null, imperfect: 0 };
}

/** Fecha corta para UI de goteo (es-CL). */
export function formatAvailableAt(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = t - now;
  if (diff <= 0) return 'ya';
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days <= 1) {
    return new Date(iso).toLocaleString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return new Date(iso).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
  });
}
