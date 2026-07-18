import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/admin/isAdmin';
import InstallBanner from '@/components/InstallBanner';
import BrandLogo from '@/components/BrandLogo';
import { fetchActiveSeason, hasSeasonPass, seasonPricing } from '@/services/supabase/seasons';
import { fetchLevelsWithProgress } from '@/services/supabase/levels';
import SeasonProgress from '@/features/progression/SeasonProgress';
import { seasonGoalPhrase } from '@/features/progression/copy';
import { formatClp, FREE_LEVEL_MAX, LEVELS_PER_SEASON } from '@/types/database';
import type { SeasonRow } from '@/types/database';
import './home.css';

function MenuIcon({ kind }: { kind: 'levels' | 'gallery' | 'admin' }) {
  const props = {
    width: 28,
    height: 28,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    'aria-hidden': true as const,
  };
  if (kind === 'levels') {
    return (
      <svg {...props}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (kind === 'gallery') {
    return (
      <svg {...props}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
        <path d="m21 16-5.5-5.5L8 18" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const { session, user, loading, configured, signOut } = useAuth();
  const admin = isAdminUser(user);
  const displayName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'Jugador';

  const [season, setSeason] = useState<SeasonRow | null>(null);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [owned, setOwned] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void (async () => {
      try {
        const active = await fetchActiveSeason();
        if (cancelled || !active) return;
        const [list, pass] = await Promise.all([
          fetchLevelsWithProgress(active.id),
          hasSeasonPass(active.id),
        ]);
        if (cancelled) return;
        setSeason(active);
        setOwned(pass);
        setCompleted(list.filter((i) => i.status === 'completed').length);
        setTotal(list.length || LEVELS_PER_SEASON);
      } catch {
        // home sigue usable sin stats
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) {
    return (
      <main className="home">
        <p className="home-muted">Cargando…</p>
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="home">
        <BrandLogo size="lg" asHeading />
        <p className="home-muted">Configura el archivo .env para conectar Supabase.</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="home home-guest">
        <div className="home-hero">
          <p className="home-eyebrow">Arcade móvil</p>
          <BrandLogo size="hero" asHeading />
          <p className="home-tagline">Conquista el territorio. Revela el contenido oculto.</p>
        </div>
        <div className="home-cta-stack">
          <Link className="btn-cta home-cta" to="/login">
            Entrar
          </Link>
          <Link className="btn-ghost home-cta" to="/registro">
            Crear cuenta
          </Link>
          <p className="home-hint">
            Toca Entrar si ya tienes cuenta. Si es tu primera vez, crea una.
          </p>
        </div>
      </main>
    );
  }

  const pricing = season ? seasonPricing(season) : null;

  return (
    <main className="home">
      <header className="home-top">
        <div className="home-identity">
          <div className="home-avatar" aria-hidden>
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="home-hello">Hola,</p>
            <p className="home-name">{displayName}</p>
          </div>
        </div>
        <button
          type="button"
          className="home-icon-btn"
          aria-label="Cerrar sesión"
          onClick={() => void signOut()}
          title="Cerrar sesión"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </header>

      <section className="home-hero-card">
        <BrandLogo size="lg" asHeading />
        <p className="home-tagline">Conquista el territorio y revela el contenido oculto.</p>
        {season && (
          <p className="home-season-line">
            {season.name}
            {owned ? ' · Suscripción activa' : ` · Free 1–${FREE_LEVEL_MAX}`}
          </p>
        )}
        {season && total > 0 && (
          <div className="home-season-progress">
            <SeasonProgress completed={completed} total={total} />
            <p className="home-goal">{seasonGoalPhrase(completed, total)}</p>
          </div>
        )}
        <button type="button" className="btn-cta home-play" onClick={() => navigate('/levels')}>
          Jugar
        </button>
        {season && !owned && pricing && (
          <button
            type="button"
            className="btn-ghost home-pass-cta"
            onClick={() => navigate(`/pase/${season.id}`)}
          >
            Suscripción · {formatClp(pricing.effectiveClp)}/mes
          </button>
        )}
      </section>

      <nav className="home-menu" aria-label="Menú">
        <button type="button" className="home-menu-item" onClick={() => navigate('/levels')}>
          <span className="home-menu-icon levels">
            <MenuIcon kind="levels" />
          </span>
          <span className="home-menu-text">
            <strong>Niveles</strong>
            <small>Elige y juega una partida</small>
          </span>
          <span className="home-menu-chevron" aria-hidden>
            ›
          </span>
        </button>
        <button type="button" className="home-menu-item" onClick={() => navigate('/gallery')}>
          <span className="home-menu-icon gallery">
            <MenuIcon kind="gallery" />
          </span>
          <span className="home-menu-text">
            <strong>Galería</strong>
            <small>Contenido que ya revelaste</small>
          </span>
          <span className="home-menu-chevron" aria-hidden>
            ›
          </span>
        </button>
        {admin && (
          <button type="button" className="home-menu-item" onClick={() => navigate('/admin')}>
            <span className="home-menu-icon admin">
              <MenuIcon kind="admin" />
            </span>
            <span className="home-menu-text">
              <strong>Admin</strong>
              <small>Crear y editar niveles</small>
            </span>
            <span className="home-menu-chevron" aria-hidden>
              ›
            </span>
          </button>
        )}
      </nav>

      <InstallBanner />
    </main>
  );
}
