/**
 * Regenera TODAS las miniaturas (thumb) desde el full en Storage,
 * con blur fuerte — sin pasar por el admin nivel a nivel.
 *
 * Uso:
 *   npm run blur:thumbs           # procesa todo el bucket
 *   npm run blur:thumbs -- --dry  # solo lista qué haría
 *
 * Requiere en .env:
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const bucket = 'level-images';
const dryRun = process.argv.includes('--dry');

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

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env\n' +
      '(también acepta VITE_SUPABASE_SERVICE_ROLE_KEY). Dashboard → API → service_role.\n' +
      'Preferible SIN prefijo VITE_ para que Vite no la empaquete al cliente.',
  );
  process.exit(1);
}

if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    'Aviso: usas VITE_SUPABASE_SERVICE_ROLE_KEY. Renómbrala a SUPABASE_SERVICE_ROLE_KEY\n' +
      'para que no pueda filtrarse al bundle del navegador.\n',
  );
}

const supabase = createClient(url, serviceKey);

/** Lista recursiva de objetos en el bucket. */
async function listAll(prefix = '') {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`);

  const out = [];
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    // Carpetas: sin metadata id (o name sin extensión típica de archivo)
    const isFolder = item.id == null && !/\.(webp|png|jpe?g|gif|mp4|webm)$/i.test(item.name);
    if (isFolder) {
      out.push(...(await listAll(path)));
    } else if (item.name && item.id != null) {
      out.push(path);
    } else if (/\.(webp|png|jpe?g)$/i.test(item.name)) {
      out.push(path);
    }
  }
  return out;
}

function folderOf(path) {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(0, i) : '';
}

function fileName(path) {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

/**
 * Blur + oscurecer (equivalente a prepareLevelImage thumb en el admin).
 * Máx lado 480 px.
 */
async function blurThumbFromFull(buffer) {
  const img = sharp(buffer).rotate();
  const meta = await img.metadata();
  const w = meta.width ?? 480;
  const h = meta.height ?? 480;
  const longest = Math.max(w, h);
  const scale = longest > 480 ? 480 / longest : 1;
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  // Capa oscura semitransparente encima del blur
  const overlay = await sharp({
    create: {
      width: tw,
      height: th,
      channels: 4,
      background: { r: 8, g: 11, b: 22, alpha: 0.35 },
    },
  })
    .png()
    .toBuffer();

  return img
    .resize(tw, th)
    .blur(18)
    .modulate({ brightness: 0.55, saturation: 0.7 })
    .composite([{ input: overlay, blend: 'over' }])
    .webp({ quality: 72 })
    .toBuffer();
}

const all = await listAll();
const fulls = all.filter((p) => /^full\./i.test(fileName(p)) || /\/full\./i.test(p));

if (fulls.length === 0) {
  console.error('No se encontraron archivos full.* en el bucket. ¿Bucket vacío?');
  process.exit(1);
}

console.log(
  `Encontrados ${fulls.length} full(s). ${dryRun ? '(dry-run: no sube)' : 'Subiendo thumbs…'}\n`,
);

let ok = 0;
let fail = 0;

for (const fullPath of fulls.sort()) {
  const dir = folderOf(fullPath);
  const thumbPath = dir ? `${dir}/thumb.webp` : 'thumb.webp';

  try {
    const { data, error } = await supabase.storage.from(bucket).download(fullPath);
    if (error || !data) throw new Error(error?.message ?? 'download vacío');

    const input = Buffer.from(await data.arrayBuffer());
    const blurred = await blurThumbFromFull(input);

    if (dryRun) {
      console.log(`DRY  ${fullPath} → ${thumbPath} (${blurred.length} bytes)`);
      ok += 1;
      continue;
    }

    const { error: upErr } = await supabase.storage.from(bucket).upload(thumbPath, blurred, {
      contentType: 'image/webp',
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message);

    // Compat paths antiguos thumb.png
    const legacyPng = dir ? `${dir}/thumb.png` : 'thumb.png';
    if (all.includes(legacyPng) || all.some((p) => p === legacyPng)) {
      await supabase.storage.from(bucket).upload(legacyPng, blurred, {
        contentType: 'image/webp',
        upsert: true,
      });
    }

    // Alinear thumb_path en DB si apunta a .png
    if (dir) {
      const sortMatch = dir.match(/^level-(\d+)$/);
      if (sortMatch) {
        await supabase
          .from('levels')
          .update({ thumb_path: `${dir}/thumb.webp` })
          .eq('thumb_path', `${dir}/thumb.png`);
      }
    }

    console.log(`OK   ${fullPath} → ${thumbPath} (${blurred.length} bytes)`);
    ok += 1;
  } catch (e) {
    fail += 1;
    console.error(`FAIL ${fullPath}:`, e instanceof Error ? e.message : e);
  }
}

console.log(`\nListo. ok=${ok} fail=${fail}${dryRun ? ' (dry-run)' : ''}`);
if (fail > 0) process.exit(1);
