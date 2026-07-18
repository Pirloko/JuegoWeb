import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchSeason, hasActiveSubscription, hasSeasonPass } from '@/services/supabase/seasons';
import { MP_MANAGE_SUBSCRIPTION_URL } from '@/types/database';
import './pass.css';

/** Tras autorizar suscripción MP. El webhook activa el acceso; aquí confirmamos. */
export default function PaymentOkScreen() {
  const [params] = useSearchParams();
  const seasonId = params.get('season');
  const [status, setStatus] = useState<'checking' | 'ok' | 'pending' | 'error'>('checking');
  const [seasonName, setSeasonName] = useState('');

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      try {
        const active = await hasActiveSubscription();
        let pass = active;
        if (seasonId) {
          const [p, season] = await Promise.all([
            hasSeasonPass(seasonId),
            fetchSeason(seasonId),
          ]);
          if (cancelled) return;
          if (season) setSeasonName(season.name);
          pass = p;
        }
        if (cancelled) return;
        if (pass) {
          setStatus('ok');
          return;
        }
        attempts += 1;
        if (attempts < 10) {
          setStatus('pending');
          window.setTimeout(() => void poll(), 1500);
        } else {
          setStatus('pending');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  return (
    <main className="pass pass-ok">
      {status === 'checking' && <p className="pass-lead">Confirmando suscripción…</p>}
      {status === 'ok' && (
        <>
          <h1 className="pass-title">¡Suscripción activa!</h1>
          <p className="pass-lead">
            {seasonName
              ? `Ya puedes jugar los niveles de pago de ${seasonName} y las demás temporadas.`
              : 'Tu suscripción mensual ya está activa.'}
          </p>
          <Link className="btn-cta pass-cta" to="/levels">
            Ir a niveles
          </Link>
          <a className="pass-link" href={MP_MANAGE_SUBSCRIPTION_URL} target="_blank" rel="noreferrer">
            Gestionar en Mercado Pago
          </a>
        </>
      )}
      {status === 'pending' && (
        <>
          <h1 className="pass-title">Activando suscripción</h1>
          <p className="pass-lead">
            Estamos confirmando con Mercado Pago. Si no ves el acceso en unos segundos, recarga o
            vuelve más tarde.
          </p>
          <Link className="btn-cta pass-cta" to="/levels">
            Ir a niveles
          </Link>
          <Link className="pass-link" to="/mis-temporadas">
            Ver mi suscripción
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <h1 className="pass-title">Algo falló</h1>
          <p className="pass-lead">
            No pudimos confirmar la suscripción. Revisa Mi suscripción o Mercado Pago.
          </p>
          <Link className="btn-cta pass-cta" to="/mis-temporadas">
            Mi suscripción
          </Link>
        </>
      )}
    </main>
  );
}
