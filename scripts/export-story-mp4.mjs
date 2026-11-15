/**
 * Fully offline (no Gemini/TTS) true-frame MP4 showcase.
 * Renders deterministic Toon3D and Motion2D frames from the real lab canvas
 * at 24 fps, encodes H.264/AAC and verifies the resulting MP4 with ffprobe.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import worker from '../dist/server/index.js';

const fps = 24, modes = ['3d', '2d'];
const output = path.resolve('tmp/story-video-output');
const frames = path.join(output, 'frames');
await fs.mkdir(frames, { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const response = await worker.fetch(new Request(new URL(req.url || '/', base), {
      method: req.method, headers: req.headers,
    }), { GEMINI_API_KEY: undefined });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
let page, frameId = 0, segmentDuration = 0;
const browserErrors = [], aiCalls = [];
try {
  page = await browser.newPage({ viewport: { width: 1365, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('request', (req) => {
    if (/\/api\/(ai|gemini|narrate|transcribe)\b/i.test(req.url())) aiCalls.push(req.url());
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#script').fill('Lia entra, caminha, agacha-se, pega a lanterna e entrega para Caio, que segura o objeto e sorri.');
  await page.locator('#local').click();
  assert.match(await page.locator('#fidelity').innerText(), /Todas as palavras preservadas/);
  segmentDuration = Number(await page.locator('#timeline').getAttribute('max'));
  assert.ok(Number.isFinite(segmentDuration) && segmentDuration > 2 && segmentDuration < 30, 'Invalid demo scene duration');
  const count = Math.ceil(segmentDuration * fps);
  console.log('Timeline:', segmentDuration.toFixed(2), 's per engine;', count, 'frames each');
  for (const mode of modes) {
    await page.locator('[data-engine="' + mode + '"]').click();
    if (mode === '3d') {
      await page.waitForTimeout(2600);
      assert.match(await page.locator('[data-engine="3d"]').getAttribute('class') || '', /selected/, 'Toon3D WebGL unavailable');
    } else {
      await page.waitForTimeout(250);
    }
    for (let i = 0; i < count; i++) {
      const time = (i + .5) / fps;
      const png64 = await page.evaluate(({ at, mode }) => {
        const timeline = document.getElementById('timeline');
        const canvas = document.getElementById('canvas');
        timeline.value = String(at);
        timeline.dispatchEvent(new Event('input', { bubbles: true }));
        const ctx = canvas.getContext('2d');
        const text = mode === '3d' ? 'TOON 3D' : 'MOTION 2D';
        ctx.save();
        ctx.fillStyle = 'rgba(20,29,45,.78)';
        ctx.beginPath(); ctx.roundRect(22, 22, 183, 55, 17); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 23px sans-serif';
        ctx.fillText(text, 40, 50);
        ctx.restore();
        return canvas.toDataURL('image/png').slice('data:image/png;base64,'.length);
      }, { at: Math.min(time, segmentDuration - 0.001), mode });
      await fs.writeFile(path.join(frames, 'f' + String(frameId++).padStart(5, '0') + '.png'), Buffer.from(png64, 'base64'));
      if (i % 24 === 0) console.log('Rendered', mode, i + 1, '/', count);
    }
  }
  assert.equal(aiCalls.length, 0, 'AI or TTS requests must never run for this demo');
  assert.deepEqual(browserErrors, [], 'Browser had JS errors');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

// Simple original and copyright-free cartoon effects, not a generated narration.
// 24-kHz mono signed-16 WAV, encoded as AAC in the MP4.
const videoDuration = frameId / fps, sampleRate = 24000;
const events = [];
for (const offset of [0, Math.ceil(segmentDuration * fps) / fps]) {
  events.push(
    { at: offset + segmentDuration * .23, freq: 290, length: .30, amp: .16 },
    { at: offset + segmentDuration * .50, freq: 530, length: .20, amp: .12 },
    { at: offset + segmentDuration * .61, freq: 760, length: .47, amp: .17 },
    { at: offset + segmentDuration * .86, freq: 390, length: .28, amp: .10 },
  );
}
const countAudio = Math.round(videoDuration * sampleRate);
const wav = Buffer.allocUnsafe(44 + countAudio * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36);
wav.writeUInt32LE(countAudio * 2, 40);
for (let i = 0; i < countAudio; i++) {
  const t = i / sampleRate;
  let value = 0;
  for (const e of events) {
    const q = (t - e.at) / e.length;
    if (q < 0 || q >= 1) continue;
    const env = Math.sin(Math.PI * q) ** 2;
    const phase = 2 * Math.PI * e.freq * ((t - e.at) + (t - e.at) ** 2 * .5);
    value += e.amp * env * (Math.sin(phase) * .75 + Math.sin(phase * 2) * .25);
  }
  wav.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(value * 32767))), 44 + i * 2);
}
const wavPath = path.join(output, 'foley-original.wav');
await fs.writeFile(wavPath, wav);
const filename = 'crieseuvideo-lia-caio-2d-3d.mp4';
const mp4 = path.join(output, filename);
console.log('Encoding original canvas frames to MP4...');
execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-framerate', String(fps), '-i', path.join(frames, 'f%05d.png'),
  '-i', wavPath, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k',
  '-movflags', '+faststart', '-shortest', '-metadata',
  'title=CrieSeuVideo - Lia e Caio - 3D e 2D',
  mp4,
], { stdio: 'inherit', timeout: 240000 });

const probe = JSON.parse(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries',
  'format=duration,size:stream=codec_type,codec_name,width,height',
  '-of', 'json', mp4,
], { encoding: 'utf8' }));
const video = probe.streams.find((s) => s.codec_type === 'video');
const audio = probe.streams.find((s) => s.codec_type === 'audio');
assert.equal(video?.codec_name, 'h264');
assert.equal(audio?.codec_name, 'aac');
assert.equal(video?.width, 720);
assert.equal(video?.height, 1280);
assert.ok(Number(probe.format.duration) >= videoDuration - .15);
assert.ok(Number(probe.format.size) > 120000);
console.log('SUCCESS', filename, JSON.stringify({
  frames: frameId, seconds: Number(probe.format.duration),
  codec: video.codec_name, audio: audio.codec_name,
  width: video.width, height: video.height,
  bytes: Number(probe.format.size),
}));
