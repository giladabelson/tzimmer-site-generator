// Minimal iCalendar reader. We only need DTSTART/DTEND of VEVENTs.
// ponytail: 60 lines instead of node-ical; upgrade if we ever need RRULE expansion.

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function toUtcDate(value) {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Returns [{start, end}] as UTC Date objects. DTEND is exclusive, as in RFC 5545. */
export function parseIcs(text) {
  if (typeof text !== 'string' || !text.includes('BEGIN:VEVENT')) return [];
  // RFC 5545 line folding: a CRLF followed by a space or tab continues the line.
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) cur = {};
    else if (line.startsWith('END:VEVENT')) {
      if (cur?.start && cur?.end && cur.end > cur.start) events.push(cur);
      cur = null;
    } else if (cur) {
      const m = /^(DTSTART|DTEND)(?:;[^:]*)?:(.+)$/.exec(line);
      if (m) {
        const d = toUtcDate(m[2]);
        if (d) cur[m[1] === 'DTSTART' ? 'start' : 'end'] = d;
      }
    }
  }
  return events;
}

/** Expands events into the set of nights that are taken. Checkout day stays bookable. */
export function blockedNights(events) {
  const out = new Set();
  const DAY = 86400000;
  for (const { start, end } of events) {
    for (let t = start.getTime(); t < end.getTime(); t += DAY) {
      out.add(iso(new Date(t)));
      if (out.size > 4000) return out; // runaway guard on a malformed far-future DTEND
    }
  }
  return out;
}

/**
 * Fetches every feed at build time and merges them.
 * A feed that times out, 404s or returns garbage is skipped — never fatal.
 * Returns { blocked: string[], ok: number, failed: number }.
 */
export async function mergeFeeds(urls = [], { timeoutMs = 8000, log = console.warn } = {}) {
  const all = new Set();
  let ok = 0;
  let failed = 0;
  for (const url of urls) {
    const ctrl = new AbortController();
    // An unref'd timer, and every response body drained or cancelled: a build-time
    // fetch must not leave a live socket behind, or node crashes on exit (Windows).
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    timer.unref?.();
    try {
      const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const events = parseIcs(text);
      if (!events.length) throw new Error('no VEVENT found');
      for (const night of blockedNights(events)) all.add(night);
      ok++;
    } catch (err) {
      failed++;
      log(`  ⚠ יומן לא נקרא (${url}): ${err.message} — נבנה בלי חסימות מהיומן הזה`);
    } finally {
      clearTimeout(timer);
    }
  }
  return { blocked: [...all].sort(), ok, failed };
}
