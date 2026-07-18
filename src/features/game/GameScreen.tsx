import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LevelResultStats } from '@/types/level';
import { gameEvents } from './core/GameEvents';
import { PROTOTYPE_LEVEL } from './prototypeLevel';
import GameCanvas from './GameCanvas';
import './game.css';

interface Result {
  won: boolean;
  stats: LevelResultStats;
}

export default function GameScreen() {
  const navigate = useNavigate();
  const [runId, setRunId] = useState(0);
  const [pct, setPct] = useState(0);
  const [lives, setLives] = useState(PROTOTYPE_LEVEL.lives);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const unsubscribes = [
      gameEvents.on('game:progress', ({ conqueredPct }) => setPct(conqueredPct)),
      gameEvents.on('game:life-lost', ({ livesLeft }) => setLives(livesLeft)),
      gameEvents.on('game:completed', (stats) => setResult({ won: true, stats })),
      gameEvents.on('game:failed', (stats) => setResult({ won: false, stats })),
    ];
    return () => unsubscribes.forEach((off) => off());
  }, []);

  const retry = () => {
    setPct(0);
    setLives(PROTOTYPE_LEVEL.lives);
    setResult(null);
    setRunId((n) => n + 1);
  };

  return (
    <div className="game-screen">
      <header className="game-hud">
        <button className="hud-exit" onClick={() => navigate('/')} aria-label="Salir">
          ✕
        </button>
        <span className="hud-progress">
          {Math.floor(pct)}% / {PROTOTYPE_LEVEL.targetPct}%
        </span>
        <span className="hud-lives">{'♥'.repeat(Math.max(lives, 0)) || '—'}</span>
      </header>

      <GameCanvas level={PROTOTYPE_LEVEL} runId={runId} />

      {result && (
        <div className="result-overlay">
          <div className="result-card">
            <h2>{result.won ? '¡Territorio conquistado!' : 'Has perdido'}</h2>
            <p className="result-stats">
              Conquistado: {Math.floor(result.stats.conqueredPct)}% ·{' '}
              {(result.stats.timeMs / 1000).toFixed(1)}s
            </p>
            <div className="result-actions">
              <button className="btn-ghost" onClick={() => navigate('/')}>
                Salir
              </button>
              <button className="btn-primary" onClick={retry}>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
