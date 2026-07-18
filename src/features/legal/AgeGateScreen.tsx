import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { confirmAge18, hasConfirmedAge18 } from './legalMeta';
import './legal.css';

function resolveNext(location: ReturnType<typeof useLocation>): string {
  const fromState = (location.state as { next?: string } | null)?.next;
  if (fromState && fromState.startsWith('/')) return fromState;
  const fromQuery = new URLSearchParams(location.search).get('next');
  if (fromQuery && fromQuery.startsWith('/')) return fromQuery;
  return '/login';
}

/** Pantalla obligatoria antes de login/registro: confirmar +18. */
export default function AgeGateScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = resolveNext(location);

  if (hasConfirmedAge18()) {
    return <Navigate to={next} replace />;
  }

  function accept() {
    confirmAge18();
    navigate(next, { replace: true });
  }

  return (
    <main className="legal legal-gate">
      <div className="legal-gate-brand">
        <BrandLogo size="md" />
      </div>

      <div className="legal-gate-card">
        <span className="legal-age-badge" aria-hidden>
          +18
        </span>
        <h1>Solo para mayores de 18 años</h1>
        <p>
          <strong>puntocachero</strong> es un juego con contenido visual para adultos. Al continuar
          declaras que tienes <strong>18 años o más</strong> y que puedes acceder legalmente a este
          tipo de material.
        </p>
        <p className="legal-gate-muted">
          Si eres menor de edad, debes salir ahora. No está permitido el uso por menores.
        </p>

        <button type="button" className="legal-gate-accept" onClick={accept}>
          Tengo 18 años o más — continuar
        </button>
        <button
          type="button"
          className="legal-gate-leave"
          onClick={() => navigate('/', { replace: true })}
        >
          Salir
        </button>

        <p className="legal-gate-links">
          Al continuar también aceptas conocer nuestras{' '}
          <Link to="/legal/terminos">Condiciones de uso</Link> y{' '}
          <Link to="/legal/privacidad">Política de privacidad</Link>.
        </p>
      </div>
    </main>
  );
}
