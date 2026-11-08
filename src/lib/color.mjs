// Accent helpers. Kept tiny on purpose — one colour per property, nothing more.

export const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

const srgb = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(srgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/** Text colour to place on top of the accent. Picks whichever clears 4.5:1 best. */
export const onAccent = (accent) =>
  contrast(accent, '#ffffff') >= contrast(accent, '#17130f') ? '#ffffff' : '#17130f';

const shift = (hex, factor) => {
  const [r, g, b] = hexToRgb(hex).map((c) => Math.min(255, Math.max(0, c * factor)));
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
};

/**
 * The accent as a solid fill (buttons, selected days). Nudged until the label
 * on top of it clears WCAG AA, so a property can pick any colour it likes and
 * the button is still readable.
 */
export function solidAccent(accent, target = 4.5) {
  // Prefer a deep accent with a white label; only genuinely light hues go the
  // other way. Keeps every property in the same restrained register.
  const towardsDark = luminance(accent) <= 0.5;
  let hex = accent;
  for (let i = 0; i < 30; i++) {
    if (contrast(hex, towardsDark ? '#ffffff' : '#17130f') >= target) return hex;
    hex = shift(hex, towardsDark ? 0.94 : 1.07);
  }
  return towardsDark ? '#17130f' : '#ffffff';
}

/** Darkens the accent until body-size text on --paper clears WCAG AA. */
export function readableAccent(accent, bg = '#f7f4ee', target = 4.5) {
  let [r, g, b] = hexToRgb(accent);
  for (let i = 0; i < 24; i++) {
    const hex = '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
    if (contrast(hex, bg) >= target) return hex;
    [r, g, b] = [r * 0.9, g * 0.9, b * 0.9];
  }
  return '#17130f';
}
