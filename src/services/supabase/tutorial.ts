import { getSupabase } from '@/services/supabase/client';

const cacheKey = (userId: string) => `puntocachero:tutorial_seen:${userId}`;

export function getTutorialSeenCache(userId: string): boolean | null {
  try {
    const v = localStorage.getItem(cacheKey(userId));
    if (v === '1') return true;
    if (v === '0') return false;
    return null;
  } catch {
    return null;
  }
}

export function setTutorialSeenCache(userId: string, seen: boolean): void {
  try {
    localStorage.setItem(cacheKey(userId), seen ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

/** true si ya vio/saltó el tutorial. */
export async function fetchTutorialSeen(userId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('tutorial_seen_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const seen = Boolean(data?.tutorial_seen_at);
  setTutorialSeenCache(userId, seen);
  return seen;
}

/** Marca el tutorial como visto (saltar o completar). */
export async function markTutorialSeen(userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('profiles')
    .update({ tutorial_seen_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  setTutorialSeenCache(userId, true);
}
