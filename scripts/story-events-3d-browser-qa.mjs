/**
 * Render 14 seconds of narrative-compiled motion in the REAL SceneProgram3D.
 * No paid Gemini API call, no static sprite video, no fake screenshot.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';

const W=720,H=1280,FPS=24,DURATION=14,ROOT='http://127.0.0.1:4199';
const out=path.resolve('tmp/story-events-3d');
await mkdir(out,{recursive:true});
const errors=[];
let encoder=null;
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--use-gl=angle',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
  await page.route('**/*',route=>
    route.request().url().startsWith(ROOT)?route.continue():route.abort());
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.ready==='story-event-3d',
    {},{timeout:40000}).catch(async e=>{throw Error(
      'Storyboard Three.js initialization failed: '+JSON.stringify(errors)+' '+e.message)});
  const info=await page.evaluate(()=>window.__storyEvents3D.info);
  assert.equal(info.duration,14);
  assert.equal(info.events,7);
  assert.ok(info.tracks>=4);
  const at=async(t)=>page.evaluate(time=>window.__storyEvents3D.seek(time),t);
  const png=async(t)=>page.evaluate(time=>{
    window.__storyEvents3D.seek(time);return window.__storyEvents3D.frame().split(',')[1];
  },t);
  const times=[0,.45,1.1,2.6,3.8,4.4,5.1,6.5,7.6,9.8,12.3,13.8];
  const samples=[];
  for(const time of times){
    const frame=await at(time);
    assert.ok(frame.camera.every(Number.isFinite),'Camera has nonfinite values at '+time);
    assert.ok(frame.positions.saco.every(Number.isFinite),'Cargo has nonfinite coordinates');
    samples.push(frame);
  }
  const get=t=>samples.find(s=>Math.abs(s.time-t)<.001);
  assert.ok(get(1.1).positions.saco[1]>get(0).positions.saco[1]+.75,
    'The actor never picks up the cargo');
  assert.ok(get(3.8).positions.saco[0]>get(1.1).positions.saco[0]+1.5,
    'The same cargo is not carried to platform');
  assert.ok(get(5.1).positions.saco[1]<get(3.8).positions.saco[1],
    'The actor did not put down cargo');
  assert.ok(get(12.3).positions.saco[1]-get(6.5).positions.saco[1]>4,
    'Cargo did not rise together with the platform');
  assert.ok(Math.abs(
    (get(12.3).positions.saco[1]-get(12.3).positions.elevador[1])-
    (get(6.5).positions.saco[1]-get(6.5).positions.elevador[1]))<.03,
    'Cargo detached from the moving platform');
  assert.ok(Math.abs(get(12.3).gear[2]-get(6.5).gear[2])>25,
    '3D motor shaft fails to rotate during elevation');
  const visuals=[];
  for(const [label,start,end] of [
    ['pickup',.3,1.2],['carry',2,3],['place',4.1,5.2],
    ['lift',7,11.5],['motor',8.8,10.4]
  ]){
    const before=await page.evaluate(t=>{
      window.__storyEvents3D.seek(t);
      const img=document.createElement('canvas');img.width=180;img.height=320;
      const c=img.getContext('2d',{willReadFrequently:true});
      const source=document.createElement('img');
      return new Promise((resolve,reject)=>{
        source.onload=()=>{
          c.drawImage(source,0,0,180,320);
          resolve(Array.from(c.getImageData(0,0,180,320).data));
        };
        source.onerror=()=>reject(new Error('Data image decode failed'));
        source.src=window.__storyEvents3D.frame();
      });
    },start);
    const after=await page.evaluate(t=>{
      window.__storyEvents3D.seek(t);
      const img=document.createElement('canvas');img.width=180;img.height=320;
      const c=img.getContext('2d',{willReadFrequently:true});
      const source=document.createElement('img');
      return new Promise((resolve,reject)=>{
        source.onload=()=>{
          c.drawImage(source,0,0,180,320);
          resolve(Array.from(c.getImageData(0,0,180,320).data));
        };
        source.onerror=()=>reject(new Error('Data image decode failed'));
        source.src=window.__storyEvents3D.frame();
      });
    },end);
    let count=0;
    for(let i=0;i<before.length;i+=4)
      if(Math.abs(before[i]-after[i])>22||Math.abs(before[i+1]-after[i+1])>22||
         Math.abs(before[i+2]-after[i+2])>22)count++;
    visuals.push({label,changeFraction:Number((count/(180*320)).toFixed(4))});
  }
  const video=path.join(out,'story-events-3d-14s.mp4');
  encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','image2pipe','-framerate',String(FPS),'-vcodec','png','-i','pipe:0',
    '-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',
    '-movflags','+faststart',video],{stdio:['pipe','ignore','pipe']});
  let stderr='';
  encoder.stderr.on('data',x=>stderr+=String(x));
  for(let i=0;i<DURATION*FPS;i++){
    const buf=Buffer.from(await png(i/FPS),'base64');
    if(!encoder.stdin.write(buf))await once(encoder.stdin,'drain');
    if(i%72===0)console.log('EVENT_RENDER',i+'/'+DURATION*FPS);
  }
  encoder.stdin.end();
  const [exit]=await once(encoder,'exit');
  if(exit!==0)throw Error('FFmpeg failed: '+stderr);
  encoder=null;
  for(const t of [0,1.1,3.5,5.0,7.5,10.0,12.5,13.5])
    await writeFile(path.join(out,'event-'+String(t).replace('.','-')+'.png'),
      Buffer.from(await png(t),'base64'));
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames',
    '-show_entries','stream=codec_name,width,height,nb_read_frames:format=duration',
    '-of','json',video],{encoding:'utf8'}));
  assert.equal(probe.streams[0].codec_name,'h264');
  assert.equal(probe.streams[0].width,W);assert.equal(probe.streams[0].height,H);
  assert.equal(Number(probe.streams[0].nb_read_frames),DURATION*FPS);
  assert.ok(Math.abs(Number(probe.format.duration)-DURATION)<.04);
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,'report.json'),JSON.stringify({
    info,visuals,samples,errorList:errors,
    evidenceType:'Offline hand-authored geometry with automatic causal-motion compilation; not a live Gemini-generated film.',
    note:'Pixel differences include caption changes. Narrative plausibility, actor pickup and mechanism constraints require further QA.',
    aiRequests:0,renderFrames:DURATION*FPS,codec:'H264',audio:false
  },null,2));
  console.log('PASS event compiler to real Three.js browser to 14s MP4; causal-state positions verified');
}finally{
  if(encoder)encoder.kill('SIGKILL');
  await browser.close();
}
