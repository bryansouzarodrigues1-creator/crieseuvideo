/**
 * Opt-in smartphone demo: mobile WebGL smoke/visual regression QA.
 * No paid model calls, no authentication, no saved project changes.
 * Screenshots are retained in the existing unified-3d CI artifact.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:4198';
// Deterministic, locally generated 2-second WAV; no ElevenLabs credits or calls.
const generateTestWav = () => {
  const rate=48000, samples=rate*2, buffer=Buffer.alloc(44+samples*2);
  buffer.write('RIFF',0);buffer.writeUInt32LE(36+samples*2,4);
  buffer.write('WAVE',8);buffer.write('fmt ',12);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);
  buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);
  buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);
  buffer.writeUInt16LE(16,34);buffer.write('data',36);
  buffer.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++)
    buffer.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/rate)*3000),44+i*2);
  return buffer;
};
const out = path.resolve('tmp/unified-3d-qa');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader']
});
const errors = [];
let providerRequests = 0;
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/ai.gateway.lovable.dev|generativelanguage.googleapis.com/.test(request.url())) providerRequests++;
  });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const testButton = page.getByRole('button', { name: /Testar montagem de celular \(12s, sem IA\)/ });
  await testButton.waitFor({ timeout: 60000 });
  assert.equal(await page.locator('canvas[aria-label="Prévia da montagem 3D de celular"]').count(), 0);
  assert.equal(providerRequests, 0, 'The demo must not trigger AI billing');
  await testButton.click();
  const stage = page.locator('canvas[aria-label="Prévia da montagem 3D de celular"]');
  await stage.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.native-3d-error').count(), 0, 'Stage failed to render');
  assert.equal(await page.getByText('Demonstração offline (sem IA)').count(), 1);
  assert.equal(providerRequests, 0, 'The opt-in demo must remain offline');

  const slider = page.getByRole('slider', { name: 'Linha do tempo do 3D avançado' });
  const seek = async (seconds) => {
    await slider.evaluate((element, target) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) throw new Error('Range value setter not found');
      setter.call(element, String(target));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, seconds);
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.native-3d-error').count(), 0, 'Stage failed after seek to ' + seconds);
  };

  const hashes = [];
  for (const [seconds, label] of [[0, 'initial'], [3.8, 'battery-installed'], [7.9, 'cpu-camera-installed'], [11.8, 'display-installed']]) {
    await seek(seconds);
    const bytes = await stage.screenshot({ path: path.join(out, 'phone-' + label + '.png') });
    hashes.push(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.ok(new Set(hashes).size >= 2, 'All four rendered frames were identical');
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 4);
  assert.equal(noOverflow, true, 'Mobile layout has horizontal overflow');
  assert.equal(providerRequests, 0, 'No paid provider calls during scrubbing');
  // Narration track should be embedded into the fixed-frame output, not just
  // played aloud in the preview. A 2s WAV keeps browser CI lightweight.
  const audioInput=page.locator('input[aria-label="Carregar narração no 3D avançado"]');
  await audioInput.setInputFiles({
    name:'qa-narration.wav',mimeType:'audio/wav',buffer:generateTestWav()
  });
  await page.getByText(/Narração pronta:/).waitFor({timeout:30000});
  assert.equal(providerRequests,0,'Uploading narration must not call a model');
  const downloadPromise=page.waitForEvent('download',{timeout:180000});
  await page.getByRole('button',{name:/Baixar cena 3D/}).click();
  const download=await downloadPromise;
  const downloaded=await readFile(await download.path());
  assert.ok(downloaded.length>3000,'Encoded video is empty');
  const {Input,BlobSource,ALL_FORMATS}=await import('mediabunny');
  const input=new Input({source:new BlobSource(new Blob([downloaded])),formats:ALL_FORMATS});
  const audioTrack=await input.getPrimaryAudioTrack();
  assert.ok(audioTrack,'Narration audio track missing from exported MP4/WebM');
  const videoTrack=await input.getPrimaryVideoTrack();
  assert.ok(videoTrack,'Video track missing from export');
  assert.equal(await videoTrack.getDisplayWidth(),720,'Export must be 720px wide');
  assert.equal(await videoTrack.getDisplayHeight(),1280,'Export must be 1280px tall');
  assert.equal(providerRequests,0,'Export must not call a paid provider');
  assert.deepEqual(errors, [], 'Unhandled errors in browser');

  await writeFile(path.join(out, 'smartphone-demo-report.json'), JSON.stringify({
    passed: true, providerRequests, hashes,
    checkpoints: [0, 3.8, 7.9, 11.8],
    audioExportBytes:downloaded.length, audioEmbedded:!!audioTrack,
    caveat: 'Automated WebGL/render/audio mux smoke; human assessment of visual quality is still required.',
  }, null, 2));
  console.log('PASS: smartphone WebGL assembly, audio track embedded in fixed-frame export, zero AI billing');
} finally {
  await browser.close();
}
