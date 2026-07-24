import { getSupabase } from '@/services/supabase/client';
import {
  createSignedImageUrl,
  LOCKED_LEVEL_PLACEHOLDER,
  resolveLevelImageUrl,
  resolvePlayableLevelImageUrl,
} from '@/services/supabase/storage';
import { fetchActiveSeason, hasSeasonPass } from '@/services/supabase/seasons';
import { isLevelReleased } from '@/features/progression/progression';
import type {
  GalleryItem,
  LevelListItem,
  LevelRow,
  ProgressRow,
  ProgressStatus,
} from '@/types/database';
import { levelRequiresPass, toLevelConfig } from '@/types/database';
import type { LevelConfig } from '@/types/level';

/** En lista/galería: solo completed descarga bytes reales (anti-spoiler DevTools). */
function canFetchLevelImage(status: ProgressStatus): boolean {
  return status === 'completed';
}

export async function fetchLevelsWithProgress(seasonId: string): Promise<LevelListItem[]> {
  const supabase = getSupabase();

  const [{ data: levels, error: levelsError }, { data: progress, error: progressError }, owned] =
    await Promise.all([
      supabase
        .from('levels')
        .select('*')
        .eq('is_active', true)
        .eq('season_id', seasonId)
        .order('sort_order', { ascending: true }),
      supabase.from('user_level_progress').select('*'),
      hasSeasonPass(seasonId),
    ]);

  if (levelsError) throw new Error(levelsError.message);
  if (progressError) throw new Error(progressError.message);

  const byLevel = new Map((progress as ProgressRow[] | null)?.map((p) => [p.level_id, p]) ?? []);
  const rows = (levels as LevelRow[] | null) ?? [];

  return Promise.all(
    rows.map(async (level) => {
      const p = byLevel.get(level.id);
      const special = levelRequiresPass(level.requires_pass);
      const needsPass = special && !owned;
      let status: ProgressStatus = p?.status ?? 'locked';
      if (needsPass && status !== 'completed') {
        status = 'gated';
      }
      if (!isLevelReleased(level.available_at) && status !== 'completed') {
        status = 'upcoming';
      }
      // Locked/gated/upcoming: NUNCA firmar thumb (spoiler vía DevTools).
      const thumbUrl = canFetchLevelImage(status)
        ? await resolveLevelImageUrl(level.thumb_path, level.sort_order)
        : LOCKED_LEVEL_PLACEHOLDER;
      return {
        level,
        status,
        bestPct: p?.best_pct ?? null,
        bestTimeMs: p?.best_time_ms ?? null,
        attempts: p?.attempts ?? 0,
        needsPass,
        thumbUrl,
      };
    }),
  );
}

export async function fetchPlayableLevel(levelId: string): Promise<{
  level: LevelRow;
  config: LevelConfig;
  status: ProgressStatus;
  needsPass: boolean;
} | null> {
  const supabase = getSupabase();

  const [{ data: level, error: levelError }, { data: progress, error: progressError }] =
    await Promise.all([
      supabase.from('levels').select('*').eq('id', levelId).eq('is_active', true).maybeSingle(),
      supabase.from('user_level_progress').select('*').eq('level_id', levelId).maybeSingle(),
    ]);

  if (levelError) throw new Error(levelError.message);
  if (progressError) throw new Error(progressError.message);
  if (!level) return null;

  const row = level as LevelRow;
  const owned = await hasSeasonPass(row.season_id);
  const needsPass = levelRequiresPass(row.requires_pass) && !owned;
  let status: ProgressStatus = (progress as ProgressRow | null)?.status ?? 'locked';

  if (!isLevelReleased(row.available_at) && status !== 'completed') {
    return {
      level: row,
      config: toLevelConfig(row, LOCKED_LEVEL_PLACEHOLDER),
      status: 'upcoming',
      needsPass,
    };
  }

  // Especial sin pase: no se juega. Si ya está revelado, el cliente manda a galería.
  if (needsPass) {
    return {
      level: row,
      config: toLevelConfig(row, LOCKED_LEVEL_PLACEHOLDER),
      status: status === 'completed' ? 'completed' : 'gated',
      needsPass: true,
    };
  }

  if (status === 'locked') {
    return {
      level: row,
      config: toLevelConfig(row, LOCKED_LEVEL_PLACEHOLDER),
      status,
      needsPass: false,
    };
  }

  // Partida: full nítida bajo la niebla (la conquista DEBE verse bien).
  // Anti-spoiler: borde no perfora; locked/gated no firman bytes.
  const imageUrl = await resolvePlayableLevelImageUrl(row.image_path, row.sort_order);

  return {
    level: row,
    config: toLevelConfig(row, imageUrl),
    status,
    needsPass: false,
  };
}

export async function fetchGallery(seasonId?: string): Promise<GalleryItem[]> {
  let season = seasonId;
  if (!season) {
    const active = await fetchActiveSeason();
    if (!active) return [];
    season = active.id;
  }

  const items = await fetchLevelsWithProgress(season);

  return Promise.all(
    items.map(async ({ level, status }) => {
      const revealed = status === 'completed';
      // Sin revelar: placeholder (no firmar thumb → no spoiler en DevTools).
      const displayUrl = revealed
        ? await resolveLevelImageUrl(level.image_path, level.sort_order)
        : LOCKED_LEVEL_PLACEHOLDER;
      const mediaUrl =
        revealed && level.media_type !== 'image' && level.media_path
          ? await createSignedImageUrl(level.media_path)
          : null;
      return { level, status, revealed, displayUrl, mediaUrl };
    }),
  );
}

export interface CompleteLevelResult {
  status: ProgressStatus;
  best_pct: number | null;
  best_time_ms: number | null;
  attempts: number;
}

export async function completeLevel(
  levelId: string,
  pct: number,
  timeMs: number,
): Promise<CompleteLevelResult> {
  const { data, error } = await getSupabase().rpc('complete_level', {
    p_level_id: levelId,
    p_pct: pct,
    p_time_ms: timeMs,
    p_session_payload: {},
  });

  if (error) throw new Error(error.message);
  return data as CompleteLevelResult;
}

/** Siguiente nivel jugable de la temporada (misma lista que el mapa). */
export async function fetchNextPlayableLevelId(
  seasonId: string,
  afterSortOrder: number,
): Promise<string | null> {
  const items = await fetchLevelsWithProgress(seasonId);
  const next = items.find(
    (i) =>
      i.level.sort_order > afterSortOrder &&
      (i.status === 'unlocked' || i.status === 'completed') &&
      !i.needsPass,
  );
  return next?.level.id ?? null;
}
