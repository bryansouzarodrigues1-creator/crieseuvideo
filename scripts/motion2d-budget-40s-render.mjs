import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const out = 'tmp/motion2d-budget-40s';
await mkdir(out, { recursive: true });
const js = await readFile(out + '/harness.js');
const server = createServer((req,res) => {
  if (req.url?.split('?')[0] === '/harness.js') {
    res.writeHead(200, {'Content-Type':'application/javascript; charset=utf-8'});
    res.end(js);
    return;
  }
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
  res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>CrieSeuVideo — Motion 2D real</title>
    <style>body{margin:0;background:#141821;display:grid;place-items:center;min-height:100vh}
    canvas{width:360px;height:640px}</style></head>
    <body><canvas id="screen" width="720" height="1280"></canvas>
    <script type="module" src="/harness.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(4208,'127.0.0.1',resolve));
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
let page;
const report = { kind:'real Motion 2D original renderer, authored scene input, synthetic narrator', noAIGeneration:true, time: new Date().toISOString(), renderedParts:[], errors:[], providerRequests:0 };
try {
  page = await browser.newPage({ viewport: {width:820,height:850}, acceptDownloads:true });
  page.setDefaultTimeout(900000);
  page.on('pageerror', e => report.errors.push('page: '+e.message));
  page.on('request', request => {
    if (/generativelanguage.googleapis.com|ai.gateway.lovable.dev|elevenlabs.io/i.test(request.url())) report.providerRequests++;
  });
  const response = await page.goto('http://127.0.0.1:4208/',{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  await page.waitForFunction(() => document.body.dataset.ready==='true',{timeout:60000});
  const info = await page.evaluate(() => window.motion2d.info);
  assert.equal(info.engine,'Motion 2D');
  assert.equal(info.duration,40);
  assert.equal(info.scenes,8);
  report.source = info.source;
  for (const t of [0.5,2.5,5.7,11.2,16.7,21.3,26.5,31.6,36.5,39.5]) {
    const png = await page.evaluate(t => window.motion2d.frame(t),t);
    await writeFile(`${out}/frame-${t.toFixed(1)}.png`,Buffer.from(png,'base64'));
  }
  const first = await page.evaluate(() => window.motion2d.frame(12.5));
  await page.evaluate(() => window.motion2d.frame(34));
  const again = await page.evaluate(() => window.motion2d.frame(12.5));
  report.sameTimestampPngEqual = first === again;
  for (const start of [0,20]) {
    console.log('EXPORT_START '+start);
    const pending = page.waitForEvent('download',{timeout:900000});
    const encoded = await page.evaluate(start => window.motion2d.exportPart(start),start);
    const download = await pending;
    assert.equal(encoded.frames,600);
    const filename = `${out}/motion2d-native-${String(start).padStart(2,'0')}s.mp4`;
    await download.saveAs(filename);
    const probe = JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames,r_frame_rate','-of','json',filename],{encoding:'utf8'}));
    assert.equal(Number(probe.streams[0].nb_frames),600,'Each native segment must contain 600 frames');
    assert.equal(probe.streams[0].width,720);
    assert.equal(probe.streams[0].height,1280);
    report.renderedParts.push({ start, frames:encoded.frames, filename, probe:probe.streams[0] });
    console.log('EXPORT_DONE '+start);
  }
  assert.equal(report.providerRequests,0);
  assert.deepEqual(report.errors,[]);
  assert.equal(report.sameTimestampPngEqual,true,'Fixed-time rendering must be replayable');
  report.completed=true;
} catch(e) {
  report.completed=false;
  report.failure=String(e.stack||e);
  await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});
  throw e;
} finally {
  await writeFile(out+'/render-report.json',JSON.stringify(report,null,2));
  await page?.close().catch(()=>{});
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
