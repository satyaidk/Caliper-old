import fs from 'node:fs';

/**
 * Checks that every text colour in styles/tokens.css clears WCAG AA (4.5:1)
 * against every surface it is used on, in both themes.
 *
 *   npm run contrast
 *
 * The palette starts from Bambu Studio's, and several of its values fall short
 * for small text. This is what keeps the adjusted ones honest: change a token
 * and CI says whether the pairs that use it still read.
 */

const css = fs.readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

const block = (re) =>
  Object.fromEntries([...(css.match(re)?.[1] ?? '').matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const dark = block(/:root \{([\s\S]*?)\n\}/);
const light = { ...dark, ...block(/:root\[data-theme='light'\] \{([\s\S]*?)\n\}/) };

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Text token, surface token: every combination the stylesheets put on screen. */
const PAIRS = [
  ...['ink', 'ink-2', 'ink-3'].flatMap((fg) => ['panel', 'raise', 'raise-2', 'app', 'sunken'].map((bg) => [fg, bg])),
  ['accent-text', 'panel'],
  ['accent-text', 'raise'],
  ['accent-text', 'sunken'],
  ['accent-text', 'accent-wash'],
  ['danger', 'panel'],
  ['danger', 'sunken'],
  ['warn', 'panel'],
  ['link', 'panel'],
  ['topbar-ink', 'topbar'],
  ['topbar-ink-2', 'topbar'],
  ['topbar-ink-2', 'topbar-raise'],
  ['canvas-ink', 'canvas'],
];

const failures = [];
let checked = 0;
for (const [theme, tokens] of [['dark', dark], ['light', light]]) {
  for (const [fg, bg] of PAIRS) {
    checked++;
    const value = ratio(tokens[fg], tokens[bg]);
    if (value < 4.5) failures.push(`${theme}: --${fg} on --${bg} is ${value.toFixed(2)}:1`);
  }
  // Fixed inks: white on filled green buttons and tooltips, dark ink on measurement tags.
  for (const [fg, bg, label] of [
    ['#ffffff', tokens['accent-fill'], 'white on --accent-fill'],
    ['#ffffff', tokens.topbar, 'white on --topbar (tooltips)'],
    ['#1f0f00', tokens.mark, 'tag ink on --mark'],
  ]) {
    checked++;
    const value = ratio(fg, bg);
    if (value < 4.5) failures.push(`${theme}: ${label} is ${value.toFixed(2)}:1`);
  }
}

if (failures.length) {
  console.error(`${failures.length} of ${checked} pairs are under 4.5:1\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`All ${checked} text pairs clear WCAG AA (4.5:1) in both themes.`);
