import { describe, expect, it } from 'vitest';
import { selectChainTargets } from './LightningEffect';

const origin = { x: 0, y: 0 };

describe('selectChainTargets (rayo)', () => {
  it('elige primero al más cercano al origen', () => {
    const near = { x: 10, y: 0 };
    const far = { x: 100, y: 0 };
    expect(selectChainTargets(origin, [far, near], 1)).toEqual([near]);
  });

  it('encadena: cada salto va al más cercano de la víctima anterior', () => {
    const a = { x: 10, y: 0 };
    const b = { x: 100, y: 0 }; // más cerca de a que c
    const c = { x: -80, y: 0 }; // más cerca del origen que b, pero no de a
    expect(selectChainTargets(origin, [b, c, a], 2)).toEqual([a, b]);
  });

  it('respeta el límite de objetivos', () => {
    const candidates = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(selectChainTargets(origin, candidates, 2)).toHaveLength(2);
  });

  it('si hay menos enemigos que objetivos, devuelve los que haya', () => {
    expect(selectChainTargets(origin, [{ x: 5, y: 5 }], 3)).toHaveLength(1);
  });

  it('sin enemigos devuelve vacío y no revienta', () => {
    expect(selectChainTargets(origin, [], 2)).toEqual([]);
  });

  it('no repite víctimas', () => {
    const a = { x: 10, y: 0 };
    const b = { x: 20, y: 0 };
    const result = selectChainTargets(origin, [a, b], 2);
    expect(result).toEqual([a, b]);
    expect(new Set(result).size).toBe(2);
  });
});
