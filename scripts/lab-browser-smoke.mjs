/**
 * Local visual smoke for the isolated Story lab.
 * Starts the same built Worker as production lab, with no API keys or paid calls.
 * Requires Playwright Chromium installed in the test runner.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import worker from '../dist/server/index.js';

const output = path.resolve('tmp/story-browser-qa');
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await worker.fetch(new Request(new URL(req.url || '/', base), {
      method: req.method,
      headers: req.headers,
    }), { GEMINI_API_KEY: undefined });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
let exit = 0;
const errors = [], forbidden = [];
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (req) => {
    if (/\/api\/(direct|narrate|transcribe)/.test(req.url())) forbidden.push(req.url());
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#story-demo').click();
  assert.match(await page.locator('#source').innerText(), /COREOGRAFIA SEM IA/);
  assert.equal(await page.locator('#scene-count').innerText(), '1');
  assert.match(await page.locator('#fidelity').innerText(), /Todas as palavras preservadas/);
  const storyboard = await page.locator('.scene-card').first().innerText();
  assert.match(storyboard, /Lia/);
  assert.match(storyboard, /Caio/);

  const canvas = page.locator('#canvas');
  const samples = [];
  for (const [i, at] of [0.05, 0.42, 0.70, 0.98].entries()) {
    await page.locator('#timeline').evaluate((element, fraction) => {
      element.value = String(Number(element.max) * fraction);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }, at);
    await page.waitForTimeout(180);
    const signature = await canvas.evaluate((element) => {
      const c = element.getContext('2d');
      const img = c.getImageData(0, 0, element.width, element.height);
      let sample = 0, colored = 0, alpha = 0;
      for (let i = 0; i < img.data.length; i += 1024) {
        sample = (Math.imul(sample, 33) + img.data[i] + 3 * img.data[i + 1] + 7 * img.data[i + 2]) >>> 0;
        if (img.data[i] !== img.data[i + 1] || img.data[i + 1] !== img.data[i + 2]) colored++;
        if (img.data[i + 3] > 0) alpha++;
      }
      return { sample, colored, alpha };
    });
    assert.ok(signature.colored > 300, `Frame ${i}: desenho não apareceu`);
    assert.ok(signature.alpha > 300, `Frame ${i}: canvas transparente`);
    samples.push(signature.sample);
    await canvas.screenshot({ path: path.join(output, `lia-caio-2d-${i}.png`) });
  }
  assert.ok(new Set(samples).size >= 3, 'Quadros não mudam durante a coreografia');
  console.log('PASS 2D laboratory, 4 distinct timeline frames, original words retained');

  const webgl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    try { return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  });
  if (webgl) {
    await page.locator('[data-engine="3d"]').click();
    await page.waitForTimeout(2500);
    await page.locator('#timeline').evaluate((element) => {
      element.value = String(Number(element.max) * 0.55);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const selected = await page.locator('[data-engine="3d"]').getAttribute('class');
    assert.match(selected || '', /selected/, '3D não conseguiu iniciar apesar do WebGL disponível');
    await canvas.screenshot({ path: path.join(output, 'lia-caio-3d.png') });
    console.log('PASS Toon3D rendered WebGL frame');
  } else {
    console.log('SKIP Toon3D: WebGL not available in CI, browser fallback remains in place');
  }
  assert.deepEqual(forbidden, [], 'O teste local não deve chamar Gemini/TTS');
  assert.deepEqual(errors, [], 'Errors in browser console');
} catch (error) {
  exit = 1;
  console.error(error);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
process.exitCode = exit;
