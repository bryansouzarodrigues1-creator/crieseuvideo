/** Rasterize a captured REAL Gemini response. This job makes no inference calls.
 * The capture is replayed only at the browser HTTP boundary so the ordinary
 * creation/validation/export UI handles the exact server-normalized program. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import worker from '../dist/server/index.js';

const project = JSON.parse(await fs.readFile('scripts/live/everest-attempt-3.project.json', 'utf8'));
const capture = JSON.parse(await fs.readFile('scripts/live/everest-capture.json', 'utf8'));
const output = path.resolve('tmp/live-gemini-render'); await fs.mkdir(output, { recursive: true });
const errors = [], requests = [], unauthorized = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => { unauthorized.push(String(url)); throw new Error('Network inference is prohibited during captured rendering.'); };
const server = http.createServer(async (req, res) => {
  try { const response = await worker.fetch(new Request(new URL(req.url || '/', `http://127.0.0.1:${server.address().port}`), { method: req.method, headers: req.headers }), {}); res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); }
  catch { res.writeHead(500); res.end('Render server failure.'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const digest = (s) => createHash('sha256').update(s).digest('hex');
let browser;
try {
  const shipped = await fs.readFile('dist/server/index.js','utf8'); assert.ok(!shipped.includes('mountain_group'), 'Captured story was accidentally shipped as an app preset.');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const req = route.request(); if (!req.url().startsWith(origin + '/')) return route.abort();
    if (req.url() === origin + '/api/direct') {
      const body=req.postDataJSON();requests.push(body);assert.equal(body.script,project.script);assert.equal(body.mode,'program');assert.equal(body.targetDuration,15);
      return route.fulfill({ status:200,contentType:'application/json',body:JSON.stringify({ok:true,provider:capture.provider,model:capture.model,source:'ai',plan:project.plan}) });
    }
    return route.continue();
  });
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#canvas').isVisible(),false);
  await page.locator('#script').fill(project.script);await page.locator('#duration').selectOption('15');await page.locator('#direction-mode').selectOption('program');
  await page.locator('#generate').click();await page.waitForFunction(()=>!document.getElementById('generate').disabled);
  await page.waitForFunction(()=>document.getElementById('canvas').dataset.action==='scene-program3d');
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(requests.length,1);
  const applied=await page.evaluate(()=>JSON.parse(localStorage.getItem('crieseuvideo-lab-v1')));
  assert.equal(applied.plan.scenes.map(s=>s.text).join(' '),project.script);
  assert.equal(digest(JSON.stringify(applied.plan.sceneProgram)),capture.programHash,'The captured model program was changed in the UI.');
  const render=async(time)=>page.evaluate((at)=>{
    const timeline=document.getElementById('timeline');timeline.value=String(at);timeline.dispatchEvent(new Event('input',{bubbles:true}));
    const c=document.getElementById('canvas');return{png:c.toDataURL('image/png').split(',')[1],data:JSON.parse(c.dataset.production||'null'),action:c.dataset.action};
  },time);
  const samples=[];
  for(const aspect of ['9:16','16:9']){
    await page.locator(`[data-aspect="${aspect}"]`).click();
    for(const at of [.1,2.5,5,7.5,10,12.5,14.9667]){
      const f=await render(at);assert.equal(f.action,'scene-program3d');assert.equal(f.data.board,false);assert.ok(f.data.maxIKError<.025);
      const file=`everest-${aspect.replace(':','x')}-${String(at).replace('.','-')}.png`;await fs.writeFile(path.join(output,file),Buffer.from(f.png,'base64'));samples.push({aspect,time:at,diagnostics:f.data});
    }
    const expected=digest((await render(6.321)).png);await render(15);await render(0);assert.equal(digest((await render(6.321)).png),expected);
  }
  await page.locator('[data-aspect="9:16"]').click();
  await fs.writeFile(path.join(output,'preview-last.png'),Buffer.from((await render(15-1/30)).png,'base64'));
  const pending=page.waitForEvent('download',{timeout:600000});await page.locator('#download-video').click();
  const failed=page.waitForFunction(()=>!document.getElementById('generate').disabled,undefined,{timeout:600000}).then(async()=>{await page.waitForTimeout(300);throw new Error('No export: '+await page.locator('#message').innerText());});
  const download=await Promise.race([pending,failed]);const encoded=await page.locator('#canvas').evaluate(c=>JSON.parse(c.dataset.lastExport));
  assert.equal(encoded.frames,450);assert.equal(encoded.duration,15);assert.equal(encoded.audio,false);
  const native=path.join(output,'everest-gemini-native.'+encoded.extension);await download.saveAs(native);
  const final=path.join(output,'crieseuvideo-everest-gemini-real-15s.mp4');
  execFileSync('ffmpeg',['-v','error','-y','-i',native,'-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',final]);
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','format=duration:stream=codec_name,codec_type,width,height,nb_read_frames,pix_fmt','-of','json',final],{encoding:'utf8'}));
  const video=probe.streams.find(s=>s.codec_type==='video');assert.equal(Number(video.nb_read_frames),450);assert.equal(video.codec_name,'h264');assert.equal(video.width,720);assert.equal(video.height,1280);
  const last=path.join(output,'export-last.png');execFileSync('ffmpeg',['-v','error','-y','-i',final,'-vf','select=eq(n\\,449)','-frames:v','1',last]);
  const pixelError=Number(execFileSync('python3',['-c','from PIL import Image;import numpy as np,sys;a=np.asarray(Image.open(sys.argv[1]).convert("RGB"),dtype=float);b=np.asarray(Image.open(sys.argv[2]).convert("RGB"),dtype=float);print(float(np.abs(a-b).mean()))',path.join(output,'preview-last.png'),last],{encoding:'utf8'}));assert.ok(pixelError<8);
  await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.locator('#canvas').isVisible(),false);await page.locator('#resume-project').click();await page.waitForFunction(()=>document.getElementById('canvas').dataset.action==='scene-program3d');
  assert.deepEqual(errors,[]);assert.deepEqual(unauthorized,[]);
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({capturedRealGeminiProgram:true,realInferenceExecutedByThisJob:false,networkInferenceCalls:0,sourcePreserved:true,modelProgramUnedited:true,programHash:capture.programHash,provider:capture.provider,model:capture.model,authorizedLiveRequestsUsed:3,captureReplayedThroughCreationUI:true,mobileViewport:{width:393,height:852},export:{duration:15,frames:450,width:720,height:1280,codec:'h264',silent:true,lastFrameMeanPixelError:pixelError},browserErrors:errors,samples},null,2));
  console.log('PASS captured REAL Gemini program, ordinary creation UI, both aspects and native export. No inference call in this render job.');
}finally{globalThis.fetch=originalFetch;await browser?.close();await new Promise(r=>server.close(r));}
