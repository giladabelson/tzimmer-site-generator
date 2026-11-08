#!/usr/bin/env node
/**
 * npm run deploy -- --slug=<slug> [--project=<cloudflare-project>]
 *
 * Builds the property and pushes dist/<slug> to Cloudflare Pages.
 * Free tier, one Pages project per property, no card on file.
 * Wrangler is invoked with npx so nothing is installed permanently.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const slug = arg('slug');
if (!slug) {
  console.error('\nשימוש: npm run deploy -- --slug=<slug> [--project=<שם הפרויקט ב-Cloudflare>]\n');
  process.exit(1);
}
const project = arg('project') ?? slug;

const build = spawnSync(process.execPath, ['scripts/run.mjs', 'build', `--slug=${slug}`,
  `--site=https://${project}.pages.dev`], { cwd: ROOT, stdio: 'inherit' });
if (build.status !== 0) process.exit(1);

const dist = join(ROOT, 'dist', slug);
if (!existsSync(dist)) {
  console.error(`\n✖ ${dist} לא נמצא\n`);
  process.exit(1);
}

console.log(`\n▸ מעלה ל-Cloudflare Pages: ${project}.pages.dev`);
console.log('  (בפעם הראשונה ייפתח דפדפן לאישור החשבון)\n');

const r = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['--yes', 'wrangler@latest', 'pages', 'deploy', dist, `--project-name=${project}`, '--commit-dirty=true'],
  { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(r.status ?? 1);
