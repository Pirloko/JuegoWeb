import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { initInstallPrompt } from '@/services/pwa/installPrompt';
import App from '@/app/App';
import '@/styles/global.css';

registerSW({ immediate: true });
initInstallPrompt();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
