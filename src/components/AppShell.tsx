import { Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import BottomNav from './BottomNav';

/** Shell con navegación inferior solo si hay sesión. */
export default function AppShell() {
  const { session, loading } = useAuth();
  const showNav = Boolean(session) && !loading;

  return (
    <div className={`app-shell${showNav ? '' : ' app-shell--guest'}`}>
      <div className="app-shell-main">
        <Outlet />
      </div>
      {showNav && <BottomNav />}
    </div>
  );
}
