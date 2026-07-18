// Genera iconos PWA y logo-brand desde public/icons/logo.png
// Uso: node scripts/generate-icons.mjs  (requiere red la 1ª vez por npx sharp-cli)
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const LOGO = join(OUT_DIR, 'logo.png');

if (!existsSync(LOGO)) {
  console.error('Falta public/icons/logo.png (logo oficial)');
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
const brand = join(OUT_DIR, 'logo-brand.png');

sharpCli('-i', LOGO, '-o', icon512, 'resize', '512', '512', '--fit', 'contain', '--background', '#080b16');
sharpCli('-i', LOGO, '-o', icon192, 'resize', '192', '192', '--fit', 'contain', '--background', '#080b16');
copyFileSync(icon512, join(OUT_DIR, 'icon-512-maskable.png'));
sharpCli('-i', LOGO, '-o', brand, 'resize', '720', '--withoutEnlargement');

console.log('✓ logo-brand.png, icon-192, icon-512, icon-512-maskable');
