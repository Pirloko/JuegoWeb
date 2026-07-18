import { Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/admin/isAdmin';
import AdminBottomNav from '@/features/admin/AdminBottomNav';
import BottomNav from './BottomNav';

/** Shell con navegación inferior solo si hay sesión. */
export default function AppShell() {
  const { session, user, loading } = useAuth();
  const showNav = Boolean(session) && !loading;
  const admin = isAdminUser(user);

  return (
    <div className={`app-shell${showNav ? '' : ' app-shell--guest'}`}>
      <div className="app-shell-main">
        <Outlet />
      </div>
      {showNav && (admin ? <AdminBottomNav /> : <BottomNav />)}
    </div>
  );
}
