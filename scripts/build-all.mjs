#!/usr/bin/env node
/** Builds every property into its own dist/<slug>/ directory. */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const slugs = readdirSync(join(ROOT, 'properties')).filter(
  (s) => !s.startsWith('_') && existsSync(join(ROOT, 'properties', s, 'property.md')),
);

if (!slugs.length) {
  console.error('\n✖ אין אף צימר תחת properties/\n');
  process.exit(1);
}

const failed = [];
for (const slug of slugs) {
  const r = spawnSync(process.execPath, ['scripts/run.mjs', 'build', `--slug=${slug}`], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (r.status !== 0) failed.push(slug);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`נבנו ${slugs.length - failed.length} מתוך ${slugs.length}: ${slugs.map((s) => `dist/${s}`).join(', ')}`);
if (failed.length) {
  console.error(`✖ נכשלו: ${failed.join(', ')}`);
  process.exit(1);
}
