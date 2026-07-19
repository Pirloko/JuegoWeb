import { getSupabase } from '@/services/supabase/client';
import type { EnergyStatus } from '@/services/supabase/energy';

export type GameSessionOutcome = 'playing' | 'completed' | 'failed' | 'abandoned';

function parseEndEnergy(raw: unknown): EnergyStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.hearts == null) return null;
  return {
    hearts: Number(o.hearts) || 0,
    max: Number(o.max) || 5,
    refillSec: Number(o.refillSec) || 1200,
    nextRefillAt: o.nextRefillAt != null ? String(o.nextRefillAt) : null,
    energyWaived: Boolean(o.energyWaived),
    sessionId: o.sessionId != null ? String(o.sessionId) : null,
  };
}

export async function endGameSession(
  sessionId: string,
  outcome: Exclude<GameSessionOutcome, 'playing'>,
  durationMs: number,
): Promise<EnergyStatus | null> {
  const { data, error } = await getSupabase().rpc('end_game_session', {
    p_session_id: sessionId,
    p_outcome: outcome,
    p_duration_ms: Math.max(0, Math.floor(durationMs)),
  });
  if (error) {
    console.warn('[sessions] end', error.message);
    return null;
  }
  return parseEndEnergy(data);
}
