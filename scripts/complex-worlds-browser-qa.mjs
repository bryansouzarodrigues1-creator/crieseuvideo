/**
 * Headless visual proof of three different complex 3D scenes in ONE compiled
 * batch. Browser, geometry, real pixels and MP4; no model requests or secrets.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';

const WIDTH=720,HEIGHT=1280,FPS=24,DURATION=18;
const ROOT='http://127.0.0.1:4198';
const out=path.resolve('tmp/complex-worlds');
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
  await page.waitForFunction(()=>document.body.dataset.ready==='complex-worlds-3d',
    {},{timeout:75000}).catch(e=>{throw Error('Complex 3D stage failed: '+errors.join('; ')+' '+e.message)});
  const info=await page.evaluate(()=>window.__complexWorlds.info);
  assert.equal(info.duration,DURATION);
  assert.equal(info.audit.clips,3);
  assert.deepEqual(info.scenes,['noahs-ark','security-prison','sport-motorcycle']);
  assert.ok(info.nodes.every(n=>n>=20),'Too few scene nodes for complex worlds');
  const at=async(t)=>page.evaluate(time=>window.__complexWorlds.seek(time),t);
  const png=async(t)=>page.evaluate(time=>{
    window.__complexWorlds.seek(time);
    return window.__complexWorlds.frame().split(',')[1];
  },t);
  const scenes=[];
  for(let i=0;i<3;i++){
    const a=await at(i*6+1),b=await at(i*6+5.8);
    assert.equal(a.index,i);assert.equal(b.index,i);
    assert.ok(a.camera.every(Number.isFinite)&&b.camera.every(Number.isFinite));
    assert.ok(a.parts>8&&a.sceneryRegions>=2,'Scenery/objects missing for '+a.setting);
    assert.ok(Object.values(a.nodes).every(n=>n&&n.bounds.every(Number.isFinite)),
      'Required visible 3D geometry was not created in '+a.setting);
    const deltas={};
    if(i===0){
      // The boat returns close to its starting height; sample its crest, not two similar endpoints.
      const crest=await at(i*6+2.9);
      deltas.arkBobMetres=Math.abs(crest.nodes.ark.position[1]-a.nodes.ark.position[1]);
      deltas.hatchRadians=Math.abs(b.nodes['ark-hatch'].rotation[1]-a.nodes['ark-hatch'].rotation[1]);
      deltas.animalMetres=Math.hypot(...b.nodes.animals.position.map((x,j)=>x-a.nodes.animals.position[j]));
      assert.ok(deltas.arkBobMetres>.02,'Ark should bob');
      assert.ok(deltas.hatchRadians>.5,'Ark hatch not opened');
      assert.ok(deltas.animalMetres>1.0,'Animals have no progress');
      for(const step of [a,b]){
        const feet=step.nodes.animals.position;
        const ramp=step.nodes['ark-gangway'];
        assert.ok(
          feet[0]>=ramp.min[0]-.20&&feet[0]<=ramp.max[0]+.20&&
          feet[2]>=ramp.min[2]-.20&&feet[2]<=ramp.max[2]+.20&&
          feet[1]>=ramp.min[1]-.20&&feet[1]<=ramp.max[1]+.20,
          'Animals are not boarding on the ramp — likely floating or standing in sea'
        );
      }
      const w1=a.water.find(n=>n.id==='ocean'),w2=b.water.find(n=>n.id==='ocean');
      assert.ok(w1&&w2,'Ocean missing');
      deltas.waterWaveMetres=Math.max(...w1.samples.map((y,j)=>Math.abs(w2.samples[j]-y)));
      assert.ok(deltas.waterWaveMetres>.005,'Ocean is frozen');
    }else if(i===1){
      deltas.gateMetres=b.nodes['compound-gate'].position[0]-a.nodes['compound-gate'].position[0];
      deltas.patrolMetres=a.nodes.patrol.position[2]-b.nodes.patrol.position[2];
      assert.ok(deltas.gateMetres>3,'Prison gate does not open');
      assert.ok(deltas.patrolMetres>8,'Patrol vehicle does not move through compound');
    }else{
      deltas.bikeMetres=b.nodes.bike.position[0]-a.nodes.bike.position[0];
      deltas.wheelRadians=Math.abs(b.nodes['bike-fwheel'].rotation[2]-a.nodes['bike-fwheel'].rotation[2]);
      assert.ok(deltas.bikeMetres>6,'Motorcycle root is stationary');
      assert.ok(deltas.wheelRadians>9,'Motorcycle wheels do not turn');
      assert.ok(Math.abs(deltas.wheelRadians/deltas.bikeMetres-1/.62)<.3,
        'Wheel spin does not follow vehicle distance and wheel radius');
    }
    const pixelDelta=await page.evaluate(([start,end])=>{
      const canvas=document.querySelector('#scene'), target=document.createElement('canvas');
      target.width=180;target.height=320;
      const ctx=target.getContext('2d',{willReadFrequently:true});
      const snapshot=t=>{
        window.__complexWorlds.seek(t);
        ctx.drawImage(canvas,0,0,180,320);
        return ctx.getImageData(0,0,180,320).data.slice();
      };
      const first=snapshot(start),last=snapshot(end);
      let changed=0;
      for(let k=0;k<first.length;k+=4)if(
        Math.abs(first[k]-last[k])>20||
        Math.abs(first[k+1]-last[k+1])>20||
        Math.abs(first[k+2]-last[k+2])>20)changed++;
      return Number((changed/(180*320)).toFixed(4));
    },[i*6+1,i*6+5.8]);
    assert.ok(pixelDelta>.004,'Real rendered pixels remained nearly unchanged '+a.setting);
    scenes.push({id:a.setting,nodes:a.viewNodes,parts:a.parts,scenery:a.sceneryRegions,
      pixelDelta,deltas});
    for(const sec of [1,3,5])
      await writeFile(path.join(out,a.setting+'-'+sec+'.png'),
        Buffer.from(await png(i*6+sec),'base64'));
  }
  const mp4=path.join(out,'ark-prison-motorcycle-18s.mp4');
  encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','image2pipe','-framerate',String(FPS),'-vcodec','png','-i','pipe:0',
    '-an','-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p',
    '-movflags','+faststart',mp4],{stdio:['pipe','ignore','pipe']});
  let stderr='';encoder.stderr.on('data',x=>stderr+=String(x));
  for(let i=0;i<DURATION*FPS;i++){
    const buf=Buffer.from(await png(i/FPS),'base64');
    if(!encoder.stdin.write(buf))await once(encoder.stdin,'drain');
    if(i%72===0)console.log('Complex-world render frame',i,'/',DURATION*FPS);
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
    info,scenes,frames:DURATION*FPS,
    disclaimer:'Hand-authored QA geometry, not Gemini generation; no narration, people, cinematic physics or production deployment.',
    errors
  },null,2));
  console.log('PASS: 3 complex Three.js worlds, native geometries, causal movement and H264 MP4');
}finally{
  if(encoder)encoder.kill('SIGKILL');
  await browser.close();
}
