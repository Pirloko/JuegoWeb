import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLevelsWithProgress } from '@/services/supabase/levels';
import { fetchActiveSeason, hasSeasonPass, seasonPricing } from '@/services/supabase/seasons';
import { fullscreenService } from '@/services/fullscreen/FullscreenService';
import { markFirstLevelCompleted } from '@/services/pwa/installPrompt';
import { formatClp, FREE_LEVEL_MAX, LEVELS_PER_SEASON } from '@/types/database';
import type { LevelListItem, SeasonRow } from '@/types/database';
import { milestonesForTotal, seasonProgress, starsForLevel } from '@/features/progression/progression';
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

function CrownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 18h18l-1.5-9-4.5 3.5L12 5l-3 7.5L4.5 9 3 18Z" />
    </svg>
  );
}

function LockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
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
  const total = Math.max(items.length, LEVELS_PER_SEASON);
  const progress = seasonProgress(completedCount, total);
  const pricing = season ? seasonPricing(season) : null;
  const showPassBanner = Boolean(season && !owned && items.some((i) => i.needsPass));

  return (
    <main className="levels">
      <header className="levels-header">
        <button
          type="button"
          className="levels-back"
          aria-label="Volver"
          onClick={() => navigate('/')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden
          >
            <path d="M15 18 9 12l6-6" />
          </svg>
        </button>
        <div className="levels-heading">
          <h1 className="levels-title">Niveles</h1>
          <p className="levels-sub">
            {season
              ? `${season.name} · Free 1–${FREE_LEVEL_MAX}`
              : 'Toca un nivel disponible'}
          </p>
        </div>
        {!loading && items.length > 0 && (
          <span className="levels-count-chip">
            {completedCount}/{total}
          </span>
        )}
      </header>

      {!loading && items.length > 0 && (
        <div
          className="levels-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.completed}
          aria-label={`Progreso: ${progress.completed} de ${progress.total}`}
        >
          <div className="levels-progress-track">
            <div className="levels-progress-bar" style={{ width: `${progress.pct}%` }} />
            {milestonesForTotal(progress.total)
              .filter((m) => m < progress.total)
              .map((m) => (
                <span
                  key={m}
                  className={`levels-progress-tick${m <= progress.completed ? ' is-reached' : ''}`}
                  style={{ left: `${(m / progress.total) * 100}%` }}
                  aria-hidden
                />
              ))}
            <span className="levels-progress-spark" aria-hidden />
          </div>
          <span className="levels-progress-label">
            {progress.nextMilestone != null
              ? `Hito ${progress.nextMilestone}`
              : 'Temporada completa'}
          </span>
        </div>
      )}

      {showPassBanner && season && pricing && (
        <button
          type="button"
          className="levels-pass-banner"
          onClick={() => navigate(`/pase/${season.id}`)}
        >
          <span className="levels-pass-left">
            <CrownIcon />
            <span>
              Suscripción {FREE_LEVEL_MAX + 1}–{LEVELS_PER_SEASON}
              {' · '}
              {pricing.onOffer && <s className="levels-pass-list">{formatClp(pricing.listClp)}</s>}{' '}
              {formatClp(pricing.effectiveClp)}/mes
            </span>
          </span>
          <span className="levels-pass-chevron" aria-hidden>
            ›
          </span>
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
          {items.map((item, index) => {
            const { level, status, bestPct, bestTimeMs, attempts } = item;
            const playable = status === 'unlocked' || status === 'completed';
            const gated = status === 'gated';
            return (
              <li key={level.id} style={{ '--i': Math.min(index, 14) } as CSSProperties}>
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
                  <img
                    className="level-tile-bg"
                    src={item.thumbUrl}
                    alt=""
                    draggable={false}
                    loading="lazy"
                  />
                  <span className="level-tile-scrim" aria-hidden />
                  <span className="level-tile-body">
                    <span className="level-num">{level.sort_order}</span>
                    {level.media_type !== 'image' && (
                      <span className={`level-media-dot ${level.media_type}`} aria-hidden>
                        {level.media_type === 'video' ? '▶' : 'GIF'}
                      </span>
                    )}
                    <span className="level-tile-name">{level.name}</span>
                    {status === 'locked' ? (
                      <span className="level-lock-badge">
                        <LockIcon />
                        Bloqueado
                      </span>
                    ) : status === 'gated' ? (
                      <span className="level-pass-badge">
                        <CrownIcon />
                        Pase
                      </span>
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
                  </span>
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
