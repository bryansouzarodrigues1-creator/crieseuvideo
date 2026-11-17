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
import { sceneProgramFixtures } from '../src/studio/explainer/sceneProgram/fixtures.ts';
import { craneExperimentFixture } from '../src/studio/explainer/sceneProgram/craneExperiment.ts';
import { auditSceneActionDensity } from '../src/studio/explainer/sceneProgram/actionDensity.ts';
import { productionSources } from '../src/studio/explainer/plan.ts';
// Calibration scenes stay outside the shipped studio and never trigger an AI call.
const qaFixtures = process.env.SCENE_PROGRAM_EXPERIMENT === 'crane'
  ? [craneExperimentFixture()]
  : sceneProgramFixtures();
import worker from '../dist/server/index.js';

const output = path.resolve('tmp/scene-program-qa'); await fs.mkdir(output, { recursive: true });
const shippedWorker = await fs.readFile('dist/server/index.js', 'utf8');
for (const spec of qaFixtures) assert.ok(!shippedWorker.includes(spec.id), 'A prepared scene was accidentally bundled into the application.');
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
  assert.equal(await page.locator('#direction-mode').inputValue(), 'program');
  const render = async (at) => page.evaluate((time) => {
    const timeline = document.getElementById('timeline'); timeline.value = String(time); timeline.dispatchEvent(new Event('input', { bubbles: true }));
    const canvas = document.getElementById('canvas');
    return { png: canvas.toDataURL('image/png').split(',')[1], data: JSON.parse(canvas.dataset.production || 'null'), action: canvas.dataset.action };
  }, at);
  for (const spec of qaFixtures) {
    console.log('Checking authored fixture through programming UI:', spec.id);
    fixture = spec.response; backend = (await import('../dist/server/index.js?program=' + spec.id)).default;
    await page.locator('#script').fill(spec.script);
    if (spec.duration === 15) await page.locator('#duration').selectOption('15');
    else { await page.locator('#duration').selectOption('custom'); await page.locator('#duration-custom').fill(String(spec.duration)); await page.locator('#duration-custom').dispatchEvent('change'); }
    const before = providerCalls; await page.locator('#generate').click();
    await page.waitForFunction(() => !document.getElementById('generate').disabled);
    await page.waitForFunction(() => document.getElementById('canvas').dataset.action === 'scene-program3d', undefined, { timeout: 12000 }).catch(async (error) => {
      const message = await page.locator('#message').innerText().catch(() => 'message unavailable');
      const action = await page.locator('#canvas').getAttribute('data-action').catch(() => 'canvas unavailable');
      throw new Error('The programmed 3D scene was rejected before preview. UI message: ' + message + '; action: ' + action + '; JS errors: ' + JSON.stringify(errors) + '; original: ' + error);
    });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(providerCalls, before + 1); assert.equal(requests.at(-1).mode, 'program');
    assert.equal(Number(await page.locator('#timeline').getAttribute('max')), spec.duration);
    const project = await page.evaluate(() => JSON.parse(localStorage.getItem('crieseuvideo-lab-v1')));
    assert.equal(project.plan.scenes.map((s) => s.text).join(' '), spec.script);
    assert.ok(project.plan.sceneProgram); assert.equal(project.plan.production, undefined);
    const independentAudit = auditSceneActionDensity(project.plan.sceneProgram, productionSources(project.plan.scenes));
    await fs.writeFile(path.join(output, spec.id + '-action-audit.json'), JSON.stringify(independentAudit, null, 2));
    await fs.writeFile(path.join(output, spec.id + '.json'), JSON.stringify(project, null, 2));
    const samples = [];
    for (const aspect of ['9:16', '16:9']) {
      await page.locator(`[data-aspect="${aspect}"]`).click();
      for (const f of [.08, .34, .67, .98]) {
        const frame = await render(spec.duration * f); assert.equal(frame.action, 'scene-program3d'); assert.equal(frame.data.board, false);
        assert.ok(frame.data.maxContactError < .025); assert.ok(frame.data.projectedBounds.min[0] > -1 && frame.data.projectedBounds.max[0] < 1);
        const filename = `${spec.id}-${aspect.replace(':', 'x')}-${Math.round(f * 100)}.png`;
        await fs.writeFile(path.join(output, filename), Buffer.from(frame.png, 'base64')); samples.push({ aspect, phase: f, diagnostics: frame.data });
      }
      const at = spec.duration * .437, digest = (f) => createHash('sha256').update(f.png).digest('hex');
      const expected = digest(await render(at)); await render(spec.duration); await render(0);
      assert.equal(digest(await render(at)), expected, 'Random seeking changed the actual rendered frame.');
    }
    await page.locator('[data-aspect="9:16"]').click();
    const last = await render(spec.duration - 1 / 30); await fs.writeFile(path.join(output, spec.id + '-preview-last.png'), Buffer.from(last.png, 'base64'));
    const pending = page.waitForEvent('download', { timeout: 600000 });
    await page.locator('#download-video').click();
    const failure = page.waitForFunction(() => !document.getElementById('generate').disabled, undefined, { timeout: 600000 }).then(async () => { await page.waitForTimeout(300); throw new Error('Export ended without download: ' + await page.locator('#message').innerText()); });
    const download = await Promise.race([pending, failure]);
    const encoded = await page.locator('#canvas').evaluate((c) => JSON.parse(c.dataset.lastExport));
    assert.equal(encoded.frames, spec.duration * 30); assert.equal(encoded.duration, spec.duration); assert.equal(encoded.audio, false);
    const native = path.join(output, spec.id + '-native.' + encoded.extension); await download.saveAs(native);
    const final = path.join(output, spec.id + '.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', native, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', final]);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'format=duration:stream=codec_name,codec_type,width,height,nb_read_frames,pix_fmt', '-of', 'json', final], { encoding: 'utf8' }));
    const video = probe.streams.find((s) => s.codec_type === 'video'); assert.equal(Number(video.nb_read_frames), spec.duration * 30); assert.equal(video.codec_name, 'h264');
    assert.equal(video.width, 720); assert.equal(video.height, 1280); assert.ok(Math.abs(Number(probe.format.duration) - spec.duration) < .04);
    const lastDecoded = path.join(output, spec.id + '-export-last.png');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', final, '-vf', `select=eq(n\\,${encoded.frames - 1})`, '-frames:v', '1', lastDecoded]);
    const comparison = execFileSync('python3', ['-c', 'from PIL import Image; import numpy as np,sys; a=np.asarray(Image.open(sys.argv[1]).convert("RGB"),dtype=float); b=np.asarray(Image.open(sys.argv[2]).convert("RGB"),dtype=float); print(float(np.abs(a-b).mean()))', path.join(output, spec.id + '-preview-last.png'), lastDecoded], { encoding: 'utf8' });
    assert.ok(Number(comparison) < 8, 'The final exported frame differs from the preview.');
    await page.reload({ waitUntil: 'domcontentloaded' }); assert.equal(await page.locator('#canvas').isVisible(), false);
    await page.locator('#resume-project').click(); await page.waitForFunction(() => document.getElementById('canvas').dataset.action === 'scene-program3d');
    assert.equal((await render(spec.duration * .5)).data.board, false);
    if (spec.id === 'escalada-programa') {
      const saved = await page.evaluate(() => localStorage.getItem('crieseuvideo-lab-v1'));
      const previousPixels = (await render(spec.duration * .5)).png;
      fixture = JSON.parse(JSON.stringify(spec.response)); fixture.sceneProgram.contacts[0].offset[1] += 20;
      backend = (await import('../dist/server/index.js?program=unreachable-contact')).default;
      await page.locator('#generate').click(); await page.waitForFunction(() => !document.getElementById('generate').disabled);
      assert.match(await page.locator('#message').innerText(), /fora do alcance/);
      assert.equal(await page.evaluate(() => localStorage.getItem('crieseuvideo-lab-v1')), saved);
      assert.equal((await render(spec.duration * .5)).png, previousPixels);
      assert.match(await page.locator('#generate').innerText(), /Corrigir com Gemini/);
      fixture = spec.response; backend = (await import('../dist/server/index.js?program=explicit-contact-repair')).default;
      await page.locator('#generate').click(); await page.waitForFunction(() => !document.getElementById('generate').disabled);
      assert.ok(requests.at(-1).previousProgram); assert.match(requests.at(-1).repairIssue, /fora do alcance/);
      assert.match(await page.locator('#generate').innerText(), /Programar com Gemini/);
      assert.equal((await render(spec.duration * .5)).data.maxContactError < .025, true);
    }
    report.push({ id: spec.id, script: spec.script, developerAuthoredProgram: true, sourcePreserved: true, duration: spec.duration, independentActionFindings: independentAudit.findings, export: { codec: video.codec_name, width: video.width, height: video.height, frames: Number(video.nb_read_frames), silent: true, lastFrameMeanPixelError: Number(comparison) }, samples });
  }
  assert.equal(providerCalls, process.env.SCENE_PROGRAM_EXPERIMENT === 'crane' ? 1 : 5); assert.deepEqual(errors, []);
  if (process.env.SCENE_PROGRAM_EXPERIMENT !== 'crane') {
  const files = sceneProgramFixtures().map((s) => path.join(output, s.id + '.mp4'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap((file) => ['-i', file]), '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]', '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, 'programas-de-cena-42s.mp4')]);
  }
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ realProviderGenerationTested: false, developerAuthoredPrograms: true, interceptedProviderCalls: providerCalls, paidCalls: 0, browserErrors: errors, fixtures: report }, null, 2));
  console.log('PASS scene-program renderer/controller/mobile/native export. Developer-authored offline fixtures only; no real provider generation.');
} finally { globalThis.fetch = originalFetch; await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
