import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAdminSubscriptions,
  type AdminSubscriptionRow,
  type SubscriptionStatus,
} from '@/services/supabase/adminStats';
import { formatClp } from '@/types/database';
import './admin.css';

const STATUS_OPTIONS: Array<{ value: 'all' | SubscriptionStatus; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'authorized', label: 'Authorized' },
  { value: 'pending', label: 'Pending' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function AdminSubscriptionsScreen() {
  const [filter, setFilter] = useState<'all' | SubscriptionStatus>('all');
  const [rows, setRows] = useState<AdminSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: typeof filter) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchAdminSubscriptions(status));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  return (
    <main className="admin">
      <header className="admin-header">
        <Link className="admin-back" to="/admin">
          ←
        </Link>
        <h1>Suscripciones</h1>
        <span className="admin-spacer" />
      </header>

      <div className="admin-toolbar">
        <label className="admin-field admin-season-select">
          <span>Estado</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="admin-msg">Cargando…</p>}
      {error && <p className="admin-error">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="admin-msg">No hay suscripciones con este filtro.</p>
      )}

      {!loading && rows.length > 0 && (
        <ul className="admin-list">
          {rows.map((r) => (
            <li key={r.user_id} className="admin-sub-row">
              <div className="admin-row-meta">
                <strong>{r.username ?? r.user_id.slice(0, 8)}</strong>
                <span>
                  <span className={`admin-sub-status admin-sub-status--${r.status}`}>
                    {r.status}
                  </span>
                  {' · '}
                  {formatClp(r.amount_clp)}
                </span>
                <span>
                  Periodo hasta {formatDate(r.current_period_end)} · act. {formatDate(r.updated_at)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
