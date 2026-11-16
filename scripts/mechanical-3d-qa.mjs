import { execFileSync } from 'node:child_process';
import { mechanicalDemoScript, mechanicalDemoResponse } from '../src/studio/explainer/sceneProgram/mechanicalDemo.ts';
/** Real Chromium/WebGL render, fixture-only API and zero paid calls. */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import worker from '../dist/server/index.js';

const script=mechanicalDemoScript;
const response=mechanicalDemoResponse();
const output=path.resolve('tmp/mechanical-3d-qa');
await fs.mkdir(output,{recursive:true});
const nativeFetch=globalThis.fetch;
let calls=0;
globalThis.fetch=async url=>{
  assert.match(String(url),/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.6-flash:generateContent$/);
  calls++;
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(response)}]}}]});
};
const server=http.createServer(async (req,res)=>{
  try{
    const chunks=[];
    for await(const c of req)chunks.push(c);
    const base='http://127.0.0.1:'+server.address().port;
    const result=await worker.fetch(new Request(new URL(req.url||'/',base),{
      method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})
    }),{GEMINI_API_KEY:'fixture-not-real'});
    res.writeHead(result.status,Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;const errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#script').fill(script);
  await page.locator('#duration').selectOption('custom');
  await page.locator('#duration-custom').fill('8');
  await page.locator('#duration-custom').dispatchEvent('change');
  await page.locator('#generate').click();
  await page.waitForFunction(()=>!document.getElementById('generate').disabled);
  await page.waitForFunction(()=>document.getElementById('canvas').dataset.action==='scene-program3d',undefined,{timeout:30000});
  assert.equal(calls,1);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('crieseuvideo-lab-v1')));
  assert.equal(stored.plan.scenes.map(s=>s.text).join(' '),script);
  assert.equal(stored.plan.sceneProgram.nodes.find(n=>n.id==='glass-jar').geometry.shape,'lathe');
  const hashes=[];
  for(const [i,fraction] of [.04,.24,.52,.76,.98].entries()){
    const data=await page.evaluate(at=>{
      const input=document.getElementById('timeline');
      input.value=String(at);input.dispatchEvent(new Event('input',{bubbles:true}));
      const canvas=document.getElementById('canvas');
      return {png:canvas.toDataURL('image/png').split(',')[1],
        info:JSON.parse(canvas.dataset.production||'{}'),action:canvas.dataset.action};
    },8*fraction);
    assert.equal(data.action,'scene-program3d');
    assert.equal(data.info.board,false);
    const png=Buffer.from(data.png,'base64');
    hashes.push(createHash('sha256').update(png).digest('hex'));
    await fs.writeFile(path.join(output,'mecanismo-'+i+'.png'),png);
  }
  assert.equal(new Set(hashes).size,5);
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({
    modelGenerationReal:false,modelResponseSimulated:true,paidCalls:0,
    canvas:'scene-program3d',frameHashes:hashes,textPreserved:true,geometry:'THREE.LatheGeometry',mechanicalAnimation:true,expectedLength:8
  },null,2));
  const download=page.waitForEvent('download',{timeout:300000});
  await page.locator('#download-video').click();
  const file=await download;
  const exportInfo=await page.evaluate(()=>JSON.parse(document.getElementById('canvas').dataset.lastExport));
  assert.equal(exportInfo.duration,8);
  assert.equal(exportInfo.frames,240);
  const native=path.join(output,'mecanismo-native.'+exportInfo.extension);
  await file.saveAs(native);
  const mp4=path.join(output,'crieseuvideo-liquidificador-3d.mp4');
  execFileSync('ffmpeg',['-v','error','-y','-i',native,'-an','-c:v','libx264',
    '-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',mp4],
    {timeout:180000});
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries',
    'format=duration,size:stream=codec_type,codec_name,width,height,nb_read_frames','-of','json',mp4],{encoding:'utf8'}));
  const video=probe.streams.find(stream=>stream.codec_type==='video');
  assert.equal(video.codec_name,'h264');
  assert.equal(video.width,720);assert.equal(video.height,1280);
  assert.ok(Math.abs(Number(probe.format.duration)-8)<.05);
  assert.equal(Number(video.nb_read_frames),240);
  assert.deepEqual(errors,[]);
  console.log('PASS 5 distinct real Toon3D WebGL previews and verified 240-frame H.264 MP4, no paid calls.');
}finally{
  globalThis.fetch=nativeFetch;
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
