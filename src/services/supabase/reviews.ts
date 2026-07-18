import { getSupabase } from '@/services/supabase/client';

export interface LevelReview {
  id: string;
  user_id: string;
  username: string;
  body: string;
  created_at: string;
  updated_at: string;
}

/** Reseñas de un nivel (la DB exige que el lector lo haya revelado). */
export async function fetchLevelReviews(levelId: string): Promise<LevelReview[]> {
  const { data, error } = await getSupabase().rpc('get_level_reviews', {
    p_level_id: levelId,
  });
  if (error) throw new Error(error.message);
  return (data as LevelReview[]) ?? [];
}

/** Crea o reemplaza la reseña propia (1 por nivel; RLS exige completed). */
export async function upsertMyReview(levelId: string, userId: string, body: string): Promise<void> {
  const { error } = await getSupabase()
    .from('level_reviews')
    .upsert({ level_id: levelId, user_id: userId, body }, { onConflict: 'level_id,user_id' });
  if (error) throw new Error(error.message);
}

/** Borra la reseña propia (o cualquiera si el caller es admin, por RLS). */
export async function deleteReview(reviewId: string): Promise<void> {
  const { error } = await getSupabase().from('level_reviews').delete().eq('id', reviewId);
  if (error) throw new Error(error.message);
}
