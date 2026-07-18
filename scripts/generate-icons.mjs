// Genera los iconos PWA (public/icons/) sin dependencias externas.
// Motivo visual: esquina de territorio "conquistado" con trail, como el juego.
// Uso: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { png } from './png.mjs';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [15, 18, 32, 255]; // #0f1220
const ACCENT = [139, 92, 246, 255]; // #8b5cf6
const TRAIL = [110, 231, 183, 255]; // #6ee7b7

// Frontera escalonada entre zona conquistada (abajo-izquierda) y libre.
function drawIcon(u, v) {
  const step = Math.floor(v * 8) / 8; // escalones tipo grid
  const boundary = 1.1 - step - 0.25;
  if (Math.abs(u - boundary) < 0.035) return TRAIL;
  if (u < boundary) return ACCENT;
  return BG;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-512-maskable.png', 512],
]) {
  writeFileSync(join(OUT_DIR, name), png(size, size, drawIcon));
  console.log(`✓ ${name}`);
}
