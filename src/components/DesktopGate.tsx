import { Link, Navigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/admin/isAdmin';

/** Pantalla suave: puntocachero solo en smartphone (jugadores). Admin → panel. */
export default function DesktopGate() {
  const { user, loading, session } = useAuth();

  if (loading) {
    return <div className="screen-loading">Cargando…</div>;
  }

  // Sesión admin: nunca bloquear PC.
  if (session && isAdminUser(user)) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="desktop-gate" role="dialog" aria-live="polite" aria-label="Usa tu celular">
      <div className="desktop-gate-card">
        <BrandLogo size="lg" />
        <h1>Puntocachero es para celular</h1>
        <p>
          Cacherito abre el juego desde tu celular ingresa a tu navegador favorito para jugar, superar niveles y revelar las
          imágenes cariñosas mi potro.
        </p>
        <p className="desktop-gate-aside">
          En computador no está disponible la experiencia de juego. Agregá la app a tu pantalla
          de inicio para entrar más rápido en el celular.
        </p>
        {!session && (
          <Link className="desktop-gate-admin" to="/login" state={{ from: '/admin' }}>
            Soy administrador — entrar
          </Link>
        )}
        {session && !isAdminUser(user) && (
          <p className="desktop-gate-aside">
            Estás en una cuenta de jugador. El juego solo funciona en el celular.
          </p>
        )}
      </div>
    </div>
  );
}
