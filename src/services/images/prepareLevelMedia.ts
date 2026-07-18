/**
 * Validación client-side del media especial de un nivel (GIF o video corto).
 * A diferencia de las imágenes, no se recomprime: se valida formato, peso y
 * duración y se sube tal cual. Límite de peso replicado en el bucket
 * (supabase/migrations/00016_level_media.sql).
 */

export const LEVEL_MEDIA_MAX_BYTES = 12 * 1024 * 1024;
export const LEVEL_MEDIA_MAX_DURATION_S = 20;

const GIF_MIMES = ['image/gif'];
const VIDEO_MIMES = ['video/mp4', 'video/webm'];

export interface PreparedLevelMedia {
  file: File;
  contentType: string;
  ext: 'gif' | 'mp4' | 'webm';
  /** Duración en segundos (solo video; los GIF no exponen duración). */
  durationS: number | null;
}

function videoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer el video'));
    };
    video.src = url;
  });
}

export async function prepareLevelMedia(
  file: File,
  mediaType: 'gif' | 'video',
): Promise<PreparedLevelMedia> {
  const allowed = mediaType === 'gif' ? GIF_MIMES : VIDEO_MIMES;
  if (!allowed.includes(file.type)) {
    throw new Error(
      mediaType === 'gif' ? 'El archivo debe ser un GIF' : 'Formato no permitido (mp4 o webm)',
    );
  }
  if (file.size > LEVEL_MEDIA_MAX_BYTES) {
    throw new Error(
      `Media demasiado pesada (máx. ${Math.round(LEVEL_MEDIA_MAX_BYTES / (1024 * 1024))} MB)`,
    );
  }

  let durationS: number | null = null;
  if (mediaType === 'video') {
    durationS = await videoDurationSeconds(file);
    if (!Number.isFinite(durationS) || durationS <= 0) {
      throw new Error('No se pudo leer la duración del video');
    }
    if (durationS > LEVEL_MEDIA_MAX_DURATION_S + 0.5) {
      throw new Error(`El video debe durar máximo ${LEVEL_MEDIA_MAX_DURATION_S} segundos`);
    }
  }

  const ext: PreparedLevelMedia['ext'] =
    mediaType === 'gif' ? 'gif' : file.type === 'video/webm' ? 'webm' : 'mp4';

  return { file, contentType: file.type, ext, durationS };
}
