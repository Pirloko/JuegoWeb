import type { LevelResultStats } from '@/types/level';

/**
 * Event bus tipado entre Phaser (emite) y React (escucha).
 * Sin dependencia de Phaser para que el shell React no arrastre el motor.
 * Contrato documentado en docs/ARCHITECTURE.md.
 */
export interface GameEventMap {
  'game:progress': { conqueredPct: number };
  'game:life-lost': { livesLeft: number };
  'game:completed': LevelResultStats;
  'game:failed': LevelResultStats;
}

type Handler<T> = (payload: T) => void;

class GameEventBus {
  private handlers = new Map<keyof GameEventMap, Set<Handler<never>>>();

  /** Suscribe y devuelve la función para desuscribir. */
  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => set.delete(handler as Handler<never>);
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.handlers.get(event)?.forEach((handler) => (handler as Handler<GameEventMap[K]>)(payload));
  }
}

export const gameEvents = new GameEventBus();
