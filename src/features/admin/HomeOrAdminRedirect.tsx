import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/admin/isAdmin';
import RequireMobilePlayer from '@/features/auth/RequireMobilePlayer';
import HomeScreen from '@/features/home/HomeScreen';

/** Home: admins van al dashboard; jugadores ven inicio (solo móvil). */
export default function HomeOrAdminRedirect() {
  const { user, loading, session } = useAuth();
  if (loading) return <div className="screen-loading">Cargando…</div>;
  if (session && isAdminUser(user)) return <Navigate to="/admin" replace />;
  return (
    <RequireMobilePlayer>
      <HomeScreen />
    </RequireMobilePlayer>
  );
}
