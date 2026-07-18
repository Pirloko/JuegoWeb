import { getSupabase } from '@/services/supabase/client';
import {
  createSignedImageUrl,
  localLevelImageUrl,
  resolveLevelImageUrl,
  resolvePlayableLevelImageUrl,
} from '@/services/supabase/storage';
import { fetchActiveSeason, hasSeasonPass } from '@/services/supabase/seasons';
import type {
  GalleryItem,
  LevelListItem,
  LevelRow,
  ProgressRow,
  ProgressStatus,
} from '@/types/database';
import { FREE_LEVEL_MAX, toLevelConfig } from '@/types/database';
import type { LevelConfig } from '@/types/level';

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
      const needsPass = level.sort_order > FREE_LEVEL_MAX && !owned;
      let status: ProgressStatus = p?.status ?? 'locked';
      if (needsPass && status !== 'completed') {
        status = 'gated';
      }
      const thumbUrl = await resolveLevelImageUrl(level.thumb_path, level.sort_order);
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
  const needsPass = row.sort_order > FREE_LEVEL_MAX && !owned;
  const status: ProgressStatus = (progress as ProgressRow | null)?.status ?? 'locked';

  if (needsPass) {
    return {
      level: row,
      config: toLevelConfig(row, localLevelImageUrl(row.sort_order)),
      status: 'gated',
      needsPass: true,
    };
  }

  if (status === 'locked') {
    return {
      level: row,
      config: toLevelConfig(row, localLevelImageUrl(row.sort_order)),
      status,
      needsPass: false,
    };
  }

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
      const path = revealed ? level.image_path : level.thumb_path;
      const displayUrl = await resolveLevelImageUrl(path, level.sort_order);
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
