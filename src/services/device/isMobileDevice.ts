/**
 * Detecta entorno smartphone/tablet táctil vs desktop con ratón.
 * Admin bypass en RequireMobilePlayer, no aquí.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // Dev: permitir desktop para pruebas locales (ver .env.example).
  if (import.meta.env.DEV && import.meta.env.VITE_ALLOW_DESKTOP === '1') {
    return true;
  }

  const ua = navigator.userAgent;

  if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  if (/iPad|Android/i.test(ua) && navigator.maxTouchPoints > 0) {
    return true;
  }

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;
  const hover = window.matchMedia('(hover: hover)').matches;
  const touchPoints = navigator.maxTouchPoints ?? 0;

  // iPadOS reporta MacIntel + multitouch.
  if (touchPoints > 1 && /Mac/i.test(navigator.platform)) {
    return true;
  }

  // Desktop clásico: ratón (fine + hover) sin puntero coarse dominante.
  if (fine && hover && !coarse && touchPoints === 0) {
    return false;
  }

  if (coarse && touchPoints > 0) {
    return true;
  }

  // Pantalla estrecha + touch (UA raro).
  if (touchPoints > 0 && window.innerWidth <= 820) {
    return true;
  }

  return false;
}
