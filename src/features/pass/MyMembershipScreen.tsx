import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ENERGY_PACK_PRICE_CLP,
  fetchUserEnergy,
  formatRefillCountdown,
  startEnergyPackCheckout,
  type EnergyStatus,
} from '@/services/supabase/energy';
import {
  fetchMembershipPassExpiry,
  fetchMySubscription,
  formatPassExpiry,
  PASS_MONTHLY_PRICE_CLP,
  startPassCheckout,
} from '@/services/supabase/seasons';
import { formatClp, MP_MANAGE_SUBSCRIPTION_URL } from '@/types/database';
import type { SubscriptionRow } from '@/types/database';
import './pass.css';

export default function MyMembershipScreen() {
  const navigate = useNavigate();
  const [passActive, setPassActive] = useState(false);
  const [passExpiry, setPassExpiry] = useState<string | null>(null);
  const [passExpiryLabel, setPassExpiryLabel] = useState<string | null>(null);
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [passPrice, setPassPrice] = useState<number | null>(null);
  const [passOnOffer, setPassOnOffer] = useState(false);
  const [energy, setEnergy] = useState<EnergyStatus | null>(null);
  const [refillLabel, setRefillLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyingPack, setBuyingPack] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPackError(null);
    try {
      const [subscription, expiry, snap] = await Promise.all([
        fetchMySubscription(),
        fetchMembershipPassExpiry(),
        fetchUserEnergy(),
      ]);
      setSub(subscription);
      setPassExpiry(expiry);
      setPassExpiryLabel(formatPassExpiry(expiry));
      const active = Boolean(expiry && new Date(expiry).getTime() > Date.now());
      setPassActive(active);
      setEnergy(snap);
      setRefillLabel(formatRefillCountdown(snap.nextRefillAt));
      setPassPrice(PASS_MONTHLY_PRICE_CLP);
      setPassOnOffer(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function buyPack() {
    setBuyingPack(true);
    setPackError(null);
    try {
      const { url } = await startEnergyPackCheckout();
      window.location.href = url;
    } catch (e) {
      setPackError(e instanceof Error ? e.message : 'No se pudo iniciar la compra');
      setBuyingPack(false);
    }
  }

  async function activatePass() {
    setError(null);
    try {
      const { url } = await startPassCheckout();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la suscripción');
    }
  }

  const energyWaived = passActive || Boolean(energy?.energyWaived);
  const hearts = energy?.hearts ?? 0;
  const max = energy?.max ?? 5;

  return (
    <main className="pass membership">
      <button type="button" className="pass-back" onClick={() => navigate(-1)} aria-label="Volver">
        ←
      </button>
      <h1 className="pass-title">Mi suscripción</h1>
      <p className="pass-lead">
        Un solo pase mensual para especiales y jugar sin gastar corazones al fallar. Los packs de
        corazones son compras puntuales cuando los necesites.
      </p>

      {loading && <p className="pass-muted">Cargando…</p>}
      {error && !loading && <p className="pass-error">{error}</p>}

      {!loading && (
        <>
          <section className={`membership-card membership-card--pass${passActive ? ' is-active' : ''}`}>
            <p className="pass-eyebrow">Pase mensual</p>
            <div className="membership-card-head">
              <strong>{passActive ? 'Pase activo' : 'Sin pase activo'}</strong>
              {passActive && passExpiryLabel && (
                <span className="membership-meta">Vigente hasta {passExpiryLabel}</span>
              )}
              {!passActive && (
                <span className="membership-meta">
                  Especiales (GIF/video), fallar sin perder corazones y acceso premium.
                </span>
              )}
              {sub?.amount_clp && passActive && (
                <span className="membership-meta">{formatClp(sub.amount_clp)}/mes · Mercado Pago</span>
              )}
            </div>
            <ul className="membership-perks">
              <li>~30 días por cobro mensual</li>
              <li>Niveles especiales de temporadas ya liberadas</li>
              <li>Tu galería se queda aunque venza el pase</li>
            </ul>
            <div className="membership-actions">
              {passActive ? (
                <a
                  className="btn-ghost membership-btn"
                  href={MP_MANAGE_SUBSCRIPTION_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Gestionar / cancelar
                </a>
              ) : (
                <button type="button" className="btn-cta membership-btn" onClick={() => void activatePass()}>
                  {passPrice != null
                    ? `Activar pase · ${formatClp(passPrice)}/mes${passOnOffer ? ' (oferta)' : ''}`
                    : 'Activar pase mensual'}
                </button>
              )}
              {!passActive && (
                <Link className="pass-link membership-link" to="/pase">
                  Ver detalle del pase
                </Link>
              )}
            </div>
          </section>

          <section className={`membership-card membership-card--hearts${hearts === 0 && !energyWaived ? ' is-empty' : ''}`}>
            <p className="pass-eyebrow">Corazones</p>
            <div className="membership-hearts-row" aria-hidden>
              {'♥'.repeat(energyWaived ? max : hearts)}
              {'♡'.repeat(energyWaived ? 0 : Math.max(0, max - hearts))}
            </div>
            <div className="membership-card-head">
              <strong>
                {energyWaived ? 'Ilimitados con pase' : `${hearts} de ${max} corazones`}
              </strong>
              {!energyWaived && hearts < max && refillLabel && refillLabel !== 'ya' && (
                <span className="membership-meta">+1 corazón en {refillLabel}</span>
              )}
              {!energyWaived && (
                <span className="membership-meta">
                  Pierdes 1 corazón al fallar un nivel (no al empezar).
                </span>
              )}
              {energyWaived && (
                <span className="membership-meta">Con pase activo, fallar no gasta corazones.</span>
              )}
            </div>
            {!energyWaived && (
              <div className="membership-actions">
                <button
                  type="button"
                  className="btn-cta membership-btn"
                  disabled={buyingPack}
                  onClick={() => void buyPack()}
                >
                  {buyingPack
                    ? 'Abriendo Mercado Pago…'
                    : `Pack ${max}♥ · ${formatClp(ENERGY_PACK_PRICE_CLP)}`}
                </button>
                {packError && <p className="pass-error">{packError}</p>}
              </div>
            )}
          </section>

          {passExpiry && !passActive && (
            <p className="pass-fine">
              Tu pase venció{passExpiryLabel ? ` el ${passExpiryLabel}` : ''}. Reactívalo para volver a
              jugar especiales sin gastar corazones.
            </p>
          )}
        </>
      )}
    </main>
  );
}
