// Inspect and export the untouched actual Gemini response through the native UI.
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tmp/gemini-direction';
await mkdir(out, { recursive: true });
const proof = JSON.parse(await readFile(out + '/generation.json', 'utf8'));
assert.equal(proof.ok, true); assert.equal(proof.attempts, 1); assert.equal(proof.manualChanges, false);
const code = await readFile(out + '/gemini-scene.js');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 1150 }, acceptDownloads: true });
const errors = []; let browserModelRequests = 0;
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => { if (/generativelanguage.googleapis.com|ai.gateway.lovable.dev/.test(r.url())) browserModelRequests++; });
try {
  await page.goto('http://127.0.0.1:4198/motor-3d/codigo', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#code3d-import').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('iframe').count(), 0);
  await page.locator('#code3d-quality').selectOption('hd');
  await page.locator('#code3d-narration').setInputFiles('scripts/fixtures/gemini-direction-timing.json');
  await page.locator('#code3d-import').setInputFiles({ name: 'gemini-directed.js', mimeType: 'text/javascript', buffer: code });
  await page.waitForFunction(() => /estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent || ''), undefined, { timeout: 90000 });
  assert.match(await page.locator('main').innerText(), /estado: pronto/, (await page.getByRole('alert').allTextContents()).join('\n'));
  assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
  assert.equal(Number(await page.getByRole('slider', { name: 'Linha do tempo' }).getAttribute('max')), proof.direction.duration);
  const frame = page.frames().find(f => f.url() === 'about:srcdoc');
  assert.ok(frame);
  const capture = async (time, save = true) => {
    const t = Math.min(proof.direction.duration - .05, Math.max(0, Math.round(time * 20) / 20));
    await page.getByRole('slider', { name: 'Linha do tempo' }).fill(String(t));
    await page.waitForTimeout(100);
    const png = await frame.evaluate(() => document.querySelector('canvas').toDataURL('image/png').split(',')[1]);
    if (save) await writeFile(`${out}/frame-${t.toFixed(2)}.png`, Buffer.from(png, 'base64'));
    return png;
  };
  const times = new Set([0, proof.direction.duration - .05]);
  for (let t = 1; t < proof.direction.duration; t++) times.add(t);
  for (const shot of proof.direction.shots) for (const t of [shot.start - .05, shot.start + .05, (shot.start + shot.end) / 2, shot.end - .05]) times.add(t);
  for (const time of [...times].sort((a, b) => a - b)) await capture(time);
  const middle = await capture(4, false); await capture(9, false); await capture(1, false);
  assert.equal(await capture(4, false), middle, 'Random access must reproduce the same image.');
  const pending = page.waitForEvent('download', { timeout: 600000 });
  const failure = page.waitForFunction(() => Array.from(document.querySelectorAll('[role=alert]')).some(e => /Exportação falhou/.test(e.textContent || '')), undefined, { timeout: 600000 }).then(() => { throw Error('Native export failed.'); });
  await page.getByRole('button', { name: 'Exportar vídeo (experimental)', exact: true }).click();
  const download = await Promise.race([pending, failure]);
  assert.ok(download.suggestedFilename().endsWith('.mp4'));
  await download.saveAs(out + '/Gemini_Montagem_Sem_Correcao_Manual.mp4');
  assert.deepEqual(errors, []); assert.equal(browserModelRequests, 0);
  await writeFile(out + '/browser.json', JSON.stringify({ passed: true, fps: 30, width: 720, height: 1280, duration: proof.direction.duration,
    frames: Math.ceil(proof.direction.duration * 30), browserModelRequests, actualGeminiRequests: proof.attempts,
    manualChanges: false, errors, source: 'Real Gemini direction and source, original response retained. Native export of imported actual response.',
    limitation: 'No production login verification; audio mixed separately; structural validation and replay do not certify semantic or visual quality.' }, null, 2));
} catch (error) {
  await page.screenshot({ path: out + '/failure.png', fullPage: true }).catch(() => {});
  await writeFile(out + '/browser-failure.json', JSON.stringify({ error: String(error), errors, visible: await page.locator('main').innerText().catch(() => '') }, null, 2));
  throw error;
} finally { await browser.close(); }
