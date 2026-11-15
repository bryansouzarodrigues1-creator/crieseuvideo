/** Real browser interaction; all model responses are fixtures, never paid calls. */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import worker from '../dist/server/index.js';

let backendWorker = worker, backendMode = false, providerFixture, providerCalls = 0, requestedSchema;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.6-flash:generateContent$/);
  providerCalls++;
  requestedSchema = JSON.parse(init.body).generationConfig.responseFormat.text.schema;
  return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(providerFixture) }] } }] });
};

const output = 'tmp/director-response-qa';
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const url = `http://127.0.0.1:${server.address().port}`;
    const response = await backendWorker.fetch(new Request(new URL(req.url || '/', url), {
      method: req.method, headers: req.headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    }), backendMode ? { GEMINI_API_KEY: 'fixture-only-key' } : {});
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Test server failed.'); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  let fixture, calls = 0;
  const errors = [], cases = [], blockedExternalRequests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!request.url().startsWith(origin + '/')) { blockedExternalRequests.push(new URL(request.url()).hostname); return route.abort(); }
    if (request.url() === origin + '/api/direct') {
      calls++;
      assert.equal(request.postDataJSON().script, 'Eu sou o maior jogador do mundo hahahaha');
      assert.equal(request.postDataJSON().targetDuration, 30);
      if (backendMode) return route.continue();
      return route.fulfill(fixture);
    }
    return route.continue();
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-engine="2d"]').click();
  await page.locator('#script').fill('Eu sou o maior jogador do mundo hahahaha');
  await page.locator('#local').click();
  await page.locator('#duration').selectOption('30');
  await page.evaluate(() => document.fonts.ready);
  const saved = await page.evaluate(() => localStorage.getItem('crieseuvideo-lab-v1'));
  const pixels = await page.locator('#canvas').evaluate((canvas) => canvas.toDataURL());
  for (const [name, response, message] of [
    ['html-502', { status: 502, contentType: 'text/html', body: '<!DOCTYPE html><html>private-page-detail</html>' }, /HTTP 502/],
    ['html-as-json', { status: 200, contentType: 'application/json', body: '<!DOCTYPE html>' }, /dados esperados/],
    ['unsupported-action', { status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, status: 502, code: 'unsupported_action', error: 'A ação ainda não tem suporte.' }) }, /não tem suporte/],
    ['quota', { status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, status: 429, code: 'quota', error: 'A cota da IA terminou.' }) }, /cota da IA terminou/],
    ['empty-plan', { status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, plan: { scenes: [] } }) }, /sem cenas válidas/],
  ]) {
    fixture = response;
    const before = calls;
    await page.locator('#generate').click();
    await page.waitForFunction(() => !document.getElementById('generate').disabled);
    const text = await page.locator('#message').innerText();
    assert.match(text, message);
    assert.doesNotMatch(text, /Unexpected token|DOCTYPE|private-page-detail/);
    assert.equal(calls, before + 1, 'Each click must submit once without retries.');
    assert.equal(await page.evaluate(() => localStorage.getItem('crieseuvideo-lab-v1')), saved);
    assert.equal(await page.locator('#canvas').evaluate((canvas) => canvas.toDataURL()), pixels);
    assert.equal(await page.locator('#script').inputValue(), 'Eu sou o maior jogador do mundo hahahaha');
    cases.push({ name, previousPlanPreserved: true, pixelsPreserved: true, submittedOnce: true });
  }
  await page.locator('.script-panel').screenshot({ path: output + '/error-preserved.png' });
  fixture = { status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, source: 'ai', plan: { scenes: [{ text: 'Eu sou o maior jogador do mundo hahahaha', visual: 'character', mood: 'happy', palette: 'teal' }] } }) };
  await page.locator('#generate').click();
  await page.waitForFunction(() => !document.getElementById('generate').disabled);
  assert.equal(await page.locator('#source').innerText(), 'GEMINI DIRETO');
  assert.equal(Number(await page.locator('#timeline').getAttribute('max')), 30);
  // Exercise the real server/controller/provider parser, not only a ready-made plan.
  backendMode = true;
  backendWorker = (await import('../dist/server/index.js?qa=nullable-actions')).default;
  providerFixture = { scenes: [{ sourceId: 's1', visual: 'character', mood: 'happy', staging: null, story: null }], production: null };
  await page.locator('[data-engine="3d"]').click();
  await page.locator('#generate').click();
  await page.waitForFunction(() => !document.getElementById('generate').disabled);
  await page.waitForFunction(() => document.getElementById('canvas').dataset.action === 'production3d');
  const directed = await page.evaluate(() => JSON.parse(localStorage.getItem('crieseuvideo-lab-v1')));
  assert.deepEqual(directed.plan.production.assets.map((asset) => asset.kind), ['person']);
  assert.ok(directed.plan.production.tracks.some((track) => track.channel === 'laugh'));
  assert.equal(directed.plan.scenes.map((scene) => scene.text).join(' '), 'Eu sou o maior jogador do mundo hahahaha');
  assert.equal(Number(await page.locator('#timeline').getAttribute('max')), 30);
  assert.deepEqual(requestedSchema.properties.scenes.prefixItems[0].properties.staging, { type: 'null' });
  assert.equal(providerCalls, 1);
  const current = await page.evaluate(() => localStorage.getItem('crieseuvideo-lab-v1'));
  const currentPixels = await page.locator('#canvas').evaluate((canvas) => canvas.toDataURL());
  backendWorker = (await import('../dist/server/index.js?qa=unsupported-action')).default;
  providerFixture = { scenes: [{ sourceId: 's1', visual: 'character', staging: { action: 'laugh' } }] };
  await page.locator('#generate').click();
  await page.waitForFunction(() => !document.getElementById('generate').disabled);
  assert.match(await page.locator('#message').innerText(), /Cena 1.*laugh/);
  assert.equal(await page.evaluate(() => localStorage.getItem('crieseuvideo-lab-v1')), current);
  assert.equal(await page.locator('#canvas').evaluate((canvas) => canvas.toDataURL()), currentPixels);
  assert.equal(providerCalls, 2);
  await page.locator('.script-panel').screenshot({ path: output + '/source-action-diagnostic.png' });
  assert.deepEqual(errors, []);
  await fs.writeFile(output + '/report.json', JSON.stringify({ providerResponses: 'simulated', realProviderGenerationTested: false, paidCalls: 0, requests: calls, interceptedProviderCalls: providerCalls, viewport: { width: 393, height: 852 }, cases, validResponseApplied: true, realControllerNullableActionsApplied: true, sourceSpecificErrorPreserves3d: true, durationPreserved: 30, browserErrors: errors, blockedExternalRequests }, null, 2));
  console.log('PASS browser: nullable actions through the real director apply as 3D acting; rejected actions identify the source and preserve pixels. No provider generation.');
} finally {
  globalThis.fetch = originalFetch;
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
