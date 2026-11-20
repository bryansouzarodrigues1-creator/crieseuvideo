import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('tmp/patrick-qa');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: [
  '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
] });
const errors = [];
const page = await browser.newPage({
  viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, acceptDownloads: true,
});
page.on('pageerror', e => errors.push(e.message));
let paidCalls = 0;
page.on('request', request => {
  if (/generativelanguage.googleapis.com|ai.gateway.lovable.dev/.test(request.url())) paidCalls++;
});
try {
  await page.goto('http://127.0.0.1:4198/patrick-lab', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('heading', { name: 'Patrick — personagem 3D articulado' }).waitFor({ timeout: 60000 });
  assert.equal(await page.locator('canvas').count(), 1);
  await page.getByRole('button', { name: 'Carregar personagem 3D' }).click();
  await page.getByRole('button', { name: 'Reproduzir' }).waitFor({ timeout: 60000 });
  const slider = page.getByRole('slider', { name: 'Controlar o tempo da cena 3D' });
  const canvas = page.locator('canvas');
  const png = () => canvas.evaluate(c => c.toDataURL('image/png'));
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    return canvas?.width === 360 && canvas?.height === 640 && canvas.toDataURL().length > 12000;
  }, null, { timeout: 60000 });
  assert.equal(await page.getByRole('alert').count(), 0);
  const first = await png();
  await canvas.screenshot({ path: path.join(out, '01-patrick-inicial.png') });
  await slider.fill('4.2');
  const contactFrame = await png();
  assert.notEqual(contactFrame, first, 'Pose remained unchanged after scrubbing to hand contact');
  await canvas.screenshot({ path: path.join(out, '02-patrick-contato-livro.png') });
  await slider.fill('6.8');
  const discovery = await png();
  assert.notEqual(discovery, contactFrame, 'The discovery reaction has no movement');
  await canvas.screenshot({ path: path.join(out, '03-patrick-descoberta.png') });
  await slider.fill('4.2');
  assert.equal(await png(), contactFrame, 'Arbitrary-time seek is not reproducible');
  await page.getByRole('button', { name: 'Reproduzir' }).click();
  await page.waitForFunction(() => Number(document.querySelector('input[type=range]')?.value) > 4.3,
    null, { timeout: 20000 });
  await page.getByRole('button', { name: 'Pausar' }).click();
  const event = page.waitForEvent('download', { timeout: 240000 });
  await page.getByRole('button', { name: /Exportar MP4/ }).click();
  const download = await event;
  const filename = download.suggestedFilename();
  assert.match(filename, /patrick-mentalista-piloto\.(mp4|webm)$/);
  await download.saveAs(path.join(out, filename));
  const bytes = await readFile(path.join(out, filename));
  assert.ok(bytes.length > 20000, 'Export contains no video data');
  if (filename.endsWith('.mp4')) assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
  else assert.equal(bytes.subarray(0, 4).toString('hex'), '1a45dfa3');
  if (filename.endsWith('.mp4')) {
    const stsz = bytes.indexOf(Buffer.from('stsz'));
    const mvhd = bytes.indexOf(Buffer.from('mvhd'));
    assert.ok(stsz > 0 && mvhd > 0, 'MP4 is missing its timing/sample tables');
    assert.equal(bytes.readUInt32BE(stsz + 12), 192, 'Missing 24fps frames in the 8-second clip');
  }
  assert.equal(paidCalls, 0, 'The authored pilot must not call a paid provider');
  assert.deepEqual(errors, []);
  await writeFile(path.join(out, 'report.json'), JSON.stringify({
    passed: true,
    rendered: ['initial', 'hand contact', 'discovery'],
    arbitraryTimeSeekReproduced: true,
    export: { filename, bytes: bytes.length, fps: 24, durationSeconds: 8 },
    paidCalls,
    disclaimer: 'QA validates authored rig/IK and media export, not autonomous Gemini generation or cinematic animation quality.',
  }, null, 2));
  console.log('PASS: Patrick rendered, changed gesture, deterministic seek, and exported a real video.');
} finally {
  await browser.close();
}
