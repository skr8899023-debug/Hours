// KKRC V2.1 photographic-alignment capture tool.
//
// HARD GUARD: refuses to run unless the real aerial photo exists at
// reference/kkrc_aerial_reference.(jpg|png) AND the page confirms it loaded
// (overlayState().isPhoto === true). The schematic fallback is never allowed
// in approval captures.
//
// Usage:
//   1. put the photo at reference/kkrc_aerial_reference.jpg
//   2. python3 -m http.server 8000   (from prototype/king-khalid-racecourse/)
//   3. npm i playwright-core  (or set CHROME_PATH to a Chrome/Chromium binary)
//   4. node tools/capture_v2_1.mjs
//
// Output: ../../reports/kkrc-v2.1/*.png  (all mandated V2.1 shots)

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const OUT = join(root, '..', '..', 'reports', 'kkrc-v2.1');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';

const photo = ['kkrc_aerial_reference.jpg', 'kkrc_aerial_reference.png']
  .map((f) => join(root, 'reference', f))
  .find(existsSync);

if (!photo) {
  console.error('PHOTOGRAPHIC REFERENCE MISSING');
  console.error('Put the aerial photo at prototype/king-khalid-racecourse/reference/kkrc_aerial_reference.jpg and re-run.');
  process.exit(2);
}

const { chromium } = await import('playwright-core');
const executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  executablePath,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`${BASE}/index.html?variant=v2`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.KKRC && window.KKRC.ready, { timeout: 30000 });
await page.waitForTimeout(1200);

const st = await page.evaluate(() => window.KKRC.overlayState());
if (!st.isPhoto) {
  console.error('PHOTOGRAPHIC REFERENCE MISSING — page fell back to the schematic; aborting.');
  await browser.close();
  process.exit(2);
}
console.log(`photo loaded: ${st.imageName} ${st.imageWidth}x${st.imageHeight}px`);

mkdirSync(OUT, { recursive: true });
async function shot(file, { cam = 'topOrthographic', diff = null, ref = true } = {}) {
  await page.evaluate(({ cam, diff, ref }) => {
    window.KKRC.setReferenceMode(false);
    window.KKRC.setCamera(cam);
    if (ref) window.KKRC.setReferenceMode(true);
    if (diff) window.KKRC.setDiffMode(diff);
  }, { cam, diff, ref });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, file) });
  console.log('captured', file);
}

await shot('reference-original.png', { diff: 'reference' });
await shot('model-only.png', { diff: 'model' });
await shot('photo-overlay-25.png', { diff: 'overlay25' });
await shot('photo-overlay-50.png', { diff: 'overlay50' });
await shot('photo-overlay-75.png', { diff: 'overlay75' });
await shot('photo-flicker-a.png', { diff: 'flicker-a' });
await shot('photo-flicker-b.png', { diff: 'flicker-b' });
await shot('edge-comparison.png', { diff: 'edge' });
await shot('top-final.png', { ref: false });
await shot('aerial-final.png', { cam: 'aerialHero', ref: false });

// persist the live alignment settings next to the landmarks
const alignment = await page.evaluate(() => window.KKRC.exportAlignment());
writeFileSync(join(root, 'reference', 'reference_alignment.json'), JSON.stringify(alignment, null, 2) + '\n');
console.log('wrote reference/reference_alignment.json (photo_verified:', alignment.photo_verified, ')');

await browser.close();
console.log('done — build side-by-side-final.png from reference-original/model-only/photo-overlay-50');
