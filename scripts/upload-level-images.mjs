/**
 * Sube public/levels/level-N.png al bucket level-images
 * como level-N/full.png y level-N/thumb.png.
 *
 * Uso:
 *   npm run upload:images
 *
 * Requiere en .env (NO uses VITE_ para la service role):
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (Dashboard → Settings → API → service_role)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    const val = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env\n' +
      'La service_role está en Dashboard → Settings → API (nunca la expongas al cliente).',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey);
const levelsDir = join(root, 'public', 'levels');
const files = readdirSync(levelsDir).filter((f) => /^level-\d+\.png$/i.test(f));

if (files.length === 0) {
  console.error('No hay public/levels/level-N.png para subir.');
  process.exit(1);
}

const bucket = 'level-images';

for (const file of files.sort()) {
  const match = file.match(/^level-(\d+)\.png$/i);
  if (!match) continue;
  const n = match[1];
  const body = readFileSync(join(levelsDir, file));

  for (const path of [`level-${n}/full.png`, `level-${n}/thumb.png`]) {
    const { error } = await supabase.storage.from(bucket).upload(path, body, {
      contentType: 'image/png',
      upsert: true,
    });
    if (error) {
      console.error(`Error subiendo ${path}:`, error.message);
      process.exit(1);
    }
    console.log(`OK  ${path} (${body.length} bytes)`);
  }
}

console.log('\nListo. Las imágenes están en Storage (bucket level-images).');
