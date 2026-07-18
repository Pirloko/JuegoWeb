import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/admin/isAdmin';
import './profile.css';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const admin = isAdminUser(user);
  const displayName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'Jugador';
  const email = user?.email ?? '';

  return (
    <main className="profile">
      <header className="profile-header">
        <h1 className="page-title">Perfil</h1>
        <p className="page-sub">Tu cuenta y opciones</p>
      </header>

      <section className="profile-card">
        <div className="profile-avatar" aria-hidden>
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="profile-meta">
          <p className="profile-name">{displayName}</p>
          <p className="profile-email">{email}</p>
        </div>
      </section>

      <div className="profile-actions">
        <button type="button" className="profile-row" onClick={() => navigate('/mis-temporadas')}>
          <span>Mi suscripción</span>
          <span aria-hidden>›</span>
        </button>
        <button type="button" className="profile-row" onClick={() => navigate('/levels')}>
          <span>Ir a niveles</span>
          <span aria-hidden>›</span>
        </button>
        <button type="button" className="profile-row" onClick={() => navigate('/gallery')}>
          <span>Ver galería</span>
          <span aria-hidden>›</span>
        </button>
        {admin && (
          <button type="button" className="profile-row" onClick={() => navigate('/admin')}>
            <span>Administración</span>
            <span aria-hidden>›</span>
          </button>
        )}
        <button
          type="button"
          className="profile-row danger"
          onClick={() => void signOut().then(() => navigate('/'))}
        >
          <span>Cerrar sesión</span>
          <span aria-hidden>›</span>
        </button>
      </div>
    </main>
  );
}
