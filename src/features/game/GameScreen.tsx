import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { LevelConfig, LevelResultStats } from '@/types/level';
import { completeLevel, fetchNextPlayableLevelId, fetchPlayableLevel } from '@/services/supabase/levels';
import { awardBadges } from '@/services/supabase/badges';
import { createSignedImageUrl, resolveCompletedImageUrl } from '@/services/supabase/storage';
import { endGameSession } from '@/services/supabase/gameSessions';
import {
  beginLevelAttempt,
  fetchUserEnergy,
  formatRefillCountdown,
  grantEnergyHearts,
  ENERGY_PACK_PRICE_CLP,
  startEnergyPackCheckout,
} from '@/services/supabase/energy';
import { formatClp } from '@/types/database';
import { BADGE_CATALOG, type BadgeId } from '@/features/progression/badgeCatalog';
import { formatAvailableAt } from '@/features/progression/progression';
import RevealedMedia from '@/components/RevealedMedia';
import type { LevelMediaType } from '@/types/database';
import { fullscreenService } from '@/services/fullscreen/FullscreenService';
import { markFirstLevelCompleted } from '@/services/pwa/installPrompt';
import { gameEvents } from './core/GameEvents';
import GameCanvas from './GameCanvas';
import './game.css';

function formatRemain(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Result {
  won: boolean;
  stats: LevelResultStats;
  saveError: string | null;
  saving: boolean;
  newBadges: BadgeId[];
  /** Signed URL del GIF/video si el nivel es especial (para el revelado). */
  mediaUrl: string | null;
  /** Full nítida (solo tras ganar + complete_level). */
  fullImageUrl: string | null;
  /** Tras pulsar "Revelar imagen". */
  revealed: boolean;
  nextLevelId: string | null;
}

export default function GameScreen() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();

  const [config, setConfig] = useState<LevelConfig | null>(null);
  const [levelName, setLevelName] = useState('');
  const [levelMedia, setLevelMedia] = useState<{ type: LevelMediaType; path: string | null }>({
    type: 'image',
    path: null,
  });
  const [fullImagePath, setFullImagePath] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gateSeasonId, setGateSeasonId] = useState<string | null>(null);
  const levelSeasonIdRef = useRef<string | null>(null);
  const [outOfEnergy, setOutOfEnergy] = useState(false);
  const [energyHearts, setEnergyHearts] = useState<number | null>(null);
  const [energyMax, setEnergyMax] = useState(5);
  const [energyWaived, setEnergyWaived] = useState(false);
  const [nextRefillLabel, setNextRefillLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingPack, setBuyingPack] = useState(false);

  const [runId, setRunId] = useState(0);
  const [pct, setPct] = useState(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [levelSortOrder, setLevelSortOrder] = useState(0);
  const [fsSupported] = useState(() => fullscreenService.isSupported());
  const [fsActive, setFsActive] = useState(() => fullscreenService.isActive());
  const [needsFsReentry, setNeedsFsReentry] = useState(false);

  const savedRef = useRef(false);
  const hadFullscreenRef = useRef(fullscreenService.isActive());
  /** Evita el modal de FS al pasar al siguiente nivel sin salir de fullscreen. */
  const skipFsPromptRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number>(0);
  const sessionClosedRef = useRef(false);
  const pendingOutcomeRef = useRef<{
    outcome: 'completed' | 'failed' | 'abandoned';
    durationMs: number;
  } | null>(null);

  useEffect(() => {
    if (!levelId) {
      setLoadError('Nivel no indicado');
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      setNeedsFsReentry(false);
      try {
        const data = await fetchPlayableLevel(levelId);
        if (cancelled) return;
        if (!data) {
          setLoadError('Nivel no encontrado');
          return;
        }
        if (data.needsPass && data.status === 'completed') {
          navigate(`/gallery?level=${levelId}`, { replace: true });
          return;
        }
        if (data.needsPass || data.status === 'gated') {
          setGateSeasonId(data.level.season_id);
          setLoadError('Necesitas el pase para jugar este especial (GIF/video)');
          return;
        }
        if (data.status === 'locked') {
          setLoadError('Este nivel está bloqueado');
          return;
        }
        if (data.status === 'upcoming') {
          const when = data.level.available_at
            ? formatAvailableAt(data.level.available_at)
            : '';
          setLoadError(
            when ? `Este nivel llega pronto (${when})` : 'Este nivel llega pronto',
          );
          return;
        }
        setGateSeasonId(null);
        levelSeasonIdRef.current = data.level.season_id;
        setConfig(data.config);
        setLevelName(data.level.name);
        setLevelSortOrder(data.level.sort_order);
        setLevelMedia({
          type: data.level.media_type ?? 'image',
          path: data.level.media_path ?? null,
        });
        setFullImagePath(data.level.image_path);
        setPct(0);
        setRemainingMs(
          data.config.timeLimitSec > 0 ? data.config.timeLimitSec * 1000 : null,
        );
        setResult(null);
        savedRef.current = false;
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Error al cargar el nivel');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [levelId]);

  // Abrir sesión al montar / reintentar (corazones se gastan al fallar, no aquí).
  useEffect(() => {
    if (!config || !levelId) return;

    let cancelled = false;
    sessionClosedRef.current = false;
    sessionIdRef.current = null;
    pendingOutcomeRef.current = null;
    sessionStartedAtRef.current = Date.now();
    setOutOfEnergy(false);

    void (async () => {
      try {
        const attempt = await beginLevelAttempt(levelId);
        if (cancelled) {
          if (attempt.sessionId) {
            const pending = pendingOutcomeRef.current;
            void endGameSession(
              attempt.sessionId,
              pending?.outcome ?? 'abandoned',
              pending?.durationMs ?? Date.now() - sessionStartedAtRef.current,
            );
          }
          return;
        }
        setEnergyHearts(attempt.hearts);
        setEnergyMax(attempt.max);
        setEnergyWaived(Boolean(attempt.energyWaived));
        setNextRefillLabel(formatRefillCountdown(attempt.nextRefillAt));
        sessionIdRef.current = attempt.sessionId ?? null;
        const pending = pendingOutcomeRef.current;
        if (attempt.sessionId && pending && !sessionClosedRef.current) {
          sessionClosedRef.current = true;
          void endGameSession(attempt.sessionId, pending.outcome, pending.durationMs);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : '';
        if (msg === 'OUT_OF_ENERGY') {
          setOutOfEnergy(true);
          setConfig(null);
          setGateSeasonId(levelSeasonIdRef.current);
          setLoadError('OUT_OF_ENERGY');
          try {
            const snap = await fetchUserEnergy();
            setEnergyHearts(snap.hearts);
            setEnergyMax(snap.max);
            setNextRefillLabel(formatRefillCountdown(snap.nextRefillAt));
          } catch {
            setEnergyHearts(0);
            setNextRefillLabel(null);
          }
          return;
        }
        setLoadError(msg || 'No se pudo iniciar la partida');
        setConfig(null);
      }
    })();

    return () => {
      cancelled = true;
      const id = sessionIdRef.current;
      if (sessionClosedRef.current) return;
      const ms = Date.now() - sessionStartedAtRef.current;
      pendingOutcomeRef.current = { outcome: 'abandoned', durationMs: ms };
      if (!id) return;
      sessionClosedRef.current = true;
      void endGameSession(id, 'abandoned', ms);
    };
  }, [config, levelId, runId]);

  useEffect(() => {
    if (!config || !levelId) return;

    const closeSession = (outcome: 'completed' | 'failed', timeMs: number) => {
      if (sessionClosedRef.current) return;
      pendingOutcomeRef.current = { outcome, durationMs: timeMs };
      const id = sessionIdRef.current;
      if (!id) return;
      sessionClosedRef.current = true;
      void endGameSession(id, outcome, timeMs).then((energy) => {
        if (!energy) return;
        setEnergyHearts(energy.hearts);
        setEnergyMax(energy.max);
        setEnergyWaived(Boolean(energy.energyWaived));
        setNextRefillLabel(formatRefillCountdown(energy.nextRefillAt));
        if (outcome === 'failed' && !energy.energyWaived && energy.hearts < 1) {
          setOutOfEnergy(true);
        }
      });
    };

    const unsubscribes = [
      gameEvents.on('game:progress', ({ conqueredPct }) => setPct(conqueredPct)),
      gameEvents.on('game:time', ({ remainingMs: ms, limited }) => {
        setRemainingMs(limited ? ms : null);
      }),
      gameEvents.on('game:energy-gained', ({ amount }) => {
        if (energyWaived) return;
        void grantEnergyHearts(amount)
          .then((energy) => {
            setEnergyHearts(energy.hearts);
            setEnergyMax(energy.max);
            setNextRefillLabel(formatRefillCountdown(energy.nextRefillAt));
          })
          .catch(() => {
            /* HUD se sincroniza al cerrar sesión */
          });
      }),
      gameEvents.on('game:completed', (stats) => {
        closeSession('completed', stats.timeMs);
        setResult({
          won: true,
          stats,
          saveError: null,
          saving: true,
          newBadges: [],
          mediaUrl: null,
          fullImageUrl: null,
          revealed: false,
          nextLevelId: null,
        });
      }),
      gameEvents.on('game:failed', (stats) => {
        closeSession('failed', stats.timeMs);
        setResult({
          won: false,
          stats,
          saveError: null,
          saving: false,
          newBadges: [],
          mediaUrl: null,
          fullImageUrl: null,
          revealed: false,
          nextLevelId: null,
        });
      }),
    ];
    return () => unsubscribes.forEach((off) => off());
  }, [config, levelId, runId, energyWaived]);

  useEffect(() => {
    return fullscreenService.onChange((active) => {
      setFsActive(active);
      if (active) {
        hadFullscreenRef.current = true;
        skipFsPromptRef.current = false;
        setNeedsFsReentry(false);
        gameEvents.emit('game:resume', {});
        return;
      }
      // Transición intencional (siguiente nivel): no pedir reingreso.
      if (skipFsPromptRef.current) {
        skipFsPromptRef.current = false;
        return;
      }
      // Salió de fullscreen tras haber estado dentro → pausar y ofrecer reingreso.
      if (hadFullscreenRef.current) {
        setNeedsFsReentry(true);
        gameEvents.emit('game:pause', {});
      }
    });
  }, []);

  useEffect(() => {
    if (!result?.won || !levelId || savedRef.current) return;

    savedRef.current = true;
    void (async () => {
      try {
        await completeLevel(levelId, result.stats.conqueredPct, result.stats.timeMs);
        markFirstLevelCompleted();
        let newBadges: BadgeId[] = [];
        try {
          newBadges = await awardBadges();
        } catch {
          // Sin drama: la RPC recomputa todo en el próximo completado.
        }
        let mediaUrl: string | null = null;
        if (levelMedia.type !== 'image' && levelMedia.path) {
          mediaUrl = await createSignedImageUrl(levelMedia.path);
          if (!mediaUrl && levelMedia.path) {
            // Reintento corto: RLS a veces tarda un tick tras complete_level.
            await new Promise((r) => setTimeout(r, 350));
            mediaUrl = await createSignedImageUrl(levelMedia.path);
          }
        }
        // Full nítida solo después de complete_level (misma ruta que galería).
        let fullImageUrl: string | null = null;
        if (fullImagePath) {
          fullImageUrl = await resolveCompletedImageUrl(fullImagePath, levelSortOrder);
          if (!fullImageUrl) {
            await new Promise((r) => setTimeout(r, 350));
            fullImageUrl = await resolveCompletedImageUrl(fullImagePath, levelSortOrder);
          }
        }
        let nextLevelId: string | null = null;
        const seasonId = levelSeasonIdRef.current;
        if (seasonId) {
          try {
            nextLevelId = await fetchNextPlayableLevelId(seasonId, levelSortOrder);
          } catch {
            nextLevelId = null;
          }
        }
        setResult((r) =>
          r
            ? { ...r, saving: false, saveError: null, newBadges, mediaUrl, fullImageUrl, nextLevelId }
            : r,
        );
      } catch (e) {
        setResult((r) =>
          r
            ? {
                ...r,
                saving: false,
                saveError: e instanceof Error ? e.message : 'No se pudo guardar el progreso',
              }
            : r,
        );
      }
    })();
  }, [result, levelId, levelMedia, levelSortOrder, fullImagePath]);

  const retry = () => {
    if (!config) return;
    if (!energyWaived && energyHearts != null && energyHearts < 1) {
      setOutOfEnergy(true);
      setConfig(null);
      setLoadError('OUT_OF_ENERGY');
      setGateSeasonId(levelSeasonIdRef.current);
      return;
    }
    setPct(0);
    setRemainingMs(config.timeLimitSec > 0 ? config.timeLimitSec * 1000 : null);
    setResult(null);
    savedRef.current = false;
    setNeedsFsReentry(false);
    setRunId((n) => n + 1);
  };

  async function revealImage() {
    let url = result?.fullImageUrl ?? null;
    if (!url && fullImagePath) {
      url = await resolveCompletedImageUrl(fullImagePath, levelSortOrder);
      if (!url) {
        await new Promise((r) => setTimeout(r, 350));
        url = await resolveCompletedImageUrl(fullImagePath, levelSortOrder);
      }
    }
    gameEvents.emit('game:reveal', {});
    setResult((r) => (r ? { ...r, fullImageUrl: url ?? r.fullImageUrl, revealed: true } : r));
  }

  function goNextLevel() {
    if (!result?.nextLevelId) return;
    // Mantener pantalla completa: no salir (evita el modal de reingreso).
    skipFsPromptRef.current = true;
    setNeedsFsReentry(false);
    navigate(`/play/${result.nextLevelId}`);
  }

  async function reenterFullscreen() {
    const ok = await fullscreenService.request();
    if (ok) {
      setNeedsFsReentry(false);
      gameEvents.emit('game:resume', {});
    }
  }

  async function exitToLevels() {
    await fullscreenService.exit();
    navigate('/levels');
  }

  async function buyEnergyPack() {
    setBuyingPack(true);
    try {
      const { url } = await startEnergyPackCheckout();
      window.location.href = url;
    } catch {
      setBuyingPack(false);
    }
  }

  if (loading) {
    return <div className="screen-loading">Cargando nivel…</div>;
  }

  if (loadError || !config) {
    if (outOfEnergy) {
      return (
        <div className="energy-gate">
          <div className="energy-gate-card">
            <span className="energy-gate-icon" aria-hidden>
              {'♡'.repeat(energyMax)}
            </span>
            <h2>Sin corazones</h2>
            <p>
              Pierdes <strong>1 corazón</strong> si un enemigo te mata o se acaba el tiempo.
              Se recarga solo con el tiempo
              {nextRefillLabel && nextRefillLabel !== 'ya' ? (
                <>
                  : próximo en <strong>{nextRefillLabel}</strong>
                </>
              ) : (
                '.'
              )}
            </p>
            <p className="energy-gate-aside">
              Con el pase fallas <strong>sin gastar</strong> corazones.
            </p>
            <button
              className="btn-cta"
              type="button"
              disabled={buyingPack}
              onClick={() => void buyEnergyPack()}
            >
              {buyingPack
                ? 'Abriendo…'
                : `Rellenar ${energyMax}♥ · ${formatClp(ENERGY_PACK_PRICE_CLP)}`}
            </button>
            {gateSeasonId && (
              <button
                className="btn-ghost"
                type="button"
                onClick={() => navigate('/pase')}
              >
                Activar pase
              </button>
            )}
            <button className="btn-ghost" type="button" onClick={() => navigate('/levels')}>
              Volver a niveles
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="screen-loading">
        <p>{loadError ?? 'Nivel no disponible'}</p>
        {gateSeasonId && (
          <button
            className="btn-cta"
            type="button"
            onClick={() => navigate('/pase')}
          >
            Desbloquear especial (GIF/video)
          </button>
        )}
        <button className="btn-ghost" type="button" onClick={() => navigate('/levels')}>
          Volver a niveles
        </button>
      </div>
    );
  }

  return (
    <div className="game-screen">
      <header className="game-hud">
        <button className="hud-exit" onClick={() => void exitToLevels()} aria-label="Salir">
          ✕
        </button>
        <span className="hud-progress">
          {Math.floor(pct)}% / {config.targetPct}%
        </span>
        {remainingMs != null && (
          <span
            className={`hud-time${remainingMs <= 15_000 ? ' is-urgent' : ''}`}
            aria-label="Tiempo restante"
          >
            {formatRemain(remainingMs)}
          </span>
        )}
        {energyHearts != null && (
          <span
            className="hud-energy"
            title={
              energyWaived
                ? 'Pase: fallar no gasta corazones'
                : 'Corazones: se pierde 1 al fallar'
            }
          >
            {energyWaived ? '∞♥' : `${energyHearts}♥`}
          </span>
        )}
      </header>

      <div className="game-subbar">
        <p className="game-level-name">{levelName}</p>
        {fsSupported && !fsActive && !needsFsReentry && (
          <button type="button" className="hud-fs" onClick={() => void fullscreenService.request()}>
            Pantalla completa
          </button>
        )}
      </div>

      <GameCanvas level={config} runId={runId} />

      {needsFsReentry && !result && (
        <div className="fs-overlay">
          <div className="fs-card">
            <h2>Juego en pausa</h2>
            <p>Saliste de pantalla completa.</p>
            <button type="button" className="btn-primary" onClick={() => void reenterFullscreen()}>
              Volver a pantalla completa
            </button>
            <button type="button" className="btn-ghost" onClick={() => void exitToLevels()}>
              Salir
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="result-overlay">
          <div className="result-card">
            <h2>
              {result.won
                ? result.revealed
                  ? levelMedia.type !== 'image'
                    ? 'Contenido desbloqueado, cachero'
                    : '¡Imagen revelada!'
                  : '¡Territorio conquistado!'
                : 'Has perdido'}
            </h2>
            {result.won && result.revealed && levelMedia.type !== 'image' && (
              result.mediaUrl || result.fullImageUrl ? (
                <RevealedMedia
                  mediaType={levelMedia.type}
                  mediaUrl={result.mediaUrl}
                  posterUrl={result.fullImageUrl ?? ''}
                  alt={levelName}
                  className="result-media"
                />
              ) : (
                <p className="result-save-error">No se pudo cargar el contenido. Ábrelo en Galería.</p>
              )
            )}
            {result.won && result.revealed && levelMedia.type === 'image' && (
              result.fullImageUrl ? (
                <img
                  className="result-media"
                  src={result.fullImageUrl}
                  alt={levelName}
                  draggable={false}
                />
              ) : (
                <p className="result-save-error">No se pudo cargar la imagen. Ábrela en Galería.</p>
              )
            )}
            <p className="result-stats">
              Conquistado: {Math.floor(result.stats.conqueredPct)}% ·{' '}
              {(result.stats.timeMs / 1000).toFixed(1)}s
            </p>
            {!result.won && !energyWaived && (
              <p className="result-save">
                {energyHearts != null && energyHearts < 1
                  ? 'Sin corazones · espera o compra un pack'
                  : '−1 corazón'}
              </p>
            )}
            {result.won && result.saving && <p className="result-save">Guardando progreso…</p>}
            {result.won && result.saveError && (
              <p className="result-save-error">{result.saveError}</p>
            )}
            {result.won && !result.saving && !result.saveError && (
              <p className="result-save-ok">Progreso guardado</p>
            )}
            {result.won && result.revealed && result.newBadges.length > 0 && (
              <div className="result-badges">
                {result.newBadges.map((id) => (
                  <p key={id} className="result-badge">
                    <span className="result-badge-icon" aria-hidden>
                      {BADGE_CATALOG[id].icon}
                    </span>
                    <span>
                      <strong>{BADGE_CATALOG[id].name}</strong> · {BADGE_CATALOG[id].earnedPhrase}
                    </span>
                  </p>
                ))}
              </div>
            )}
            <div className="result-actions">
              {result.won ? (
                <>
                  {!result.revealed ? (
                    <button
                      className="btn-primary"
                      type="button"
                      disabled={result.saving}
                      onClick={() => void revealImage()}
                    >
                      Revelar imagen
                    </button>
                  ) : result.nextLevelId ? (
                    <button
                      className="btn-primary"
                      type="button"
                      onClick={() => void goNextLevel()}
                    >
                      Siguiente nivel
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      type="button"
                      onClick={() => void exitToLevels()}
                    >
                      Ver niveles
                    </button>
                  )}
                  <button className="btn-ghost" type="button" onClick={() => void exitToLevels()}>
                    Niveles
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-ghost" type="button" onClick={() => void exitToLevels()}>
                    Niveles
                  </button>
                  {energyWaived || (energyHearts != null && energyHearts > 0) ? (
                    <button className="btn-primary" type="button" onClick={retry}>
                      Reintentar
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      type="button"
                      disabled={buyingPack}
                      onClick={() => void buyEnergyPack()}
                    >
                      {buyingPack
                        ? 'Abriendo…'
                        : `Pack ${energyMax}♥ · ${formatClp(ENERGY_PACK_PRICE_CLP)}`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
