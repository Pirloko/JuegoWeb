import { useEffect, useState } from 'react';
import {
  dismissInstallPrompt,
  promptInstall,
  shouldShowInstallPrompt,
  subscribeInstallPrompt,
} from '@/services/pwa/installPrompt';
import './install-banner.css';

/** Banner de instalación PWA — solo tras completar el primer nivel. */
export default function InstallBanner() {
  const [visible, setVisible] = useState(shouldShowInstallPrompt);

  useEffect(() => subscribeInstallPrompt(() => setVisible(shouldShowInstallPrompt())), []);

  if (!visible) return null;

  async function onInstall() {
    await promptInstall();
    setVisible(shouldShowInstallPrompt());
  }

  function onDismiss() {
    dismissInstallPrompt();
    setVisible(false);
  }

  return (
    <div className="install-banner" role="status">
      <span className="install-banner-icon" aria-hidden>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M12 6v6M12 12l-2.5-2.5M12 12l2.5-2.5" />
          <circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <p>Instala puntocachero para jugar a pantalla completa</p>
      <div className="install-banner-actions">
        <button type="button" className="install-banner-dismiss" onClick={onDismiss}>
          Ahora no
        </button>
        <button type="button" className="install-banner-accept" onClick={() => void onInstall()}>
          Instalar
        </button>
      </div>
    </div>
  );
}
