import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  fetchActiveSeason,
  fetchSeason,
  hasSeasonPass,
  PASS_MONTHLY_PRICE_CLP,
  startPassCheckout,
  usesStaticPaymentLink,
} from '@/services/supabase/seasons';
import { formatClp, MP_MANAGE_SUBSCRIPTION_URL } from '@/types/database';
import type { SeasonRow } from '@/types/database';
import './pass.css';

/** Paywall del pase mensual único. */
export default function SeasonPassScreen() {
  const { seasonId: seasonIdParam } = useParams<{ seasonId?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [season, setSeason] = useState<SeasonRow | null>(null);
  const [owned, setOwned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelled = params.get('cancel') === '1';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const seasonId = seasonIdParam ?? (await fetchActiveSeason())?.id;
      if (!seasonId) {
        setError('No hay temporada activa');
        return;
      }
      const [s, pass] = await Promise.all([fetchSeason(seasonId), hasSeasonPass(seasonId)]);
      if (!s) {
        setError('Temporada no encontrada');
        return;
      }
      setSeason(s);
      setOwned(pass);
      if (pass) {
        navigate('/mi-suscripcion', { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [seasonIdParam, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onBuy() {
    setCheckoutLoading(true);
    setError(null);
    try {
      const { url } = await startPassCheckout();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la suscripción');
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return <div className="screen-loading">Cargando…</div>;
  }

  if (error && !season) {
    return (
      <main className="pass">
        <p className="pass-error">{error}</p>
        <Link className="btn-ghost" to="/levels">
          Volver a niveles
        </Link>
      </main>
    );
  }

  if (!season) return null;

  const staticPay = usesStaticPaymentLink();

  return (
    <main className="pass">
      <button type="button" className="pass-back" onClick={() => navigate(-1)} aria-label="Volver">
        ←
      </button>

      <p className="pass-eyebrow">Pase mensual · ~30 días</p>
      <h1 className="pass-title">Pase premium</h1>
      <p className="pass-lead">
        Un solo pase para todas las temporadas que ya liberaste con estrellas. Juega especiales
        (GIF y video), falla sin perder corazones y conserva tu galería aunque venza el pase.
      </p>

      {cancelled && (
        <p className="pass-banner">
          Suscripción no completada. Puedes intentarlo de nuevo cuando quieras.
        </p>
      )}

      {staticPay && (
        <p className="pass-banner">
          Tras pagar en Mercado Pago, el acceso se activa manualmente (avísanos con tu email de
          cuenta). Mientras tanto puedes seguir con los niveles free (fotos).
        </p>
      )}

      <ul className="pass-perks">
        <li>Se renueva con el cobro mensual de Mercado Pago</li>
        <li>Especiales de temporadas desbloqueadas por ★</li>
        <li>Niveles foto siguen gratis · lo revelado queda en galería</li>
        <li>Con pase activo, fallar no gasta corazones</li>
        <li>
          Cancela cuando quieras en{' '}
          <a href={MP_MANAGE_SUBSCRIPTION_URL} target="_blank" rel="noreferrer">
            Mercado Pago
          </a>
        </li>
      </ul>

      <div className="pass-price-block">
        <span className="pass-price-now">{formatClp(PASS_MONTHLY_PRICE_CLP)}</span>
        <span className="pass-offer-tag">/ mes</span>
      </div>

      {error && <p className="pass-error">{error}</p>}

      <button
        type="button"
        className="btn-cta pass-cta"
        disabled={checkoutLoading || owned}
        onClick={() => void onBuy()}
      >
        {checkoutLoading
          ? 'Redirigiendo…'
          : `Suscribirme por ${formatClp(PASS_MONTHLY_PRICE_CLP)}/mes`}
      </button>

      <p className="pass-fine">
        Al vencer el periodo no podrás revelar especiales nuevos; tu colección sigue visible. Tú
        cancelas en Mercado Pago.
        {staticPay ? ' Activación: manual tras el pago.' : ''}
      </p>

      <Link className="pass-link" to="/levels">
        Seguir jugando gratis
      </Link>
    </main>
  );
}
