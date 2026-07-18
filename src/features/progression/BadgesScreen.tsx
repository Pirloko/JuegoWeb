import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMyBadges } from '@/services/supabase/badges';
import { BADGE_CATALOG, BADGE_ORDER } from './badgeCatalog';
import './badges.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export default function BadgesScreen() {
  const [earned, setEarned] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMyBadges();
      setEarned(new Map(rows.map((r) => [r.badge_id, r.awarded_at])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar logros');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    const defs = BADGE_ORDER.map((id) => BADGE_CATALOG[id]);
    return [...defs.filter((d) => earned.has(d.id)), ...defs.filter((d) => !earned.has(d.id))];
  }, [earned]);

  return (
    <main className="badges">
      <header className="badges-header">
        <h1 className="page-title">Logros</h1>
        <p className="page-sub">Tu colección de medallas cacheras</p>
      </header>

      {!loading && !error && (
        <p className="badges-count">
          {earned.size}/{BADGE_ORDER.length} medallas
        </p>
      )}

      {loading && <p className="badges-msg">Cargando…</p>}
      {error && (
        <div className="badges-msg">
          <p className="badges-error">{error}</p>
          <button type="button" className="btn-ghost" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && (
        <ul className="badges-list">
          {sorted.map((def) => {
            const at = earned.get(def.id);
            return (
              <li key={def.id} className={`badge-row${at ? ' is-earned' : ''}`}>
                <span className="badge-icon" aria-hidden>
                  {def.icon}
                </span>
                <span className="badge-text">
                  <strong>{def.name}</strong>
                  <small>{at ? def.earnedPhrase : def.description}</small>
                </span>
                <span className="badge-state">{at ? formatDate(at) : 'Pendiente'}</span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
