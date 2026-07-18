import { useEffect, useRef } from 'react';
import type { LevelConfig } from '@/types/level';
import { createGame } from './core/GameConfig';
import { gameEvents } from './core/GameEvents';

interface Props {
  level: LevelConfig;
  /** Cambiarlo fuerza a recrear la instancia de Phaser (reintentar). */
  runId: number;
}

/** Monta y destruye la instancia de Phaser. Nada más: la UI vive fuera. */
export default function GameCanvas({ level, runId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = createGame(containerRef.current, level);

    const offPause = gameEvents.on('game:pause', () => {
      game.scene.pause('game');
    });
    const offResume = gameEvents.on('game:resume', () => {
      game.scene.resume('game');
    });

    return () => {
      offPause();
      offResume();
      game.destroy(true);
    };
  }, [level, runId]);

  return <div ref={containerRef} className="game-canvas" />;
}
