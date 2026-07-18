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
