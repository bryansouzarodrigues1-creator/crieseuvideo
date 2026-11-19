/**
 * Opt-in smartphone demo: mobile WebGL smoke/visual regression QA.
 * No paid model calls, no authentication, no saved project changes.
 * Screenshots are retained in the existing unified-3d CI artifact.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:4198';
const out = path.resolve('tmp/unified-3d-qa');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader']
});
const errors = [];
let providerRequests = 0;
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/ai.gateway.lovable.dev|generativelanguage.googleapis.com/.test(request.url())) providerRequests++;
  });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const testButton = page.getByRole('button', { name: /Testar montagem de celular \(12s, sem IA\)/ });
  await testButton.waitFor({ timeout: 60000 });
  assert.equal(await page.locator('canvas[aria-label="Prévia da montagem 3D de celular"]').count(), 0);
  assert.equal(providerRequests, 0, 'The demo must not trigger AI billing');
  await testButton.click();
  const stage = page.locator('canvas[aria-label="Prévia da montagem 3D de celular"]');
  await stage.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.native-3d-error').count(), 0, 'Stage failed to render');
  assert.equal(await page.getByText('Demonstração offline (sem IA)').count(), 1);
  assert.equal(providerRequests, 0, 'The opt-in demo must remain offline');

  const slider = page.getByRole('slider', { name: 'Linha do tempo do 3D avançado' });
  const seek = async (seconds) => {
    await slider.evaluate((element, target) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) throw new Error('Range value setter not found');
      setter.call(element, String(target));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, seconds);
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.native-3d-error').count(), 0, 'Stage failed after seek to ' + seconds);
  };

  const hashes = [];
  for (const [seconds, label] of [[0, 'initial'], [3.8, 'battery-installed'], [7.9, 'cpu-camera-installed'], [11.8, 'display-installed']]) {
    await seek(seconds);
    const bytes = await stage.screenshot({ path: path.join(out, 'phone-' + label + '.png') });
    hashes.push(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.ok(new Set(hashes).size >= 2, 'All four rendered frames were identical');
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 4);
  assert.equal(noOverflow, true, 'Mobile layout has horizontal overflow');
  assert.equal(providerRequests, 0, 'No paid provider calls during scrubbing');
  assert.deepEqual(errors, [], 'Unhandled errors in browser');

  await writeFile(path.join(out, 'smartphone-demo-report.json'), JSON.stringify({
    passed: true, providerRequests, hashes,
    checkpoints: [0, 3.8, 7.9, 11.8],
    caveat: 'Automated render smoke/frames only, not human visual sign-off or MP4/audio QA.',
  }, null, 2));
  console.log('PASS: 12-second smartphone assembly renders in mobile viewport, no AI billing');
} finally {
  await browser.close();
}
