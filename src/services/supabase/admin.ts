import { getSupabase } from '@/services/supabase/client';
import type { LevelConfigJson, LevelMediaType, LevelRow, SeasonRow } from '@/types/database';
import { LEVEL_IMAGE_MAX_BYTES } from '@/services/images/prepareLevelImage';
import { LEVEL_MEDIA_MAX_BYTES } from '@/services/images/prepareLevelMedia';

const BUCKET = 'level-images';

export function defaultLevelConfig(): LevelConfigJson {
  return {
    targetPct: 60,
    lives: 3,
    playerSpeed: 280,
    minTimeMs: 8000,
    cellSize: 8,
    enemies: [{ type: 'basic', speed: 200 }],
    powerUps: [
      {
        type: 'bomb',
        spawn: { delayMs: 8000, max: 2 },
        params: { radiusCells: 10 },
      },
    ],
  };
}

export function pathsForSortOrder(sortOrder: number): { image_path: string; thumb_path: string } {
  return {
    image_path: `level-${sortOrder}/full.webp`,
    thumb_path: `level-${sortOrder}/thumb.webp`,
  };
}

/** Lista todos los niveles (incl. inactivos). Solo admin (RLS). */
export async function fetchAllLevelsAdmin(seasonId?: string): Promise<LevelRow[]> {
  let q = getSupabase().from('levels').select('*').order('sort_order', { ascending: true });
  if (seasonId) q = q.eq('season_id', seasonId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as LevelRow[]) ?? [];
}

export async function fetchSeasonsAdmin(): Promise<SeasonRow[]> {
  const { data, error } = await getSupabase()
    .from('seasons')
    .select('*')
    .order('starts_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SeasonRow[]) ?? [];
}

export interface SeasonWriteInput {
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

export async function createSeason(input: SeasonWriteInput): Promise<SeasonRow> {
  const { data, error } = await getSupabase().from('seasons').insert(input).select('*').single();
  if (error) throw new Error(error.message);
  return data as SeasonRow;
}

export async function updateSeason(id: string, input: SeasonWriteInput): Promise<SeasonRow> {
  const { data, error } = await getSupabase()
    .from('seasons')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as SeasonRow;
}

/** Otorga pase (testing / soporte). Requiere is_admin. */
export async function adminGrantSeasonPass(
  userId: string,
  seasonId: string,
  amountClp: number,
): Promise<void> {
  const { error } = await getSupabase().rpc('grant_season_pass', {
    p_user_id: userId,
    p_season_id: seasonId,
    p_amount_clp: amountClp,
    p_provider: 'admin',
    p_provider_ref: `admin-${Date.now()}`,
  });
  if (error) throw new Error(error.message);
}

export async function fetchLevelAdmin(id: string): Promise<LevelRow | null> {
  const { data, error } = await getSupabase().from('levels').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LevelRow | null;
}

export interface LevelWriteInput {
  season_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  config: LevelConfigJson;
  image_path: string;
  thumb_path: string;
  media_type: LevelMediaType;
  media_path: string | null;
  source_url: string | null;
}

export async function createLevel(input: LevelWriteInput): Promise<LevelRow> {
  const { data, error } = await getSupabase().from('levels').insert(input).select('*').single();
  if (error) throw new Error(error.message);
  return data as LevelRow;
}

export async function updateLevel(id: string, input: LevelWriteInput): Promise<LevelRow> {
  const { data, error } = await getSupabase()
    .from('levels')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as LevelRow;
}

export async function deleteLevel(id: string): Promise<void> {
  const { error } = await getSupabase().from('levels').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function uploadLevelImage(
  path: string,
  file: Blob,
  contentType: string = 'image/webp',
): Promise<void> {
  if (file.size > LEVEL_IMAGE_MAX_BYTES) {
    throw new Error(`Imagen demasiado pesada (máx. ${LEVEL_IMAGE_MAX_BYTES / 1024} KB)`);
  }

  const { error } = await getSupabase().storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

/** Sube el GIF/video especial de un nivel (validado en prepareLevelMedia). */
export async function uploadLevelMedia(
  path: string,
  file: Blob,
  contentType: string,
): Promise<void> {
  if (file.size > LEVEL_MEDIA_MAX_BYTES) {
    throw new Error(
      `Media demasiado pesada (máx. ${Math.round(LEVEL_MEDIA_MAX_BYTES / (1024 * 1024))} MB)`,
    );
  }

  const { error } = await getSupabase().storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
}
