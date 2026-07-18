/**
 * Sistema de territorio puro (sin Phaser): única fuente de verdad del grid.
 * Conquista por cierre de trail + flood-fill desde los enemigos: toda región
 * libre que ningún enemigo alcanza queda conquistada (regla Gals Panic).
 * Ver docs/GAMEPLAY.md.
 */
export const CellState = {
  Free: 0,
  Conquered: 1,
  Trail: 2,
} as const;
export type CellState = (typeof CellState)[keyof typeof CellState];

export interface Cell {
  col: number;
  row: number;
}

export class TerritorySystem {
  private readonly grid: Uint8Array;
  private trail: Cell[] = [];
  private readonly interiorTotal: number;
  private conqueredInterior = 0;

  constructor(
    readonly cols: number,
    readonly rows: number,
    borderCells: number,
  ) {
    this.grid = new Uint8Array(cols * rows); // todo Free
    let borderCount = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const isBorder =
          col < borderCells || col >= cols - borderCells || row < borderCells || row >= rows - borderCells;
        if (isBorder) {
          this.grid[this.idx(col, row)] = CellState.Conquered;
          borderCount++;
        }
      }
    }
    this.interiorTotal = cols * rows - borderCount;
  }

  private idx(col: number, row: number): number {
    return row * this.cols + col;
  }

  private inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  /** Fuera de límites cuenta como conquistado (muro). */
  stateAt(col: number, row: number): CellState {
    if (!this.inBounds(col, row)) return CellState.Conquered;
    return (this.grid[this.idx(col, row)] ?? CellState.Conquered) as CellState;
  }

  get conqueredPct(): number {
    return (100 * this.conqueredInterior) / this.interiorTotal;
  }

  get hasTrail(): boolean {
    return this.trail.length > 0;
  }

  /** Marca una celda libre como trail. Devuelve false si no era libre. */
  markTrail(cell: Cell): boolean {
    if (this.stateAt(cell.col, cell.row) !== CellState.Free) return false;
    this.grid[this.idx(cell.col, cell.row)] = CellState.Trail;
    this.trail.push(cell);
    return true;
  }

  /** Borra el trail (muerte). Devuelve las celdas que vuelven a Free. */
  clearTrail(): Cell[] {
    const cleared = this.trail;
    for (const cell of cleared) {
      this.grid[this.idx(cell.col, cell.row)] = CellState.Free;
    }
    this.trail = [];
    return cleared;
  }

  /**
   * Conquista directa de celdas libres (power-ups como la bomba).
   * Las celdas de trail y las ya conquistadas se ignoran: si la explosión
   * toca el trail activo, el trail sobrevive intacto.
   * Mismo pipeline de porcentaje que closeTrail.
   */
  conquerCells(cells: Cell[]): { conquered: Cell[]; pct: number } {
    const conquered: Cell[] = [];
    for (const cell of cells) {
      if (this.stateAt(cell.col, cell.row) !== CellState.Free) continue;
      this.grid[this.idx(cell.col, cell.row)] = CellState.Conquered;
      this.conqueredInterior++;
      conquered.push(cell);
    }
    return { conquered, pct: this.conqueredPct };
  }

  /** Celdas dentro del grid a distancia euclídea ≤ radius del centro. */
  cellsInRadius(center: Cell, radius: number): Cell[] {
    const cells: Cell[] = [];
    const r2 = radius * radius;
    for (let row = center.row - radius; row <= center.row + radius; row++) {
      for (let col = center.col - radius; col <= center.col + radius; col++) {
        if (!this.inBounds(col, row)) continue;
        const dc = col - center.col;
        const dr = row - center.row;
        if (dc * dc + dr * dr <= r2) cells.push({ col, row });
      }
    }
    return cells;
  }

  /**
   * Celda libre más cercana a la dada (BFS 4-conectado), o null si no hay
   * ninguna dentro del radio. Se usa para anclar el flood-fill cuando el
   * centro de un enemigo cae en una celda no-libre en el instante del cierre.
   */
  nearestFreeCell(cell: Cell, maxRadius = 6): Cell | null {
    const start: Cell = {
      col: Math.min(Math.max(cell.col, 0), this.cols - 1),
      row: Math.min(Math.max(cell.row, 0), this.rows - 1),
    };
    if (this.stateAt(start.col, start.row) === CellState.Free) return start;

    const visited = new Set<number>([this.idx(start.col, start.row)]);
    let frontier: Cell[] = [start];
    for (let radius = 0; radius < maxRadius; radius++) {
      const next: Cell[] = [];
      for (const current of frontier) {
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nc = current.col + dc;
          const nr = current.row + dr;
          if (!this.inBounds(nc, nr) || visited.has(this.idx(nc, nr))) continue;
          if (this.stateAt(nc, nr) === CellState.Free) return { col: nc, row: nr };
          visited.add(this.idx(nc, nr));
          next.push({ col: nc, row: nr });
        }
      }
      frontier = next;
    }
    return null;
  }

  /**
   * Cierra el trail: trail → conquistado, y toda región libre que ningún
   * enemigo alcanza (flood-fill 4-conectado) también se conquista.
   * Devuelve las celdas recién conquistadas para repintar.
   */
  closeTrail(enemyCells: Cell[]): { conquered: Cell[]; pct: number } {
    const conquered: Cell[] = [];

    for (const cell of this.trail) {
      this.grid[this.idx(cell.col, cell.row)] = CellState.Conquered;
      this.conqueredInterior++;
      conquered.push(cell);
    }
    this.trail = [];

    // Flood-fill de lo alcanzable por enemigos sobre celdas libres.
    // Si el centro del enemigo no está en celda libre, ancla a la más cercana.
    const reachable = new Uint8Array(this.cols * this.rows);
    const stack: number[] = [];
    for (const enemyCell of enemyCells) {
      const seed = this.nearestFreeCell(enemyCell);
      if (!seed) continue;
      const i = this.idx(seed.col, seed.row);
      if (!reachable[i]) {
        reachable[i] = 1;
        stack.push(i);
      }
    }
    while (stack.length > 0) {
      const i = stack.pop() as number;
      const col = i % this.cols;
      const row = (i / this.cols) | 0;
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nc = col + dc;
        const nr = row + dr;
        if (!this.inBounds(nc, nr)) continue;
        const j = this.idx(nc, nr);
        if (this.grid[j] === CellState.Free && !reachable[j]) {
          reachable[j] = 1;
          stack.push(j);
        }
      }
    }

    // Lo libre e inalcanzable para los enemigos queda conquistado.
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === CellState.Free && !reachable[i]) {
        this.grid[i] = CellState.Conquered;
        this.conqueredInterior++;
        conquered.push({ col: i % this.cols, row: (i / this.cols) | 0 });
      }
    }

    return { conquered, pct: this.conqueredPct };
  }
}
