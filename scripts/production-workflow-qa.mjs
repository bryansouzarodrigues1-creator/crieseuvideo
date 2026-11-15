/** Ordinary creation UI, composable assets, physical contacts and random seeking. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import worker from '../dist/server/index.js';

const specs = JSON.parse(await fs.readFile('scripts/production-cases.json', 'utf8'));
const full = process.argv.includes('--full'), output = 'tmp/production-qa';
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  try {
    const response = await worker.fetch(new Request(new URL(req.url || '/', `http://127.0.0.1:${server.address().port}`), { method: req.method, headers: req.headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) }), {});
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('QA server failure.'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [], paidCalls = [], reports = [];
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (/\/api\/(direct|connect|ai|narrate|transcribe)/.test(url)) { paidCalls.push(url); return route.abort(); }
    return url.startsWith(origin + '/') ? route.continue() : route.abort();
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-engine="3d"]').click();
  await page.waitForFunction(() => document.getElementById('canvas').dataset.renderEngine === '3d');
  const render = async (time) => page.evaluate((at) => {
    const timeline = document.getElementById('timeline'); timeline.value = String(at); timeline.dispatchEvent(new Event('input', { bubbles: true }));
    const canvas = document.getElementById('canvas');
    return { png: canvas.toDataURL('image/png').split(',')[1], engine: canvas.dataset.renderEngine, action: canvas.dataset.action, data: JSON.parse(canvas.dataset.production || 'null') };
  }, time);
  for (const spec of specs) {
    await page.locator('#script').fill(spec.script);
    if ([15, 30, 60, 90].includes(spec.seconds)) await page.locator('#duration').selectOption(String(spec.seconds));
    else { await page.locator('#duration').selectOption('custom'); await page.locator('#duration-custom').fill(String(spec.seconds)); await page.locator('#duration-custom').dispatchEvent('change'); }
    await page.locator(`[data-aspect="${spec.aspect}"]`).click(); await page.locator('#local').click();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(Number(await page.locator('#timeline').getAttribute('max')), spec.seconds);
    assert.match(await page.locator('#fidelity').innerText(), /Todas as palavras preservadas/);
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('crieseuvideo-lab-v1')));
    await fs.writeFile(path.join(output, spec.id + '.plan.json'), JSON.stringify({ script: spec.script, plan: stored.plan }, null, 2));
    assert.ok(stored.plan.production); assert.deepEqual(stored.plan.production.assets.map((a) => a.kind), spec.kinds);
    if (full) {
      const voice = path.resolve('tmp/production-voice', spec.id + '.narration.json');
      await page.locator(spec.id === 'guindaste-40s' ? '#project-file' : '#narration-file').setInputFiles(voice);
      await page.waitForFunction(() => !document.getElementById('generate').disabled);
      assert.match(await page.locator('#narration-info').innerText(), /Narração importada/);
    }
    const actualSeconds = Number(await page.locator('#timeline').getAttribute('max'));
    const scenes = await page.locator('.scene-card').evaluateAll((cards) => cards.map((c) => ({ start: Number(c.dataset.start), duration: Number(c.dataset.duration) })));
    const snapshots = [];
    for (let i = 0; i < scenes.length; i++) for (const fraction of [.12, .60, .94]) {
      const at = scenes[i].start + scenes[i].duration * fraction, r = await render(at);
      assert.equal(r.engine, '3d'); assert.equal(r.action, 'production3d'); assert.equal(r.data.board, false); assert.ok(r.data.maxContactError < .001);
      const filename = `${spec.id}-s${i + 1}-${Math.round(fraction * 100)}.png`;
      await fs.writeFile(path.join(output, filename), Buffer.from(r.png, 'base64'));
      snapshots.push({ at, filename, ...r.data });
    }
    const t = actualSeconds * .437, digest = (r) => createHash('sha256').update(r.png).digest('hex');
    const expected = digest(await render(t)); await render(actualSeconds - .01); await render(.01);
    assert.equal(digest(await render(t)), expected, 'Seeking changed the exact rendered frame.');
    const exportThis = full && ['guindaste-40s', 'atuacao-jogador-15s', 'elevador-30s'].includes(spec.id) || !full && spec.id === 'guindaste-40s';
    if (exportThis) {
      if (full) {
        const downloadPromise = page.waitForEvent('download', { timeout: 900000 });
        await page.locator('#download-video').click();
        const download = await downloadPromise;
        await page.waitForFunction(() => !document.getElementById('generate').disabled, undefined, { timeout: 900000 });
        const encoded = JSON.parse(await page.locator('#canvas').getAttribute('data-last-export'));
        assert.equal(encoded.frames, Math.ceil(actualSeconds * 30 - 1e-8)); assert.equal(encoded.audio, true);
        const native = path.join(output, `native-${spec.id}.${encoded.extension}`); await download.saveAs(native);
        const filename = path.join(output, `crieseuvideo-${spec.id}.mp4`);
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', native, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-t', String(encoded.duration), filename], { stdio: 'inherit' });
        const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,nb_read_frames,pix_fmt', '-of', 'json', filename], { encoding: 'utf8' }));
        const video = probe.streams.find((s) => s.codec_type === 'video');
        assert.equal(Number(video.nb_read_frames), encoded.frames); assert.ok(probe.streams.some((s) => s.codec_type === 'audio'));
        execFileSync('ffmpeg', ['-v', 'error', '-i', filename, '-f', 'null', '-'], { stdio: 'inherit' });
        reports.push({ ...spec, ordinaryInput: true, specialDemoClicked: false, actualSeconds, importedNarration: true, nativeExport: encoded, probe, scenes, snapshots, seekIdentical: true });
        continue;
      }
      const seconds = full ? spec.seconds : 5, folder = path.join(output, spec.id + (full ? '-full' : '-preview'));
      await fs.mkdir(folder, { recursive: true });
      if (!full) await page.locator('#canvas').evaluate((canvas) => { canvas.width = 360; canvas.height = 640; });
      for (let n = 0; n < seconds * 30; n++) {
        const r = await render(n / 30); await fs.writeFile(path.join(folder, `f${String(n).padStart(5, '0')}.png`), Buffer.from(r.png, 'base64'));
        if (n % 120 === 0) console.log(JSON.stringify({ spec: spec.id, frame: n, frames: seconds * 30 }));
      }
      const name = full ? `crieseuvideo-${spec.id}.mp4` : 'production-preview-5s.mp4';
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', path.join(folder, 'f%05d.png'), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', String(seconds), path.join(output, name)], { stdio: 'inherit' });
      execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(output, name), '-f', 'null', '-'], { stdio: 'inherit' });
    }
    reports.push({ ...spec, ordinaryInput: true, specialDemoClicked: false, seekIdentical: true, scenes, snapshots });
  }
  if (!full) {
    await page.locator('#script').fill('O guindaste ergue uma carga.');
    await page.locator('#duration').selectOption('custom'); await page.locator('#duration-custom').fill('5'); await page.locator('#duration-custom').dispatchEvent('change');
    await page.locator('[data-aspect="9:16"]').click(); await page.locator('#local').click();
    await page.locator('#canvas').evaluate((canvas) => { canvas.width = 360; canvas.height = 640; });
    const pending = page.waitForEvent('download', { timeout: 180000 }); await page.locator('#download-video').click();
    const download = await pending; await page.waitForFunction(() => !document.getElementById('generate').disabled);
    const encoded = JSON.parse(await page.locator('#canvas').getAttribute('data-last-export'));
    assert.equal(encoded.frames, 150); assert.equal(encoded.duration, 5);
    const filename = path.join(output, 'native-5s.' + encoded.extension); await download.saveAs(filename);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=nb_read_frames,codec_type', '-of', 'json', filename], { encoding: 'utf8' }));
    assert.equal(Number(probe.streams.find((s) => s.codec_type === 'video').nb_read_frames), 150);
    reports.push({ nativeExportSmoke: encoded, ordinaryDownloadButton: true });
  }
  assert.deepEqual(errors, []); assert.deepEqual(paidCalls, []);
  await fs.writeFile(path.join(output, full ? 'full-report.json' : 'samples-report.json'), JSON.stringify({ mode: full ? 'full' : 'samples', realAiDirectionTested: false, paidCalls, browserErrors: errors, reports }, null, 2));
  console.log('PASS composable production: ordinary scripts, persistent assets, contacts, alternative mechanisms and deterministic seeks.');
} finally { await browser?.close(); await new Promise((r) => server.close(r)); }
