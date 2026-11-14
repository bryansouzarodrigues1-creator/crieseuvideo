/** Ordinary input flow, not the special demo. --samples first; --full exports MP4. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import worker from '../dist/server/index.js';
let pw;
try { pw = await import('playwright'); }
catch (e) { if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw e; pw = await import(pathToFileURL(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright/index.mjs')).href); }
const full = process.argv.includes('--full'), fps = 30;
const output = path.resolve('tmp/normal-workflow'); await fs.mkdir(output, { recursive: true });
const cases = [
  { id: 'fluxo-normal-60s', aspect: '9:16', seconds: 60, text: 'Ele recebeu uma mensagem no celular. A novidade fez o coração disparar. Ele correu pela rua para contar aos amigos. No escritório, o gráfico subia sem parar. Mas uma pergunta mudou tudo: e agora?', actions: ['phone', 'heartbeat', 'run', 'growth', 'question'] },
  { id: 'metafora-30s', aspect: '16:9', seconds: 30, text: 'Esse foi o maior esquema de corrupção.', actions: ['money_flow'] },
];
const server = http.createServer(async (req, res) => {
  try {
    const response = await worker.fetch(new Request(new URL(req.url || '/', 'http://127.0.0.1:' + server.address().port), { method: req.method, headers: req.headers }), {});
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await pw.chromium.launch({ headless: true, ...(process.env.CRIESEUVIDEO_CHROME ? { executablePath: process.env.CRIESEUVIDEO_CHROME } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], aiCalls = [], reports = [];
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (/\/api\/(direct|ai|narrate|transcribe|connect)\b/.test(u)) { aiCalls.push(u); return route.abort(); }
    return u.startsWith(origin + '/') || u.startsWith('data:') ? route.continue() : route.abort();
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-engine="3d"]').click();
  await page.waitForFunction(() => document.getElementById('canvas').dataset.renderEngine === '3d');
  await page.evaluate(() => document.fonts.ready);
  for (const seconds of [15, 30, 60, 90]) {
    await page.locator('#duration').selectOption(String(seconds));
    assert.ok(Math.abs(Number(await page.locator('#timeline').getAttribute('max')) - seconds) < .001);
  }
  await page.locator('#duration').selectOption('custom');
  await page.locator('#duration-custom').fill('47'); await page.locator('#duration-custom').dispatchEvent('change');
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#duration').inputValue(), 'custom');
  assert.equal(await page.locator('#duration-custom').inputValue(), '47');
  assert.ok(Math.abs(Number(await page.locator('#timeline').getAttribute('max')) - 47) < .001);
  await page.screenshot({ path: path.join(output, 'mobile-duration-control.png'), fullPage: true });
  for (const spec of cases) {
    await page.locator('#script').fill(spec.text); await page.locator('#duration').selectOption(String(spec.seconds));
    await page.locator('[data-aspect="' + spec.aspect + '"]').click(); await page.locator('#local').click();
    await page.waitForFunction(() => document.getElementById('canvas').dataset.renderEngine === '3d');
    assert.equal(Number(await page.locator('#timeline').getAttribute('max')), spec.seconds);
    assert.equal(Number(await page.locator('#timeline').inputValue()), 0);
    assert.match(await page.locator('#fidelity').innerText(), /Todas as palavras preservadas/);
    const scenes = await page.locator('.scene-card').evaluateAll((cards) => cards.map((c) => ({ start: Number(c.dataset.start), duration: Number(c.dataset.duration), text: c.querySelector('p').textContent })));
    assert.equal(scenes.length, spec.actions.length); assert.equal(scenes.map((s) => s.text).join(' '), spec.text);
    const folder = path.join(output, spec.id); await fs.mkdir(folder, { recursive: true });
    const render = async (time) => {
      const r = await page.evaluate((t) => {
        const s = document.getElementById('timeline'); s.value = String(t); s.dispatchEvent(new Event('input', { bubbles: true }));
        const c = document.getElementById('canvas'); if (c.dataset.renderEngine !== '3d') throw new Error('Normal workflow fell back to 2D.');
        return { png: c.toDataURL('image/png').split(',')[1], action: c.dataset.action, error: Number(c.dataset.contactError) };
      }, time);
      return { png: Buffer.from(r.png, 'base64'), action: r.action, error: r.error };
    };
    for (let i = 0; i < scenes.length; i++) for (const f of [.12, .40, .77]) {
      const r = await render(scenes[i].start + scenes[i].duration * f);
      assert.equal(r.action, spec.actions[i]); assert.ok(r.error < .001, r.action + ': unreachable hand');
      await fs.writeFile(path.join(output, spec.id + '-' + i + '-' + f + '.png'), r.png);
    }
    const time = spec.seconds * .41, hash = (b) => createHash('sha256').update(b).digest('hex');
    const expected = hash((await render(time)).png); await render(spec.seconds - .01); await render(.01);
    assert.equal(hash((await render(time)).png), expected, 'Normal scene is not deterministic after seeking');
    if (!full) { reports.push({ ...spec, scenes, seekIdentical: true }); continue; }
    for (let i = 0; i < spec.seconds * fps; i++) {
      await fs.writeFile(path.join(folder, 'f' + String(i).padStart(5, '0') + '.png'), (await render(i / fps)).png);
      if (i % 120 === 0) console.log(JSON.stringify({ case: spec.id, frame: i, total: spec.seconds * fps }));
    }
    // No narration is synthesized. Original soft effects mark the scene beats.
    const wav = path.join(folder, 'effects.wav'); await fs.writeFile(wav, effects(spec.seconds, scenes));
    const filename = path.join(output, 'crieseuvideo-' + spec.id + '.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps), '-i', path.join(folder, 'f%05d.png'), '-i', wav, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-t', String(spec.seconds), filename], { stdio: 'inherit', timeout: 180000 });
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,pix_fmt,nb_read_frames', '-of', 'json', filename], { encoding: 'utf8' }));
    const video = probe.streams.find((s) => s.codec_type === 'video'); assert.equal(video.codec_name, 'h264'); assert.equal(video.pix_fmt, 'yuv420p'); assert.equal(Number(video.nb_read_frames), fps * spec.seconds);
    assert.ok(Math.abs(Number(probe.format.duration) - spec.seconds) < .04);
    execFileSync('ffmpeg', ['-v', 'error', '-i', filename, '-f', 'null', '-'], { stdio: 'inherit', timeout: 60000 });
    reports.push({ ...spec, scenes, filename: path.basename(filename), probe, seekIdentical: true });
  }
  assert.deepEqual(errors, []); assert.deepEqual(aiCalls, []);
  await fs.writeFile(path.join(output, full ? 'export-report.json' : 'samples-report.json'), JSON.stringify({ ordinaryInput: true, specialDemoClicked: false, fps, errors, aiCalls, reports }, null, 2));
  console.log('PASS ordinary input, source actions, user duration and deterministic export; no AI calls');
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }

function effects(seconds, scenes) {
  const rate = 24000, count = rate * seconds, b = Buffer.alloc(44 + count * 2);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) { const t = i / rate; let value = 0;
    for (let k = 0; k < scenes.length; k++) { const q = (t - scenes[k].start - .6) / .2; if (q >= 0 && q < 1) value += .06 * Math.sin(Math.PI * q) ** 2 * Math.sin(2 * Math.PI * (k ? 380 : 760) * t); }
    b.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return b;
}
