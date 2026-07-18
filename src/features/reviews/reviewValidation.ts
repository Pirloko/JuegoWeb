/**
 * Validación pura de reseñas. Límites replicados en la DB
 * (supabase/migrations/00017_source_url_reviews.sql).
 */

export const REVIEW_MIN_LENGTH = 3;
export const REVIEW_MAX_LENGTH = 500;

export type ReviewValidation = { ok: true; body: string } | { ok: false; error: string };

export function validateReviewBody(raw: string): ReviewValidation {
  const body = raw.trim().replace(/\s{3,}/g, '  ');
  if (body.length < REVIEW_MIN_LENGTH) {
    return { ok: false, error: `Escribe al menos ${REVIEW_MIN_LENGTH} caracteres, cachero.` };
  }
  if (body.length > REVIEW_MAX_LENGTH) {
    return {
      ok: false,
      error: `Máximo ${REVIEW_MAX_LENGTH} caracteres (llevas ${body.length}).`,
    };
  }
  return { ok: true, body };
}
