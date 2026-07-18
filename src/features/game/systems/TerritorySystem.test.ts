import { describe, expect, it } from 'vitest';
import { CellState, TerritorySystem, type Cell } from './TerritorySystem';

/**
 * Checklist de casos límite de docs/GAMEPLAY.md (FASE 3).
 * Grid de referencia: 20×20 con borde de 2 → interior de 16×16 = 256 celdas.
 */

const COLS = 20;
const ROWS = 20;
const BORDER = 2;
const INTERIOR = (COLS - 2 * BORDER) * (ROWS - 2 * BORDER); // 256

function makeTerritory(): TerritorySystem {
  return new TerritorySystem(COLS, ROWS, BORDER);
}

/** Marca un trail vertical completo en `col`, de borde a borde. */
function fullColumnTrail(t: TerritorySystem, col: number): Cell[] {
  const cells: Cell[] = [];
  for (let row = BORDER; row < ROWS - BORDER; row++) {
    const cell = { col, row };
    expect(t.markTrail(cell)).toBe(true);
    cells.push(cell);
  }
  return cells;
}

describe('estado inicial', () => {
  it('borde conquistado, interior libre, 0%', () => {
    const t = makeTerritory();
    expect(t.stateAt(0, 0)).toBe(CellState.Conquered);
    expect(t.stateAt(1, 10)).toBe(CellState.Conquered);
    expect(t.stateAt(10, 10)).toBe(CellState.Free);
    expect(t.conqueredPct).toBe(0);
    expect(t.hasTrail).toBe(false);
  });

  it('fuera de límites cuenta como muro conquistado', () => {
    const t = makeTerritory();
    expect(t.stateAt(-1, 5)).toBe(CellState.Conquered);
    expect(t.stateAt(5, ROWS + 3)).toBe(CellState.Conquered);
  });
});

describe('trail', () => {
  it('no se puede marcar sobre trail ni sobre conquistado', () => {
    const t = makeTerritory();
    expect(t.markTrail({ col: 10, row: 10 })).toBe(true);
    expect(t.markTrail({ col: 10, row: 10 })).toBe(false); // sobre trail
    expect(t.markTrail({ col: 0, row: 0 })).toBe(false); // sobre borde
  });

  it('muerte: clearTrail devuelve las celdas y todo vuelve a Free sin tocar el %', () => {
    const t = makeTerritory();
    t.markTrail({ col: 10, row: 10 });
    t.markTrail({ col: 10, row: 11 });
    const cleared = t.clearTrail();
    expect(cleared).toHaveLength(2);
    expect(t.stateAt(10, 10)).toBe(CellState.Free);
    expect(t.stateAt(10, 11)).toBe(CellState.Free);
    expect(t.conqueredPct).toBe(0);
    expect(t.hasTrail).toBe(false);
  });
});

describe('cierre de regiones', () => {
  it('ruta mínima (1 celda): conquista solo esa celda y el estado queda sano', () => {
    const t = makeTerritory();
    t.markTrail({ col: 10, row: 2 });
    const { conquered, pct } = t.closeTrail([{ col: 10, row: 10 }]);
    expect(conquered).toHaveLength(1);
    expect(pct).toBeCloseTo(100 / INTERIOR, 10);
    expect(t.hasTrail).toBe(false);
    expect(t.stateAt(10, 2)).toBe(CellState.Conquered);
    expect(t.stateAt(10, 3)).toBe(CellState.Free);
  });

  it('un enemigo: la región sin enemigo se conquista, la suya sobrevive', () => {
    const t = makeTerritory();
    fullColumnTrail(t, 10); // parte el interior: izq cols 2-9, der cols 11-17
    const { conquered, pct } = t.closeTrail([{ col: 15, row: 10 }]);
    // izquierda 8×16 = 128 + trail 16 = 144
    expect(conquered).toHaveLength(144);
    expect(pct).toBeCloseTo((144 / INTERIOR) * 100, 10);
    expect(t.stateAt(5, 10)).toBe(CellState.Conquered);
    expect(t.stateAt(15, 10)).toBe(CellState.Free);
  });

  it('múltiples enemigos en regiones distintas: ninguna de sus regiones cae', () => {
    const t = makeTerritory();
    fullColumnTrail(t, 10);
    const { conquered } = t.closeTrail([
      { col: 5, row: 10 },
      { col: 15, row: 10 },
    ]);
    expect(conquered).toHaveLength(16); // solo el trail
    expect(t.stateAt(5, 10)).toBe(CellState.Free);
    expect(t.stateAt(15, 10)).toBe(CellState.Free);
  });

  it('ruta que deja al enemigo entre dos regiones vacías: ambas se conquistan', () => {
    const t = makeTerritory();
    fullColumnTrail(t, 6);
    t.closeTrail([{ col: 12, row: 10 }]); // conquista cols 2-6
    fullColumnTrail(t, 15);
    const { conquered } = t.closeTrail([{ col: 12, row: 10 }]);
    // trail col 15 (16) + región derecha cols 16-17 (2×16=32)
    expect(conquered).toHaveLength(48);
    expect(t.stateAt(16, 10)).toBe(CellState.Conquered); // pocket derecho cayó
    expect(t.stateAt(4, 10)).toBe(CellState.Conquered); // pocket izquierdo (cierre 1)
    expect(t.stateAt(12, 10)).toBe(CellState.Free); // el enemigo sobrevive en medio
  });

  it('cierre contra una península conquistada (no contra el borde)', () => {
    const t = makeTerritory();
    // Península: cols 2-6 conquistadas tras un primer cierre.
    fullColumnTrail(t, 6);
    t.closeTrail([{ col: 12, row: 10 }]);
    // Trail en L apoyado en la península y el borde superior:
    // (7,3)→(8,3)→(9,3)→(9,2) encierra el pocket (7,2)+(8,2).
    for (const cell of [
      { col: 7, row: 3 },
      { col: 8, row: 3 },
      { col: 9, row: 3 },
      { col: 9, row: 2 },
    ]) {
      expect(t.markTrail(cell)).toBe(true);
    }
    const { conquered } = t.closeTrail([{ col: 12, row: 10 }]);
    expect(conquered).toHaveLength(6); // 4 de trail + pocket de 2
    expect(t.stateAt(7, 2)).toBe(CellState.Conquered);
    expect(t.stateAt(8, 2)).toBe(CellState.Conquered);
    expect(t.stateAt(7, 4)).toBe(CellState.Free);
  });

  it('sin enemigos: se conquista todo el interior (100%)', () => {
    const t = makeTerritory();
    t.markTrail({ col: 10, row: 2 });
    const { pct } = t.closeTrail([]);
    expect(pct).toBe(100);
  });

  it('el porcentaje se acumula correctamente en cierres sucesivos', () => {
    const t = makeTerritory();
    fullColumnTrail(t, 6);
    const first = t.closeTrail([{ col: 12, row: 10 }]);
    fullColumnTrail(t, 10);
    const second = t.closeTrail([{ col: 12, row: 10 }]);
    expect(second.pct).toBeGreaterThan(first.pct);
    const conqueredTotal = first.conquered.length + second.conquered.length;
    expect(second.pct).toBeCloseTo((conqueredTotal / INTERIOR) * 100, 10);
  });
});

describe('conquista directa (bomba)', () => {
  it('bomba sobre trail activo: el trail sobrevive, solo cae lo libre', () => {
    const t = makeTerritory();
    t.markTrail({ col: 10, row: 10 });
    t.markTrail({ col: 10, row: 11 });
    const { conquered } = t.conquerCells(t.cellsInRadius({ col: 10, row: 10 }, 2));
    expect(t.stateAt(10, 10)).toBe(CellState.Trail);
    expect(t.stateAt(10, 11)).toBe(CellState.Trail);
    expect(t.stateAt(11, 10)).toBe(CellState.Conquered);
    expect(t.hasTrail).toBe(true);
    expect(conquered.some((c) => c.col === 10 && c.row === 10)).toBe(false);
  });

  it('el porcentaje usa el mismo pipeline que closeTrail', () => {
    const t = makeTerritory();
    const { conquered, pct } = t.conquerCells(t.cellsInRadius({ col: 10, row: 10 }, 3));
    expect(conquered.length).toBeGreaterThan(0);
    expect(pct).toBeCloseTo((conquered.length / INTERIOR) * 100, 10);
  });

  it('celdas ya conquistadas (borde) no se recuentan', () => {
    const t = makeTerritory();
    // Radio que pisa el borde conquistado: solo las libres cuentan.
    const cells = t.cellsInRadius({ col: 2, row: 2 }, 3);
    const freeBefore = cells.filter((c) => t.stateAt(c.col, c.row) === CellState.Free).length;
    const { conquered, pct } = t.conquerCells(cells);
    expect(conquered).toHaveLength(freeBefore);
    expect(pct).toBeCloseTo((freeBefore / INTERIOR) * 100, 10);
  });

  it('cellsInRadius: círculo euclídeo recortado al grid', () => {
    const t = makeTerritory();
    const corner = t.cellsInRadius({ col: 0, row: 0 }, 3);
    expect(corner.every((c) => c.col >= 0 && c.row >= 0)).toBe(true);

    const full = t.cellsInRadius({ col: 10, row: 10 }, 2);
    expect(full).toHaveLength(13); // dc²+dr² ≤ 4
    expect(full).toContainEqual({ col: 12, row: 10 });
    expect(full).not.toContainEqual({ col: 12, row: 12 }); // 8 > 4: esquina fuera
  });
});

describe('anclaje del enemigo al cierre (nearestFreeCell)', () => {
  it('enemigo con centro en celda conquistada: su región sobrevive igualmente', () => {
    const t = makeTerritory();
    fullColumnTrail(t, 10);
    // El enemigo reporta una celda del borde (conquistada), pegada a la
    // región derecha: el flood-fill debe anclarse a la libre más cercana.
    const { conquered } = t.closeTrail([{ col: 18, row: 10 }]);
    expect(conquered).toHaveLength(144); // izquierda + trail, como con enemigo libre
    expect(t.stateAt(15, 10)).toBe(CellState.Free);
  });

  it('enemigo fuera de límites: se ancla dentro del grid', () => {
    const t = makeTerritory();
    fullColumnTrail(t, 10);
    const { conquered } = t.closeTrail([{ col: COLS + 5, row: 10 }]);
    expect(conquered).toHaveLength(144);
    expect(t.stateAt(15, 10)).toBe(CellState.Free);
  });

  it('nearestFreeCell devuelve null si no hay celda libre en el radio', () => {
    const t = makeTerritory();
    t.markTrail({ col: 10, row: 10 });
    t.closeTrail([]); // conquista todo
    expect(t.nearestFreeCell({ col: 10, row: 10 })).toBeNull();
  });

  it('nearestFreeCell devuelve la propia celda si ya es libre', () => {
    const t = makeTerritory();
    expect(t.nearestFreeCell({ col: 10, row: 10 })).toEqual({ col: 10, row: 10 });
  });
});
