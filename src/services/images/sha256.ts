/**
 * SHA-256 hex del contenido de un Blob/File (SubtleCrypto).
 * Se usa sobre el archivo original antes de comprimir: misma foto = mismo hash
 * aunque el WebP final varíe de calidad entre navegadores.
 */
export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
