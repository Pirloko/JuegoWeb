// Genera la imagen de prueba del nivel 1 (public/levels/level-1.png, 720×1280).
// Paisaje sintético: atardecer con sol y bandas de reflejo — algo vistoso que
// merezca la pena revelar. En la FASE 9 las imágenes vivirán en Supabase Storage.
// Uso: node scripts/generate-level-image.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { png, mix, lerp } from './png.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'levels');

const SKY_TOP = [24, 16, 64]; // índigo profundo
const SKY_MID = [124, 58, 237]; // violeta
const HORIZON = [244, 114, 182]; // rosa
const SEA_TOP = [251, 146, 60]; // ámbar
const SEA_BOTTOM = [30, 20, 70];
const SUN = [253, 230, 138];

const HORIZON_V = 0.58;
const SUN_CENTER = { u: 0.5, v: 0.44 };
const SUN_RADIUS = 0.16;

function draw(u, v) {
  let color;
  if (v < HORIZON_V) {
    // Cielo en tres tramos
    const t = v / HORIZON_V;
    color = t < 0.55 ? mix(SKY_TOP, SKY_MID, t / 0.55) : mix(SKY_MID, HORIZON, (t - 0.55) / 0.45);

    // Sol con halo suave
    const du = (u - SUN_CENTER.u) * (720 / 1280); // corrige aspecto
    const dv = v - SUN_CENTER.v;
    const dist = Math.hypot(du, dv);
    if (dist < SUN_RADIUS) {
      const core = Math.max(0, 1 - dist / SUN_RADIUS);
      color = mix(color, SUN, Math.min(1, core * 1.6));
    } else if (dist < SUN_RADIUS * 2.2) {
      const halo = 1 - (dist - SUN_RADIUS) / (SUN_RADIUS * 1.2);
      color = mix(color, SUN, halo * 0.25);
    }
  } else {
    // Mar con bandas de reflejo
    const t = (v - HORIZON_V) / (1 - HORIZON_V);
    color = mix(SEA_TOP, SEA_BOTTOM, t);
    const band = Math.sin(v * 320) * 0.5 + 0.5;
    const nearSun = Math.max(0, 1 - Math.abs(u - 0.5) / (0.28 * (1 + t)));
    color = mix(color, SUN, band * nearSun * lerp(0.35, 0.05, t));
  }
  return [Math.round(color[0]), Math.round(color[1]), Math.round(color[2]), 255];
}

mkdirSync(OUT, { recursive: true });
const buffer = png(720, 1280, draw);
writeFileSync(join(OUT, 'level-1.png'), buffer);
console.log(`✓ level-1.png (${(buffer.length / 1024).toFixed(0)} KB)`);
