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
    timeLimitSec: 120,
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

/** @deprecated Colisiona entre temporadas (sort_order reinicia en cada una). */
export function pathsForSortOrder(sortOrder: number): { image_path: string; thumb_path: string } {
  return {
    image_path: `level-${sortOrder}/full.webp`,
    thumb_path: `level-${sortOrder}/thumb.webp`,
  };
}

/**
 * Carpeta única por nivel. `sort_order` reinicia en cada temporada, así que el
 * slug de la temporada tiene que entrar en la ruta o el nivel 1 de Agosto
 * pisaría la foto del nivel 1 de Julio.
 *
 * Un solo segmento: la política de Storage autoriza por carpeta
 * (`split_part(image_path, '/', 1)`), así que anidar filtraría toda la temporada.
 */
export function levelFolder(seasonSlug: string, sortOrder: number): string {
  const slug = seasonSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `s-${slug}-level-${sortOrder}` : `level-${sortOrder}`;
}

export function pathsForLevel(
  seasonSlug: string,
  sortOrder: number,
): { image_path: string; thumb_path: string; folder: string } {
  const folder = levelFolder(seasonSlug, sortOrder);
  return {
    folder,
    image_path: `${folder}/full.webp`,
    thumb_path: `${folder}/thumb.webp`,
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
  price_clp: number;
  offer_price_clp: number | null;
  offer_starts_at: string | null;
  offer_ends_at: string | null;
  is_active: boolean;
  stars_required_to_unlock_next: number;
}

export async function createSeason(input: SeasonWriteInput): Promise<SeasonRow> {
  const { data, error } = await getSupabase()
    .from('seasons')
    .insert({ ...input, ends_at: null })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as SeasonRow;
}

export async function updateSeason(id: string, input: SeasonWriteInput): Promise<SeasonRow> {
  const { data, error } = await getSupabase()
    .from('seasons')
    .update({ ...input, ends_at: null })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as SeasonRow;
}

/** Borra temporada y, en cascada, sus niveles y entitlements. */
export async function deleteSeason(id: string): Promise<void> {
  const { error } = await getSupabase().from('seasons').delete().eq('id', id);
  if (error) throw new Error(error.message);
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

/** Rellena corazones al máximo (testing / soporte). Requiere is_admin. */
export async function adminGrantEnergyPack(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('grant_energy_pack', {
    p_user_id: userId,
    p_provider: 'admin',
    p_provider_ref: `admin-energy-${Date.now()}`,
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
  /** ISO o null = disponible ya. */
  available_at: string | null;
  /** Exige pase (independiente del media). */
  requires_pass: boolean;
  /** SHA-256 de la foto original; obligatorio al crear. */
  image_sha256: string;
}

export type LevelImageDuplicate = {
  id: string;
  name: string;
  sort_order: number;
  season_id: string;
  season_name: string | null;
};

/** Busca un nivel que ya use esta foto (por SHA-256). */
export async function findLevelByImageSha256(
  sha256: string,
  excludeLevelId?: string,
): Promise<LevelImageDuplicate | null> {
  let q = getSupabase()
    .from('levels')
    .select('id, name, sort_order, season_id, seasons(name)')
    .eq('image_sha256', sha256);

  if (excludeLevelId) {
    q = q.neq('id', excludeLevelId);
  }

  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as {
    id: string;
    name: string;
    sort_order: number;
    season_id: string;
    seasons: { name: string } | { name: string }[] | null;
  };

  const seasonRel = row.seasons;
  const seasonName = Array.isArray(seasonRel)
    ? (seasonRel[0]?.name ?? null)
    : (seasonRel?.name ?? null);

  return {
    id: row.id,
    name: row.name,
    sort_order: row.sort_order,
    season_id: row.season_id,
    season_name: seasonName,
  };
}

export function formatImageDuplicate(dup: LevelImageDuplicate): string {
  const where = dup.season_name
    ? `${dup.name} · ${dup.season_name}`
    : `${dup.name} (#${dup.sort_order})`;
  return `Esta foto ya está en «${where}». Elige otra.`;
}

export async function createLevel(input: LevelWriteInput): Promise<LevelRow> {
  const { data, error } = await getSupabase().from('levels').insert(input).select('*').single();
  if (error) {
    if (error.code === '23505' && /image_sha256/i.test(error.message)) {
      throw new Error('Esta foto ya está usada en otro nivel. Elige otra.');
    }
    throw new Error(error.message);
  }
  return data as LevelRow;
}

export async function updateLevel(id: string, input: LevelWriteInput): Promise<LevelRow> {
  const { data, error } = await getSupabase()
    .from('levels')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505' && /image_sha256/i.test(error.message)) {
      throw new Error('Esta foto ya está usada en otro nivel. Elige otra.');
    }
    throw new Error(error.message);
  }
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
