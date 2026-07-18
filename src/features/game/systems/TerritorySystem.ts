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
    const reachable = new Uint8Array(this.cols * this.rows);
    const stack: number[] = [];
    for (const cell of enemyCells) {
      if (this.stateAt(cell.col, cell.row) !== CellState.Free) continue;
      const i = this.idx(cell.col, cell.row);
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
