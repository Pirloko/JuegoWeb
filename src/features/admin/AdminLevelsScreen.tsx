import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteLevel, fetchAllLevelsAdmin, fetchSeasonsAdmin } from '@/services/supabase/admin';
import type { LevelRow, SeasonRow } from '@/types/database';
import './admin.css';

export default function AdminLevelsScreen() {
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [seasonId, setSeasonId] = useState<string>('');
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSeasons = useCallback(async () => {
    const list = await fetchSeasonsAdmin();
    setSeasons(list);
    setSeasonId((prev) => prev || list[0]?.id || '');
  }, []);

  const loadLevels = useCallback(async (sid: string) => {
    if (!sid) {
      setLevels([]);
      return;
    }
    setLevels(await fetchAllLevelsAdmin(sid));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadSeasons();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [loadSeasons]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!seasonId) return;
    void (async () => {
      try {
        await loadLevels(seasonId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar niveles');
      }
    })();
  }, [seasonId, loadLevels]);

  async function onDelete(level: LevelRow) {
    if (!confirm(`¿Eliminar "${level.name}"? Esto borra progreso asociado.`)) return;
    try {
      await deleteLevel(level.id);
      await loadLevels(seasonId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  return (
    <main className="admin">
      <header className="admin-header">
        <Link className="admin-back" to="/">
          ←
        </Link>
        <h1>Admin · Niveles</h1>
        <button
          type="button"
          className="admin-add"
          onClick={() => navigate(`/admin/levels/new${seasonId ? `?season=${seasonId}` : ''}`)}
          aria-label="Nuevo nivel"
        >
          +
        </button>
      </header>

      <div className="admin-toolbar">
        <Link className="btn-ghost admin-link" to="/admin/seasons">
          Temporadas
        </Link>
        <label className="admin-field admin-season-select">
          <span>Temporada</span>
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="admin-msg">Cargando…</p>}
      {error && <p className="admin-error">{error}</p>}

      {!loading && (
        <ul className="admin-list">
          {levels.map((level) => (
            <li key={level.id} className="admin-row">
              <button
                type="button"
                className="admin-row-main"
                onClick={() => navigate(`/admin/levels/${level.id}`)}
              >
                <span className="admin-order">{level.sort_order}</span>
                <span className="admin-row-meta">
                  <strong>{level.name}</strong>
                  <span>
                    {level.is_active ? 'Activo' : 'Inactivo'} · {level.config.targetPct}% ·{' '}
                    {level.config.enemies?.length ?? 0} enemigos
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="admin-row-del"
                onClick={() => void onDelete(level)}
                aria-label={`Eliminar ${level.name}`}
              >
                ✕
              </button>
            </li>
          ))}
          {levels.length === 0 && <p className="admin-msg">Sin niveles. Crea el primero.</p>}
        </ul>
      )}
    </main>
  );
}
