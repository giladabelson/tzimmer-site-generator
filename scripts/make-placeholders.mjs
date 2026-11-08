#!/usr/bin/env node
/**
 * Generates the shipped placeholder set into assets/placeholders/.
 * Deliberately ABSTRACT: soft colour fields, no rooms, no furniture, no views.
 * A placeholder must never be mistakable for a photograph of a real property.
 * Licence-clean by construction — every pixel is generated here from code.
 *
 * Replace these with your own set any time; keep the filenames and the build
 * keeps working. See assets/placeholders/README.md.
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'placeholders');
mkdirSync(OUT, { recursive: true });

// Deterministic pseudo-random so re-running produces identical files.
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const PALETTES = [
  ['#1d2a24', '#3f5c4a', '#9ab08c', '#e7e3d4'], // olive / Galilee
  ['#2a1f18', '#7a4f30', '#c69a6d', '#f2e7d8'], // terracotta / stone
  ['#16262e', '#31606e', '#8fb3b6', '#e3ebe8'], // slate / water
  ['#2b2129', '#6d4552', '#c08e93', '#f1e4e2'], // plum / dusk
];

function field(w, h, seed, { bands = false, pal: palIdx = 0 } = {}) {
  const r = rng(seed);
  const pal = PALETTES[palIdx % PALETTES.length];
  const min = Math.min(w, h);

  let shapes = '';
  for (let i = 0; i < 4; i++) {
    const cx = w * (0.1 + r() * 0.8);
    const cy = bands ? h * (0.2 + r() * 0.6) : h * (0.1 + r() * 0.8);
    const rx = min * (0.22 + r() * 0.3);
    const ry = rx * (bands ? 0.55 : 0.8 + r() * 0.5);
    const fill = pal[1 + (i % 3)];
    const op = (0.5 + r() * 0.35).toFixed(2);
    const one = (x) => `<ellipse cx="${x.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="${fill}" opacity="${op}"/>`;
    shapes += one(cx);
    if (bands) shapes += one(cx - w) + one(cx + w); // wrap the 360 seam
  }

  // Crisp hairline geometry over the soft field: reads as art direction, not a smear.
  const hy = Math.round(h * (bands ? 0.5 : 0.62));
  const cr = min * 0.34;
  const ccx = Math.round(w * (bands ? 0.5 : 0.68));
  const ccy = Math.round(h * 0.4);
  const line = [
    `<path d="M0 ${hy} H ${w}"/>`,
    `<circle cx="${ccx}" cy="${ccy}" r="${cr.toFixed(0)}"/>`,
    `<circle cx="${ccx}" cy="${ccy}" r="${(cr * 0.62).toFixed(0)}" stroke-opacity="0.18"/>`,
    bands ? `<path d="M0 ${Math.round(h * 0.28)} H ${w}" stroke-opacity="0.16"/>` : `<path d="M${Math.round(w * 0.12)} 0 V ${h}" stroke-opacity="0.16"/>`,
  ].join('');

  const blur = Math.round(min / 15);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="${bands ? 0 : 0.7}" y2="1">
      <stop offset="0" stop-color="${pal[3]}"/>
      <stop offset="${bands ? 0.46 : 0.42}" stop-color="${pal[2]}"/>
      <stop offset="1" stop-color="${pal[0]}"/>
    </linearGradient>
    <radialGradient id="v" cx="0.5" cy="0.45" r="0.78">
      <stop offset="0.5" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="${pal[0]}" stop-opacity="0.5"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur}"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <g filter="url(#soft)">${shapes}</g>
  <g fill="none" stroke="${pal[3]}" stroke-opacity="0.3" stroke-width="${Math.max(1, min / 500)}">
    ${line}
  </g>
  <rect width="${w}" height="${h}" fill="url(#v)"/>
</svg>`;
  return Buffer.from(svg);
}

const jobs = [
  ['hero.jpg', 2400, 1500, 11, { pal: 0 }],
  ['gallery-01.jpg', 1800, 1200, 23, { pal: 1 }],
  ['gallery-02.jpg', 1800, 1200, 41, { pal: 0 }],
  ['gallery-03.jpg', 1800, 1200, 67, { pal: 2 }],
  ['gallery-04.jpg', 1800, 1200, 89, { pal: 1 }],
  ['gallery-05.jpg', 1800, 1200, 103, { pal: 3 }],
  ['pano-01.jpg', 4096, 2048, 7, { bands: true, pal: 0 }],
  ['pano-02.jpg', 4096, 2048, 19, { bands: true, pal: 1 }],
  ['pano-03.jpg', 4096, 2048, 31, { bands: true, pal: 2 }],
  ['texture-paper.jpg', 1400, 1400, 5, { pal: 0 }],
];

// Everything here is soft gradient, so we rasterise small and scale up: same
// picture, a fraction of the time. ponytail: no reason to blur 8 megapixels.
// Never overwrite a set that someone dropped in by hand. --force to regenerate.
const force = process.argv.includes('--force');
const done = [];
const kept = [];
for (const [name, w, h, seed, opts] of jobs) {
  if (!force && existsSync(join(OUT, name))) { kept.push(name); continue; }
  const scale = Math.max(1, Math.round(w / 640));
  const rw = Math.round(w / scale);
  const rh = Math.round(h / scale);
  await sharp(field(rw, rh, seed, opts))
    .resize(w, h, { kernel: 'lanczos3' })
    .modulate({ saturation: 1.12 })
    .linear(1.06, -8)
    .jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(join(OUT, name));
  done.push(name);
}

// The grain tile. A pre-rasterised PNG, not an SVG feTurbulence filter: the
// filter costs ~2s of paint on a throttled phone, the PNG costs nothing.
const N = 96;
const noise = Buffer.alloc(N * N);
const nr = rng(4242);
for (let i = 0; i < noise.length; i++) noise[i] = Math.round(nr() * 255);
await sharp(noise, { raw: { width: N, height: N, channels: 1 } })
  .png({ compressionLevel: 9, palette: true, colours: 16 })
  .toFile(resolve(OUT, '..', 'grain.png'));

// The README is written once, never overwritten. It describes what is actually
// in this folder, and the shipped set is licensed stand-in photography rather
// than the abstract fields this script generates, so clobbering it on every run
// would keep reintroducing a description that is not true.
if (!existsSync(join(OUT, 'README.md'))) writeFileSync(
  join(OUT, 'README.md'),
  `# תמונות המחשה (placeholders)

הקבצים כאן נוצרו על ידי \`npm run placeholders\` — צורות מופשטות בלבד, ללא חדרים,
רהיטים או נופים. הם קיימים כדי שאפשר יהיה לבנות אתר לצימר לפני שצילמנו אותו.

**כל תמונה כזו מוצגת באתר עם תווית גלויה: "תמונת המחשה — טרם צולם".**

## להחליף בסט משלכם
שמרו את אותם שמות קבצים (\`hero.jpg\`, \`gallery-01..05.jpg\`, \`pano-01..03.jpg\`)
ותחליפו את הקבצים כאן. אין צורך לגעת בשום קובץ אחר.

הפנורמות חייבות להיות **equirectangular** ביחס 2:1.

## מה אסור
אסור להכניס לכאן צילום של צימר אמיתי שלא צילמתם בעצמכם, גם לא "רק להדגמה".
צילום הוא יצירה מוגנת — הזכויות בדרך כלל אצל הצלם, לא אצל בעל הצימר.
`,
  'utf8',
);



console.log(`✓ נוצרו ${done.length} תמונות המחשה ב-assets/placeholders/`);
if (kept.length) console.log(`  דילגתי על ${kept.length} קבצים שכבר קיימים (--force כדי לדרוס): ${kept.join(', ')}`);
