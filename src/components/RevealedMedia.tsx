import { useState } from 'react';
import type { LevelMediaType } from '@/types/database';
import ContentShield from '@/components/ContentShield';

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
 * Contenido revelado de un nivel. Mitiga descarga/copia en UI (no DRM absoluto).
 */
export default function RevealedMedia({ mediaType, mediaUrl, posterUrl, alt, className }: Props) {
  const [failed, setFailed] = useState(false);
  const showMedia = mediaUrl != null && !failed;

  const body =
    mediaType === 'video' && showMedia ? (
      <video
        className={className}
        src={mediaUrl}
        poster={posterUrl}
        playsInline
        muted
        autoPlay
        loop
        controls
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        onContextMenu={(e) => e.preventDefault()}
        onError={() => setFailed(true)}
      />
    ) : mediaType === 'gif' && showMedia ? (
      <img
        className={className}
        src={mediaUrl}
        alt={alt}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onError={() => setFailed(true)}
      />
    ) : (
      <img
        className={className}
        src={posterUrl}
        alt={alt}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />
    );

  return <ContentShield className="revealed-media-shield">{body}</ContentShield>;
}
