import { getSupabase } from '@/services/supabase/client';
import { isBadgeId, type BadgeId } from '@/features/progression/badgeCatalog';

export interface UserBadgeRow {
  user_id: string;
  badge_id: string;
  awarded_at: string;
}

/** Medallas del usuario actual (RLS: solo las propias). */
export async function fetchMyBadges(): Promise<UserBadgeRow[]> {
  const { data, error } = await getSupabase()
    .from('user_badges')
    .select('*')
    .order('awarded_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as UserBadgeRow[]) ?? [];
}

/**
 * Pide a la DB recomputar elegibilidad y otorgar lo que falte.
 * Devuelve solo las medallas nuevas (para celebrarlas). Si falla, no pasa
 * nada: la RPC recomputa todo en el próximo completado.
 */
export async function awardBadges(): Promise<BadgeId[]> {
  const { data, error } = await getSupabase().rpc('award_badges');
  if (error) throw new Error(error.message);
  return ((data as { badge_id: string }[] | null) ?? []).map((r) => r.badge_id).filter(isBadgeId);
}
