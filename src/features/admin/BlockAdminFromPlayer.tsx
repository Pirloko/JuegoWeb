import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/admin/isAdmin';

/** Redirige admins fuera de rutas de jugador hacia /admin. */
export default function BlockAdminFromPlayer({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loading">Cargando…</div>;
  if (isAdminUser(user)) return <Navigate to="/admin" replace />;
  return children;
}
