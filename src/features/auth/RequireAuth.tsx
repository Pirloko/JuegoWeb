import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

/** Redirige a /login si no hay sesión. Muestra loading mientras se resuelve. */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading, configured } = useAuth();
  const location = useLocation();

  if (!configured) {
    return (
      <div className="screen-loading">
        Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env
      </div>
    );
  }

  if (loading) {
    return <div className="screen-loading">Cargando…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
