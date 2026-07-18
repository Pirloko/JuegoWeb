/** Límite final en Storage / red móvil (tras comprimir). */
export const LEVEL_IMAGE_MAX_BYTES = 400 * 1024;

/** Tamaño máximo del archivo original que acepta el admin. */
export const LEVEL_IMAGE_MAX_SOURCE_BYTES = 15 * 1024 * 1024;

const FULL_MAX_EDGE = 1280;
const THUMB_MAX_EDGE = 480;

export type LevelImageKind = 'full' | 'thumb';

export interface PreparedLevelImage {
  blob: Blob;
  contentType: 'image/webp' | 'image/jpeg';
  ext: 'webp' | 'jpg';
  width: number;
  height: number;
  originalBytes: number;
  finalBytes: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

function fitSize(
  srcW: number,
  srcH: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(srcW, srcH);
  if (longest <= maxEdge) return { width: srcW, height: srcH };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('No se pudo comprimir la imagen'));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function encodeUnderLimit(
  canvas: HTMLCanvasElement,
  maxBytes: number,
): Promise<{ blob: Blob; contentType: 'image/webp' | 'image/jpeg'; ext: 'webp' | 'jpg' }> {
  // Preferir WebP; si el navegador no lo soporta bien, caer a JPEG.
  const tryWebp = await canvasToBlob(canvas, 'image/webp', 0.85).catch(() => null);
  const preferWebp = Boolean(tryWebp && tryWebp.size > 0 && tryWebp.type === 'image/webp');

  const mime = preferWebp ? 'image/webp' : 'image/jpeg';
  const ext = preferWebp ? 'webp' : 'jpg';

  let quality = 0.88;
  let blob = await canvasToBlob(canvas, mime, quality);

  while (blob.size > maxBytes && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, mime, quality);
  }

  // Si aún pesa demasiado, reducir resolución y reintentar.
  if (blob.size > maxBytes) {
    let w = canvas.width;
    let h = canvas.height;
    let guard = 0;
    while (blob.size > maxBytes && guard < 6 && Math.max(w, h) > 320) {
      w = Math.round(w * 0.85);
      h = Math.round(h * 0.85);
      const smaller = document.createElement('canvas');
      smaller.width = w;
      smaller.height = h;
      const ctx = smaller.getContext('2d');
      if (!ctx) throw new Error('Canvas no disponible');
      ctx.drawImage(canvas, 0, 0, w, h);
      quality = 0.8;
      blob = await canvasToBlob(smaller, mime, quality);
      while (blob.size > maxBytes && quality > 0.4) {
        quality -= 0.08;
        blob = await canvasToBlob(smaller, mime, quality);
      }
      guard += 1;
    }
  }

  if (blob.size > maxBytes) {
    throw new Error(
      `No se pudo dejar la imagen bajo ${Math.round(maxBytes / 1024)} KB. Prueba otra foto.`,
    );
  }

  return { blob, contentType: mime, ext };
}

/**
 * Redimensiona y comprime a WebP (o JPEG) para Storage.
 * Acepta PNG/JPEG/WebP grandes; el resultado queda ≤ LEVEL_IMAGE_MAX_BYTES.
 */
export async function prepareLevelImage(
  file: File,
  kind: LevelImageKind,
): Promise<PreparedLevelImage> {
  if (!['image/png', 'image/webp', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    throw new Error('Formato no permitido (png, webp o jpeg)');
  }
  if (file.size > LEVEL_IMAGE_MAX_SOURCE_BYTES) {
    throw new Error(
      `Archivo original demasiado grande (máx. ${LEVEL_IMAGE_MAX_SOURCE_BYTES / (1024 * 1024)} MB)`,
    );
  }

  const img = await loadImage(file);
  const maxEdge = kind === 'thumb' ? THUMB_MAX_EDGE : FULL_MAX_EDGE;
  const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, maxEdge);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');
  ctx.drawImage(img, 0, 0, width, height);

  const encoded = await encodeUnderLimit(canvas, LEVEL_IMAGE_MAX_BYTES);

  return {
    ...encoded,
    width,
    height,
    originalBytes: file.size,
    finalBytes: encoded.blob.size,
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
