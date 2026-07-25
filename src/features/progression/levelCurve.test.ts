import { describe, expect, it } from 'vitest';
import {
  configForSeasonSlot,
  curveBandForSlot,
  enemiesForSlot,
  MAX_ENEMIES_PER_LEVEL,
  powerUpsForSlot,
  SEASON_CURVE_SLOTS,
} from './levelCurve';

describe('configForSeasonSlot', () => {
  it('el primer nivel es suave', () => {
    const c = configForSeasonSlot(1);
    expect(c.targetPct).toBe(50);
    expect(c.enemies).toHaveLength(1);
    expect(c.enemies[0]?.type).toBe('basic');
    expect(c.timeLimitSec).toBe(150);
  });

  it('el último slot de referencia es el tope de exigencia', () => {
    const c = configForSeasonSlot(SEASON_CURVE_SLOTS);
    expect(c.targetPct).toBe(75);
    expect(c.timeLimitSec).toBe(90);
    expect(c.enemies).toHaveLength(MAX_ENEMIES_PER_LEVEL);
  });

  it('la meta sube y el tiempo baja de forma monótona', () => {
    let prevTarget = 0;
    let prevTime = Number.POSITIVE_INFINITY;
    for (let slot = 1; slot <= SEASON_CURVE_SLOTS; slot += 1) {
      const c = configForSeasonSlot(slot);
      expect(c.targetPct).toBeGreaterThanOrEqual(prevTarget);
      expect(c.timeLimitSec ?? 0).toBeLessThanOrEqual(prevTime);
      prevTarget = c.targetPct;
      prevTime = c.timeLimitSec ?? 0;
    }
  });

  it('pasado el slot de referencia se mantiene el tramo final (sin tope duro)', () => {
    expect(configForSeasonSlot(45)).toEqual(configForSeasonSlot(SEASON_CURVE_SLOTS));
  });

  it('slots inválidos caen al primero', () => {
    expect(configForSeasonSlot(0)).toEqual(configForSeasonSlot(1));
    expect(configForSeasonSlot(-3)).toEqual(configForSeasonSlot(1));
  });

  it('es determinista: mismo slot, misma config en cualquier temporada', () => {
    expect(configForSeasonSlot(7)).toEqual(configForSeasonSlot(7));
  });
});

describe('enemiesForSlot', () => {
  it('nunca supera el tope de enemigos', () => {
    for (let slot = 1; slot <= 50; slot += 1) {
      expect(enemiesForSlot(slot).length).toBeLessThanOrEqual(MAX_ENEMIES_PER_LEVEL);
    }
  });

  it('los primeros niveles no tienen perseguidores', () => {
    for (let slot = 1; slot < 10; slot += 1) {
      expect(enemiesForSlot(slot).some((e) => e.type === 'chase')).toBe(false);
    }
  });

  it('a partir del slot 10 aparece un perseguidor', () => {
    expect(enemiesForSlot(10).filter((e) => e.type === 'chase')).toHaveLength(1);
  });

  it('en el tramo final hay dos perseguidores', () => {
    expect(enemiesForSlot(25).filter((e) => e.type === 'chase')).toHaveLength(2);
  });

  it('los perseguidores nunca superan al total de enemigos', () => {
    for (let slot = 1; slot <= 40; slot += 1) {
      const enemies = enemiesForSlot(slot);
      const chasers = enemies.filter((e) => e.type === 'chase').length;
      expect(chasers).toBeLessThanOrEqual(enemies.length);
    }
  });

  it('el perseguidor va más lento que el de rebote del mismo nivel', () => {
    const enemies = enemiesForSlot(20);
    const basic = enemies.find((e) => e.type === 'basic');
    const chaser = enemies.find((e) => e.type === 'chase');
    expect(chaser!.speed).toBeLessThan(basic!.speed);
  });
});

describe('powerUpsForSlot', () => {
  it('el primer nivel solo trae bomba', () => {
    const types = powerUpsForSlot(1).map((p) => p.type);
    expect(types).toEqual(['bomb']);
  });

  it('los power-ups se acumulan al avanzar', () => {
    const early = powerUpsForSlot(6).map((p) => p.type);
    const late = powerUpsForSlot(26).map((p) => p.type);
    expect(early).toContain('clock');
    for (const type of early) {
      expect(late).toContain(type);
    }
    expect(late.length).toBeGreaterThan(early.length);
  });

  it('no se repite un tipo en el mismo nivel', () => {
    for (let slot = 1; slot <= SEASON_CURVE_SLOTS; slot += 1) {
      const types = powerUpsForSlot(slot).map((p) => p.type);
      expect(new Set(types).size).toBe(types.length);
    }
  });
});

describe('curveBandForSlot', () => {
  it('agrupa los slots en tramos legibles', () => {
    expect(curveBandForSlot(1)).toBe('intro');
    expect(curveBandForSlot(8)).toBe('ritmo');
    expect(curveBandForSlot(15)).toBe('exige');
    expect(curveBandForSlot(30)).toBe('cierre');
  });
});
