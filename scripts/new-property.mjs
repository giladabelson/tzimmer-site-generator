#!/usr/bin/env node
/**
 * npm run new-property -- --slug=<slug> [--name="שם הצימר"]
 *
 * Copies properties/_template into properties/<slug>. That folder is the only
 * thing you ever edit for a new property — no template file is touched.
 */
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const slug = arg('slug');
const name = arg('name');

if (!slug || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
  console.error(`
שימוש:  npm run new-property -- --slug=<slug> [--name="שם הצימר"]

ה-slug הוא גם שם התיקייה וגם הכתובת באוויר, למשל kramim-bagalil.
אותיות אנגליות קטנות, ספרות ומקפים בלבד.
`);
  process.exit(1);
}

const dest = join(ROOT, 'properties', slug);
if (existsSync(dest)) {
  console.error(`\n✖ properties/${slug} כבר קיים. בחרו slug אחר או מחקו את התיקייה.\n`);
  process.exit(1);
}

cpSync(join(ROOT, 'properties', '_template'), dest, { recursive: true });
mkdirSync(join(dest, 'images'), { recursive: true });
mkdirSync(join(dest, 'panoramas'), { recursive: true });

const file = join(dest, 'property.md');
if (name) {
  writeFileSync(file, readFileSync(file, 'utf8').replace('name: שם הצימר', `name: ${name}`), 'utf8');
}

writeFileSync(
  join(dest, 'images', 'README.md'),
  `# תמונות הצימר

שימו כאן **רק** צילומים שיש לכם זכויות עליהם — כלומר שצילמתם בעצמכם או
שקיבלתם עליהם רישיון בכתב מהצלם.

אסור להעתיל לכאן תמונות מ-Booking, Airbnb, פייסבוק, אינסטגרם או מאתר קיים
של הצימר. גם לא "רק להדגמה" וגם לא באתר פרטי. צילום הוא יצירה מוגנת,
והזכויות בדרך כלל אצל הצלם — לא אצל בעל הצימר.

אחרי שמוסיפים קובץ כאן, מוסיפים אותו לרשימת \`images\` בקובץ property.md עם
\`source: real\`.

הפנורמות (equirectangular, יחס 2:1) הולכות לתיקייה panoramas/.
`,
  'utf8',
);

console.log(`
✓ נוצר properties/${slug}

  1. ערכו את properties/${slug}/property.md — כל שדה מוסבר שם בהערה.
  2. שימו צילומים אמיתיים ב-properties/${slug}/images/ (או השאירו את תמונות ההמחשה).
  3. npm run build:one -- --slug=${slug}
`);
