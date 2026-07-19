import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLevelsWithProgress } from '@/services/supabase/levels';
import { fetchActiveSeason, fetchNextSeason, hasSeasonPass, seasonPricing } from '@/services/supabase/seasons';
import {
  ENERGY_PACK_PRICE_CLP,
  fetchUserEnergy,
  formatRefillCountdown,
  startEnergyPackCheckout,
  type EnergyStatus,
} from '@/services/supabase/energy';
import { fullscreenService } from '@/services/fullscreen/FullscreenService';
import { markFirstLevelCompleted } from '@/services/pwa/installPrompt';
import { formatClp } from '@/types/database';
import type { LevelListItem, SeasonRow } from '@/types/database';
import {
  formatAvailableAt,
  isSeasonTeaserWindow,
  milestonesForTotal,
  seasonProgress,
  seasonRhythmHint,
  starsForLevel,
} from '@/features/progression/progression';
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
  const [nextSeason, setNextSeason] = useState<SeasonRow | null>(null);
  const [owned, setOwned] = useState(false);
  const [energy, setEnergy] = useState<EnergyStatus | null>(null);
  const [buyingPack, setBuyingPack] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
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
      const [list, pass, energyStatus, teaser] = await Promise.all([
        fetchLevelsWithProgress(active.id),
        hasSeasonPass(active.id),
        fetchUserEnergy().catch(() => null),
        fetchNextSeason(active).catch(() => null),
      ]);
      setSeason(active);
      setNextSeason(teaser);
      setOwned(pass);
      setEnergy(energyStatus);
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

  useEffect(() => {
    if (!energy || energy.hearts >= energy.max || !energy.nextRefillAt) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [energy]);

  useEffect(() => {
    if (!energy?.nextRefillAt) return;
    if (new Date(energy.nextRefillAt).getTime() > Date.now()) return;
    void fetchUserEnergy()
      .then(setEnergy)
      .catch(() => undefined);
  }, [energy, nowTick]);

  async function playLevel(levelId: string) {
    await fullscreenService.request();
    navigate(`/play/${levelId}`);
  }

  async function buyEnergyPack() {
    setPackError(null);
    setBuyingPack(true);
    try {
      const { url } = await startEnergyPackCheckout();
      window.location.href = url;
    } catch (e) {
      setPackError(e instanceof Error ? e.message : 'No se pudo abrir el pago');
      setBuyingPack(false);
    }
  }

  function onTile(item: LevelListItem) {
    // Especial ya revelado sin pase: ver en galería (no rejugar)
    if (item.status === 'completed' && item.needsPass) {
      navigate(`/gallery?level=${item.level.id}`);
      return;
    }
    if (item.status === 'upcoming') return;
    if (item.status === 'gated' && season) {
      navigate(`/pase/${season.id}`);
      return;
    }
    const playable = item.status === 'unlocked' || item.status === 'completed';
    if (playable) void playLevel(item.level.id);
  }

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const total = Math.max(items.length, 1);
  const progress = seasonProgress(completedCount, total);
  const pricing = season ? seasonPricing(season) : null;
  const specialCount = items.filter((i) => i.level.media_type !== 'image').length;
  const showPassBanner = Boolean(season && !owned && specialCount > 0);
  const refillLabel = energy
    ? formatRefillCountdown(energy.nextRefillAt, nowTick)
    : null;
  const rhythm = seasonRhythmHint(
    items.map((i) => ({
      status: i.status,
      availableAt: i.level.available_at,
      bestPct: i.bestPct,
      targetPct: i.level.config.targetPct,
    })),
  );
  const showTeaser = Boolean(
    season && nextSeason && isSeasonTeaserWindow(season.ends_at),
  );

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
            {season ? season.name : 'Toca un nivel disponible'}
          </p>
        </div>
      </header>

      {!loading && energy && (
        <div
          className={`levels-energy-bar${energy.hearts === 0 && !owned ? ' is-empty' : ''}`}
          role="status"
          aria-label={
            owned
              ? 'Pase activo: corazones ilimitados'
              : `${energy.hearts} de ${energy.max} corazones para jugar`
          }
        >
          <span className="levels-energy-hearts" aria-hidden>
            {'♥'.repeat(owned ? energy.max : energy.hearts)}
            {'♡'.repeat(owned ? 0 : Math.max(0, energy.max - energy.hearts))}
          </span>
          <div className="levels-energy-meta">
            <strong>{owned ? 'Ilimitados con pase' : `${energy.hearts} de ${energy.max} corazones`}</strong>
            {!owned && energy.hearts < energy.max && refillLabel && refillLabel !== 'ya' && (
              <span>Se recarga 1 en {refillLabel}</span>
            )}
            {!owned && energy.hearts === 0 && (
              <span>Sin corazones no puedes jugar · se pierde 1 al fallar</span>
            )}
            {owned && <span>Fallar no gasta corazones</span>}
          </div>
          {!owned && energy.hearts < energy.max && (
            <button
              type="button"
              className="levels-energy-pack"
              disabled={buyingPack}
              onClick={() => void buyEnergyPack()}
            >
              {buyingPack ? 'Abriendo…' : `Pack ${energy.max}♥ · ${formatClp(ENERGY_PACK_PRICE_CLP)}`}
            </button>
          )}
          {packError && <p className="levels-energy-pack-error">{packError}</p>}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div
          className="levels-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.completed}
          aria-label={`Progreso: ${progress.completed} de ${progress.total} niveles`}
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
            {completedCount}/{total} hechos
            {progress.nextMilestone != null ? ` · Hito ${progress.nextMilestone}` : ''}
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
              Pase: GIF y video de temporadas liberadas
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

      {rhythm && (
        <div className="levels-rhythm" role="status">
          {rhythm.kind === 'drip' && (
            <p>
              Más niveles pronto
              {rhythm.nextAt ? (
                <>
                  {' '}
                  · el siguiente llega <strong>{formatAvailableAt(rhythm.nextAt)}</strong>
                </>
              ) : null}
              {rhythm.imperfect > 0 ? (
                <>
                  {' '}
                  · mientras, caza 3★ ({rhythm.imperfect} por mejorar)
                </>
              ) : null}
            </p>
          )}
          {rhythm.kind === 'stars' && (
            <p>
              Temporada al día · perfecciona a <strong>3★</strong> ({rhythm.imperfect} niveles)
            </p>
          )}
          {rhythm.kind === 'caught_up' && (
            <p>Estás al día en esta temporada{showTeaser ? '' : '.'}</p>
          )}
        </div>
      )}

      {showTeaser && nextSeason && (
        <div className="levels-teaser" role="status">
          <strong>Pronto: {nextSeason.name}</strong>
          <span>
            Empieza{' '}
            {new Date(nextSeason.starts_at).toLocaleDateString('es-CL', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
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
            const upcoming = status === 'upcoming';
            return (
              <li key={level.id} style={{ '--i': Math.min(index, 14) } as CSSProperties}>
                <button
                  type="button"
                  className={`level-tile ${status}`}
                  disabled={!playable && !gated}
                  onClick={() => onTile(item)}
                  aria-label={
                    item.status === 'completed' && item.needsPass
                      ? `Ver ${level.name} en galería`
                      : upcoming
                        ? `${level.name}: próximamente${level.available_at ? ` ${formatAvailableAt(level.available_at)}` : ''}`
                        : gated
                          ? `${level.name}: requiere pase (GIF/video)`
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
                    ) : status === 'upcoming' ? (
                      <span className="level-soon-badge">
                        Pronto
                        {level.available_at ? ` · ${formatAvailableAt(level.available_at)}` : ''}
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
                    {attempts > 0 && status !== 'completed' && status !== 'gated' && status !== 'upcoming' && (
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
