#!/usr/bin/env node
/**
 * Two gates, both fatal:
 *
 *  --content [slug]   every image referenced by a property file is a local file that
 *                     exists, and no "stock" image is used as a hero, gallery or
 *                     panorama image (see IMAGE HONESTY in src/content.config.ts).
 *
 *  --dist <dir>       nothing in the built output fetches an image, font, script or
 *                     stylesheet from a third-party host at runtime.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (msg) => errors.push(msg);

// The one documented exception: a Luma splat is an <iframe> to lumalabs.ai and is
// only ever rendered behind an explicit click (see Walkthrough.astro).
const IFRAME_ALLOW = /lumalabs\.ai/;

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

function frontmatter(file) {
  const raw = readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!m) throw new Error(`אין frontmatter בקובץ ${file}`);
  return yamlLoad(m[1]);
}

function checkContent(onlySlug) {
  const dir = join(ROOT, 'properties');
  const slugs = readdirSync(dir)
    .filter((s) => !s.startsWith('_') && existsSync(join(dir, s, 'property.md')))
    .filter((s) => !onlySlug || s === onlySlug);

  if (!slugs.length) fail(onlySlug ? `לא נמצא צימר בשם "${onlySlug}" תחת properties/` : "לא נמצא אף צימר תחת properties/");

  for (const slug of slugs) {
    const file = join(dir, slug, 'property.md');
    const data = frontmatter(file);
    const base = join(dir, slug);

    const entries = [
      ...(data.images ?? []).map((i) => ({ ...i, kind: `images[role=${i.role ?? 'gallery'}]` })),
      ...(data.panoramas ?? []).map((p) => ({ ...p, role: 'panorama', kind: 'panoramas' })),
      ...(data.entrance ? [{ ...data.entrance, role: 'entrance', kind: 'entrance' }] : []),
    ];
    if (!entries.length) fail(`${slug}: אין אף תמונה בקובץ התוכן`);

    for (const e of entries) {
      const p = String(e.file ?? '');
      const where = `${slug} › ${e.kind} › ${p || '(ריק)'}`;

      if (!p) { fail(`${where}: חסר שדה file`); continue; }
      if (/^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('//')) {
        fail(`${where}: כתובת חיצונית. כל תמונה חייבת להיות קובץ מקומי בפרויקט.`);
        continue;
      }
      if (p.startsWith('/')) { fail(`${where}: נתיב מוחלט. השתמשו בנתיב יחסי לקובץ property.md.`); continue; }

      const abs = resolve(base, p);
      if (relative(ROOT, abs).startsWith('..') || relative(ROOT, abs).startsWith(`..${sep}`)) {
        fail(`${where}: הקובץ נמצא מחוץ לתיקיית הפרויקט.`);
        continue;
      }
      if (!existsSync(abs)) { fail(`${where}: הקובץ לא קיים על הדיסק.`); continue; }

      if (e.source === 'stock' && e.role !== 'texture') {
        fail(`${where}: תמונת סטוק אסורה בתפקיד "${e.role}". סטוק מותר רק ל-role: texture (רקע/מרקם).`);
      }
      if (!['real', 'placeholder', 'stock'].includes(e.source)) {
        fail(`${where}: שדה source חייב להיות real / placeholder / stock.`);
      }
    }

    const heroes = (data.images ?? []).filter((i) => i.role === 'hero');
    if (heroes.length !== 1) fail(`${slug}: חייבת להיות בדיוק תמונת hero אחת (נמצאו ${heroes.length}).`);

    for (const pano of data.panoramas ?? []) {
      for (const h of pano.hotspots ?? []) {
        if (!(data.panoramas ?? []).some((p) => p.id === h.target)) {
          fail(`${slug}: נקודת מעבר בפנורמה "${pano.id}" מפנה ל-"${h.target}" שלא קיים.`);
        }
      }
    }
  }
  return slugs;
}

function checkDist(dir) {
  if (!existsSync(dir)) return fail(`תיקיית הפלט ${dir} לא נמצאה`);
  for (const file of walk(dir)) {
    if (!/\.(html|css|js)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);

    // <img src>, <source src|srcset>, <link href>, <script src>, url(...) in CSS
    const patterns = [
      /<(?:img|source|script|link|video|audio)\b[^>]*?\b(?:src|srcset|href)\s*=\s*["']([^"']+)["']/gi,
      /url\(\s*["']?((?:https?:)?\/\/[^"')]+)["']?\s*\)/gi,
    ];
    for (const re of patterns) {
      for (const [full, url] of text.matchAll(re)) {
        if (!/^(https?:)?\/\//i.test(url)) continue;
        if (/<link\b[^>]*\brel\s*=\s*["'](?:canonical|alternate)["']/i.test(full)) continue;
        fail(`${rel}: משאב חיצוני בזמן ריצה → ${url}`);
      }
    }
    for (const [, url] of text.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
      if (/^(https?:)?\/\//i.test(url) && !IFRAME_ALLOW.test(url)) {
        fail(`${rel}: iframe חיצוני לא מאושר → ${url}`);
      }
    }
  }
}

const args = process.argv.slice(2);
const distIdx = args.indexOf('--dist');
if (distIdx !== -1) checkDist(resolve(ROOT, args[distIdx + 1]));
else checkContent(args.find((a) => !a.startsWith('--')));

if (errors.length) {
  console.error('\n✖ בדיקת תמונות נכשלה:\n' + errors.map((e) => '  • ' + e).join('\n') + '\n');
  process.exit(1);
}
console.log('✓ בדיקת תמונות עברה (כל התמונות מקומיות, אין סטוק במקום צילום אמיתי)');
