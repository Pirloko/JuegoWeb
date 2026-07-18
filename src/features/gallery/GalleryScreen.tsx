import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchGallery } from '@/services/supabase/levels';
import type { GalleryItem } from '@/types/database';
import './gallery.css';

type Tab = 'revealed' | 'locked';

export default function GalleryScreen() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<GalleryItem | null>(null);
  const [tab, setTab] = useState<Tab>('revealed');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchGallery());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar la galería');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revealed = useMemo(() => items.filter((i) => i.revealed), [items]);
  const locked = useMemo(() => items.filter((i) => !i.revealed), [items]);
  const visible = tab === 'revealed' ? revealed : locked;

  return (
    <main className="gallery">
      <header className="gallery-header">
        <h1 className="page-title">Galería</h1>
        <p className="page-sub">Completa niveles para revelar imágenes</p>
      </header>

      {!loading && items.length > 0 && (
        <>
          <div className="gallery-tabs" role="tablist" aria-label="Filtro de galería">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'revealed'}
              className={`gallery-tab${tab === 'revealed' ? ' is-active' : ''}`}
              onClick={() => setTab('revealed')}
            >
              Descubiertas ({revealed.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'locked'}
              className={`gallery-tab${tab === 'locked' ? ' is-active' : ''}`}
              onClick={() => setTab('locked')}
            >
              Bloqueadas ({locked.length})
            </button>
          </div>
          <div className="gallery-progress" aria-label="Progreso de galería">
            <div
              className="gallery-progress-bar"
              style={{ width: `${items.length ? (revealed.length / items.length) * 100 : 0}%` }}
            />
            <span>
              {revealed.length}/{items.length} reveladas
            </span>
          </div>
        </>
      )}

      {loading && <p className="gallery-msg">Cargando…</p>}
      {error && (
        <div className="gallery-msg">
          <p className="gallery-error">{error}</p>
          <button type="button" className="btn-ghost" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && (
        <ul className="gallery-grid">
          {visible.map((item) => (
            <li key={item.level.id}>
              <button
                type="button"
                className={`gallery-tile ${item.revealed ? 'revealed' : 'locked'}`}
                onClick={() => setViewer(item)}
                aria-label={
                  item.revealed ? `Ver ${item.level.name}` : `${item.level.name} bloqueada`
                }
              >
                <img src={item.displayUrl} alt="" draggable={false} />
                {!item.revealed && (
                  <span className="gallery-veil">
                    <span className="gallery-lock" aria-hidden />
                    <span className="gallery-tile-name">{item.level.name}</span>
                  </span>
                )}
                {item.revealed && (
                  <>
                    <span className="gallery-check" aria-hidden>
                      ✓
                    </span>
                    <span className="gallery-caption">{item.level.name}</span>
                  </>
                )}
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <p className="gallery-msg">
              {tab === 'revealed'
                ? 'Aún no has revelado ninguna. ¡Juega un nivel!'
                : 'No quedan imágenes bloqueadas.'}
            </p>
          )}
        </ul>
      )}

      {viewer && (
        <div
          className="gallery-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={viewer.level.name}
          onClick={() => setViewer(null)}
        >
          <div className="gallery-viewer-card" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewer.displayUrl}
              alt={viewer.revealed ? viewer.level.name : 'Imagen bloqueada'}
              className={viewer.revealed ? undefined : 'is-blurred'}
              draggable={false}
            />
            <p>
              {viewer.revealed
                ? viewer.level.name
                : `${viewer.level.name}: completa el nivel para revelarla`}
            </p>
            <button type="button" className="btn-cta" onClick={() => setViewer(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
