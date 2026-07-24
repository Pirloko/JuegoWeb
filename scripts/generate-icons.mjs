// Genera iconos PWA desde public/icons/logo.png (órbita).
// logo-brand.png / logo-mark.png se actualizan al instalar el pack de marca.
// Uso: node scripts/generate-icons.mjs
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const LOGO = join(OUT_DIR, 'logo.png');

if (!existsSync(LOGO)) {
  console.error('Falta public/icons/logo.png (órbita oficial)');
  process.exit(1);
}

function sharpCli(...args) {
  execFileSync('npx', ['--yes', 'sharp-cli', ...args], {
    stdio: 'inherit',
    cwd: join(OUT_DIR, '../..'),
  });
}

const icon512 = join(OUT_DIR, 'icon-512.png');
const icon192 = join(OUT_DIR, 'icon-192.png');

sharpCli('-i', LOGO, '-o', icon512, 'resize', '512', '512', '--fit', 'contain', '--background', '#080b16');
sharpCli('-i', LOGO, '-o', icon192, 'resize', '192', '192', '--fit', 'contain', '--background', '#080b16');
copyFileSync(icon512, join(OUT_DIR, 'icon-512-maskable.png'));

console.log('✓ icon-192, icon-512, icon-512-maskable (desde logo.png)');
