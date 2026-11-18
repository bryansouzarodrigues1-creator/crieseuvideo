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

const render = async (at) => page.evaluate((time) => {
  const timeline = document.getElementById('timeline'); timeline.value = String(time); timeline.dispatchEvent(new Event('input', { bubbles: true }));
  const canvas = document.getElementById('canvas');
  return { png: canvas.toDataURL('image/png').split(',')[1], data: JSON.parse(canvas.dataset.production || 'null'), action: canvas.dataset.action };
}, at);
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
const scenario = async (name, text, seconds, program, shots = [.02, .3, .5, .75, .98]) => {
  fixture = program; backend = (await import(`../dist/server/index.js?program=${name}`)).default;
  await page.locator('#script').fill(text);
  await page.locator('#duration').selectOption('custom'); await page.locator('#duration-custom').fill(String(seconds)); await page.locator('#duration-custom').dispatchEvent('change');
  await page.locator('#generate').click();
  await page.waitForFunction(() => !document.getElementById('generate').disabled);
  await page.waitForFunction(() => document.getElementById('canvas').dataset.action === 'scene-program3d', undefined, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  for (const aspect of ['9:16', '16:9']) {
    await page.locator(`[data-aspect="${aspect}"]`).click();
    for (const f of shots) {
      const frame = await render(seconds * f); assert.equal(frame.action, 'scene-program3d');
      await fs.writeFile(path.join(output, `${name}-${aspect.replace(':', 'x')}-${Math.round(f * 100)}.png`), Buffer.from(frame.png, 'base64'));
    }
  }
};
await scenario('colisao', script, duration, fixture);

// Scenery kit: an island with mountains, a lake, a forest snapped to the relief, rocks and clouds. Authored, no AI.
// Water floods every part of the relief below its level, so the lake is a water plane placed over a low spot.
const { terrainHeight } = await import('../src/studio/explainer/sceneProgram/scenery.ts');
const relief = { size: [90, 90, 16], seed: 11, roughness: .75 }, base = -.3;
let low = { x: 0, z: 0, h: Infinity };
for (let x = -22; x <= 22; x += 2) for (let z = -22; z <= 22; z += 2) { if (Math.hypot(x, z) > 17) continue; const h = terrainHeight(relief, x, z); if (h < low.h) low = { x, z, h }; }
let shore = { x: 0, z: 0, d: Infinity }; // dry spot next to the lake for the walker
for (let x = -30; x <= 30; x += 1) for (let z = -30; z <= 30; z += 1) { const h = terrainHeight(relief, x, z), d = Math.hypot(x - low.x, z - low.z); if (h > low.h + 1.6 && d < shore.d && d > 7) shore = { x, z, d }; }
const level = base + low.h + 1.1, land = 'Uma ilha verde com montanhas, floresta e um lago sob as nuvens.';
const at = (id, kind, position, more = {}) => ({ id, kind, position, evidence: land, ...more });
const walkY = (x, z) => base + terrainHeight(relief, x, z);
await scenario('paisagem', land, 8, { title: 'paisagem', scenes: [{ sourceId: 's1', visual: 'character', mood: 'neutral', palette: 'teal' }], sceneProgram: { version: 1, background: '#8EC5EA',
  nodes: [at('mar', 'mesh', [0, base - .15, 0], { geometry: { shape: 'water', size: [200, 200], wave: .25, segments: 48 }, color: '#2E86C1', material: { opacity: .9 } }),
    at('ilha', 'mesh', [0, base, 0], { geometry: { shape: 'terrain', ...relief, segments: 56, peakColor: '#F1F3F5' }, color: '#5E9A48' }),
    at('lago', 'mesh', [low.x, level, low.z], { geometry: { shape: 'water', size: [24, 24], wave: .06, segments: 16 }, color: '#4FB3E8', material: { opacity: .92 } }),
    at('floresta', 'mesh', [0, base, 0], { geometry: { shape: 'tree', size: [3.2], seed: 3, foliage: '#2F7D45' }, color: '#6B4A2B', repeat: { count: 260, step: [0, 0, 0], jitter: [70, 0, 70], seed: 9, ground: 'ilha', above: 1.4 } }),
    at('pedras', 'mesh', [0, base, 0], { geometry: { shape: 'rock', size: [.9], seed: 5 }, color: '#8A8D93', repeat: { count: 50, step: [0, 0, 0], jitter: [60, 0, 60], seed: 21, ground: 'ilha', above: 3 } }),
    at('nuvens', 'mesh', [0, 26, -10], { geometry: { shape: 'cloud', size: [5], seed: 2 }, color: '#FFFFFF', repeat: { count: 9, step: [0, 0, 0], jitter: [120, 8, 60], seed: 4 } }),
    at('ana', 'actor', [shore.x, walkY(shore.x, shore.z), shore.z], { color: '#E8C55A', rotation: [0, 2.2, 0] })],
  tracks: [key('ana', [[0, [shore.x, walkY(shore.x, shore.z), shore.z]], [1, [shore.x, walkY(shore.x, shore.z), shore.z]]])],
  shots: [{ sourceId: 's1', subjects: ['ana', 'lago'], azimuth: .5, endAzimuth: -.4, elevation: .3, distance: 1.5 }], contacts: [] } }, [.02, .35, .7, .98]);
assert.deepEqual(errors, []);
console.log('Collision frames written to', output);
} finally { globalThis.fetch = originalFetch; await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
