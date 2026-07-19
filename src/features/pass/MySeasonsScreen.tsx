import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchMyEntitlements,
  fetchMySubscription,
  fetchPassExpiresAt,
  fetchSeasons,
  formatPassExpiry,
  hasActiveSubscription,
  seasonPricing,
} from '@/services/supabase/seasons';
import { formatClp, MP_MANAGE_SUBSCRIPTION_URL } from '@/types/database';
import type { SeasonEntitlement, SeasonRow, SubscriptionRow } from '@/types/database';
import './pass.css';

interface SeasonView {
  season: SeasonRow;
  owned: boolean;
  expiresLabel: string | null;
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
      const views = await Promise.all(
        seasons.map(async (season) => {
          const e = bySeason.get(season.id);
          const expiresAt = await fetchPassExpiresAt(season.id);
          const owned = Boolean(expiresAt);
          return {
            season,
            owned,
            expiresLabel: formatPassExpiry(expiresAt),
            purchasedAt: e?.purchased_at ?? null,
          };
        }),
      );
      setRows(views);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const subExpiry = formatPassExpiry(sub?.current_period_end);

  return (
    <main className="pass my-seasons">
      <button type="button" className="pass-back" onClick={() => navigate(-1)} aria-label="Volver">
        ←
      </button>
      <h1 className="pass-title">Mi pase</h1>
      <p className="pass-lead">
        Pase ~30 días: GIF y video de temporadas liberadas por ★. Lo ya revelado se queda en tu
        galería. Cancela en Mercado Pago cuando quieras.
      </p>

      {loading && <p className="pass-muted">Cargando…</p>}
      {error && <p className="pass-error">{error}</p>}

      {!loading && !error && (
        <>
          <section className={`my-season-card${subActive ? ' owned' : ''}`}>
            <div>
              <strong>{subActive ? 'Pase activo' : 'Sin pase activo'}</strong>
              {sub && (
                <span className="my-season-meta">
                  Estado: {sub.status}
                  {sub.amount_clp ? ` · ${formatClp(sub.amount_clp)}/mes` : ''}
                  {subActive && subExpiry ? ` · hasta ${subExpiry}` : ''}
                </span>
              )}
              {!subActive && (
                <span className="my-season-meta">
                  Suscríbete para jugar especiales (GIF/video). Las fotos siguen gratis.
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
                  Activar pase
                </Link>
              )
            )}
          </section>

          <h2 className="pass-eyebrow" style={{ marginTop: 8 }}>
            Temporadas
          </h2>
          <ul className="my-seasons-list">
            {rows.map(({ season, owned, expiresLabel, purchasedAt }) => {
              const pricing = seasonPricing(season);
              return (
                <li key={season.id} className={`my-season-card${owned ? ' owned' : ''}`}>
                  <div>
                    <strong>{season.name}</strong>
                    <span className="my-season-slug">{season.slug}</span>
                    {owned && expiresLabel && (
                      <span className="my-season-meta">Especiales hasta {expiresLabel}</span>
                    )}
                    {owned && !expiresLabel && purchasedAt && (
                      <span className="my-season-meta">
                        Otorgado · {new Date(purchasedAt).toLocaleDateString('es-CL')}
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
                      Activar pase
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
