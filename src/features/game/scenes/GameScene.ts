import Phaser from 'phaser';
import type { LevelConfig, LevelResultStats } from '@/types/level';
import { BORDER_CELLS, CELL, COLORS, COLS, GAME_HEIGHT, GAME_WIDTH, ROWS } from '../core/constants';
import { gameEvents } from '../core/GameEvents';
import { CellState, TerritorySystem, type Cell } from '../systems/TerritorySystem';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { VirtualJoystick } from '../input/VirtualJoystick';

const INVULNERABLE_MS = 1500;

type Dir = { x: number; y: number };

/**
 * Coordinador del gameplay: conecta input → jugador → territorio → render.
 * La lógica de conquista vive en TerritorySystem (puro y testeable).
 */
export class GameScene extends Phaser.Scene {
  private territory!: TerritorySystem;
  private territoryRT!: Phaser.GameObjects.RenderTexture;
  private player!: Player;
  private enemies: Enemy[] = [];
  private joystick!: VirtualJoystick;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

  private lastCell!: Cell;
  private lastMoveDir: Dir = { x: 0, y: 0 };
  private lives = 0;
  private startTime = 0;
  private invulnerableUntil = 0;
  private finished = false;
  private readonly spawnPoint = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - CELL * 1.5 };

  constructor(private readonly level: LevelConfig) {
    super('game');
  }

  create(): void {
    this.territory = new TerritorySystem(COLS, ROWS, BORDER_CELLS);
    this.territoryRT = this.add.renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0);
    this.paintInitial();

    this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.level.playerSpeed);
    this.lastCell = this.cellOf(this.player.x, this.player.y);

    const stateAtPixel = (x: number, y: number) => this.stateAtPixel(x, y);
    for (const enemyConfig of this.level.enemies) {
      this.enemies.push(new Enemy(this, GAME_WIDTH / 2, GAME_HEIGHT * 0.35, enemyConfig.speed, stateAtPixel));
    }

    this.joystick = new VirtualJoystick(this);
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys('W,A,S,D') as typeof this.wasd;

    this.lives = this.level.lives;
    this.startTime = this.time.now;
  }

  override update(time: number, delta: number): void {
    if (this.finished) return;

    const dir = this.readDirection();
    this.player.move(dir, delta);
    if (dir.x !== 0 || dir.y !== 0) this.lastMoveDir = dir;

    const cell = this.cellOf(this.player.x, this.player.y);
    if (cell.col !== this.lastCell.col || cell.row !== this.lastCell.row) {
      this.onCellEnter(cell, time);
      if (this.finished) return;
    }

    for (const enemy of this.enemies) enemy.update(delta);
    this.checkEnemyCollisions(time);
  }

  // ── Input ────────────────────────────────────────────────────────────

  private readDirection(): Dir {
    let x = this.joystick.vector.x;
    let y = this.joystick.vector.y;
    if (x === 0 && y === 0) {
      if (this.cursors?.left.isDown || this.wasd?.A.isDown) x = -1;
      else if (this.cursors?.right.isDown || this.wasd?.D.isDown) x = 1;
      if (this.cursors?.up.isDown || this.wasd?.W.isDown) y = -1;
      else if (this.cursors?.down.isDown || this.wasd?.S.isDown) y = 1;
    }
    if (x === 0 && y === 0) return { x: 0, y: 0 };

    // Eje dominante: el trazado sobre el grid debe ser ortogonal.
    const dir: Dir =
      Math.abs(x) >= Math.abs(y) ? { x: Math.sign(x), y: 0 } : { x: 0, y: Math.sign(y) };

    // Con trail activo no se permite invertir la marcha (suicidio accidental).
    if (this.territory.hasTrail && dir.x === -this.lastMoveDir.x && dir.y === -this.lastMoveDir.y) {
      return { x: 0, y: 0 };
    }
    return dir;
  }

  // ── Territorio ───────────────────────────────────────────────────────

  private onCellEnter(cell: Cell, time: number): void {
    const state = this.territory.stateAt(cell.col, cell.row);

    if (state === CellState.Trail) {
      this.loseLife(time);
      return;
    }

    if (state === CellState.Free) {
      this.territory.markTrail(cell);
      this.paintCell(cell.col, cell.row, COLORS.trail);
    } else if (this.territory.hasTrail) {
      // Vuelta a zona segura con trail activo: cierre de región.
      const enemyCells = this.enemies.map((enemy) => this.cellOf(enemy.x, enemy.y));
      const { conquered, pct } = this.territory.closeTrail(enemyCells);
      for (const conqueredCell of conquered) {
        this.paintCell(conqueredCell.col, conqueredCell.row, COLORS.conquered);
      }
      gameEvents.emit('game:progress', { conqueredPct: pct });
      if (pct >= this.level.targetPct) {
        this.finish(true);
        return;
      }
    }

    this.lastCell = cell;
  }

  // ── Colisiones y vidas ───────────────────────────────────────────────

  private checkEnemyCollisions(time: number): void {
    const playerState = this.territory.stateAt(this.lastCell.col, this.lastCell.row);
    const playerExposed = playerState !== CellState.Conquered && time >= this.invulnerableUntil;

    for (const enemy of this.enemies) {
      if (this.territory.hasTrail) {
        const r = enemy.radius;
        const samples: ReadonlyArray<readonly [number, number]> = [
          [0, 0],
          [r, 0],
          [-r, 0],
          [0, r],
          [0, -r],
        ];
        for (const [ox, oy] of samples) {
          if (this.stateAtPixel(enemy.x + ox, enemy.y + oy) === CellState.Trail) {
            this.loseLife(time);
            return;
          }
        }
      }

      if (playerExposed) {
        const dx = enemy.x - this.player.x;
        const dy = enemy.y - this.player.y;
        const minDist = enemy.radius + this.player.width / 2;
        if (dx * dx + dy * dy < minDist * minDist) {
          this.loseLife(time);
          return;
        }
      }
    }
  }

  private loseLife(time: number): void {
    if (time < this.invulnerableUntil) return;

    this.lives -= 1;
    this.cameras.main.shake(150, 0.008);
    for (const cell of this.territory.clearTrail()) {
      this.paintCell(cell.col, cell.row, COLORS.free);
    }
    gameEvents.emit('game:life-lost', { livesLeft: this.lives });

    if (this.lives <= 0) {
      this.finish(false);
      return;
    }

    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    this.lastCell = this.cellOf(this.spawnPoint.x, this.spawnPoint.y);
    this.lastMoveDir = { x: 0, y: 0 };
    this.invulnerableUntil = time + INVULNERABLE_MS;
    this.tweens.add({
      targets: this.player,
      alpha: 0.25,
      duration: 125,
      yoyo: true,
      repeat: 5,
      onComplete: () => this.player.setAlpha(1),
    });
  }

  private finish(won: boolean): void {
    this.finished = true;
    const stats: LevelResultStats = {
      conqueredPct: this.territory.conqueredPct,
      targetPct: this.level.targetPct,
      timeMs: Math.round(this.time.now - this.startTime),
      livesLeft: this.lives,
    };
    gameEvents.emit(won ? 'game:completed' : 'game:failed', stats);
  }

  // ── Render del grid ──────────────────────────────────────────────────

  private paintInitial(): void {
    this.territoryRT.fill(COLORS.conquered, 1, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.territoryRT.fill(
      COLORS.free,
      1,
      BORDER_CELLS * CELL,
      BORDER_CELLS * CELL,
      GAME_WIDTH - 2 * BORDER_CELLS * CELL,
      GAME_HEIGHT - 2 * BORDER_CELLS * CELL,
    );
  }

  private paintCell(col: number, row: number, color: number): void {
    this.territoryRT.fill(color, 1, col * CELL, row * CELL, CELL, CELL);
  }

  // ── Utilidades ───────────────────────────────────────────────────────

  private cellOf(x: number, y: number): Cell {
    return {
      col: Phaser.Math.Clamp(Math.floor(x / CELL), 0, COLS - 1),
      row: Phaser.Math.Clamp(Math.floor(y / CELL), 0, ROWS - 1),
    };
  }

  private stateAtPixel(x: number, y: number): CellState {
    return this.territory.stateAt(Math.floor(x / CELL), Math.floor(y / CELL));
  }
}
