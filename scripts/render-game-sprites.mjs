/**
 * Genera sprites de gameplay con alpha real (sin damero / fondo blanco).
 * Estilo: iconos glossy neon-velvet legibles a ~48px.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../public/game/sprites');
const SIZE = 256;

function plate(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="disc" cx="38%" cy="32%" r="68%">
      <stop offset="0%" stop-color="#3b1d3a"/>
      <stop offset="55%" stop-color="#1a0b18"/>
      <stop offset="100%" stop-color="#0a0510"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f472b6"/>
      <stop offset="50%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#67e8f9"/>
    </linearGradient>
    <radialGradient id="sheen" cx="30%" cy="25%" r="55%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.28"/>
      <stop offset="45%" stop-color="#fff" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- soft outer bloom (transparent outside) -->
  <circle cx="256" cy="256" r="232" fill="#f472b6" opacity="0.12"/>
  <circle cx="256" cy="256" r="200" fill="url(#disc)"/>
  <circle cx="256" cy="256" r="200" fill="none" stroke="url(#rim)" stroke-width="10"/>
  <circle cx="256" cy="256" r="188" fill="none" stroke="#67e8f9" stroke-opacity="0.25" stroke-width="2"/>
  <circle cx="256" cy="256" r="200" fill="url(#sheen)"/>
  ${inner}
  <!-- sparkles -->
  <g fill="#fff" opacity="0.85">
    <path d="M78 150 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5 z"/>
    <path d="M420 170 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 z"/>
    <path d="M400 360 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z"/>
  </g>
</svg>`;
}

const SPRITES = {
  player: plate(`
    <!-- chic player silhouette: hair + face + curves -->
    <g filter="url(#glow)">
      <ellipse cx="256" cy="210" rx="78" ry="86" fill="#fbcfe8"/>
      <path d="M178 200 C170 140 210 110 256 108 C310 110 348 145 336 205
               C350 175 360 210 340 250 C320 220 300 235 256 230
               C210 235 190 215 178 200 Z" fill="#1e1030"/>
      <path d="M190 175 C200 150 230 145 250 155 C235 170 215 175 190 175 Z" fill="#c084fc"/>
      <path d="M320 175 C310 150 280 145 262 155 C277 170 297 175 320 175 Z" fill="#67e8f9" opacity="0.7"/>
      <!-- eyes -->
      <ellipse cx="230" cy="215" rx="10" ry="8" fill="#0f172a"/>
      <ellipse cx="282" cy="215" rx="10" ry="8" fill="#0f172a"/>
      <circle cx="233" cy="213" r="3" fill="#67e8f9"/>
      <circle cx="285" cy="213" r="3" fill="#f472b6"/>
      <!-- lips -->
      <path d="M240 248 Q256 262 272 248 Q256 256 240 248 Z" fill="#e11d48"/>
      <!-- shoulders / bust hint -->
      <path d="M170 300 C190 275 220 268 256 270 C292 268 322 275 342 300
               C330 340 290 360 256 358 C222 360 182 340 170 300 Z" fill="#f9a8d4"/>
      <path d="M210 295 Q256 330 302 295 Q280 315 256 318 Q232 315 210 295 Z" fill="#db2777" opacity="0.45"/>
      <path d="M200 285 Q230 305 256 300" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="4"/>
    </g>
  `),

  enemy: plate(`
    <g filter="url(#glow)">
      <ellipse cx="256" cy="230" rx="86" ry="92" fill="#fce7f3"/>
      <!-- horns -->
      <path d="M175 175 L155 105 L200 155 Z" fill="#f472b6"/>
      <path d="M337 175 L357 105 L312 155 Z" fill="#67e8f9"/>
      <!-- hair -->
      <path d="M160 220 C155 140 210 100 256 98 C310 100 360 145 352 225
               C370 190 365 260 330 280 C300 240 270 250 256 245
               C240 250 210 235 180 270 C150 250 165 230 160 220 Z" fill="#4c1d95"/>
      <path d="M170 200 C190 160 230 150 250 165" fill="none" stroke="#f472b6" stroke-width="8" stroke-linecap="round"/>
      <!-- glowing eyes -->
      <ellipse cx="228" cy="228" rx="16" ry="12" fill="#0f172a"/>
      <ellipse cx="284" cy="228" rx="16" ry="12" fill="#0f172a"/>
      <ellipse cx="228" cy="228" rx="7" ry="7" fill="#f472b6"/>
      <ellipse cx="284" cy="228" rx="7" ry="7" fill="#67e8f9"/>
      <circle cx="230" cy="226" r="2.5" fill="#fff"/>
      <circle cx="286" cy="226" r="2.5" fill="#fff"/>
      <!-- smirk -->
      <path d="M232 268 Q256 286 280 268" fill="none" stroke="#be123c" stroke-width="5" stroke-linecap="round"/>
      <!-- chest plate -->
      <path d="M175 320 C200 295 230 290 256 292 C282 290 312 295 337 320
               C320 365 280 385 256 384 C232 385 192 365 175 320 Z" fill="#831843"/>
      <path d="M210 318 Q256 355 302 318" fill="none" stroke="#f472b6" stroke-width="5"/>
    </g>
  `),

  heart: plate(`
    <defs>
      <radialGradient id="skinL" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stop-color="#ffe4e6"/>
        <stop offset="45%" stop-color="#fb7185"/>
        <stop offset="100%" stop-color="#be123c"/>
      </radialGradient>
      <radialGradient id="skinR" cx="65%" cy="32%" r="65%">
        <stop offset="0%" stop-color="#fff1f2"/>
        <stop offset="40%" stop-color="#f472b6"/>
        <stop offset="100%" stop-color="#9f1239"/>
      </radialGradient>
    </defs>
    <g filter="url(#glow)">
      <ellipse cx="200" cy="265" rx="88" ry="102" fill="url(#skinL)"/>
      <ellipse cx="312" cy="260" rx="90" ry="104" fill="url(#skinR)"/>
      <path d="M256 195 C248 235 246 275 250 320 C254 275 252 235 256 195 Z" fill="#881337" opacity="0.45"/>
      <ellipse cx="190" cy="270" rx="13" ry="11" fill="#9f1239"/>
      <ellipse cx="322" cy="264" rx="13" ry="11" fill="#9f1239"/>
      <ellipse cx="186" cy="265" rx="4" ry="3" fill="#fda4af"/>
      <ellipse cx="318" cy="259" rx="4" ry="3" fill="#fecdd3"/>
      <ellipse cx="172" cy="220" rx="26" ry="14" fill="#fff" opacity="0.5" transform="rotate(-26 172 220)"/>
      <ellipse cx="292" cy="214" rx="28" ry="15" fill="#fff" opacity="0.48" transform="rotate(-20 292 214)"/>
    </g>
  `),

  bomb: plate(`
    <g filter="url(#glow)">
      <circle cx="256" cy="280" r="110" fill="#111827"/>
      <circle cx="256" cy="280" r="110" fill="none" stroke="#f472b6" stroke-width="8"/>
      <ellipse cx="220" cy="245" rx="34" ry="22" fill="#fff" opacity="0.18"/>
      <rect x="240" y="150" width="32" height="36" rx="6" fill="#64748b"/>
      <path d="M256 150 Q290 110 320 95" fill="none" stroke="#67e8f9" stroke-width="8" stroke-linecap="round"/>
      <circle cx="328" cy="90" r="16" fill="#fbbf24"/>
      <circle cx="328" cy="90" r="8" fill="#fff" opacity="0.7"/>
      <circle cx="256" cy="295" r="28" fill="#f97316" opacity="0.85"/>
    </g>
  `),

  lightning: plate(`
    <g filter="url(#glow)">
      <path d="M290 110 L200 255 L250 255 L210 400 L340 230 L275 230 Z"
            fill="#67e8f9" stroke="#f472b6" stroke-width="6" stroke-linejoin="round"/>
      <path d="M290 110 L200 255 L250 255 L210 400 L340 230 L275 230 Z"
            fill="#fff" opacity="0.25"/>
    </g>
  `),

  shield: plate(`
    <g filter="url(#glow)">
      <path d="M256 120 C310 140 360 155 360 230 C360 320 300 380 256 400
               C212 380 152 320 152 230 C152 155 202 140 256 120 Z"
            fill="#0ea5e9" opacity="0.35" stroke="#67e8f9" stroke-width="10"/>
      <path d="M256 150 C292 165 325 175 325 230 C325 295 285 340 256 355
               C227 340 187 295 187 230 C187 175 220 165 256 150 Z"
            fill="#f472b6" opacity="0.35" stroke="#f9a8d4" stroke-width="5"/>
      <path d="M230 250 L250 275 L295 215" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  `),

  freeze: plate(`
    <g filter="url(#glow)" stroke="#a5f3fc" stroke-width="12" stroke-linecap="round">
      <line x1="256" y1="130" x2="256" y2="382"/>
      <line x1="150" y1="190" x2="362" y2="322"/>
      <line x1="362" y1="190" x2="150" y2="322"/>
      <circle cx="256" cy="256" r="28" fill="#67e8f9" stroke="#fff" stroke-width="6"/>
      <circle cx="256" cy="150" r="14" fill="#fff" opacity="0.85"/>
      <circle cx="256" cy="362" r="14" fill="#fff" opacity="0.85"/>
      <circle cx="168" cy="200" r="10" fill="#f472b6" opacity="0.8"/>
      <circle cx="344" cy="312" r="10" fill="#f472b6" opacity="0.8"/>
    </g>
  `),

  speed: plate(`
    <g filter="url(#glow)">
      <path d="M140 300 L220 200 L250 250 L300 150 L380 280 L300 250 L270 310 Z"
            fill="#fbbf24" stroke="#f472b6" stroke-width="6" stroke-linejoin="round"/>
      <path d="M120 330 H220" stroke="#67e8f9" stroke-width="10" stroke-linecap="round" opacity="0.8"/>
      <path d="M130 360 H200" stroke="#67e8f9" stroke-width="8" stroke-linecap="round" opacity="0.55"/>
      <ellipse cx="300" cy="220" rx="18" ry="10" fill="#fff" opacity="0.45"/>
    </g>
  `),

  clock: plate(`
    <g filter="url(#glow)">
      <circle cx="256" cy="270" r="115" fill="#1e1b4b" stroke="#c084fc" stroke-width="12"/>
      <circle cx="256" cy="270" r="95" fill="#312e81" stroke="#67e8f9" stroke-width="4"/>
      <circle cx="256" cy="145" r="18" fill="#f472b6"/>
      <line x1="256" y1="270" x2="256" y2="205" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
      <line x1="256" y1="270" x2="310" y2="300" stroke="#f9a8d4" stroke-width="8" stroke-linecap="round"/>
      <circle cx="256" cy="270" r="10" fill="#f472b6"/>
      <g fill="#67e8f9">
        <circle cx="256" cy="190" r="5"/><circle cx="256" cy="350" r="5"/>
        <circle cx="176" cy="270" r="5"/><circle cx="336" cy="270" r="5"/>
      </g>
    </g>
  `),
};

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const [name, svg] of Object.entries(SPRITES)) {
    const dest = path.join(outDir, `${name}.png`);
    await sharp(Buffer.from(svg), { density: 180 })
      .resize(SIZE, SIZE)
      .png()
      .toFile(dest);
    console.log('✓', name + '.png');
  }
  console.log('Done →', outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
