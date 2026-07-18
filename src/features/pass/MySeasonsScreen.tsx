import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchMyEntitlements,
  fetchMySubscription,
  fetchSeasons,
  hasActiveSubscription,
  seasonPricing,
} from '@/services/supabase/seasons';
import { formatClp, MP_MANAGE_SUBSCRIPTION_URL } from '@/types/database';
import type { SeasonEntitlement, SeasonRow, SubscriptionRow } from '@/types/database';
import './pass.css';

interface SeasonView {
  season: SeasonRow;
  owned: boolean;
  purchasedAt: string | null;
}

export default function MySeasonsScreen() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SeasonView[]>([]);
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [subActive, setSubActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [seasons, ents, subscription, active] = await Promise.all([
        fetchSeasons(),
        fetchMyEntitlements(),
        fetchMySubscription(),
        hasActiveSubscription(),
      ]);
      setSub(subscription);
      setSubActive(active);
      const bySeason = new Map(ents.map((e: SeasonEntitlement) => [e.season_id, e]));
      setRows(
        seasons.map((season) => {
          const e = bySeason.get(season.id);
          return {
            season,
            owned: active || Boolean(e),
            purchasedAt: e?.purchased_at ?? null,
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="pass my-seasons">
      <button type="button" className="pass-back" onClick={() => navigate(-1)} aria-label="Volver">
        ←
      </button>
      <h1 className="pass-title">Mi suscripción</h1>
      <p className="pass-lead">
        Suscripción mensual para niveles de pago. Cancela cuando quieras en Mercado Pago.
      </p>

      {loading && <p className="pass-muted">Cargando…</p>}
      {error && <p className="pass-error">{error}</p>}

      {!loading && !error && (
        <>
          <section className={`my-season-card${subActive ? ' owned' : ''}`}>
            <div>
              <strong>{subActive ? 'Suscripción activa' : 'Sin suscripción activa'}</strong>
              {sub && (
                <span className="my-season-meta">
                  Estado: {sub.status}
                  {sub.amount_clp ? ` · ${formatClp(sub.amount_clp)}/mes` : ''}
                </span>
              )}
              {!subActive && (
                <span className="my-season-meta">
                  Suscríbete para desbloquear niveles 8–70 de la temporada.
                </span>
              )}
            </div>
            {subActive ? (
              <a
                className="btn-ghost my-season-buy"
                href={MP_MANAGE_SUBSCRIPTION_URL}
                target="_blank"
                rel="noreferrer"
              >
                Gestionar / cancelar
              </a>
            ) : (
              rows[0] && (
                <Link className="btn-ghost my-season-buy" to={`/pase/${rows[0].season.id}`}>
                  Suscribirme
                </Link>
              )
            )}
          </section>

          <h2 className="pass-eyebrow" style={{ marginTop: 8 }}>
            Temporadas
          </h2>
          <ul className="my-seasons-list">
            {rows.map(({ season, owned, purchasedAt }) => {
              const pricing = seasonPricing(season);
              return (
                <li key={season.id} className={`my-season-card${owned ? ' owned' : ''}`}>
                  <div>
                    <strong>{season.name}</strong>
                    <span className="my-season-slug">{season.slug}</span>
                    {owned && subActive && (
                      <span className="my-season-meta">Incluida en tu suscripción</span>
                    )}
                    {owned && !subActive && purchasedAt && (
                      <span className="my-season-meta">
                        Acceso legacy · {new Date(purchasedAt).toLocaleDateString('es-CL')}
                      </span>
                    )}
                    {!owned && (
                      <span className="my-season-meta">
                        Desde {formatClp(pricing.effectiveClp)}/mes
                        {pricing.onOffer ? ' (oferta)' : ''}
                      </span>
                    )}
                  </div>
                  {owned ? (
                    <span className="my-season-badge">✓</span>
                  ) : (
                    <Link className="btn-ghost my-season-buy" to={`/pase/${season.id}`}>
                      Suscribirme
                    </Link>
                  )}
                </li>
              );
            })}
            {rows.length === 0 && <p className="pass-muted">Aún no hay temporadas.</p>}
          </ul>
        </>
      )}
    </main>
  );
}
