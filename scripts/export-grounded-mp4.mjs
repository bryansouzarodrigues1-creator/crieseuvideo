/** Offline frame export from the SAME Toon3D renderer as preview. No AI/TTS calls.
 * node lab/build.mjs && node scripts/export-grounded-mp4.mjs [--samples] [--aspect=9:16]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import worker from '../dist/server/index.js';
let browserModule;
try { browserModule = await import('playwright'); }
catch (error) {
  if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw error;
  browserModule = await import(pathToFileURL(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright/index.mjs')).href);
}
const samples = process.argv.includes('--samples');
const aspectArg = process.argv.find((x) => x.startsWith('--aspect='))?.split('=')[1];
const aspects = aspectArg ? [aspectArg] : ['9:16', '16:9'];
aspects.forEach((a) => assert.ok(['9:16', '16:9'].includes(a)));
const fps = 30, duration = 18;
const output = path.resolve('tmp/grounded-performance');
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const response = await worker.fetch(new Request(new URL(req.url || '/', 'http://127.0.0.1:' + server.address().port), {
      method: req.method, headers: req.headers,
    }), {});
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await browserModule.chromium.launch({
  headless: true,
  ...(process.env.CRIESEUVIDEO_CHROME ? { executablePath: process.env.CRIESEUVIDEO_CHROME } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const errors = [], aiCalls = [], reports = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (/\/api\/(ai|direct|gemini|narrate|transcribe|connect)\b/.test(url)) { aiCalls.push(url); return route.abort(); }
    if (!url.startsWith(origin + '/') && !url.startsWith('data:')) return route.abort();
    return route.continue();
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('#script').fill('Lia entra, caminha, agacha-se, pega a lanterna e entrega para Caio, que segura o objeto e sorri.');
  await page.locator('#local').click();
  await page.waitForFunction(() => document.getElementById('canvas').dataset.renderEngine === '3d');
  await page.evaluate(() => document.fonts.ready);
  assert.equal(Number(await page.locator('#timeline').getAttribute('max')), duration);
  assert.match(await page.locator('#fidelity').innerText(), /Todas as palavras preservadas/);
  const render = async (at) => {
    const base64 = await page.evaluate((time) => {
      const timeline = document.getElementById('timeline');
      timeline.value = String(time); timeline.dispatchEvent(new Event('input', { bubbles: true }));
      const canvas = document.getElementById('canvas');
      if (canvas.dataset.renderEngine !== '3d') throw new Error('A 2D fallback cannot be exported as 3D.');
      return canvas.toDataURL('image/png').split(',')[1];
    }, at);
    return Buffer.from(base64, 'base64');
  };
  for (const aspect of aspects) {
    await page.locator('[data-aspect="' + aspect + '"]').click();
    const label = aspect === '9:16' ? 'vertical' : 'horizontal';
    const folder = path.join(output, label); await fs.mkdir(folder, { recursive: true });
    const expected = createHash('sha256').update(await render(9.4)).digest('hex');
    await render(17.9); await render(.01);
    assert.equal(createHash('sha256').update(await render(9.4)).digest('hex'), expected, 'Seeking changed the rendered frame.');
    const times = samples ? [0, 1.8, 3.6, 4.6, 5.65, 6.8, 8.5, 10.8, 12.5, 13.64, 13.66, 15.5, 17.95] : Array.from({ length: fps * duration }, (_, i) => i / fps);
    for (let i = 0; i < times.length; i++) {
      const png = await render(times[i]);
      await fs.writeFile(path.join(folder, 'f' + String(i).padStart(5, '0') + '.png'), png);
      if (i % 60 === 0 || i === times.length - 1) console.log(JSON.stringify({ aspect, frame: i + 1, count: times.length, time: times[i] }));
    }
    if (samples) { await fs.writeFile(path.join(folder, 'sample-times.json'), JSON.stringify(times)); continue; }
    const audioPath = path.join(output, 'original-foley.wav');
    await fs.writeFile(audioPath, originalFoley());
    const filename = path.join(output, 'crieseuvideo-lia-caio-3d-' + label + '.mp4');
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', path.join(folder, 'f%05d.png'),
      '-i', audioPath, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', '-t', String(duration), '-metadata', 'title=CrieSeuVideo - Lia e Caio - Atuacao 3D', filename], { stdio: 'inherit', timeout: 180000 });
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,nb_read_frames,pix_fmt,r_frame_rate', '-of', 'json', filename], { encoding: 'utf8' }));
    const v = probe.streams.find((s) => s.codec_type === 'video'), a = probe.streams.find((s) => s.codec_type === 'audio');
    assert.equal(v.codec_name, 'h264'); assert.equal(v.pix_fmt, 'yuv420p'); assert.equal(a.codec_name, 'aac');
    assert.equal(Number(v.nb_read_frames), fps * duration);
    assert.equal(v.width, aspect === '9:16' ? 720 : 1280); assert.equal(v.height, aspect === '9:16' ? 1280 : 720);
    assert.ok(Math.abs(Number(probe.format.duration) - duration) < .04);
    execFileSync('ffmpeg', ['-v', 'error', '-i', filename, '-f', 'null', '-'], { stdio: 'inherit', timeout: 60000 });
    reports.push({ aspect, filename: path.basename(filename), ...probe, seekIdentical: true });
  }
  assert.deepEqual(aiCalls, []); assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, samples ? 'samples-report.json' : 'export-report.json'), JSON.stringify({ fps, duration, aiCalls, browserErrors: errors, reports }, null, 2));
  console.log('SUCCESS', samples ? 'samples' : 'MP4', output);
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }

function originalFoley() {
  const sampleRate = 24000, count = sampleRate * duration, wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8); wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  // Touchdown happens each .4m (half of the .8m gait cycle). Invert the
  // same smooth root curve so footsteps stay aligned while entering/stopping.
  const inverseSmooth = (amount) => {
    let a = 0, b = 1;
    for (let n = 0; n < 40; n++) { const m = (a + b) / 2; if (m * m * (3 - 2 * m) < amount) a = m; else b = m; }
    return (a + b) / 2;
  };
  const steps = [[.4, 3.8], [7.5, 11.2]].flatMap(([a, b]) => Array.from({ length: 6 }, (_, i) => a + (b - a) * inverseSmooth((i + 1) / 6)));
  const events = [...steps.map((at) => ({ at, hz: 115, len: .09, amp: .12 })), { at: 5.7, hz: 780, len: .25, amp: .07 }, { at: 13.65, hz: 960, len: .42, amp: .07 }];
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate; let value = 0;
    for (const e of events) { const q = (t - e.at) / e.len; if (q >= 0 && q < 1) value += e.amp * Math.sin(Math.PI * q) ** 2 * Math.sin(2 * Math.PI * e.hz * (t - e.at)) * Math.exp(-q * 2); }
    wav.writeInt16LE(Math.round(clampAudio(value) * 32767), 44 + i * 2);
  }
  return wav;
}
function clampAudio(x) { return Math.max(-1, Math.min(1, x)); }
