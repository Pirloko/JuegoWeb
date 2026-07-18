import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchGallery } from '@/services/supabase/levels';
import RevealedMedia from '@/components/RevealedMedia';
import LevelReviews from '@/features/reviews/LevelReviews';
import type { GalleryItem, LevelMediaType } from '@/types/database';
import './gallery.css';

type Tab = 'revealed' | 'locked';
type TypeFilter = 'all' | LevelMediaType;

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'image', label: 'Fotos' },
  { id: 'gif', label: 'GIFs' },
  { id: 'video', label: 'Videos' },
];

export default function GalleryScreen() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<GalleryItem | null>(null);
  const [tab, setTab] = useState<Tab>('revealed');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

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
  const hasSpecial = useMemo(() => items.some((i) => i.level.media_type !== 'image'), [items]);
  const visible = (tab === 'revealed' ? revealed : locked).filter(
    (i) => typeFilter === 'all' || i.level.media_type === typeFilter,
  );

  return (
    <main className="gallery">
      <header className="gallery-header">
        <h1 className="page-title">Galería</h1>
        <p className="page-sub">Completa niveles para revelar el contenido oculto</p>
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
          {hasSpecial && (
            <div className="gallery-type-filters" role="group" aria-label="Filtrar por tipo">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`gallery-type-chip${typeFilter === f.id ? ' is-active' : ''}`}
                  onClick={() => setTypeFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
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
                {item.level.media_type !== 'image' && (
                  <span className={`gallery-type-badge ${item.level.media_type}`} aria-hidden>
                    {item.level.media_type === 'video' ? '▶' : 'GIF'}
                  </span>
                )}
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
                ? 'Aún no has revelado contenido. ¡Juega un nivel!'
                : 'No queda contenido bloqueado.'}
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
            {viewer.revealed ? (
              <RevealedMedia
                mediaType={viewer.level.media_type}
                mediaUrl={viewer.mediaUrl}
                posterUrl={viewer.displayUrl}
                alt={viewer.level.name}
              />
            ) : (
              <img
                src={viewer.displayUrl}
                alt="Contenido bloqueado"
                className="is-blurred"
                draggable={false}
              />
            )}
            <p>
              {viewer.revealed
                ? viewer.level.name
                : `${viewer.level.name}: completa el nivel para revelarlo`}
            </p>
            {viewer.revealed && viewer.level.source_url && (
              <a
                className="btn-ghost gallery-source-cta"
                href={viewer.level.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver el origen del contenido ↗
              </a>
            )}
            {viewer.revealed && <LevelReviews levelId={viewer.level.id} />}
            <button type="button" className="btn-cta" onClick={() => setViewer(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
