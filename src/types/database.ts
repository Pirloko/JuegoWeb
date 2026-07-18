import type { LevelConfig, PowerUpConfig, EnemyConfig } from '@/types/level';

export const FREE_LEVEL_MAX = 7;
export const LEVELS_PER_SEASON = 70;

export interface SeasonRow {
  id: string;
  slug: string;
  name: string;
  starts_at: string;
  ends_at: string;
  price_clp: number;
  offer_price_clp: number | null;
  offer_starts_at: string | null;
  offer_ends_at: string | null;
  is_active: boolean;
}

export interface SeasonEntitlement {
  user_id: string;
  season_id: string;
  purchased_at: string;
  amount_clp: number;
  provider: string;
  provider_ref: string | null;
}

export type SubscriptionStatus = 'pending' | 'authorized' | 'paused' | 'cancelled';

export interface SubscriptionRow {
  user_id: string;
  status: SubscriptionStatus;
  mp_preapproval_id: string | null;
  amount_clp: number;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Link para que el usuario gestione/cancele en Mercado Pago (Chile). */
export const MP_MANAGE_SUBSCRIPTION_URL = 'https://www.mercadopago.cl/subscriptions';

/** Fila de public.levels */
export interface LevelRow {
  id: string;
  season_id: string;
  sort_order: number;
  name: string;
  config: LevelConfigJson;
  image_path: string;
  thumb_path: string;
  is_active: boolean;
}

export interface LevelConfigJson {
  targetPct: number;
  lives: number;
  playerSpeed: number;
  minTimeMs?: number;
  cellSize?: number;
  enemies: EnemyConfig[];
  powerUps: PowerUpConfig[];
}

export type ProgressStatus = 'locked' | 'unlocked' | 'completed' | 'gated';

export interface ProgressRow {
  user_id: string;
  level_id: string;
  status: Exclude<ProgressStatus, 'gated'>;
  best_pct: number | null;
  best_time_ms: number | null;
  attempts: number;
  completed_at: string | null;
}

export interface LevelListItem {
  level: LevelRow;
  status: ProgressStatus;
  bestPct: number | null;
  bestTimeMs: number | null;
  attempts: number;
  /** true si necesita pase (sort_order > 7 y sin entitlement) */
  needsPass: boolean;
}

export interface GalleryItem {
  level: LevelRow;
  status: ProgressStatus;
  revealed: boolean;
  displayUrl: string;
}

export function toLevelConfig(level: LevelRow, imageUrl: string): LevelConfig {
  const c = level.config;
  return {
    targetPct: c.targetPct,
    lives: c.lives,
    playerSpeed: c.playerSpeed,
    enemies: c.enemies ?? [],
    powerUps: c.powerUps ?? [],
    imageUrl,
  };
}

export function isOfferActive(season: SeasonRow, now = new Date()): boolean {
  if (season.offer_price_clp == null || !season.offer_starts_at || !season.offer_ends_at) {
    return false;
  }
  const t = now.getTime();
  return t >= new Date(season.offer_starts_at).getTime() && t < new Date(season.offer_ends_at).getTime();
}

export function effectivePriceClp(season: SeasonRow, now = new Date()): number {
  return isOfferActive(season, now) ? (season.offer_price_clp as number) : season.price_clp;
}

export function formatClp(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}
