/** Real browser interaction; all model responses are fixtures, never paid calls. */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import worker from '../dist/server/index.js';

const output = 'tmp/director-response-qa';
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const url = `http://127.0.0.1:${server.address().port}`;
    const response = await worker.fetch(new Request(new URL(req.url || '/', url), {
      method: req.method, headers: req.headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    }), {});
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
  assert.deepEqual(errors, []);
  await fs.writeFile(output + '/report.json', JSON.stringify({ providerResponses: 'simulated', realProviderGenerationTested: false, paidCalls: 0, requests: calls, viewport: { width: 393, height: 852 }, cases, validResponseApplied: true, durationPreserved: 30, browserErrors: errors, blockedExternalRequests }, null, 2));
  console.log('PASS browser: 5 failures preserve the prior plan, pixels and source; valid fixture applies once. No provider generation.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
