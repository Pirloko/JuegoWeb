import { useState } from 'react';
import type { LevelMediaType } from '@/types/database';

interface Props {
  mediaType: LevelMediaType;
  /** Signed URL del GIF/video; null si no está disponible. */
  mediaUrl: string | null;
  /** Imagen ya revelada (poster / fallback si el media falla). */
  posterUrl: string;
  alt: string;
  className?: string;
}

/**
 * Contenido revelado de un nivel. Foto → <img>; GIF → <img animado>;
 * video → <video> inline apto para mobile (muted + playsInline para las
 * políticas de autoplay de iOS/Android). Si el media falla, cae al poster.
 */
export default function RevealedMedia({ mediaType, mediaUrl, posterUrl, alt, className }: Props) {
  const [failed, setFailed] = useState(false);
  const showMedia = mediaUrl != null && !failed;

  if (mediaType === 'video' && showMedia) {
    return (
      <video
        className={className}
        src={mediaUrl}
        poster={posterUrl}
        playsInline
        muted
        autoPlay
        loop
        controls
        onError={() => setFailed(true)}
      />
    );
  }

  if (mediaType === 'gif' && showMedia) {
    return (
      <img
        className={className}
        src={mediaUrl}
        alt={alt}
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }

  return <img className={className} src={posterUrl} alt={alt} draggable={false} />;
}
