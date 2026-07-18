// Genera los iconos PWA (public/icons/) sin dependencias externas.
// Motivo visual: esquina de territorio "conquistado" con trail, como el juego.
// Uso: node scripts/generate-icons.mjs
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [15, 18, 32, 255]; // #0f1220
const ACCENT = [139, 92, 246, 255]; // #8b5cf6
const TRAIL = [110, 231, 183, 255]; // #6ee7b7

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(size, draw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4);
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x / size, y / size);
      const o = row + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

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
  writeFileSync(join(OUT_DIR, name), png(size, drawIcon));
  console.log(`✓ ${name}`);
}
