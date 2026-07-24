import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/admin/isAdmin';
import DesktopGate from '@/components/DesktopGate';
import { isMobileDevice } from '@/services/device/isMobileDevice';

/** Bloquea desktop para jugadores; admin puede usar PC o móvil. */
export default function RequireMobilePlayer({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [mobile, setMobile] = useState(isMobileDevice);

  useEffect(() => {
    const sync = () => setMobile(isMobileDevice());
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  if (loading) return <div className="screen-loading">Cargando…</div>;
  if (isAdminUser(user)) return children;
  if (!mobile) return <DesktopGate />;
  return children;
}
