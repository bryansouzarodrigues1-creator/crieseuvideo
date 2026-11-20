// Real browser + WebGL + frame-by-frame video export, with NO model calls.
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const base = process.env.CODE3D_QA_URL || 'http://127.0.0.1:4198';
const out = path.resolve('tmp/unified-3d-qa/code3d');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const consoleErrors = [];
let page;
let providerRequests = 0, generationRequests = 0;
try {
  page = await browser.newPage({ viewport: { width: 1100, height: 960 }, acceptDownloads: true });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 1200)); });
  page.on('request', r => {
    if (/ai.gateway.lovable.dev|generativelanguage.googleapis.com/.test(r.url())) providerRequests++;
    if (r.method() === 'POST' && /_serverFn/.test(r.url())) generationRequests++;
  });
  await page.goto(base + '/motor-3d/codigo', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const input = page.locator('#code3d-import');
  await input.waitFor({ timeout: 60000 });
  assert.equal(await page.locator('iframe').count(), 0, 'No demo starts without an explicit action');
  const realGeneration = !!process.env.CODE3D_QA_SCENE;
  const scene = await readFile(process.env.CODE3D_QA_SCENE || new URL('./fixtures/code3d-crane.js', import.meta.url));
  const load = async code => {
    await input.setInputFiles({ name: 'scene.js', mimeType: 'text/javascript', buffer: Buffer.from(code) });
  };
  const ready = async () => {
    await page.waitForFunction(() => /estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent || ''), undefined, { timeout: 45000 });
    assert.match(await page.locator('main').innerText(), /estado: pronto/,
      `Scene did not become ready: ${await page.getByRole('alert').allTextContents()}`);
  };
  await load(scene);
  await ready();
  const duration = Number(await page.getByRole('slider', { name: 'Linha do tempo' }).getAttribute('max'));
  assert.ok(duration >= 8 && duration <= 12);
  assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
  assert.match(await page.locator('main').innerText(), /Código importado · nenhuma chamada à IA/);
  await page.locator('iframe').screenshot({ path: path.join(out, 'crane-start.png') });
  // Seek with the real UI; verify repeatable, changing pixels in the actual WebGL canvas.
  const seek = async t => {
    await page.getByRole('slider', { name: 'Linha do tempo' }).fill(String(t));
    await page.waitForTimeout(150);
    return page.frames().find(f => f.url() === 'about:srcdoc').evaluate(() => {
      const canvas = document.querySelector('canvas');
      const sample = document.createElement('canvas'); sample.width = sample.height = 48;
      const ctx = sample.getContext('2d'); ctx.drawImage(canvas, 0, 0, 48, 48);
      return Array.from(ctx.getImageData(0, 0, 48, 48).data);
    });
  };
  const early = await seek(1), middle = await seek(4), end = await seek(duration - .4), repeated = await seek(4);
  assert.ok(middle.every((v, i) => Math.abs(v - repeated[i]) <= 3), 'Returning to a timestamp must reproduce the same frame');
  assert.notDeepEqual(early, middle, 'The animation must move');
  assert.notDeepEqual(middle, end, 'The final action must differ from the lift');
  assert.ok(new Set(middle).size > 30, 'Do not approve an empty/flat-color frame');
  await page.locator('iframe').screenshot({ path: path.join(out, 'crane-middle.png') });
  await seek(duration - .4);
  await page.locator('iframe').screenshot({ path: path.join(out, 'crane-end.png') });
  const exportButton = page.getByRole('button', { name: 'Exportar vídeo (experimental)', exact: true });
  const downloadPromise = page.waitForEvent('download', { timeout: 180000 });
  await exportButton.click();
  const download = await downloadPromise;
  const ext = download.suggestedFilename().endsWith('.mp4') ? 'mp4' : 'webm';
  await download.saveAs(path.join(out, `crieseuvideo-code3d-${realGeneration ? 'gemini-real' : 'teste-tecnico'}-${duration}s.${ext}`));
  await exportButton.waitFor();

  // Storage, parent DOM and network APIs must stay inaccessible from imported code.
  const isolation = `function createScene(THREE,canvas,width,height){
    let blocked=0;
    try{parent.document.body; }catch{blocked++;}
    try{localStorage.getItem('anything'); }catch{blocked++;}
    if(blocked!==2||typeof fetch!=='undefined'||typeof WebSocket!=='undefined')throw new Error('isolation failed');
    const ctx=canvas.getContext('2d');
    return {duration:8,renderAt(t){ctx.fillStyle=t<4?'#25a65a':'#49a7ea';ctx.fillRect(0,0,width,height);},dispose(){}};
  }`;
  await load(isolation); await ready();
  await exportButton.click();
  const cancel = page.getByRole('button', { name: /Cancelar exportação/ });
  await cancel.waitFor(); await cancel.click();
  await page.getByRole('alert').filter({ hasText: 'Exportação cancelada' }).waitFor({ timeout: 5000 });
  await exportButton.waitFor();
  const divergent = `function createScene(THREE,canvas,width,height){let n=0;const c=canvas.getContext('2d');return{duration:8,renderAt(t){c.fillStyle='rgb('+(++n*17%255)+',0,0)';c.fillRect(0,0,width,height);},dispose(){}};}`;
  await load(divergent);
  await page.getByRole('alert').filter({ hasText: 'imagens diferentes' }).waitFor({ timeout: 45000 });
  assert.equal(await exportButton.isEnabled(), false, 'Divergent code cannot be exported');
  await load('function createScene(){return {duration:8,renderAt(){},dispose(){}}');
  await page.getByRole('alert').filter({ hasText: 'JavaScript incompleto' }).waitFor();
  // Recover after failed loads, re-create at a different aspect and keep export usable.
  await load(scene); await ready();
  await page.getByRole('button', { name: 'Formato: Vertical 9:16' }).click();
  await ready();
  assert.match(await page.getByRole('button', { name: /Formato:/ }).innerText(), /Horizontal/);
  await page.screenshot({ path: path.join(out, 'studio-horizontal.png'), fullPage: true });
  assert.equal(providerRequests, 0);
  assert.equal(generationRequests, 0);
  assert.deepEqual(errors, []);
  await writeFile(path.join(out, 'report.json'), JSON.stringify({
    passed: true, providerRequests, generationRequests, duration, frames: Math.round(duration * 24), fps: 24, format: ext,
    source: realGeneration ? 'Gemini API code imported from the separate one-call proof' : 'Hand-authored regression fixture, NOT generated by Gemini',
    checks: ['real WebGL sandbox boot', 'repeatable moving pixels', 'frame-by-frame export',
      'parent DOM/storage/network isolation', 'immediate export cancellation', 'divergent replay blocked',
      'syntax rejection and recovery', 'aspect replacement'],
    limitation: 'Production login/API route remains unverified. No narration in this export.',
  }, null, 2));
  console.log(`PASS: isolated Code 3D player + ${ext} export, ${Math.round(duration * 24)} frames, no browser provider calls`);
} catch (e) {
  if (page) {
    await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
    await writeFile(path.join(out, 'failure.json'), JSON.stringify({
      error: String(e), errors, consoleErrors,
      visible: await page.locator('main').innerText().catch(() => ''),
      frames: page.frames().map(f => f.url()),
    }, null, 2));
  }
  throw e;
} finally { await browser.close(); }
