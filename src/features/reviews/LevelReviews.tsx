import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/admin/isAdmin';
import {
  deleteReview,
  fetchLevelReviews,
  upsertMyReview,
  type LevelReview,
} from '@/services/supabase/reviews';
import { REVIEW_MAX_LENGTH, validateReviewBody } from './reviewValidation';
import './reviews.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

/** Reseñas del contenido revelado de un nivel. Solo se monta si está revelado. */
export default function LevelReviews({ levelId }: { levelId: string }) {
  const { user } = useAuth();
  const admin = isAdminUser(user);
  const uid = user?.id ?? null;

  const [reviews, setReviews] = useState<LevelReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const mine = useMemo(() => reviews.find((r) => r.user_id === uid) ?? null, [reviews, uid]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReviews(await fetchLevelReviews(levelId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las reseñas');
    } finally {
      setLoading(false);
    }
  }, [levelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!uid) return;
    const v = validateReviewBody(draft);
    if (!v.ok) {
      setFormError(v.error);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await upsertMyReview(levelId, uid, v.body);
      setEditing(false);
      setDraft('');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo guardar la reseña');
    } finally {
      setSaving(false);
    }
  }

  async function remove(review: LevelReview) {
    if (!window.confirm('¿Borrar esta reseña?')) return;
    try {
      await deleteReview(review.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar la reseña');
    }
  }

  const showForm = !loading && !error && uid != null && (editing || !mine);

  return (
    <section className="reviews" aria-label="Reseñas">
      <h3 className="reviews-title">Reseñas{!loading && !error ? ` (${reviews.length})` : ''}</h3>

      {loading && <p className="reviews-msg">Cargando reseñas…</p>}
      {error && <p className="reviews-msg reviews-error">{error}</p>}

      {!loading && !error && reviews.length === 0 && (
        <p className="reviews-msg">Nadie ha opinado todavía. Parte tú, cachero.</p>
      )}

      {!loading && !error && (
        <ul className="reviews-list">
          {reviews.map((r) => (
            <li key={r.id} className={`review-item${r.user_id === uid ? ' is-mine' : ''}`}>
              <div className="review-head">
                <span className="review-user">
                  {r.username}
                  {r.user_id === uid ? ' (tú)' : ''}
                </span>
                <span className="review-date">{formatDate(r.created_at)}</span>
              </div>
              <p className="review-body">{r.body}</p>
              {(r.user_id === uid || admin) && (
                <div className="review-actions">
                  {r.user_id === uid && (
                    <button
                      type="button"
                      className="review-action"
                      onClick={() => {
                        setDraft(r.body);
                        setEditing(true);
                        setFormError(null);
                      }}
                    >
                      Editar
                    </button>
                  )}
                  <button
                    type="button"
                    className="review-action danger"
                    onClick={() => void remove(r)}
                  >
                    Borrar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="review-form">
          <textarea
            value={draft}
            maxLength={REVIEW_MAX_LENGTH}
            rows={3}
            placeholder="¿Qué te pareció este contenido, cachero?"
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="review-form-foot">
            <span className="review-counter">
              {draft.trim().length}/{REVIEW_MAX_LENGTH}
            </span>
            <div className="review-form-actions">
              {editing && (
                <button
                  type="button"
                  className="review-action"
                  onClick={() => {
                    setEditing(false);
                    setDraft('');
                    setFormError(null);
                  }}
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                className="btn-cta review-save"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? 'Guardando…' : mine ? 'Actualizar' : 'Publicar'}
              </button>
            </div>
          </div>
          {formError && <p className="reviews-error">{formError}</p>}
        </div>
      )}
    </section>
  );
}
