import { getSupabase } from '@/services/supabase/client';

const BUCKET = 'level-images';
/** 1 hora — suficiente para una partida; se renueva al cargar nivel/galería. */
const SIGNED_TTL_SEC = 60 * 60;

/**
 * URL firmada para un path del bucket privado.
 * Devuelve null si no hay permiso (RLS).
 */
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

/** Fallback local solo en desarrollo (PNG de demo del repo). */
export function localLevelImageUrl(sortOrder: number): string {
  return `/levels/level-${sortOrder}.png`;
}

function candidatePaths(imagePath: string, sortOrder: number): string[] {
  const isThumb = /thumb/i.test(imagePath);
  const base = `level-${sortOrder}/${isThumb ? 'thumb' : 'full'}`;
  // WebP primero: es lo que genera el admin al comprimir.
  const list = [
    imagePath.replace(/\.png$/i, '.webp').replace(/\.jpe?g$/i, '.webp'),
    `${base}.webp`,
    imagePath,
    `${base}.png`,
    imagePath.replace(/\.webp$/i, '.png'),
  ];
  return [...new Set(list.filter(Boolean))];
}

/** Comprueba con <img> (más fiable que fetch ante CORS de Storage). */
function probeWithImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => {
      img.src = '';
      resolve(false);
    }, 8000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

function isLocalDev(): boolean {
  return typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
}

/**
 * Resuelve la URL de imagen del nivel desde Storage.
 * Nunca usa el PNG de demo en producción (evita “foto por defecto” engañosa).
 */
export async function resolveLevelImageUrl(
  imagePath: string,
  sortOrder: number,
): Promise<string> {
  const candidates = candidatePaths(imagePath, sortOrder);
  let firstSigned: string | null = null;

  for (const path of candidates) {
    const signed = await createSignedImageUrl(path);
    if (!signed) continue;
    if (!firstSigned) firstSigned = signed;

    if (await probeWithImage(signed)) {
      return signed;
    }
  }

  // Si hubo URL firmada pero el probe falló, igual la usamos (Phaser + CORS).
  // Mejor foto rota/gradiente que el PNG de demo del repo.
  if (firstSigned) {
    console.warn('[storage] Usando signed URL sin probe OK:', imagePath);
    return firstSigned;
  }

  if (isLocalDev()) {
    const local = localLevelImageUrl(sortOrder);
    console.warn(`[storage] Sin Storage para ${imagePath}; fallback local ${local}`);
    return local;
  }

  console.error(`[storage] No hay imagen de Storage para ${imagePath} (nivel ${sortOrder})`);
  // Cadena vacía → Phaser no carga textura → degradado en GameScene (no demo).
  return '';
}
