/**
 * Browser proof: three separate 3D environments, three mechanisms,
 * one general event compiler. No AI requests or downloaded media.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';

const WIDTH=720,HEIGHT=1280,FPS=24,DURATION=18;
const ROOT='http://127.0.0.1:4198';
const out=path.resolve('tmp/multi-scene-mechanics');
await mkdir(out,{recursive:true});
const errors=[];
let encoder=null;
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--use-gl=angle',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
try{
  const page=await browser.newPage({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(r.url()+' '+r.failure()?.errorText));
  await page.route('**/*',route=>route.request().url().startsWith(ROOT)?route.continue():route.abort());
  await page.goto(ROOT,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.ready==='multi-scene-mechanics',
    {},{timeout:50000}).catch(e=>{throw Error('3D stage failed '+JSON.stringify(errors)+' '+e.message)});
  const info=await page.evaluate(()=>window.__multiScene3D.info);
  assert.equal(info.duration,DURATION);
  assert.deepEqual(info.scenes,['workshop','city','harbor']);
  const at=async(t)=>page.evaluate(time=>window.__multiScene3D.seek(time),t);
  const png=async(t)=>page.evaluate(time=>{
    window.__multiScene3D.seek(time);
    return window.__multiScene3D.frame().split(',')[1];
  },t);
  const scenes=[];
  for(let i=0;i<3;i++){
    const start=await at(i*6+1),end=await at(i*6+5);
    assert.equal(start.setting,info.scenes[i]);
    assert.equal(end.setting,info.scenes[i]);
    assert.ok(start.sceneNodes>15,'Scenery too empty for '+start.setting);
    const distance=Math.hypot(...end.cargo.map((v,j)=>v-start.cargo[j]));
    assert.ok(distance>=4.9,'Cargo failed to move under machine '+start.setting);
    assert.ok(Math.abs(end.shaft[2]-start.shaft[2])>8,
      'Drum not spinning while cargo moves '+start.setting);
    assert.ok(Math.abs(end.gear[2]-start.gear[2])>16,
      'Smaller counterrotating gear disconnected '+start.setting);
    assert.ok(Math.sign(end.shaft[2]-start.shaft[2])===
      -Math.sign(end.gear[2]-start.gear[2]),
      'Gears fail to counterrotate '+start.setting);
    assert.ok(start.camera.every(Number.isFinite)&&end.camera.every(Number.isFinite));
    const pixelDelta=await page.evaluate(([a,b])=>{
      const canvas=document.querySelector('#scene');
      const target=document.createElement('canvas');target.width=180;target.height=320;
      const ctx=target.getContext('2d',{willReadFrequently:true});
      const snapshot=(t)=>{
        window.__multiScene3D.seek(t);
        ctx.drawImage(canvas,0,0,180,320);
        return Array.from(ctx.getImageData(0,0,180,320).data);
      };
      const aa=snapshot(a),bb=snapshot(b);
      let changed=0;
      for(let j=0;j<aa.length;j+=4)if(
        Math.abs(aa[j]-bb[j])>20||Math.abs(aa[j+1]-bb[j+1])>20||
        Math.abs(aa[j+2]-bb[j+2])>20)changed++;
      return Number((changed/(180*320)).toFixed(4));
    },[i*6+1,i*6+5]);
    assert.ok(pixelDelta>.002,
      'Actual 3D pixels are frozen despite numeric mechanics: '+start.setting+' '+pixelDelta);
    scenes.push({name:start.setting,distanceMetres:distance,changedPixelFraction:pixelDelta,
      shaftRads:end.shaft[2]-start.shaft[2],
      counterGearRads:end.gear[2]-start.gear[2],nodes:start.sceneNodes});
    for(const t of [1,3,5])
      await writeFile(path.join(out,start.setting+'-'+t+'.png'),
        Buffer.from(await png(i*6+t),'base64'));
  }
  const mp4=path.join(out,'three-mechanical-scenes-18s.mp4');
  encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','image2pipe','-framerate',String(FPS),'-vcodec','png','-i','pipe:0',
    '-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',
    '-movflags','+faststart',mp4],{stdio:['pipe','ignore','pipe']});
  let stderr='';encoder.stderr.on('data',x=>stderr+=String(x));
  for(let i=0;i<DURATION*FPS;i++){
    const buf=Buffer.from(await png(i/FPS),'base64');
    if(!encoder.stdin.write(buf))await once(encoder.stdin,'drain');
    if(i%72===0)console.log('Rendered mechanics frame',i+'/'+FPS*DURATION);
  }
  encoder.stdin.end();
  const [code]=await once(encoder,'exit');
  if(code!==0)throw Error('MP4 encoder failed: '+stderr);
  encoder=null;
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames',
    '-show_entries','stream=codec_name,width,height,nb_read_frames:format=duration',
    '-of','json',mp4],{encoding:'utf8'}));
  assert.equal(probe.streams[0].codec_name,'h264');
  assert.equal(probe.streams[0].width,WIDTH);
  assert.equal(probe.streams[0].height,HEIGHT);
  assert.equal(Number(probe.streams[0].nb_read_frames),FPS*DURATION);
  assert.ok(Math.abs(Number(probe.format.duration)-DURATION)<.05);
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,'report.json'),JSON.stringify({
    info,scenes,frames:FPS*DURATION,
    disclaimer:'QA scenes are hand-authored; cargo and gear motions are produced from one reusable event-driven compiler. No Gemini, no physically simulated force, no voice.',
    errors
  },null,2));
  console.log('PASS three independent real Three.js scenes / causal gear ratios / 18 second MP4');
} finally {
  if(encoder)encoder.kill('SIGKILL');
  await browser.close();
}
