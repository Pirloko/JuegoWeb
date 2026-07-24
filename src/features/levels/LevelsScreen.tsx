import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLevelsWithProgress } from '@/services/supabase/levels';
import {
  canAccessSeason,
  fetchNextSeason,
  fetchSeasons,
  hasSeasonPass,
  PASS_MONTHLY_PRICE_CLP,
} from '@/services/supabase/seasons';
import {
  ENERGY_PACK_PRICE_CLP,
  fetchUserEnergy,
  formatRefillCountdown,
  startEnergyPackCheckout,
  type EnergyStatus,
} from '@/services/supabase/energy';
import { fullscreenService } from '@/services/fullscreen/FullscreenService';
import { markFirstLevelCompleted } from '@/services/pwa/installPrompt';
import { formatClp, levelRequiresPass } from '@/types/database';
import type { LevelListItem, SeasonRow } from '@/types/database';
import {
  formatAvailableAt,
  isSeasonTeaserWindow,
  seasonRhythmHint,
  starsForLevel,
  countableStarsTowardSeasonGate,
} from '@/features/progression/progression';
import './levels.css';

type SeasonTab = {
  season: SeasonRow;
  unlocked: boolean;
};

function formatTime(ms: number | null): string {
  if (ms == null) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Etiqueta corta del chip: "Julio", "Agosto" (prioriza el nombre de la temporada). */
function seasonChipLabel(season: SeasonRow): string {
  const first = season.name.trim().split(/\s+/)[0] ?? '';
  if (first.length >= 3) {
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  // Fallback: mes en UTC para no correr el mes por zona horaria
  const d = new Date(season.starts_at);
  const fromDate = d.toLocaleDateString('es-CL', { month: 'long', timeZone: 'UTC' });
  return fromDate.charAt(0).toUpperCase() + fromDate.slice(1);
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
  const [tabs, setTabs] = useState<SeasonTab[]>([]);
  const [season, setSeason] = useState<SeasonRow | null>(null);
  const [nextSeason, setNextSeason] = useState<SeasonRow | null>(null);
  const [owned, setOwned] = useState(false);
  const [energy, setEnergy] = useState<EnergyStatus | null>(null);
  const [buyingPack, setBuyingPack] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [items, setItems] = useState<LevelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTabLocks = useCallback(async (current: SeasonTab[]) => {
    const next = await Promise.all(
      current.map(async (t) => ({
        season: t.season,
        unlocked: await canAccessSeason(t.season.id).catch(() => false),
      })),
    );
    setTabs(next);
  }, []);

  const loadSeasonContent = useCallback(
    async (selected: SeasonRow) => {
      setLoadingLevels(true);
      setError(null);
      try {
        const [list, pass, teaser] = await Promise.all([
          fetchLevelsWithProgress(selected.id),
          hasSeasonPass(selected.id),
          fetchNextSeason(selected).catch(() => null),
        ]);
        setSeason(selected);
        setNextSeason(teaser);
        setOwned(pass);
        setItems(list);
        if (list.some((i) => i.status === 'completed')) {
          markFirstLevelCompleted();
        }
        setTabs((prev) => {
          if (prev.length > 0) void refreshTabLocks(prev);
          return prev;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar niveles');
        setItems([]);
      } finally {
        setLoadingLevels(false);
      }
    },
    [refreshTabLocks],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allSeasons, energyStatus] = await Promise.all([
        fetchSeasons(),
        fetchUserEnergy().catch(() => null),
      ]);
      setEnergy(energyStatus);

      const sorted = [...allSeasons].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const access = await Promise.all(
        sorted.map(async (s) => ({
          season: s,
          unlocked: await canAccessSeason(s.id).catch(() => false),
        })),
      );

      // Catálogo: activas, ya empezadas, o desbloqueadas; más la primera futura bloqueada.
      const nowIso = new Date().toISOString();
      const catalog: SeasonTab[] = [];
      for (const tab of access) {
        const started = tab.season.starts_at <= nowIso;
        if (tab.season.is_active || started || tab.unlocked) {
          catalog.push(tab);
          continue;
        }
        // Primera temporada futura (teaser con candado)
        if (catalog.length > 0) {
          catalog.push(tab);
          break;
        }
      }
      // Si no hay ninguna empezada, mostrar activas + primera del listado
      if (catalog.length === 0 && access.length > 0) {
        catalog.push(...access.filter((t) => t.season.is_active));
        if (catalog.length === 0) catalog.push(access[0]!);
      }

      setTabs(catalog);

      const preferred =
        catalog.find((t) => t.season.is_active && t.unlocked)?.season ??
        catalog.find((t) => t.unlocked)?.season ??
        null;

      if (!preferred) {
        setSeason(null);
        setItems([]);
        setError('No hay temporada disponible');
        return;
      }

      await loadSeasonContent(preferred);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar niveles');
      setSeason(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [loadSeasonContent]);

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

  async function selectSeason(tab: SeasonTab) {
    if (!tab.unlocked) return;
    if (season?.id === tab.season.id) return;
    await loadSeasonContent(tab.season);
  }

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
    if (item.status === 'completed' && item.needsPass) {
      navigate(`/gallery?level=${item.level.id}`);
      return;
    }
    if (item.status === 'upcoming') return;
    if (item.status === 'gated' && season) {
      navigate('/pase');
      return;
    }
    const playable = item.status === 'unlocked' || item.status === 'completed';
    if (playable) void playLevel(item.level.id);
  }

  const specialCount = items.filter((i) => i.level.requires_pass).length;
  const showPassBanner = Boolean(season && !owned && specialCount > 0);
  const refillLabel = energy
    ? formatRefillCountdown(energy.nextRefillAt, nowTick)
    : null;
  const starLevels = items.map((i) => ({
    bestPct: i.bestPct,
    targetPct: i.level.config.targetPct,
    requiresPass: levelRequiresPass(i.level.requires_pass),
  }));
  const starsEarned = countableStarsTowardSeasonGate(starLevels);
  const starsRequired = season?.stars_required_to_unlock_next ?? 0;
  const starsRemaining = Math.max(0, starsRequired - starsEarned);
  const starsGatePct =
    starsRequired > 0 ? Math.min(100, Math.round((100 * starsEarned) / starsRequired)) : 100;
  const starsGateMet = starsRequired <= 0 || starsEarned >= starsRequired;
  const rhythm = seasonRhythmHint(
    items.map((i) => ({
      status: i.status,
      availableAt: i.level.available_at,
      bestPct: i.bestPct,
      targetPct: i.level.config.targetPct,
    })),
  );
  const showTeaser = Boolean(season && nextSeason && isSeasonTeaserWindow(season.ends_at));
  const busy = loading || loadingLevels;

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
            {season ? season.name : 'Elige una temporada'}
          </p>
        </div>
        {!loading && energy && (
          <button
            type="button"
            className={`levels-hearts-chip${energy.hearts === 0 && !owned ? ' is-empty' : ''}${owned ? ' is-pass' : ''}`}
            disabled={owned || energy.hearts >= energy.max || buyingPack}
            onClick={() => {
              if (!owned && energy.hearts < energy.max) void buyEnergyPack();
            }}
            aria-label={
              owned
                ? 'Pase activo: corazones ilimitados'
                : `${energy.hearts} de ${energy.max} corazones${
                    energy.hearts < energy.max && refillLabel && refillLabel !== 'ya'
                      ? `, se recarga 1 en ${refillLabel}`
                      : ''
                  }`
            }
            title={
              owned
                ? 'Ilimitados con pase'
                : energy.hearts < energy.max
                  ? `Pack ${energy.max}♥ · ${formatClp(ENERGY_PACK_PRICE_CLP)}`
                  : `${energy.hearts}/${energy.max} corazones`
            }
          >
            <span className="levels-hearts-chip-icons" aria-hidden>
              {owned
                ? '∞♥'
                : `${'♥'.repeat(energy.hearts)}${'♡'.repeat(Math.max(0, energy.max - energy.hearts))}`}
            </span>
          </button>
        )}
      </header>
      {packError && <p className="levels-energy-pack-error">{packError}</p>}

      {!loading && tabs.length > 0 && (
        <div className="levels-season-tabs" role="tablist" aria-label="Temporadas">
          {tabs.map((tab) => {
            const selected = season?.id === tab.season.id;
            const label = seasonChipLabel(tab.season);
            return (
              <button
                key={tab.season.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`levels-season-tab${selected ? ' is-active' : ''}${tab.unlocked ? '' : ' is-locked'}`}
                disabled={!tab.unlocked || loadingLevels}
                onClick={() => void selectSeason(tab)}
                aria-label={
                  tab.unlocked
                    ? `Temporada ${label}`
                    : `Temporada ${label}, bloqueada. Consigue más estrellas.`
                }
              >
                {!tab.unlocked && (
                  <span className="levels-season-tab-lock">
                    <LockIcon size={13} />
                  </span>
                )}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {!busy && season && items.length > 0 && starsRequired > 0 && (
        <section
          className={`levels-stars-card${starsGateMet ? ' is-ready' : ''}`}
          aria-label={`Estrellas de temporada: ${starsEarned} de ${starsRequired}`}
        >
          <div className="levels-stars-head">
            <span className="levels-stars-icon" aria-hidden>
              ★
            </span>
            <div className="levels-stars-copy">
              <strong>
                {starsEarned} / {starsRequired} ★
              </strong>
              <span>
                {starsGateMet
                  ? nextSeason
                    ? `Listo para ${seasonChipLabel(nextSeason)}`
                    : 'Meta de temporada alcanzada'
                  : nextSeason
                    ? `Te faltan ${starsRemaining} ★ para ${seasonChipLabel(nextSeason)}`
                    : `Te faltan ${starsRemaining} ★ para la siguiente temporada`}
              </span>
            </div>
            <span className="levels-stars-badge" aria-hidden>
              {starsGatePct}%
            </span>
          </div>
          <div
            className="levels-stars-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={starsRequired}
            aria-valuenow={Math.min(starsEarned, starsRequired)}
          >
            <div className="levels-stars-bar" style={{ width: `${starsGatePct}%` }} />
          </div>
        </section>
      )}

      {showPassBanner && season && (
        <button
          type="button"
          className="levels-pass-banner"
          onClick={() => navigate('/pase')}
        >
          <span className="levels-pass-left">
            <CrownIcon />
            <span>
              Juega niveles con contenido premium por tan solo {formatClp(PASS_MONTHLY_PRICE_CLP)} al
              mes.
            </span>
          </span>
          <span className="levels-pass-chevron" aria-hidden>
            ›
          </span>
        </button>
      )}

      {rhythm && !busy && (
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

      {showTeaser && nextSeason && !busy && (
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

      {busy && <p className="levels-msg">Cargando niveles…</p>}
      {error && !busy && (
        <div className="levels-msg">
          <p className="levels-error">{error}</p>
          <button type="button" className="btn-ghost" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}

      {!busy && !error && (
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
                          ? `${level.name}: requiere membresía`
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
                    {attempts > 0 &&
                      status !== 'completed' &&
                      status !== 'gated' &&
                      status !== 'upcoming' && (
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
