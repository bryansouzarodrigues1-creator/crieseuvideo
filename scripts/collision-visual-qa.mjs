/** Run with Bun (TS fixture import). Real built Worker, normal mobile UI and
 * native video export. Provider responses are explicitly developer-authored
 * fixtures. Network is intercepted; this is NEVER a live Gemini generation. */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import worker from '../dist/server/index.js';

const output = path.resolve('tmp/collision-qa'); await fs.mkdir(output, { recursive: true });
const shippedWorker = await fs.readFile('dist/server/index.js', 'utf8');
let backend = worker, fixture, providerCalls = 0;
const requests = [], errors = [], report = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.6-flash:generateContent$/);
  providerCalls++;
  const body = JSON.parse(init.body); assert.match(body.contents[0].parts[0].text, /programador e diretor de animação/);
  assert.deepEqual(body.generationConfig, { responseMimeType: 'application/json', maxOutputTokens: 8192 });
  return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(fixture) }] } }] });
};
const server = http.createServer(async (req, res) => {
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const response = await backend.fetch(new Request(new URL(req.url || '/', `http://127.0.0.1:${server.address().port}`), { method: req.method, headers: req.headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) }), { GEMINI_API_KEY: 'fixture-only-key' });
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => {
    const req = route.request(); if (!req.url().startsWith(origin + '/')) return route.abort();
    if (req.url() === origin + '/api/direct') requests.push(req.postDataJSON());
    return route.continue();
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });

// Developer-authored layout that used to go wrong: two same-coloured actors start on top of each other and
// both walk INTO a solid chest. After the fix they must stay apart, stay outside the chest and look different.
const script = 'Dois colegas carregam uma caixa vermelha até o baú marrom.', duration = 6;
const key = (node, points) => ({ node, channel: 'position', interpolation: 'smooth', keys: points.map(([phase, value]) => ({ sourceId: 's1', phase, value })) });
const node = (id, kind, position, more = {}) => ({ id, kind, position, evidence: script, ...more });
fixture = { title: 'colisao', scenes: [{ sourceId: 's1', visual: 'character', mood: 'neutral', palette: 'teal' }], sceneProgram: { version: 1, background: '#9CCBEA',
  nodes: [node('chao', 'mesh', [0, -.2, 0], { geometry: { shape: 'box', size: [60, .4, 60] }, color: '#9AA58C' }),
    node('bau', 'mesh', [3, .45, 0], { geometry: { shape: 'box', size: [1.6, .9, 1.1], bevel: .08 }, color: '#6B3F2A' }),
    node('caixa', 'mesh', [1.2, .15, .6], { geometry: { shape: 'box', size: [.5, .3, .36], bevel: .04 }, color: '#E02424' }),
    node('ana', 'actor', [-1.6, 0, 0], { color: '#E8C55A', rotation: [0, 1.2, 0] }), node('beto', 'actor', [-1.3, 0, .05], { color: '#E8C55A', rotation: [0, 1.2, 0] })],
  tracks: [key('ana', [[0, [-1.6, 0, 0]], [.5, [1, 0, 0]], [1, [2.8, 0, .1]]]), key('beto', [[0, [-1.4, 0, .05]], [.5, [1.2, 0, 0]], [1, [3, 0, -.1]]])],
  shots: [{ sourceId: 's1', subjects: ['ana', 'beto', 'bau'], azimuth: .3, endAzimuth: .2, elevation: .15, distance: 1.25 }], contacts: [] } };
backend = (await import('../dist/server/index.js?program=collision')).default;
await page.locator('#script').fill(script);
await page.locator('#duration').selectOption('custom'); await page.locator('#duration-custom').fill(String(duration)); await page.locator('#duration-custom').dispatchEvent('change');
await page.locator('#generate').click();
await page.waitForFunction(() => !document.getElementById('generate').disabled);
await page.waitForFunction(() => document.getElementById('canvas').dataset.action === 'scene-program3d', undefined, { timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
for (const aspect of ['9:16', '16:9']) {
  await page.locator(`[data-aspect="${aspect}"]`).click();
  for (const f of [.02, .3, .5, .75, .98]) {
    const frame = await render(duration * f); assert.equal(frame.action, 'scene-program3d');
    await fs.writeFile(path.join(output, `colisao-${aspect.replace(':', 'x')}-${Math.round(f * 100)}.png`), Buffer.from(frame.png, 'base64'));
  }
}
assert.deepEqual(errors, []);
console.log('Collision frames written to', output);
} finally { globalThis.fetch = originalFetch; await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
