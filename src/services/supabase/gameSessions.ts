import { getSupabase } from '@/services/supabase/client';

export type GameSessionOutcome = 'playing' | 'completed' | 'failed' | 'abandoned';

export async function startGameSession(levelId: string): Promise<string | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      user_id: user.id,
      level_id: levelId,
      outcome: 'playing',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    console.warn('[sessions] start', error?.message);
    return null;
  }
  return data.id as string;
}

export async function endGameSession(
  sessionId: string,
  outcome: Exclude<GameSessionOutcome, 'playing'>,
  durationMs: number,
): Promise<void> {
  const { error } = await getSupabase().rpc('end_game_session', {
    p_session_id: sessionId,
    p_outcome: outcome,
    p_duration_ms: Math.max(0, Math.floor(durationMs)),
  });
  if (error) {
    console.warn('[sessions] end', error.message);
  }
}
