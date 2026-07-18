import { describe, expect, it } from 'vitest';
import { REVIEW_MAX_LENGTH, validateReviewBody } from './reviewValidation';

describe('validateReviewBody', () => {
  it('rechaza vacío y solo espacios', () => {
    expect(validateReviewBody('').ok).toBe(false);
    expect(validateReviewBody('   \n ').ok).toBe(false);
  });

  it('rechaza demasiado corto tras trim', () => {
    expect(validateReviewBody('  ab  ').ok).toBe(false);
  });

  it('acepta y normaliza espacios', () => {
    const r = validateReviewBody('  wena     cachero  ');
    expect(r).toEqual({ ok: true, body: 'wena  cachero' });
  });

  it('rechaza sobre el máximo', () => {
    const r = validateReviewBody('x'.repeat(REVIEW_MAX_LENGTH + 1));
    expect(r.ok).toBe(false);
  });

  it('acepta exactamente el máximo', () => {
    const r = validateReviewBody('x'.repeat(REVIEW_MAX_LENGTH));
    expect(r.ok).toBe(true);
  });
});
