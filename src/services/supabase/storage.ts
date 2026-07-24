import { getSupabase } from '@/services/supabase/client';

const BUCKET = 'level-images';
/** URLs cortas: menos ventana si alguien copia el link. */
const SIGNED_TTL_SEC = 15 * 60;
/** Placeholder sin contenido real (nunca fotos de niveles). */
export const LOCKED_LEVEL_PLACEHOLDER = '/icons/level-locked.svg';

export async function createSignedImageUrl(
  path: string,
  ttlSec: number = SIGNED_TTL_SEC,
): Promise<string | null> {
  const { data, error } = await getSupabase().storage
    .from(BUCKET)
    .createSignedUrl(path, ttlSec);

  if (error || !data?.signedUrl) {
    if (error) console.warn('[storage] signedUrl', path, error.message);
    return null;
  }
  return data.signedUrl;
}

/** Solo en DEV: assets locales de prueba. En prod no hay fallback con fotos. */
export function localLevelImageUrl(sortOrder: number): string {
  if (import.meta.env.DEV) {
    return `/levels/level-${sortOrder}.png`;
  }
  return LOCKED_LEVEL_PLACEHOLDER;
}

function candidatePaths(imagePath: string, sortOrder: number): string[] {
  const isThumb = /thumb/i.test(imagePath);
  const base = `level-${sortOrder}/${isThumb ? 'thumb' : 'full'}`;
  return [
    ...new Set(
      [
        imagePath.replace(/\.png$/i, '.webp').replace(/\.jpe?g$/i, '.webp'),
        `${base}.webp`,
        imagePath,
        `${base}.png`,
        imagePath.replace(/\.webp$/i, '.png'),
      ].filter(Boolean),
    ),
  ];
}

/**
 * URL firmada del full/thumb con candidatos (.webp/.png).
 * Devuelve null si no hay acceso (nunca el candado — eso es solo para listas locked).
 */
export async function resolveCompletedImageUrl(
  imagePath: string,
  sortOrder: number,
): Promise<string | null> {
  for (const path of candidatePaths(imagePath, sortOrder)) {
    const signed = await createSignedImageUrl(path);
    if (signed) return signed;
  }
  if (import.meta.env.DEV) {
    const local = localLevelImageUrl(sortOrder);
    if (local !== LOCKED_LEVEL_PLACEHOLDER) return local;
  }
  console.warn(`[storage] Sin full tras completar: ${imagePath}`);
  return null;
}

/**
 * URL para <img> (signed). Sin fallback a fotos públicas en producción.
 */
export async function resolveLevelImageUrl(
  imagePath: string,
  sortOrder: number,
): Promise<string> {
  const url = await resolveCompletedImageUrl(imagePath, sortOrder);
  if (url) return url;
  console.warn(`[storage] Sin acceso a ${imagePath} (¿locked / RLS?)`);
  return LOCKED_LEVEL_PLACEHOLDER;
}

/**
 * URL blob para Phaser en partida (full nítida).
 * Locked no llega aquí: fetchPlayableLevel corta antes.
 */
export async function resolvePlayableLevelImageUrl(
  imagePath: string,
  sortOrder: number,
): Promise<string> {
  const errors: string[] = [];
  for (const path of candidatePaths(imagePath, sortOrder)) {
    try {
      const { data, error } = await getSupabase().storage.from(BUCKET).download(path);
      if (error) {
        errors.push(`${path}: ${error.message}`);
        continue;
      }
      if (!data || data.size === 0) {
        errors.push(`${path}: empty`);
        continue;
      }
      return URL.createObjectURL(data);
    } catch (e) {
      errors.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (import.meta.env.DEV) {
    const local = localLevelImageUrl(sortOrder);
    console.warn(`[storage] DEV playable fallback ${local}`, errors.join(' | '));
    return local;
  }

  console.warn('[storage] Sin acceso a imagen de partida', errors.join(' | '));
  return LOCKED_LEVEL_PLACEHOLDER;
}
