import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import RequireAuth from '@/features/auth/RequireAuth';
import { isAdminUser } from './isAdmin';

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="screen-loading">Cargando…</div>;
  }

  if (!isAdminUser(user)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/** Auth + rol admin (app_metadata.role). */
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AdminGate>{children}</AdminGate>
    </RequireAuth>
  );
}
