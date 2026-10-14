import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Opens one real file per supported extension and checks it actually rendered.
 *
 *   node formats.mjs <baseUrl> [fixturesDir]
 *
 * "Rendered" means the app reached the ready state and reports a non-zero
 * triangle or vertex count — not merely that no exception was thrown.
 */

// The app lives at /app/; the site root is the website.
const BASE = process.argv[2] ?? 'http://localhost:5300/app/';
const DIR = process.argv[3]
  ? path.resolve(process.argv[3])
  : fileURLToPath(new URL('fixtures', import.meta.url));

// Companions are payload for another file, never opened on their own.
const COMPANIONS = new Set(['mtl']);

const files = fs
  .readdirSync(DIR)
  .filter((f) => !COMPANIONS.has(f.split('.').pop().toLowerCase()))
  .sort();

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const rows = [];
let failures = 0;

for (const file of files) {
  const ext = file.split('.').pop().toLowerCase();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const csp = [];
  const errors = [];
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() !== 'error') return;
    if (/Content Security Policy/i.test(t)) csp.push(t);
    else errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(e.message));

  let status = 'FAIL';
  let detail = '';

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // The OBJ fixture has a sibling .mtl; hand both in like a folder drop.
    const inputs = [path.resolve(DIR, file)];
    const companion = path.resolve(DIR, file.replace(/\.obj$/, '.mtl'));
    if (ext === 'obj' && fs.existsSync(companion)) inputs.push(companion);

    await page.setInputFiles('input[type=file]', inputs);

    // WASM kernels download on first use; give the CAD/BIM formats room.
    const budget = ['step', 'stp', 'igs', 'iges', 'brep', 'brp', 'fcstd', '3dm', 'ifc'].includes(ext)
      ? 90_000
      : 30_000;

    await page.waitForFunction(
      () => {
        const strip = document.querySelector('.statusbar');
        const toast = document.querySelector('.toast[data-tone="error"] .toast-title');
        return Boolean(toast) || Boolean(strip && /triangles/.test(strip.textContent ?? ''));
      },
      null,
      { timeout: budget },
    );

    const errorToast = await page
      .$eval('.toast[data-tone="error"] .toast-text', (n) => n.textContent)
      .catch(() => null);

    if (errorToast) {
      detail = errorToast.replace(/\s+/g, ' ').slice(0, 110);
    } else {
      const tri = await page.$eval('.statusbar', (n) => n.textContent ?? '');
      const count = Number((tri.match(/([\d,]+)\s+triangles/) ?? [0, '0'])[1].replace(/,/g, ''));
      if (count > 0) {
        status = 'PASS';
        detail = `${count.toLocaleString()} triangles`;
      } else {
        detail = 'rendered but zero triangles';
      }
    }
  } catch (e) {
    detail = e.message.split('\n')[0].slice(0, 110);
  }

  if (csp.length) {
    status = 'FAIL';
    detail = `CSP: ${csp[0].replace(/\s+/g, ' ').slice(0, 100)}`;
  }
  if (status !== 'PASS') failures++;

  rows.push({ ext, status, detail, errors: [...new Set(errors)].slice(0, 1) });
  await page.close();
}

await browser.close();

console.log('\n  EXT     RESULT   DETAIL');
console.log('  ' + '-'.repeat(86));
for (const r of rows) {
  console.log(`  ${r.ext.padEnd(7)} ${r.status.padEnd(8)} ${r.detail}`);
  if (r.errors.length) console.log(`  ${''.padEnd(16)}console: ${r.errors[0].slice(0, 90)}`);
}
console.log(`\n  ${rows.length - failures}/${rows.length} formats rendered\n`);
process.exit(failures ? 1 : 0);
