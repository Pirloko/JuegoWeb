import { getSupabase } from '@/services/supabase/client';

const BUCKET = 'level-images';
/** 1 hora — suficiente para una partida; se renueva al cargar nivel/galería. */
const SIGNED_TTL_SEC = 60 * 60;

/**
 * URL firmada para un path del bucket privado.
 * Devuelve null si no hay permiso (RLS) o el objeto no existe.
 */
export async function createSignedImageUrl(path: string): Promise<string | null> {
  const { data, error } = await getSupabase().storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SEC);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Fallback local mientras no hay archivo en Storage (dev / pre-upload). */
export function localLevelImageUrl(sortOrder: number): string {
  return `/levels/level-${sortOrder}.png`;
}
