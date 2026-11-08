#!/usr/bin/env node
/**
 * Builds (or serves) exactly one property.
 *
 *   node scripts/run.mjs build --slug=kramim-bagalil
 *   node scripts/run.mjs dev   --slug=kramim-bagalil
 *
 * Order matters:
 *   1. validate the content file            (fails loudly, before anything slow)
 *   2. derive the accent colour from the hero image, if the file has none
 *   3. write the LQIP blur placeholders
 *   4. read the iCal feeds                  (the only network call in the pipeline)
 *   5. astro build                          (fully offline)
 *   6. scan the built output for third-party resources
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';
import sharp from 'sharp';
import { mergeFeeds } from '../src/lib/ical.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] === 'dev' ? 'dev' : 'build';
const arg = (name) => process.argv.slice(3).find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const die = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const properties = () =>
  readdirSync(join(ROOT, 'properties')).filter(
    (s) => !s.startsWith('_') && existsSync(join(ROOT, 'properties', s, 'property.md')),
  );

const slug = arg('slug') ?? properties()[0];
if (!slug) die('אין אף צימר. הריצו: npm run new-property -- --slug=<slug>');
if (!existsSync(join(ROOT, 'properties', slug, 'property.md'))) {
  die(`לא נמצא properties/${slug}/property.md. קיימים: ${properties().join(', ') || '(אין)'}`);
}

// Call node directly — no shell, so paths with spaces (or Hebrew) are safe.
const run = (args, env = {}) =>
  spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
const ASTRO_BIN = join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');

// ── 1. content gate ────────────────────────────────────────────────────
console.log(`\n▸ ${slug}`);
if (run(['scripts/check-images.mjs', '--content', slug]).status !== 0) {
  die('קובץ התוכן לא עבר את הבדיקה. תקנו את מה שרשום למעלה ונסו שוב.');
}

// ── 2 + 3. accent + LQIP, both straight off the image files ────────────
const dir = join(ROOT, 'properties', slug);
const fm = yamlLoad(/^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(join(dir, 'property.md'), 'utf8'))[1]);
const images = [...(fm.images ?? []), ...(fm.panoramas ?? []), ...(fm.entrance ? [fm.entrance] : [])];
const heroPath = resolve(dir, (fm.images ?? []).find((i) => i.role === 'hero').file);

const toHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const fromHsl = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};

let accent = fm.accent;
if (!accent) {
  const { dominant } = await sharp(heroPath).resize(96, 96, { fit: 'inside' }).stats();
  const [h, s, l] = toHsl(dominant.r, dominant.g, dominant.b);
  // Pull it into a range that works as a restrained brand accent on warm paper.
  accent = fromHsl(h, Math.min(0.5, Math.max(0.22, s)), Math.min(0.38, Math.max(0.26, l)));
  console.log(`  צבע הדגשה נגזר מתמונת ההירו: ${accent}`);
}

mkdirSync(join(ROOT, 'src/generated'), { recursive: true }); // gitignored, so a fresh clone has to create it

const lqip = {};
for (const img of images) {
  const file = resolve(dir, img.file);
  const stem = file.split(/[\\/]/).pop().split('.')[0];
  const buf = await sharp(file).resize(20, 20, { fit: 'inside' }).blur(1.1).jpeg({ quality: 38 }).toBuffer();
  lqip[stem] = `data:image/jpeg;base64,${buf.toString('base64')}`;
}
writeFileSync(join(ROOT, 'src/generated/lqip.json'), JSON.stringify(lqip, null, 0), 'utf8');

// ── 4. availability ────────────────────────────────────────────────────
// Deliberately here and not in the page: the Astro build stays offline, and a
// feed that hangs or 500s can never take the build down with it.
const feeds = await mergeFeeds(fm.icalFeeds ?? []);
if ((fm.icalFeeds ?? []).length) {
  console.log(`  יומנים: ${feeds.ok} נקראו, ${feeds.failed} נכשלו, ${feeds.blocked.length} לילות חסומים`);
}
writeFileSync(join(ROOT, 'src/generated/availability.json'), JSON.stringify(feeds), 'utf8');

// ── 5. astro ───────────────────────────────────────────────────────────
const env = { PROPERTY_SLUG: slug, PROPERTY_ACCENT: accent };
if (arg('site')) env.SITE_URL = arg('site');

const astro = run([ASTRO_BIN, mode], env);
if (astro.status !== 0) die('הבנייה נכשלה.');
if (mode === 'dev') process.exit(0);

// ── 6. output gate ─────────────────────────────────────────────────────
if (run(['scripts/check-images.mjs', '--dist', `dist/${slug}`]).status !== 0) {
  die('בפלט נמצאו משאבים חיצוניים. האתר חייב להיות עצמאי לגמרי.');
}

console.log(`\n✓ נבנה: dist/${slug}\n`);
