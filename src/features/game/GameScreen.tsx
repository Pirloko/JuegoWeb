import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { LevelConfig, LevelResultStats } from '@/types/level';
import { completeLevel, fetchPlayableLevel } from '@/services/supabase/levels';
import { awardBadges } from '@/services/supabase/badges';
import { createSignedImageUrl } from '@/services/supabase/storage';
import { BADGE_CATALOG, type BadgeId } from '@/features/progression/badgeCatalog';
import RevealedMedia from '@/components/RevealedMedia';
import type { LevelMediaType } from '@/types/database';
import { fullscreenService } from '@/services/fullscreen/FullscreenService';
import { markFirstLevelCompleted } from '@/services/pwa/installPrompt';
import { gameEvents } from './core/GameEvents';
import GameCanvas from './GameCanvas';
import './game.css';

interface Result {
  won: boolean;
  stats: LevelResultStats;
  saveError: string | null;
  saving: boolean;
  newBadges: BadgeId[];
  /** Signed URL del GIF/video si el nivel es especial (para el revelado). */
  mediaUrl: string | null;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gateSeasonId, setGateSeasonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [runId, setRunId] = useState(0);
  const [pct, setPct] = useState(0);
  const [lives, setLives] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [fsSupported] = useState(() => fullscreenService.isSupported());
  const [fsActive, setFsActive] = useState(() => fullscreenService.isActive());
  const [needsFsReentry, setNeedsFsReentry] = useState(false);

  const savedRef = useRef(false);
  const hadFullscreenRef = useRef(fullscreenService.isActive());

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
      try {
        const data = await fetchPlayableLevel(levelId);
        if (cancelled) return;
        if (!data) {
          setLoadError('Nivel no encontrado');
          return;
        }
        if (data.needsPass || data.status === 'gated') {
          setGateSeasonId(data.level.season_id);
          setLoadError('Necesitas una suscripción activa');
          return;
        }
        if (data.status === 'locked') {
          setLoadError('Este nivel está bloqueado');
          return;
        }
        setGateSeasonId(null);
        setConfig(data.config);
        setLevelName(data.level.name);
        setLevelMedia({
          type: data.level.media_type ?? 'image',
          path: data.level.media_path ?? null,
        });
        setLives(data.config.lives);
        setPct(0);
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

  useEffect(() => {
    if (!config || !levelId) return;

    const unsubscribes = [
      gameEvents.on('game:progress', ({ conqueredPct }) => setPct(conqueredPct)),
      gameEvents.on('game:life-lost', ({ livesLeft }) => setLives(livesLeft)),
      gameEvents.on('game:completed', (stats) => {
        setResult({
          won: true,
          stats,
          saveError: null,
          saving: true,
          newBadges: [],
          mediaUrl: null,
        });
      }),
      gameEvents.on('game:failed', (stats) => {
        setResult({
          won: false,
          stats,
          saveError: null,
          saving: false,
          newBadges: [],
          mediaUrl: null,
        });
      }),
    ];
    return () => unsubscribes.forEach((off) => off());
  }, [config, levelId]);

  useEffect(() => {
    return fullscreenService.onChange((active) => {
      setFsActive(active);
      if (active) {
        hadFullscreenRef.current = true;
        setNeedsFsReentry(false);
        gameEvents.emit('game:resume', {});
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
        }
        setResult((r) => (r ? { ...r, saving: false, saveError: null, newBadges, mediaUrl } : r));
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
  }, [result, levelId, levelMedia]);

  const retry = () => {
    if (!config) return;
    setPct(0);
    setLives(config.lives);
    setResult(null);
    savedRef.current = false;
    setNeedsFsReentry(false);
    setRunId((n) => n + 1);
  };

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

  if (loading) {
    return <div className="screen-loading">Cargando nivel…</div>;
  }

  if (loadError || !config) {
    return (
      <div className="screen-loading">
        <p>{loadError ?? 'Nivel no disponible'}</p>
        {gateSeasonId && (
          <button
            className="btn-primary"
            type="button"
            onClick={() => navigate(`/pase/${gateSeasonId}`)}
          >
            Desbloquear con suscripción
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
        <span className="hud-lives">{'♥'.repeat(Math.max(lives, 0)) || '—'}</span>
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
                ? levelMedia.type !== 'image'
                  ? 'Contenido desbloqueado, cachero'
                  : '¡Territorio conquistado!'
                : 'Has perdido'}
            </h2>
            {result.won && levelMedia.type !== 'image' && (
              <RevealedMedia
                mediaType={levelMedia.type}
                mediaUrl={result.mediaUrl}
                posterUrl={config.imageUrl}
                alt={levelName}
                className="result-media"
              />
            )}
            <p className="result-stats">
              Conquistado: {Math.floor(result.stats.conqueredPct)}% ·{' '}
              {(result.stats.timeMs / 1000).toFixed(1)}s
            </p>
            {result.won && result.saving && <p className="result-save">Guardando progreso…</p>}
            {result.won && result.saveError && (
              <p className="result-save-error">{result.saveError}</p>
            )}
            {result.won && !result.saving && !result.saveError && (
              <p className="result-save-ok">Progreso guardado</p>
            )}
            {result.won && result.newBadges.length > 0 && (
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
              <button className="btn-ghost" type="button" onClick={() => void exitToLevels()}>
                Niveles
              </button>
              <button className="btn-primary" type="button" onClick={retry}>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
