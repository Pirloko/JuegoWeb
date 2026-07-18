const COMPLETED_KEY = 'juegoweb:completed-level';
const DISMISSED_KEY = 'juegoweb:install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/** Captura beforeinstallprompt (Chrome/Android). Llamar una vez al arrancar. */
export function initInstallPrompt(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    notify();
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  );
}

export function markFirstLevelCompleted(): void {
  try {
    localStorage.setItem(COMPLETED_KEY, '1');
    notify();
  } catch {
    // ignore
  }
}

export function hasCompletedFirstLevel(): boolean {
  try {
    return localStorage.getItem(COMPLETED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstallPrompt(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
    notify();
  } catch {
    // ignore
  }
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Solo tras completar un nivel, si el navegador ofrece instalar y no es PWA ya. */
export function shouldShowInstallPrompt(): boolean {
  return (
    !isStandalone() &&
    !isDismissed() &&
    hasCompletedFirstLevel() &&
    deferred != null
  );
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const event = deferred;
  deferred = null;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'dismissed') dismissInstallPrompt();
    notify();
    return outcome;
  } catch {
    notify();
    return 'unavailable';
  }
}

export function subscribeInstallPrompt(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
