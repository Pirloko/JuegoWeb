import { describe, expect, it } from 'vitest';
import { milestonesForTotal, nextMilestone, seasonProgress, starsForLevel } from './progression';
import { seasonGoalPhrase } from './copy';

describe('milestonesForTotal', () => {
  it('temporada estándar de 70', () => {
    expect(milestonesForTotal(70)).toEqual([5, 10, 25, 50, 70]);
  });

  it('temporada corta incluye el total como hito final', () => {
    expect(milestonesForTotal(12)).toEqual([5, 10, 12]);
    expect(milestonesForTotal(3)).toEqual([3]);
  });

  it('temporada vacía no tiene hitos', () => {
    expect(milestonesForTotal(0)).toEqual([]);
  });
});

describe('nextMilestone', () => {
  it('con 0 completados apunta al primer hito', () => {
    expect(nextMilestone(0, 70)).toBe(5);
  });

  it('exacto en un hito apunta al siguiente', () => {
    expect(nextMilestone(5, 70)).toBe(10);
    expect(nextMilestone(50, 70)).toBe(70);
  });

  it('temporada completa no tiene próximo hito', () => {
    expect(nextMilestone(70, 70)).toBeNull();
  });
});

describe('seasonProgress', () => {
  it('calcula pct y restantes', () => {
    const p = seasonProgress(7, 70);
    expect(p.pct).toBeCloseTo(10);
    expect(p.nextMilestone).toBe(10);
    expect(p.remainingToMilestone).toBe(3);
    expect(p.reachedMilestones).toEqual([5]);
  });

  it('clampa valores fuera de rango', () => {
    expect(seasonProgress(-3, 70).completed).toBe(0);
    expect(seasonProgress(99, 70).completed).toBe(70);
    expect(seasonProgress(5, 0).pct).toBe(0);
  });
});

describe('starsForLevel', () => {
  it('sin best_pct no hay estrellas', () => {
    expect(starsForLevel(null, 60)).toBe(0);
  });

  it('umbrales estándar (target 60): 1★ 60, 2★ 75, 3★ 95', () => {
    expect(starsForLevel(60, 60)).toBe(1);
    expect(starsForLevel(74.9, 60)).toBe(1);
    expect(starsForLevel(75, 60)).toBe(2);
    expect(starsForLevel(94.9, 60)).toBe(2);
    expect(starsForLevel(95, 60)).toBe(3);
    expect(starsForLevel(100, 60)).toBe(3);
  });

  it('target alto (>= 95): completar ya es 3★', () => {
    expect(starsForLevel(96, 96)).toBe(3);
  });

  it('target 85+: salta de 1★ a 3★ (2★ colapsa con 3★)', () => {
    expect(starsForLevel(94, 85)).toBe(1);
    expect(starsForLevel(95, 85)).toBe(3);
  });

  it('por debajo del target (no debería pasar en completed) da 0', () => {
    expect(starsForLevel(40, 60)).toBe(0);
  });
});

describe('seasonGoalPhrase', () => {
  it('sin niveles', () => {
    expect(seasonGoalPhrase(0, 0)).toMatch(/armando/);
  });

  it('sin completados apunta al primer hito', () => {
    expect(seasonGoalPhrase(0, 70)).toMatch(/nivel 1/);
    expect(seasonGoalPhrase(0, 70)).toMatch(/5 conquistas/);
  });

  it('a mitad de camino dice cuántos faltan', () => {
    expect(seasonGoalPhrase(7, 70)).toMatch(/faltan 3/);
    expect(seasonGoalPhrase(7, 70)).toMatch(/hito de 10/);
  });

  it('a uno del hito', () => {
    expect(seasonGoalPhrase(9, 70)).toMatch(/Queda 1/);
  });

  it('temporada completa', () => {
    expect(seasonGoalPhrase(70, 70)).toMatch(/Wena cachero/);
  });
});
