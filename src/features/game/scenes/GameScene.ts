import Phaser from 'phaser';
import type { LevelConfig, LevelResultStats } from '@/types/level';
import { BORDER_CELLS, CELL, COLORS, COLS, GAME_HEIGHT, GAME_WIDTH, ROWS } from '../core/constants';
import { gameEvents } from '../core/GameEvents';
import { CellState, TerritorySystem, type Cell } from '../systems/TerritorySystem';
import { RevealSystem } from '../systems/RevealSystem';
import { PowerUpSystem } from '../systems/PowerUpSystem';
import { applyPowerUp } from '../powerups/registry';
import type { PowerUpContext } from '../powerups/PowerUpEffect';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { VirtualJoystick } from '../input/VirtualJoystick';

const INVULNERABLE_MS = 1500;
const LEVEL_IMAGE_KEY = 'level-image';
const WIN_REVEAL_MS = 900;

type Dir = { x: number; y: number };

/**
 * Coordinador del gameplay: conecta input → jugador → territorio → render.
 * La lógica de conquista vive en TerritorySystem (puro y testeable).
 */
export class GameScene extends Phaser.Scene {
  private territory!: TerritorySystem;
  private reveal!: RevealSystem;
  private player!: Player;
  private enemies: Enemy[] = [];
  private powerUps!: PowerUpSystem;
  private joystick!: VirtualJoystick;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

  private lastCell!: Cell;
  private lastMoveDir: Dir = { x: 0, y: 0 };
  private lives = 0;
  private startTime = 0;
  private invulnerableUntil = 0;
  /** Escudo de power-up: protege el cuerpo, no el trail. */
  private shieldUntil = 0;
  private speedBoostUntil = 0;
  private shieldFx?: Phaser.GameObjects.Arc;
  private finished = false;
  private readonly spawnPoint = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - CELL * 1.5 };

  constructor(private readonly level: LevelConfig) {
    super('game');
  }

  preload(): void {
    this.load.setCORS('anonymous');
    // Si la imagen falla (404/CORS), el loader debe seguir y create() usa degradado.
    this.load.on('loaderror', () => {
      /* no-op: create() genera textura de respaldo */
    });
    const url = this.level.imageUrl?.trim();
    // URL vacía rompe el loader de Phaser (la escena nunca arranca).
    if (url) {
      this.load.image(LEVEL_IMAGE_KEY, url);
    }
  }

  create(): void {
    // Fallback si no hay URL o la imagen no cargó: degradado generado.
    if (!this.textures.exists(LEVEL_IMAGE_KEY)) {
      const g = this.make.graphics({}, false);
      g.fillGradientStyle(0x1e1b4b, 0x7c3aed, 0x7c3aed, 0xf472b6, 1);
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      g.generateTexture(LEVEL_IMAGE_KEY, GAME_WIDTH, GAME_HEIGHT);
      g.destroy();
    }

    this.territory = new TerritorySystem(COLS, ROWS, BORDER_CELLS);
    this.reveal = new RevealSystem(this, LEVEL_IMAGE_KEY);
    this.reveal.paintAll(this.territory);

    this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.level.playerSpeed);
    this.lastCell = this.cellOf(this.player.x, this.player.y);

    const stateAtPixel = (x: number, y: number) => this.stateAtPixel(x, y);
    const enemyCount = this.level.enemies.length;
    this.level.enemies.forEach((enemyConfig, i) => {
      const fx = enemyCount === 1 ? 0.5 : 0.25 + (0.5 * i) / (enemyCount - 1);
      const fy = 0.3 + (i % 2) * 0.15;
      this.enemies.push(new Enemy(this, GAME_WIDTH * fx, GAME_HEIGHT * fy, enemyConfig.speed, stateAtPixel));
    });

    this.powerUps = new PowerUpSystem(this, this.level.powerUps, {
      territory: this.territory,
      getPlayerCell: () => this.cellOf(this.player.x, this.player.y),
      onPowerUp: (config, cell) => applyPowerUp(this.buildPowerUpContext(cell), config),
    });

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

    this.tickBuffs(time);

    const cell = this.cellOf(this.player.x, this.player.y);
    if (cell.col !== this.lastCell.col || cell.row !== this.lastCell.row) {
      this.onCellEnter(cell, time);
      if (this.finished) return;
    }

    for (const enemy of this.enemies) enemy.update(delta);
    this.checkEnemyCollisions(time);
    if (this.finished) return;
    this.powerUps.update(this.player.x, this.player.y);
  }

  // ── Power-ups ────────────────────────────────────────────────────────

  /** Capacidades que un efecto de power-up puede usar (ver powerups/). */
  private buildPowerUpContext(cell: Cell): PowerUpContext {
    return {
      scene: this,
      territory: this.territory,
      cell,
      getEnemies: () => this.enemies,
      killEnemy: (enemy) => this.killEnemy(enemy),
      conquer: (cells) => this.conquerAndReveal(cells),
      grantShield: (durationMs) => this.grantShield(durationMs),
      freezeEnemies: (durationMs) => this.freezeEnemies(durationMs),
      boostSpeed: (multiplier, durationMs) => this.boostSpeed(multiplier, durationMs),
      addLives: (amount) => this.addLives(amount),
    };
  }

  private grantShield(durationMs: number): void {
    this.shieldUntil = Math.max(this.shieldUntil, this.time.now + durationMs);
    this.ensureShieldFx();
  }

  private freezeEnemies(durationMs: number): void {
    const until = this.time.now + durationMs;
    for (const enemy of this.enemies) enemy.freezeUntil(until);
  }

  private boostSpeed(multiplier: number, durationMs: number): void {
    this.speedBoostUntil = Math.max(this.speedBoostUntil, this.time.now + durationMs);
    this.player.setSpeedMultiplier(multiplier);
    this.player.setFillStyle(0xfde68a);
  }

  private addLives(amount: number): void {
    this.lives += amount;
    gameEvents.emit('game:life-lost', { livesLeft: this.lives });
  }

  private tickBuffs(time: number): void {
    if (time >= this.speedBoostUntil) {
      this.player.setSpeedMultiplier(1);
      this.player.setFillStyle(COLORS.player);
    }
    if (time < this.shieldUntil) {
      this.ensureShieldFx();
      if (this.shieldFx) {
        this.shieldFx.setPosition(this.player.x, this.player.y);
      }
    } else if (this.shieldFx) {
      this.shieldFx.destroy();
      this.shieldFx = undefined;
    }
  }

  private ensureShieldFx(): void {
    if (this.shieldFx) return;
    this.shieldFx = this.add
      .circle(this.player.x, this.player.y, 22)
      .setStrokeStyle(3, 0x38bdf8, 0.9)
      .setFillStyle(0x38bdf8, 0.12)
      .setDepth(11);
  }

  /** Pipeline común de conquista directa (power-ups). */
  private conquerAndReveal(cells: Cell[]): void {
    const { conquered, pct } = this.territory.conquerCells(cells);
    for (const cell of conquered) {
      this.reveal.setCellState(cell.col, cell.row, CellState.Conquered);
    }
    this.relocateTrappedEnemies();
    gameEvents.emit('game:progress', { conqueredPct: pct });
    if (pct >= this.level.targetPct) this.finish(true);
  }

  private killEnemy(enemy: Enemy): void {
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) this.enemies.splice(index, 1);
    this.tweens.add({
      targets: enemy,
      scale: 0,
      alpha: 0,
      duration: 250,
      onComplete: () => enemy.destroy(),
    });
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
      // Chocar con el propio trail es letal siempre: la invulnerabilidad
      // protege de enemigos, no de suicidios.
      this.loseLife(time, true);
      return;
    }

    if (state === CellState.Free) {
      this.territory.markTrail(cell);
      this.reveal.setCellState(cell.col, cell.row, CellState.Trail);
    } else if (this.territory.hasTrail) {
      // Vuelta a zona segura con trail activo: cierre de región.
      const enemyCells = this.enemies.map((enemy) => this.cellOf(enemy.x, enemy.y));
      const { conquered, pct } = this.territory.closeTrail(enemyCells);
      for (const conqueredCell of conquered) {
        this.reveal.setCellState(conqueredCell.col, conqueredCell.row, CellState.Conquered);
      }
      this.relocateTrappedEnemies();
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
    const bodyProtected =
      playerState === CellState.Conquered ||
      time < this.invulnerableUntil ||
      time < this.shieldUntil;

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
            // Trail letal siempre: escudo / i-frames no lo protegen.
            this.loseLife(time, true);
            return;
          }
        }
      }

      if (!bodyProtected) {
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

  /**
   * Un enemigo puede quedar sobre territorio recién conquistado si el cierre
   * ocurre en el mismo frame en que tocaba el trail: lo devuelve al área libre.
   */
  private relocateTrappedEnemies(): void {
    for (const enemy of this.enemies) {
      const cell = this.cellOf(enemy.x, enemy.y);
      if (this.territory.stateAt(cell.col, cell.row) === CellState.Free) continue;
      const free = this.territory.nearestFreeCell(cell, 12);
      if (free) enemy.setPosition((free.col + 0.5) * CELL, (free.row + 0.5) * CELL);
    }
  }

  private loseLife(time: number, force = false): void {
    if (!force && time < this.invulnerableUntil) return;
    if (!force && time < this.shieldUntil) return;

    this.lives -= 1;
    this.shieldUntil = 0;
    if (this.shieldFx) {
      this.shieldFx.destroy();
      this.shieldFx = undefined;
    }
    this.cameras.main.shake(150, 0.008);
    for (const cell of this.territory.clearTrail()) {
      this.reveal.setCellState(cell.col, cell.row, CellState.Free);
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
    this.powerUps.stop();
    const stats: LevelResultStats = {
      conqueredPct: this.territory.conqueredPct,
      targetPct: this.level.targetPct,
      timeMs: Math.round(this.time.now - this.startTime),
      livesLeft: this.lives,
    };
    if (won) {
      // Revelado completo antes de mostrar el modal de resultado.
      this.reveal.celebrate();
      this.time.delayedCall(WIN_REVEAL_MS, () => gameEvents.emit('game:completed', stats));
    } else {
      gameEvents.emit('game:failed', stats);
    }
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
