/** Claves y helpers del aviso +18 (persistido en el dispositivo). */

const AGE_KEY = 'puntocachero:age_gate_v1';

export function hasConfirmedAge18(): boolean {
  try {
    return localStorage.getItem(AGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function confirmAge18(): void {
  try {
    localStorage.setItem(AGE_KEY, '1');
  } catch {
    // Sin storage: el gate se pedirá en cada visita.
  }
}

export const LEGAL_CONTACT_EMAIL = 'privacidad@puntocachero.cl';
export const LEGAL_EFFECTIVE_DATE = '18 de julio de 2026';
export const LEGAL_OPERATOR_NAME = 'puntocachero';
