#!/usr/bin/env node
/** The smallest checks that fail if the non-obvious logic breaks. node scripts/selftest.mjs */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { parseIcs, blockedNights, mergeFeeds, iso } from '../src/lib/ical.mjs';
import { onAccent, readableAccent, solidAccent, luminance } from '../src/lib/color.mjs';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260912
DTEND;VALUE=DATE:20260915
SUMMARY:Airbnb (Not available)
END:VEVENT
BEGIN:VEVENT
DTSTART:20261001T140000Z
DTEND:20261002T110000Z
SUMMARY:Book\r
 ing.com
END:VEVENT
END:VCALENDAR`;

// ── iCal ───────────────────────────────────────────────────────────────
const events = parseIcs(ICS.replace(/\n/g, '\r\n'));
assert.equal(events.length, 2, 'two VEVENTs');

const nights = blockedNights(events);
// DTEND is exclusive: 12–14 are taken, the 15th is a checkout day and stays bookable.
assert.deepEqual([...nights].sort(), ['2026-09-12', '2026-09-13', '2026-09-14', '2026-10-01']);
assert.ok(!nights.has('2026-09-15'), 'checkout day stays bookable');

assert.deepEqual(parseIcs('total garbage'), [], 'garbage parses to nothing');
assert.deepEqual(parseIcs(undefined), [], 'undefined parses to nothing');

// A VEVENT whose DTEND is before its DTSTART must be dropped, not expanded backwards.
assert.deepEqual(parseIcs('BEGIN:VEVENT\nDTSTART:20260910\nDTEND:20260901\nEND:VEVENT'), []);

assert.equal(iso(new Date(Date.UTC(2026, 0, 5))), '2026-01-05');

// ── feeds: one good, one broken, one dead — the build must survive ─────
const server = createServer((req, res) => {
  if (req.url === '/good.ics') { res.writeHead(200); res.end(ICS); }
  else if (req.url === '/broken.ics') { res.writeHead(200); res.end('<html>not a calendar</html>'); }
  else { res.writeHead(500); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const merged = await mergeFeeds(
  [`${base}/good.ics`, `${base}/broken.ics`, `${base}/dead.ics`, 'http://127.0.0.1:1/never.ics'],
  { timeoutMs: 1500, log: () => {} },
);
assert.equal(merged.ok, 1, 'one feed read');
assert.equal(merged.failed, 3, 'three feeds failed without throwing');
assert.deepEqual(merged.blocked, ['2026-09-12', '2026-09-13', '2026-09-14', '2026-10-01']);
server.close();

// ── accent colour ──────────────────────────────────────────────────────
assert.equal(onAccent('#ffffff'), '#17130f', 'dark text on a light accent');
assert.equal(onAccent('#1d2a24'), '#ffffff', 'light text on a dark accent');

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
for (const accent of ['#6b7f4f', '#c9b393', '#ffee00', '#000000', '#8a6f52']) {
  assert.ok(contrast(readableAccent(accent), '#f7f4ee') >= 4.5, `accent ${accent} reaches AA on paper`);
}

// A solid accent fill must always be readable under its own label.
for (const accent of ['#6b7f4f', '#c9b393', '#ffee00', '#9ab08c', '#31606e']) {
  const solid = solidAccent(accent);
  assert.ok(contrast(solid, onAccent(solid)) >= 4.5, `solid accent ${accent} → ${solid} reaches AA under its label`);
  assert.ok(contrast(readableAccent(solid, '#efeade'), '#efeade') >= 4.5, `accent text from ${accent} reaches AA on the sunk tone`);
}

console.log('✓ כל הבדיקות עברו');
