import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/admin/isAdmin';
import { useTutorial } from '@/features/tutorial/TutorialProvider';
import { fetchMyBadges } from '@/services/supabase/badges';
import { deleteOwnAccount } from '@/services/supabase/account';
import { BADGE_CATALOG, BADGE_ORDER } from '@/features/progression/badgeCatalog';
import { MP_MANAGE_SUBSCRIPTION_URL } from '@/types/database';
import '@/features/legal/legal.css';
import './profile.css';

function RowIcon({
  kind,
}: {
  kind: 'tutorial' | 'sub' | 'levels' | 'admin' | 'logout' | 'delete';
}) {
  const props = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    'aria-hidden': true as const,
  };
  switch (kind) {
    case 'tutorial':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-1.2A2.4 2.4 0 0 0 13.5 12c0-1-.8-1.5-1.5-1.5s-1.5.5-1.5 1.5" />
          <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'sub':
      return (
        <svg {...props} fill="currentColor" stroke="none">
          <path d="M3 18h18l-1.5-9-4.5 3.5L12 5l-3 7.5L4.5 9 3 18Z" />
        </svg>
      );
    case 'levels':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'admin':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case 'delete':
      return (
        <svg {...props}>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      );
  }
}

function formatBadgeDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { openTutorial } = useTutorial();
  const admin = isAdminUser(user);
  const displayName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'Jugador';
  const email = user?.email ?? '';

  const [earned, setEarned] = useState<Map<string, string>>(new Map());
  const [badgesLoading, setBadgesLoading] = useState(!admin);
  const [badgesError, setBadgesError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadBadges = useCallback(async () => {
    if (admin) return;
    setBadgesLoading(true);
    setBadgesError(null);
    try {
      const rows = await fetchMyBadges();
      const map = new Map(rows.map((r) => [r.badge_id, r.awarded_at]));
      setEarned(map);
      const firstEarned = BADGE_ORDER.find((id) => map.has(id));
      setSelectedId(firstEarned ?? BADGE_ORDER[0] ?? null);
    } catch (e) {
      setBadgesError(e instanceof Error ? e.message : 'No se pudieron cargar los logros');
    } finally {
      setBadgesLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    void loadBadges();
  }, [loadBadges]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return BADGE_CATALOG[selectedId as keyof typeof BADGE_CATALOG] ?? null;
  }, [selectedId]);

  const selectedAt = selectedId ? earned.get(selectedId) : undefined;
  const canConfirmDelete = deleteText.trim().toUpperCase() === 'ELIMINAR';

  async function onDeleteAccount() {
    if (!canConfirmDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOwnAccount();
      navigate('/', { replace: true });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta');
      setDeleting(false);
    }
  }

  return (
    <main className="profile">
      <header className="profile-header">
        <button
          type="button"
          className="profile-back"
          aria-label="Volver"
          onClick={() => navigate(admin ? '/admin' : '/')}
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
        <div className="profile-heading">
          <h1 className="profile-title">Perfil</h1>
          <p className="profile-sub">{admin ? 'Cuenta de administración' : 'Tu cuenta, cachero'}</p>
        </div>
      </header>

      <section className="profile-card" aria-label="Identidad">
        <div className="profile-card-glow" aria-hidden />
        <div className="profile-avatar" aria-hidden>
          <span>{displayName.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="profile-meta">
          <p className="profile-eyebrow">{admin ? 'Admin' : 'Cachero'}</p>
          <h2 className="profile-name">{displayName}</h2>
          {email ? <p className="profile-email">{email}</p> : null}
        </div>
        {!admin && !badgesLoading && !badgesError && (
          <div className="profile-badge-tally" title="Medallas obtenidas">
            <strong>
              {earned.size}
              <span>/{BADGE_ORDER.length}</span>
            </strong>
            <small>medallas</small>
          </div>
        )}
      </section>

      {!admin && (
        <section className="profile-badges" aria-label="Logros">
          <div className="profile-section-head">
            <h2>Logros</h2>
            <p>Tus medallas cacheras</p>
          </div>

          {badgesLoading && <p className="profile-badges-msg">Cargando medallas…</p>}
          {badgesError && (
            <div className="profile-badges-msg">
              <p className="profile-badges-error">{badgesError}</p>
              <button type="button" className="btn-ghost" onClick={() => void loadBadges()}>
                Reintentar
              </button>
            </div>
          )}

          {!badgesLoading && !badgesError && (
            <>
              <ul className="profile-badge-grid">
                {BADGE_ORDER.map((id, index) => {
                  const def = BADGE_CATALOG[id];
                  const at = earned.get(id);
                  const active = selectedId === id;
                  return (
                    <li key={id} style={{ '--i': index } as CSSProperties}>
                      <button
                        type="button"
                        className={`profile-badge-chip${at ? ' is-earned' : ''}${active ? ' is-active' : ''}`}
                        aria-pressed={active}
                        aria-label={`${def.name}${at ? ', obtenida' : ', pendiente'}`}
                        onClick={() => setSelectedId(id)}
                      >
                        <span className="profile-badge-glyph" aria-hidden>
                          {def.icon}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {selected && (
                <div className={`profile-badge-detail${selectedAt ? ' is-earned' : ''}`}>
                  <div className="profile-badge-detail-icon" aria-hidden>
                    {selected.icon}
                  </div>
                  <div className="profile-badge-detail-text">
                    <strong>{selected.name}</strong>
                    <small>{selectedAt ? selected.earnedPhrase : selected.description}</small>
                  </div>
                  <span className="profile-badge-detail-state">
                    {selectedAt ? formatBadgeDate(selectedAt) : 'Pendiente'}
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <nav className="profile-actions" aria-label="Opciones de perfil">
        {admin ? (
          <>
            <button type="button" className="profile-row" onClick={() => navigate('/admin')}>
              <span className="profile-row-icon admin">
                <RowIcon kind="admin" />
              </span>
              <span className="profile-row-text">
                <strong>Dashboard</strong>
                <small>Métricas y resumen</small>
              </span>
              <span className="profile-row-chevron" aria-hidden>
                ›
              </span>
            </button>
            <button type="button" className="profile-row" onClick={() => navigate('/admin/niveles')}>
              <span className="profile-row-icon levels">
                <RowIcon kind="levels" />
              </span>
              <span className="profile-row-text">
                <strong>Contenido</strong>
                <small>Temporadas, niveles y sitios</small>
              </span>
              <span className="profile-row-chevron" aria-hidden>
                ›
              </span>
            </button>
            <button
              type="button"
              className="profile-row"
              onClick={() => navigate('/admin/suscripciones')}
            >
              <span className="profile-row-icon sub">
                <RowIcon kind="sub" />
              </span>
              <span className="profile-row-text">
                <strong>Suscripciones</strong>
                <small>Estados y periodos</small>
              </span>
              <span className="profile-row-chevron" aria-hidden>
                ›
              </span>
            </button>
          </>
        ) : (
          <>
            <button type="button" className="profile-row" onClick={() => openTutorial()}>
              <span className="profile-row-icon tutorial">
                <RowIcon kind="tutorial" />
              </span>
              <span className="profile-row-text">
                <strong>Ver tutorial</strong>
                <small>Cómo se juega, cachero</small>
              </span>
              <span className="profile-row-chevron" aria-hidden>
                ›
              </span>
            </button>

            <button type="button" className="profile-row" onClick={() => navigate('/mis-temporadas')}>
              <span className="profile-row-icon sub">
                <RowIcon kind="sub" />
              </span>
              <span className="profile-row-text">
                <strong>Mi suscripción</strong>
                <small>Estado y temporadas</small>
              </span>
              <span className="profile-row-chevron" aria-hidden>
                ›
              </span>
            </button>
          </>
        )}

        <button
          type="button"
          className="profile-row danger"
          onClick={() => void signOut().then(() => navigate('/'))}
        >
          <span className="profile-row-icon logout">
            <RowIcon kind="logout" />
          </span>
          <span className="profile-row-text">
            <strong>Cerrar sesión</strong>
            <small>Salir de tu cuenta</small>
          </span>
          <span className="profile-row-chevron" aria-hidden>
            ›
          </span>
        </button>

        {!admin && (
          <button
            type="button"
            className="profile-row danger"
            onClick={() => {
              setConfirmDelete(true);
              setDeleteText('');
              setDeleteError(null);
            }}
          >
            <span className="profile-row-icon delete">
              <RowIcon kind="delete" />
            </span>
            <span className="profile-row-text">
              <strong>Eliminar cuenta</strong>
              <small>Borra tu perfil y progreso para siempre</small>
            </span>
            <span className="profile-row-chevron" aria-hidden>
              ›
            </span>
          </button>
        )}
      </nav>

      <nav className="profile-legal-links" aria-label="Legal">
        <Link to="/legal/terminos">Condiciones de uso</Link>
        <Link to="/legal/privacidad">Política de privacidad</Link>
      </nav>

      {confirmDelete && (
        <div className="profile-delete-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="profile-delete-card">
            <h2 id="delete-title">¿Eliminar tu cuenta?</h2>
            <p>
              Esta acción es <strong>permanente</strong>. Se borrarán tu perfil, progreso, medallas y
              galería. No se puede deshacer.
            </p>
            <p>
              Si tienes una suscripción activa en Mercado Pago,{' '}
              <a href={MP_MANAGE_SUBSCRIPTION_URL} target="_blank" rel="noopener noreferrer">
                cancélala allí
              </a>{' '}
              para evitar cobros futuros.
            </p>
            <label className="profile-delete-field">
              <span>
                Escribe <strong>ELIMINAR</strong> para confirmar
              </span>
              <input
                type="text"
                autoComplete="off"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="ELIMINAR"
                disabled={deleting}
              />
            </label>
            {deleteError && <p className="profile-delete-error">{deleteError}</p>}
            <div className="profile-delete-actions">
              <button
                type="button"
                className="profile-delete-cancel"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="profile-delete-confirm"
                disabled={!canConfirmDelete || deleting}
                onClick={() => void onDeleteAccount()}
              >
                {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
