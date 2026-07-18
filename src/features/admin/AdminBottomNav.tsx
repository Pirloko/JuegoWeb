import { NavLink, useLocation } from 'react-router-dom';
import '@/components/bottom-nav.css';

const TABS = [
  { to: '/admin', label: 'Dashboard', end: true, icon: 'dash' },
  { to: '/admin/niveles', label: 'Contenido', end: false, icon: 'grid' },
  { to: '/admin/suscripciones', label: 'Subs', end: false, icon: 'card' },
  { to: '/perfil', label: 'Perfil', end: false, icon: 'user' },
] as const;

const CONTENT_PREFIXES = ['/admin/niveles', '/admin/seasons', '/admin/sitios', '/admin/levels'];

function TabIcon({ name }: { name: (typeof TABS)[number]['icon'] }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'dash':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'card':
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      );
  }
}

/** Barra inferior para usuarios admin (sin gameplay). */
export default function AdminBottomNav() {
  const { pathname } = useLocation();
  const contentActive = CONTENT_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <nav className="bottom-nav" aria-label="Navegación admin">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => {
            const active =
              tab.to === '/admin/niveles' ? contentActive : isActive;
            return `bottom-nav-item${active ? ' is-active' : ''}`;
          }}
        >
          <TabIcon name={tab.icon} />
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
