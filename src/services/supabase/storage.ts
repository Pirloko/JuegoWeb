import { getSupabase } from '@/services/supabase/client';

const BUCKET = 'level-images';
const SIGNED_TTL_SEC = 60 * 60;

export async function createSignedImageUrl(path: string): Promise<string | null> {
  const { data, error } = await getSupabase().storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SEC);

  if (error || !data?.signedUrl) {
    if (error) console.warn('[storage] signedUrl', path, error.message);
    return null;
  }
  return data.signedUrl;
}

export function localLevelImageUrl(sortOrder: number): string {
  return `/levels/level-${sortOrder}.png`;
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
 * URL para <img> / CSS (signed URL o fallback local).
 * Nunca string vacío.
 */
export async function resolveLevelImageUrl(
  imagePath: string,
  sortOrder: number,
): Promise<string> {
  for (const path of candidatePaths(imagePath, sortOrder)) {
    const signed = await createSignedImageUrl(path);
    if (signed) return signed;
  }

  const local = localLevelImageUrl(sortOrder);
  console.warn(`[storage] Usando fallback local para ${imagePath} → ${local}`);
  return local;
}

/**
 * URL para Phaser: descarga el archivo y usa blob: (evita CORS del canvas).
 * Si Storage falla → imagen local. Nunca string vacío.
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

  const local = localLevelImageUrl(sortOrder);
  console.warn(
    `[storage] Jugador sin acceso a imagen de nivel (¿RLS?). Fallback ${local}. Detalle:`,
    errors.join(' | ') || 'sin candidatos',
  );
  return local;
}
