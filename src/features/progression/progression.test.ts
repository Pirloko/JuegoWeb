import { describe, expect, it } from 'vitest';
import {
  countableStarsTowardSeasonGate,
  defaultStarsRequiredToUnlockNext,
  freeStarCap,
  isLevelReleased,
  isSeasonStarGateMet,
  isSeasonStarGateValid,
  isSeasonTeaserWindow,
  milestonesForTotal,
  nextMilestone,
  seasonProgress,
  seasonRhythmHint,
  starsForLevel,
} from './progression';
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

describe('defaultStarsRequiredToUnlockNext', () => {
  it('tabla T1→T4', () => {
    expect(defaultStarsRequiredToUnlockNext(0)).toBe(20);
    expect(defaultStarsRequiredToUnlockNext(1)).toBe(28);
    expect(defaultStarsRequiredToUnlockNext(2)).toBe(36);
    expect(defaultStarsRequiredToUnlockNext(3)).toBe(44);
  });

  it('escalón +8 con cap 60', () => {
    expect(defaultStarsRequiredToUnlockNext(4)).toBe(52);
    expect(defaultStarsRequiredToUnlockNext(5)).toBe(60);
    expect(defaultStarsRequiredToUnlockNext(10)).toBe(60);
  });
});

describe('freeStarCap + isSeasonStarGateValid', () => {
  const tenLevelsThreeSpecial = [
    ...Array.from({ length: 7 }, () => ({ mediaType: 'image' as const })),
    { mediaType: 'gif' as const },
    { mediaType: 'video' as const },
    { mediaType: 'image' as const },
  ];

  it('cap free = 3 × niveles imagen', () => {
    expect(freeStarCap(tenLevelsThreeSpecial)).toBe(24); // 8 imagen × 3
  });

  it('gate 20★ es válido con 8 niveles imagen', () => {
    expect(isSeasonStarGateValid(tenLevelsThreeSpecial, 20)).toBe(true);
  });

  it('gate > cap free es inválido (anti soft-lock)', () => {
    expect(isSeasonStarGateValid(tenLevelsThreeSpecial, 25)).toBe(false);
  });

  it('solo especiales: solo required 0 es válido', () => {
    const onlySpecial = [{ mediaType: 'gif' as const }, { mediaType: 'video' as const }];
    expect(freeStarCap(onlySpecial)).toBe(0);
    expect(isSeasonStarGateValid(onlySpecial, 0)).toBe(true);
    expect(isSeasonStarGateValid(onlySpecial, 1)).toBe(false);
  });
});

describe('countableStarsTowardSeasonGate', () => {
  const target = 60;

  it('free alcanza 20★ solo con imagen; especiales sin completar no cuentan', () => {
    const levels = [
      ...Array.from({ length: 7 }, () => ({
        mediaType: 'image' as const,
        bestPct: 95,
        targetPct: target,
      })),
      { mediaType: 'gif' as const, bestPct: null, targetPct: target },
      { mediaType: 'video' as const, bestPct: null, targetPct: target },
      { mediaType: 'image' as const, bestPct: 95, targetPct: target },
    ];
    // 8 imagen × 3★ = 24
    expect(countableStarsTowardSeasonGate(levels)).toBe(24);
    expect(isSeasonStarGateMet(levels, 20)).toBe(true);
  });

  it('especial no jugado aporta 0 aunque el gate sea alto', () => {
    const levels = [
      { mediaType: 'image' as const, bestPct: 60, targetPct: target },
      { mediaType: 'gif' as const, bestPct: null, targetPct: target },
    ];
    expect(countableStarsTowardSeasonGate(levels)).toBe(1);
    expect(isSeasonStarGateMet(levels, 20)).toBe(false);
  });

  it('especial completado sí suma ★ (bonus premium)', () => {
    const levels = [
      { mediaType: 'image' as const, bestPct: 60, targetPct: target },
      { mediaType: 'gif' as const, bestPct: 95, targetPct: target },
    ];
    expect(countableStarsTowardSeasonGate(levels)).toBe(1 + 3);
  });
});

describe('isLevelReleased', () => {
  const now = Date.parse('2026-07-19T12:00:00.000Z');

  it('null = liberado', () => {
    expect(isLevelReleased(null, now)).toBe(true);
    expect(isLevelReleased(undefined, now)).toBe(true);
  });

  it('futuro = no liberado', () => {
    expect(isLevelReleased('2026-07-20T00:00:00.000Z', now)).toBe(false);
  });

  it('pasado = liberado', () => {
    expect(isLevelReleased('2026-07-18T00:00:00.000Z', now)).toBe(true);
  });
});

describe('isSeasonTeaserWindow', () => {
  const ends = '2026-07-31T00:00:00.000Z';

  it('fuera de ventana', () => {
    expect(isSeasonTeaserWindow(ends, Date.parse('2026-07-10T00:00:00.000Z'))).toBe(false);
  });

  it('últimos 7 días', () => {
    expect(isSeasonTeaserWindow(ends, Date.parse('2026-07-25T00:00:00.000Z'))).toBe(true);
  });

  it('después de ends_at no', () => {
    expect(isSeasonTeaserWindow(ends, Date.parse('2026-08-01T00:00:00.000Z'))).toBe(false);
  });
});

describe('seasonRhythmHint', () => {
  const now = Date.parse('2026-07-19T12:00:00.000Z');

  it('null si hay unlocked liberado', () => {
    expect(
      seasonRhythmHint(
        [{ status: 'unlocked', availableAt: null, bestPct: null, targetPct: 60 }],
        now,
      ),
    ).toBeNull();
  });

  it('drip si hay available_at futuro y nada open', () => {
    const hint = seasonRhythmHint(
      [
        { status: 'completed', availableAt: null, bestPct: 70, targetPct: 60 },
        {
          status: 'unlocked',
          availableAt: '2026-07-22T00:00:00.000Z',
          bestPct: null,
          targetPct: 60,
        },
      ],
      now,
    );
    expect(hint?.kind).toBe('drip');
    expect(hint?.nextAt).toBe('2026-07-22T00:00:00.000Z');
  });

  it('stars si todo hecho pero sin 3★', () => {
    const hint = seasonRhythmHint(
      [{ status: 'completed', availableAt: null, bestPct: 70, targetPct: 60 }],
      now,
    );
    expect(hint?.kind).toBe('stars');
    expect(hint?.imperfect).toBe(1);
  });
});
