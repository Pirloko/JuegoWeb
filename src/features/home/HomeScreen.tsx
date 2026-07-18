import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import InstallBanner from '@/components/InstallBanner';
import BrandLogo from '@/components/BrandLogo';
import { fetchActiveSeason, hasSeasonPass, seasonPricing } from '@/services/supabase/seasons';
import { fetchLevelsWithProgress } from '@/services/supabase/levels';
import { formatClp, FREE_LEVEL_MAX } from '@/types/database';
import type { SeasonRow } from '@/types/database';
import './home.css';

function MenuIcon({ kind }: { kind: 'levels' | 'gallery' }) {
  const props = {
    width: 26,
    height: 26,
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
  return (
    <svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <path d="m21 16-5.5-5.5L8 18" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86Z" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 18h18l-1.5-9-4.5 3.5L12 5l-3 7.5L4.5 9 3 18Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const { session, user, loading, configured, signOut } = useAuth();
  const displayName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'Jugador';

  const [season, setSeason] = useState<SeasonRow | null>(null);
  const [completed, setCompleted] = useState(0);
  const [levelCount, setLevelCount] = useState(0);
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
        setLevelCount(list.length);
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
          <p className="home-tagline">Conquista el territorio. Revela la imagen oculta.</p>
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
          <p className="home-hello">
            Hola, <strong>{displayName}</strong>
          </p>
        </div>
        <button
          type="button"
          className="home-icon-btn"
          aria-label="Cerrar sesión"
          onClick={() => void signOut()}
          title="Cerrar sesión"
        >
          <svg
            width="20"
            height="20"
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
        <p className="home-tagline">Conquista el territorio y revela la imagen oculta.</p>

        {season && (
          <div className="home-meta" aria-label="Temporada">
            <span className="home-meta-item">
              <CalendarIcon />
              {season.name}
            </span>
            {levelCount > 0 && (
              <span className="home-meta-item home-meta-count">
                {completed}/{levelCount}
              </span>
            )}
            <span className="home-meta-item home-meta-free">
              {owned ? 'Suscripción' : `Free 1–${FREE_LEVEL_MAX}`}
            </span>
          </div>
        )}

        <button type="button" className="btn-cta home-play" onClick={() => navigate('/levels')}>
          <PlayIcon />
          Jugar
        </button>

        {season && !owned && pricing && (
          <button
            type="button"
            className="home-pass-cta"
            onClick={() => navigate(`/pase/${season.id}`)}
          >
            <span className="home-pass-left">
              <CrownIcon />
              Suscripción · {formatClp(pricing.effectiveClp)}/mes
            </span>
            <span className="home-pass-chevron" aria-hidden>
              ›
            </span>
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
            <small>Imágenes que ya revelaste</small>
          </span>
          <span className="home-menu-chevron" aria-hidden>
            ›
          </span>
        </button>
      </nav>

      <InstallBanner />
    </main>
  );
}
