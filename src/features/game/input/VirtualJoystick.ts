import Phaser from 'phaser';

const RADIUS = 90;
const THUMB_RADIUS = 36;
const DEADZONE = 0.22;

/**
 * Joystick virtual flotante: aparece donde el pulgar toca la pantalla y
 * desaparece al soltar. Reserva su pointer id (multi-touch seguro).
 */
export class VirtualJoystick {
  readonly vector = { x: 0, y: 0 };
  private pointerId: number | null = null;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly thumb: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene) {
    this.base = scene.add
      .circle(0, 0, RADIUS, 0xffffff, 0.06)
      .setStrokeStyle(2, 0xffffff, 0.2)
      .setDepth(100)
      .setVisible(false);
    this.thumb = scene.add.circle(0, 0, THUMB_RADIUS, 0xffffff, 0.16).setDepth(101).setVisible(false);

    scene.input.addPointer(2);
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return;
    this.pointerId = pointer.id;
    this.base.setPosition(pointer.x, pointer.y).setVisible(true);
    this.thumb.setPosition(pointer.x, pointer.y).setVisible(true);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    const dx = pointer.x - this.base.x;
    const dy = pointer.y - this.base.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, RADIUS);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;
    this.thumb.setPosition(this.base.x + nx * clamped, this.base.y + ny * clamped);
    const magnitude = clamped / RADIUS;
    if (magnitude < DEADZONE) {
      this.vector.x = 0;
      this.vector.y = 0;
    } else {
      this.vector.x = nx * magnitude;
      this.vector.y = ny * magnitude;
    }
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = null;
    this.vector.x = 0;
    this.vector.y = 0;
    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }
}
