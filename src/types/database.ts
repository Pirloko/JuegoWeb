import type { LevelConfig, PowerUpConfig, EnemyConfig } from '@/types/level';
import { DEFAULT_TIME_LIMIT_SEC } from '@/types/level';

export const FREE_LEVEL_MAX = 7;
/** @deprecated Paywall ya no usa este techo; especiales = gif/video. Conservado por copy legacy/medallas. */
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
  /** ★ en esta temporada para liberar la siguiente (≤ techo free). */
  stars_required_to_unlock_next: number;
}

export interface SeasonEntitlement {
  user_id: string;
  season_id: string;
  purchased_at: string;
  amount_clp: number;
  provider: string;
  provider_ref: string | null;
  /** Fin de vigencia (~30 días). Null = no vigente tras Fase 5. */
  expires_at: string | null;
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

/** Tipo del contenido oculto de un nivel. */
export type LevelMediaType = 'image' | 'gif' | 'video';

/** True si el nivel exige pase (GIF/video). */
export function levelRequiresPass(mediaType: LevelMediaType | string | null | undefined): boolean {
  return mediaType === 'gif' || mediaType === 'video';
}

/** Fila de public.levels */
export interface LevelRow {
  id: string;
  season_id: string;
  sort_order: number;
  name: string;
  config: LevelConfigJson;
  image_path: string;
  thumb_path: string;
  /** Contenido oculto: foto (default), GIF o video corto (≤20 s). */
  media_type: LevelMediaType;
  /** Path en Storage del GIF/video; null si media_type = image. */
  media_path: string | null;
  /** URL de procedencia del contenido (la define el admin); null si no hay. */
  source_url: string | null;
  is_active: boolean;
  /** Si no null, goteo: no jugable hasta esa fecha ISO. */
  available_at: string | null;
}

export interface LevelConfigJson {
  targetPct: number;
  lives: number;
  playerSpeed: number;
  minTimeMs?: number;
  /** Límite de partida en segundos. 0 = sin límite. Si falta, el motor usa 120. */
  timeLimitSec?: number;
  cellSize?: number;
  enemies: EnemyConfig[];
  powerUps: PowerUpConfig[];
}

export type ProgressStatus = 'locked' | 'unlocked' | 'completed' | 'gated' | 'upcoming';

export interface ProgressRow {
  user_id: string;
  level_id: string;
  status: Exclude<ProgressStatus, 'gated' | 'upcoming'>;
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
  /** true si es GIF/video y el jugador no tiene pase (salvo ya completed). */
  needsPass: boolean;
  /** Thumb firmada para fondo del tile (teaser difuminado). */
  thumbUrl: string;
}

export interface GalleryItem {
  level: LevelRow;
  status: ProgressStatus;
  revealed: boolean;
  displayUrl: string;
  /** Signed URL del GIF/video, solo si está revelado y el nivel es especial. */
  mediaUrl: string | null;
}

export function toLevelConfig(level: LevelRow, imageUrl: string): LevelConfig {
  const c = level.config;
  const rawLimit = c.timeLimitSec;
  const timeLimitSec =
    rawLimit === 0 ? 0 : typeof rawLimit === 'number' && rawLimit > 0 ? rawLimit : DEFAULT_TIME_LIMIT_SEC;
  return {
    targetPct: c.targetPct,
    lives: c.lives,
    playerSpeed: c.playerSpeed,
    timeLimitSec,
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
  return (
    t >= new Date(season.offer_starts_at).getTime() && t < new Date(season.offer_ends_at).getTime()
  );
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
