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

function candidatePaths(imagePath: string, sortOrder: number): string[] {
  const isThumb = /thumb/i.test(imagePath);
  const base = `level-${sortOrder}/${isThumb ? 'thumb' : 'full'}`;
  const list = [
    imagePath,
    imagePath.replace(/\.png$/i, '.webp'),
    imagePath.replace(/\.webp$/i, '.png'),
    imagePath.replace(/\.jpe?g$/i, '.webp'),
    `${base}.webp`,
    `${base}.png`,
  ];
  return [...new Set(list.filter(Boolean))];
}

/** Comprueba que la URL firmada realmente sirve la imagen (no 404). */
async function probeSignedUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    if (!res.ok) return false;
    const type = res.headers.get('content-type') ?? '';
    return type.startsWith('image/') || type.includes('octet-stream');
  } catch {
    return false;
  }
}

/**
 * Resuelve la mejor URL de imagen de nivel:
 * 1) signed URL del path en DB (y variantes .webp/.png)
 * 2) fallback local solo en desarrollo
 */
export async function resolveLevelImageUrl(
  imagePath: string,
  sortOrder: number,
): Promise<string> {
  for (const path of candidatePaths(imagePath, sortOrder)) {
    const signed = await createSignedImageUrl(path);
    if (!signed) continue;
    if (await probeSignedUrl(signed)) {
      return signed;
    }
  }

  const local = localLevelImageUrl(sortOrder);
  // En producción no enmascarar el fallo con un PNG de demo.
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.warn(
      `[storage] Sin imagen en Storage para ${imagePath}; usando fallback local ${local}`,
    );
    return local;
  }

  console.error(`[storage] No se pudo cargar imagen de nivel: ${imagePath}`);
  return local;
}
