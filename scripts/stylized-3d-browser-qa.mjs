/** 3D browser/rendering proof: no humans, no Gemini, no pre-rendered assets.
 * Inspect actual camera and pixel frames of a newly authored scene graph.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';

const base='http://127.0.0.1:4182', out=path.resolve('tmp/stylized-3d');
await fs.mkdir(out,{recursive:true});
const errors=[];
const browser=await chromium.launch({headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
let ff;
try {
  const page=await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
  await page.route('**/*',route=>
    route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.ready==='stylized-3d',{},{timeout:40000})
    .catch(async e=>{throw Error('Scene initialization failed: '+JSON.stringify(errors)+' / '+e.message)});
  const state=async(t)=>page.evaluate(t=>window.__stylized3D.seek(t),t);
  const frame=async(t)=>page.evaluate(t=>{
    window.__stylized3D.seek(t);
    return window.__stylized3D.frame().split(',')[1];
  },t);
  let stationary;
  const samples=[];
  for(const t of [0,1,2,2.5,3.5,4.4,5.6,6.4,7.2,8]){
    const d=await state(t);
    assert.equal(d.actors,0,'A human presenter cannot substitute the 3D action');
    assert.ok(d.tomatoParts>=11,'Prop is only a simple primitive without recognizable parts');
    assert.ok(d.nodes>=20,'Set lacks a multi-part visual environment');
    for(const v of [d.projectedBounds.min[0],d.projectedBounds.min[1],
      d.projectedBounds.max[0],d.projectedBounds.max[1]])assert.ok(Number.isFinite(v));
    assert.ok(d.projectedBounds.min[0]>-.90&&d.projectedBounds.max[0]<.90,
      '3D main subject cropped horizontally at '+t+' '+JSON.stringify(d.projectedBounds));
    assert.ok(d.projectedBounds.min[1]>-.72&&d.projectedBounds.max[1]<.89,
      '3D main subject cropped vertically at '+t+' '+JSON.stringify(d.projectedBounds));
    if(!stationary)stationary=d.camera;
    else assert.ok(d.camera.every((v,i)=>Math.abs(v-stationary[i])<.0001),
      'Camera drifts sideways during object movement at '+t);
    samples.push({time:t,camera:d.camera,bounds:d.projectedBounds,objects:d.nodes});
  }
  // Export real 8s animation as portrait H264 for visual inspection.
  const videoPath=path.join(out,'stylized-objects-8s.mp4');
  ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','image2pipe','-framerate','24','-vcodec','png','-i','pipe:0',
    '-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',
    '-movflags','+faststart',videoPath],{stdio:['pipe','ignore','pipe']});
  let stderr='';ff.stderr.on('data',x=>stderr+=String(x));
  for(let i=0;i<192;i++){
    const bytes=Buffer.from(await frame(i/24),'base64');
    if(!ff.stdin.write(bytes))await once(ff.stdin,'drain');
    if(i%48===0)console.log('3D frames',i,'/',192);
  }
  ff.stdin.end();
  const [code]=await once(ff,'exit');
  if(code!==0)throw Error('H264 encoder failed: '+stderr);
  ff=null;
  for(const t of [0,2.5,4.4,5.6,7.5])
    await fs.writeFile(path.join(out,'shot-'+String(t).replace('.','-')+'.png'),
      Buffer.from(await frame(t),'base64'));
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames',
    '-show_entries','stream=codec_name,width,height,nb_read_frames:format=duration',
    '-of','json',videoPath],{encoding:'utf8'}));
  assert.equal(probe.streams[0].codec_name,'h264');
  assert.equal(probe.streams[0].nb_read_frames,'192');
  assert.equal(probe.streams[0].width,720);
  assert.equal(probe.streams[0].height,1280);
  assert.ok(Math.abs(Number(probe.format.duration)-8)<.04);
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({
    proof:'Agent-authored offline QA, not Gemini-autonomous generation',
    scene:'Organic stylized multi-part fruit, plant and wooden crate',
    usesExistingGenericSceneProgram:true,
    productionPreset:false,sourceProviderCalls:0,
    duration:8,frames:192,dimensions:[720,1280],lockedCamera:true,samples,browserErrors:errors,
    limitation:'The strict camera/framing checks do not prove cinematic art direction or semantic AI generation',
  },null,2));
  console.log('PASS real non-human Three.js motion, stable portrait framing and H264');
} finally {
  if(ff)ff.kill('SIGKILL');
  await browser.close();
}
