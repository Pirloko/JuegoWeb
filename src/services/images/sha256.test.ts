import { describe, expect, it } from 'vitest';
import { sha256Hex } from './sha256';

describe('sha256Hex', () => {
  it('mismo contenido → mismo hash', async () => {
    const a = new Blob([new Uint8Array([1, 2, 3, 4])]);
    const b = new Blob([new Uint8Array([1, 2, 3, 4])]);
    expect(await sha256Hex(a)).toBe(await sha256Hex(b));
  });

  it('contenido distinto → hash distinto', async () => {
    const a = new Blob([new Uint8Array([1, 2, 3])]);
    const b = new Blob([new Uint8Array([1, 2, 4])]);
    expect(await sha256Hex(a)).not.toBe(await sha256Hex(b));
  });

  it('devuelve hex de 64 caracteres', async () => {
    const hex = await sha256Hex(new Blob(['hola']));
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });
});
