import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  fetchSeason,
  hasSeasonPass,
  seasonPricing,
  startSeasonCheckout,
  usesStaticPaymentLink,
} from '@/services/supabase/seasons';
import {
  formatClp,
  MP_MANAGE_SUBSCRIPTION_URL,
} from '@/types/database';
import type { SeasonRow } from '@/types/database';
import './pass.css';

export default function SeasonPassScreen() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [season, setSeason] = useState<SeasonRow | null>(null);
  const [owned, setOwned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelled = params.get('cancel') === '1';

  const load = useCallback(async () => {
    if (!seasonId) {
      setError('Temporada no indicada');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [s, pass] = await Promise.all([fetchSeason(seasonId), hasSeasonPass(seasonId)]);
      if (!s) {
        setError('Temporada no encontrada');
        return;
      }
      setSeason(s);
      setOwned(pass);
      if (pass) {
        navigate('/levels', { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [seasonId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onBuy() {
    if (!seasonId) return;
    setCheckoutLoading(true);
    setError(null);
    try {
      const { url } = await startSeasonCheckout(seasonId);
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

  const pricing = seasonPricing(season);
  const staticPay = usesStaticPaymentLink();

  return (
    <main className="pass">
      <button type="button" className="pass-back" onClick={() => navigate(-1)} aria-label="Volver">
        ←
      </button>

      <p className="pass-eyebrow">Pase premium · 30 días</p>
      <h1 className="pass-title">{season.name}</h1>
      <p className="pass-lead">
        Las estrellas abren temporadas. El pase abre los niveles especiales (GIF y video) de las
        temporadas que ya liberaste. Lo que ya revelaste se queda en tu galería.
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
        <li>Vigencia ~30 días (se renueva con el cobro mensual de Mercado Pago)</li>
        <li>Jugar y revelar GIF/video de temporadas ya liberadas por ★</li>
        <li>Los niveles foto siguen gratis · lo revelado queda en tu galería</li>
        <li>
          Cancela cuando quieras en{' '}
          <a href={MP_MANAGE_SUBSCRIPTION_URL} target="_blank" rel="noreferrer">
            Mercado Pago
          </a>
        </li>
      </ul>

      <div className="pass-price-block">
        {pricing.onOffer && pricing.offerClp != null ? (
          <>
            <span className="pass-price-list">{formatClp(pricing.listClp)}/mes</span>
            <span className="pass-price-now">{formatClp(pricing.effectiveClp)}</span>
            <span className="pass-offer-tag">/ mes · Oferta</span>
          </>
        ) : (
          <>
            <span className="pass-price-now">{formatClp(pricing.effectiveClp)}</span>
            <span className="pass-offer-tag">/ mes</span>
          </>
        )}
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
          : `Suscribirme por ${formatClp(pricing.effectiveClp)}/mes`}
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
