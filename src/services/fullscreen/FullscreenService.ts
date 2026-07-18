/**
 * Fullscreen por capas (docs/MOBILE.md).
 * Nunca lanza: los fallos (iOS Safari, denegación) se reportan como false.
 */

type ChangeHandler = (active: boolean) => void;

function docEl(): HTMLElement {
  return document.documentElement;
}

function getFullscreenElement(): Element | null {
  return (
    document.fullscreenElement ??
    (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ??
    null
  );
}

export const fullscreenService = {
  isSupported(): boolean {
    const el = docEl() as HTMLElement & {
      requestFullscreen?: () => Promise<void>;
      webkitRequestFullscreen?: () => void;
    };
    return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
  },

  isActive(): boolean {
    return getFullscreenElement() != null;
  },

  async request(el: HTMLElement = docEl()): Promise<boolean> {
    try {
      const target = el as HTMLElement & {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => void;
      };
      if (typeof target.requestFullscreen === 'function') {
        await target.requestFullscreen();
        return true;
      }
      if (typeof target.webkitRequestFullscreen === 'function') {
        target.webkitRequestFullscreen();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  async exit(): Promise<void> {
    try {
      const doc = document as Document & {
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => void;
      };
      if (!getFullscreenElement()) return;
      if (typeof doc.exitFullscreen === 'function') {
        await doc.exitFullscreen();
        return;
      }
      doc.webkitExitFullscreen?.();
    } catch {
      // ignore
    }
  },

  onChange(cb: ChangeHandler): () => void {
    const handler = () => {
      try {
        cb(fullscreenService.isActive());
      } catch {
        // ignore
      }
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  },
};
