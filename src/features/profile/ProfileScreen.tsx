import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/admin/isAdmin';
import './profile.css';

function RowIcon({ kind }: { kind: 'badges' | 'sub' | 'levels' | 'gallery' | 'admin' | 'logout' }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    'aria-hidden': true as const,
  };
  switch (kind) {
    case 'badges':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="5" />
          <path d="M8.5 13 7 21l5-2 5 2-1.5-8" />
        </svg>
      );
    case 'sub':
      return (
        <svg {...props} fill="currentColor" stroke="none">
          <path d="M3 18h18l-1.5-9-4.5 3.5L12 5l-3 7.5L4.5 9 3 18Z" />
        </svg>
      );
    case 'levels':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'gallery':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
          <path d="m21 16-5.5-5.5L8 18" />
        </svg>
      );
    case 'admin':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
  }
}

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const admin = isAdminUser(user);
  const displayName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'Jugador';
  const email = user?.email ?? '';

  return (
    <main className="profile">
      <header className="profile-header">
        <button
          type="button"
          className="profile-back"
          aria-label="Volver"
          onClick={() => navigate('/')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden
          >
            <path d="M15 18 9 12l6-6" />
          </svg>
        </button>
        <div className="profile-heading">
          <h1 className="profile-title">Perfil</h1>
          <p className="profile-sub">Tu cuenta y opciones</p>
        </div>
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

      <nav className="profile-actions" aria-label="Opciones de perfil">
        <button type="button" className="profile-row" onClick={() => navigate('/logros')}>
          <span className="profile-row-icon badges">
            <RowIcon kind="badges" />
          </span>
          <span className="profile-row-text">
            <strong>Logros</strong>
            <small>Medallas y conquistas</small>
          </span>
          <span className="profile-row-chevron" aria-hidden>
            ›
          </span>
        </button>

        <button type="button" className="profile-row" onClick={() => navigate('/mis-temporadas')}>
          <span className="profile-row-icon sub">
            <RowIcon kind="sub" />
          </span>
          <span className="profile-row-text">
            <strong>Mi suscripción</strong>
            <small>Estado y temporadas</small>
          </span>
          <span className="profile-row-chevron" aria-hidden>
            ›
          </span>
        </button>

        <button type="button" className="profile-row" onClick={() => navigate('/levels')}>
          <span className="profile-row-icon levels">
            <RowIcon kind="levels" />
          </span>
          <span className="profile-row-text">
            <strong>Ir a niveles</strong>
            <small>Elige y juega una partida</small>
          </span>
          <span className="profile-row-chevron" aria-hidden>
            ›
          </span>
        </button>

        <button type="button" className="profile-row" onClick={() => navigate('/gallery')}>
          <span className="profile-row-icon gallery">
            <RowIcon kind="gallery" />
          </span>
          <span className="profile-row-text">
            <strong>Ver galería</strong>
            <small>Imágenes que ya revelaste</small>
          </span>
          <span className="profile-row-chevron" aria-hidden>
            ›
          </span>
        </button>

        {admin && (
          <button type="button" className="profile-row" onClick={() => navigate('/admin')}>
            <span className="profile-row-icon admin">
              <RowIcon kind="admin" />
            </span>
            <span className="profile-row-text">
              <strong>Administración</strong>
              <small>Temporadas y niveles</small>
            </span>
            <span className="profile-row-chevron" aria-hidden>
              ›
            </span>
          </button>
        )}

        <button
          type="button"
          className="profile-row danger"
          onClick={() => void signOut().then(() => navigate('/'))}
        >
          <span className="profile-row-icon logout">
            <RowIcon kind="logout" />
          </span>
          <span className="profile-row-text">
            <strong>Cerrar sesión</strong>
            <small>Salir de tu cuenta</small>
          </span>
          <span className="profile-row-chevron" aria-hidden>
            ›
          </span>
        </button>
      </nav>
    </main>
  );
}
