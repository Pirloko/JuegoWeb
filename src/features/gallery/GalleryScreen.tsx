import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGallery } from '@/services/supabase/levels';
import RevealedMedia from '@/components/RevealedMedia';
import FriendSites from '@/components/FriendSites';
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

function LockIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function GalleryScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<GalleryItem | null>(null);
  const [tab, setTab] = useState<Tab>('locked');
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
  const pct = items.length ? (revealed.length / items.length) * 100 : 0;

  return (
    <main className="gallery">
      <header className="gallery-header">
        <button
          type="button"
          className="gallery-back"
          aria-label="Volver"
          onClick={() => navigate('/')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden
          >
            <path d="M15 18 9 12l6-6" />
          </svg>
        </button>
        <div className="gallery-heading">
          <h1 className="gallery-title">Galería</h1>
          <p className="gallery-sub">Completa niveles para revelar imágenes</p>
        </div>
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

          <div
            className="gallery-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={revealed.length}
            aria-label={`${revealed.length} de ${items.length} reveladas`}
          >
            <div className="gallery-progress-track">
              <div className="gallery-progress-bar" style={{ width: `${pct}%` }} />
              <span className="gallery-progress-spark" aria-hidden />
            </div>
            <span className="gallery-progress-label">
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
          {visible.map((item, index) => (
            <li key={item.level.id} style={{ '--i': Math.min(index, 12) } as CSSProperties}>
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
                    <span className="gallery-lock-wrap" aria-hidden>
                      <span className="gallery-lock-ring gallery-lock-ring--outer" />
                      <span className="gallery-lock-ring gallery-lock-ring--inner" />
                      <span className="gallery-lock-glyph">
                        <LockIcon size={20} />
                      </span>
                      <span className="gallery-lock-spark s1" />
                      <span className="gallery-lock-spark s2" />
                      <span className="gallery-lock-spark s3" />
                    </span>
                    <span className="gallery-tile-name">{item.level.name}</span>
                    <span className="gallery-locked-pill">
                      <LockIcon size={12} />
                      Bloqueado
                    </span>
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
          <div className="gallery-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="gallery-sheet-media">
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
              <button
                type="button"
                className="gallery-sheet-close"
                aria-label="Cerrar"
                onClick={() => setViewer(null)}
              >
                ✕
              </button>
            </div>
            <div className="gallery-sheet-body">
              <div className="gallery-sheet-title">
                <h2>{viewer.level.name}</h2>
                <span className={`gallery-sheet-status ${viewer.revealed ? 'revealed' : 'locked'}`}>
                  {viewer.revealed ? 'Revelado' : 'Bloqueado'}
                </span>
              </div>
              {!viewer.revealed && (
                <p className="gallery-sheet-hint">Completa el nivel para revelarlo.</p>
              )}
              {viewer.revealed && viewer.level.source_url && (
                <a
                  className="gallery-source-cta"
                  href={viewer.level.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="gallery-source-icon" aria-hidden>
                    ↗
                  </span>
                  <span className="gallery-source-text">
                    <strong>Ver el origen</strong>
                    <small>Abrir el enlace de este contenido</small>
                  </span>
                  <span className="gallery-source-chevron" aria-hidden>
                    ›
                  </span>
                </a>
              )}
              {viewer.revealed && <LevelReviews levelId={viewer.level.id} />}
              {viewer.revealed && <FriendSites />}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
