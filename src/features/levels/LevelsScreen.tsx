import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLevelsWithProgress } from '@/services/supabase/levels';
import { fetchActiveSeason, hasSeasonPass, seasonPricing } from '@/services/supabase/seasons';
import { fullscreenService } from '@/services/fullscreen/FullscreenService';
import { markFirstLevelCompleted } from '@/services/pwa/installPrompt';
import { formatClp, FREE_LEVEL_MAX, LEVELS_PER_SEASON } from '@/types/database';
import type { LevelListItem, SeasonRow } from '@/types/database';
import SeasonProgress from '@/features/progression/SeasonProgress';
import { starsForLevel } from '@/features/progression/progression';
import './levels.css';

function formatTime(ms: number | null): string {
  if (ms == null) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

function Stars({ bestPct, targetPct }: { bestPct: number | null; targetPct: number }) {
  const n = starsForLevel(bestPct, targetPct);
  return (
    <span className="level-stars" aria-label={`${n} de 3 estrellas`}>
      {'★'.repeat(n)}
      {'☆'.repeat(3 - n)}
    </span>
  );
}

export default function LevelsScreen() {
  const navigate = useNavigate();
  const [season, setSeason] = useState<SeasonRow | null>(null);
  const [owned, setOwned] = useState(false);
  const [items, setItems] = useState<LevelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await fetchActiveSeason();
      if (!active) {
        setSeason(null);
        setItems([]);
        setError('No hay temporada activa');
        return;
      }
      const [list, pass] = await Promise.all([
        fetchLevelsWithProgress(active.id),
        hasSeasonPass(active.id),
      ]);
      setSeason(active);
      setOwned(pass);
      setItems(list);
      if (list.some((i) => i.status === 'completed')) {
        markFirstLevelCompleted();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar niveles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function playLevel(levelId: string) {
    await fullscreenService.request();
    navigate(`/play/${levelId}`);
  }

  function onTile(item: LevelListItem) {
    if (item.status === 'gated' && season) {
      navigate(`/pase/${season.id}`);
      return;
    }
    const playable = item.status === 'unlocked' || item.status === 'completed';
    if (playable) void playLevel(item.level.id);
  }

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const pricing = season ? seasonPricing(season) : null;
  const showPassBanner = Boolean(season && !owned && items.some((i) => i.needsPass));

  return (
    <main className="levels">
      <header className="levels-header">
        <div>
          <h1 className="page-title">Niveles</h1>
          <p className="page-sub">
            {season ? `${season.name} · free 1–${FREE_LEVEL_MAX}` : 'Toca un nivel disponible'}
          </p>
        </div>
      </header>

      {!loading && items.length > 0 && (
        <SeasonProgress
          completed={completedCount}
          total={Math.max(items.length, LEVELS_PER_SEASON)}
          variant="compact"
        />
      )}

      {showPassBanner && season && pricing && (
        <button
          type="button"
          className="levels-pass-banner"
          onClick={() => navigate(`/pase/${season.id}`)}
        >
          <span>
            Suscripción {FREE_LEVEL_MAX + 1}–{LEVELS_PER_SEASON} ·{' '}
            {pricing.onOffer && <s className="levels-pass-list">{formatClp(pricing.listClp)}</s>}{' '}
            {formatClp(pricing.effectiveClp)}/mes
          </span>
          <span aria-hidden>›</span>
        </button>
      )}

      {loading && <p className="levels-msg">Cargando niveles…</p>}
      {error && (
        <div className="levels-msg">
          <p className="levels-error">{error}</p>
          <button type="button" className="btn-ghost" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && (
        <ul className="levels-grid">
          {items.map((item) => {
            const { level, status, bestPct, bestTimeMs, attempts } = item;
            const playable = status === 'unlocked' || status === 'completed';
            const gated = status === 'gated';
            return (
              <li key={level.id}>
                <button
                  type="button"
                  className={`level-tile ${status}`}
                  disabled={!playable && !gated}
                  onClick={() => onTile(item)}
                  aria-label={
                    gated
                      ? `${level.name}: requiere pase de temporada`
                      : playable
                        ? `Jugar ${level.name}`
                        : `${level.name}, bloqueado. Completa el anterior.`
                  }
                >
                  <span className="level-num">{level.sort_order}</span>
                  {level.media_type !== 'image' && (
                    <span className={`level-media-dot ${level.media_type}`} aria-hidden>
                      {level.media_type === 'video' ? '▶' : 'GIF'}
                    </span>
                  )}
                  <span className="level-tile-name">{level.name}</span>
                  {status === 'locked' ? (
                    <span className="level-lock-badge">Bloqueado</span>
                  ) : status === 'gated' ? (
                    <span className="level-pass-badge">Pase</span>
                  ) : status === 'completed' ? (
                    <>
                      <Stars bestPct={bestPct} targetPct={level.config.targetPct} />
                      <span className="level-tile-meta">
                        {bestPct != null ? `${Math.floor(bestPct)}%` : '—'} ·{' '}
                        {formatTime(bestTimeMs)}
                      </span>
                    </>
                  ) : (
                    <span className="level-play-badge">Jugar</span>
                  )}
                  {attempts > 0 && status !== 'completed' && status !== 'gated' && (
                    <span className="level-tile-meta">{attempts} intentos</span>
                  )}
                </button>
              </li>
            );
          })}
          {items.length === 0 && <p className="levels-msg">No hay niveles activos.</p>}
        </ul>
      )}
    </main>
  );
}
