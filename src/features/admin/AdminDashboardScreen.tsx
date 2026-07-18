import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAdminDashboardStats,
  formatPlayTime,
  type AdminDashboardStats,
} from '@/services/supabase/adminStats';
import './admin.css';

type WindowDays = 7 | 30;

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-stat-card">
      <span className="admin-stat-label">{label}</span>
      <strong className="admin-stat-value">{value}</strong>
      {hint ? <span className="admin-stat-hint">{hint}</span> : null}
    </div>
  );
}

export default function AdminDashboardScreen() {
  const [days, setDays] = useState<WindowDays>(30);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (windowDays: WindowDays) => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchAdminDashboardStats(windowDays));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar métricas');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const subs = stats?.subs_by_status ?? {};

  return (
    <main className="admin admin-dash">
      <header className="admin-header">
        <span className="admin-spacer" />
        <h1>Dashboard</h1>
        <span className="admin-spacer" />
      </header>

      <div className="admin-window-toggle" role="group" aria-label="Ventana de tiempo">
        <button
          type="button"
          className={days === 7 ? 'is-active' : ''}
          onClick={() => setDays(7)}
        >
          7 días
        </button>
        <button
          type="button"
          className={days === 30 ? 'is-active' : ''}
          onClick={() => setDays(30)}
        >
          30 días
        </button>
      </div>

      {loading && <p className="admin-msg">Cargando métricas…</p>}
      {error && <p className="admin-error">{error}</p>}

      {!loading && stats && (
        <>
          <section className="admin-dash-section">
            <h2>Usuarios</h2>
            <div className="admin-stat-grid">
              <StatCard label="Total" value={String(stats.users_total)} />
              <StatCard label="Nuevos" value={String(stats.users_new)} hint={`Últimos ${days} días`} />
              <StatCard
                label="Recurrentes"
                value={String(stats.users_returning)}
                hint="≥2 días con partida"
              />
              <StatCard label="Pagados" value={String(stats.users_paid)} hint="Sub autorizada" />
            </div>
          </section>

          <section className="admin-dash-section">
            <h2>Suscripciones</h2>
            <div className="admin-stat-grid">
              <StatCard label="Authorized" value={String(subs.authorized ?? 0)} />
              <StatCard label="Pending" value={String(subs.pending ?? 0)} />
              <StatCard label="Paused" value={String(subs.paused ?? 0)} />
              <StatCard label="Cancelled" value={String(subs.cancelled ?? 0)} />
            </div>
          </section>

          <section className="admin-dash-section">
            <h2>Actividad</h2>
            <div className="admin-stat-grid">
              <StatCard
                label="Tiempo (ventana)"
                value={formatPlayTime(stats.play_time_ms_window)}
                hint={`Últimos ${days} días`}
              />
              <StatCard label="Tiempo total" value={formatPlayTime(stats.play_time_ms_total)} />
              <StatCard label="Sesiones" value={String(stats.sessions_count)} />
              <StatCard label="Niveles completados" value={String(stats.levels_completed)} />
              <StatCard label="Intentos (histórico)" value={String(stats.attempts_total)} />
            </div>
          </section>
        </>
      )}

      <section className="admin-dash-section">
        <h2>Accesos rápidos</h2>
        <nav className="admin-quick-links" aria-label="Contenido admin">
          <Link className="admin-quick-link" to="/admin/seasons">
            Temporadas
          </Link>
          <Link className="admin-quick-link" to="/admin/niveles">
            Niveles
          </Link>
          <Link className="admin-quick-link" to="/admin/sitios">
            Sitios amigos
          </Link>
          <Link className="admin-quick-link" to="/admin/suscripciones">
            Suscripciones
          </Link>
        </nav>
      </section>
    </main>
  );
}
