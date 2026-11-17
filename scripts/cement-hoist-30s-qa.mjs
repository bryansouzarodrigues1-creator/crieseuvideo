import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';

/** Actual 30s three-dimensional browser/MP4 QA. This does not call an LLM
 * and never substitutes source-video pixels or a pre-rendered animation.
 * Visual appraisal of exported scenes remains mandatory.
 */
const W=720,H=1280,FPS=24,DURATION=30;
const base='http://127.0.0.1:4193',out=path.resolve('tmp/cement-hoist-30s');
await fs.mkdir(out,{recursive:true});
const errors=[];
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
  '--use-gl=angle','--use-angle=swiftshader']});
let encoder;
try {
  const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',r=>errors.push(r.url()+' '+(r.failure()?.errorText??'')));
  await page.route('**/*',route=>
    route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.ready==='cement-lift',
    {},{timeout:45000}).catch(async error=>{
      throw Error('Browser scene initialization failed: '+JSON.stringify(errors)+' / '+error.message);
    });
  const sample=async(t)=>page.evaluate(time=>window.__cementLift.seek(time),t);
  const frame=async(t)=>page.evaluate(time=>{
    window.__cementLift.seek(time);
    return window.__cementLift.frame().split(',')[1];
  },t);
  const details=await page.evaluate(()=>window.__cementLift.info);
  assert.equal(details.duration,DURATION);
  assert.equal(details.cuts,5);
  assert.deepEqual(details.cutActivity.frozenCuts,[],
    'The director authored a visually frozen camera cut: '+JSON.stringify(details.cutActivity.frozenCuts));
  assert.ok(details.cutActivity.cuts.every(x=>x.animated.length>0),
    'Every shot must contain an on-screen moving subject, not just a static 3D backdrop');
  assert.ok(details.objects>80 && details.objects<=160,
    '30s generic geometry should fit the engine node limit: '+details.objects);
  const cameras=new Map(), samples=[];
  const times=[0,1.5,3.5,5.6,6.9,7.2,9,11.6,12.1,14,16,17,19,22,23.2,23.5,25,27,29.5];
  const getCut=t=>t<7.2?0:t<12?1:t<16.2?2:t<23.4?3:4;
  for(const t of times){
    const a=await sample(t),cut=getCut(t);
    for(const x of [...a.camera,...a.projectedBounds.min,...a.projectedBounds.max])
      assert.ok(Number.isFinite(x),'Nonfinite 3D projection at '+t);
    // Only focus groups listed for each shot are guaranteed in view. This
    // cannot replace visual assessment of *all* story-relevant objects.
    assert.ok(a.projectedBounds.min[0]>-.94&&a.projectedBounds.max[0]<.94,
      'horizontal crop at '+t+' '+JSON.stringify(a.projectedBounds));
    assert.ok(a.projectedBounds.min[1]>-.80&&a.projectedBounds.max[1]<.94,
      'vertical crop at '+t+' '+JSON.stringify(a.projectedBounds));
    assert.equal(a.motor3D,true,'No real 3D motor assembly');
    assert.equal(a.gearShaft,true,'Gearbox output shaft missing');
    assert.ok(a.cableEndErrors?.length===1,'Missing physical cable to cargo hook');
    assert.ok(a.cableEndErrors[0].errorMeters<.002,
      'Hoist cable no longer touches cargo hook/pulley at '+t+'s: '+JSON.stringify(a.cableEndErrors));
    if(cut!==4)assert.equal(a.motorVisibility,false,'Off-shot motor leaks into corner of frame');
    else assert.equal(a.motorVisibility,true,'Motor hidden during mechanism closeup');
    if(!cameras.has(cut))cameras.set(cut,[...a.camera]);
    else assert.ok(a.camera.every((x,i)=>Math.abs(x-cameras.get(cut)[i])<.0001),
      'sideways-camera drift within cut '+cut+' at '+t);
    samples.push({time:t,cut,...a});
  }
  assert.equal(cameras.size,5);
  assert.notDeepEqual(cameras.get(0),cameras.get(4),'Mechanism closeup must change the camera');
  const before=await sample(15.9),after=await sample(23.1);
  assert.ok(after.pallet[1]-before.pallet[1]>6.0,
    'Suspended cement is not actually lifted between 16s and 23s');
  assert.ok(before.rope[1]-after.rope[1]>5.0,
    'Rope does not shorten while motor hoists');
  const gear=await sample(29.5);
  assert.ok(gear.motorGear>15 && gear.smallerGear < -25,
    'Large and small gears must counterrotate at visible speeds');
  assert.ok(Math.abs(gear.smallerGear/gear.motorGear)>2.5 && Math.abs(gear.smallerGear/gear.motorGear)<2.9,
    'Gear speed ratio must agree with the modeled unequal gear radii');
  const workerBegin=await sample(0),workerEnd=await sample(6.4);
  assert.ok(Math.hypot(...workerBegin.worker.map((x,i)=>x-workerEnd.worker[i]))>1.0,
    'Laborer never changes position in opening');
  const clip=path.join(out,'cement-hoist-30s.mp4');
  encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','image2pipe','-framerate',String(FPS),'-vcodec','png','-i','pipe:0',
    '-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',
    '-movflags','+faststart',clip],{stdio:['pipe','ignore','pipe']});
  let logs='';encoder.stderr.on('data',data=>logs+=String(data));
  for(let frameNumber=0;frameNumber<FPS*DURATION;frameNumber++){
    const png=Buffer.from(await frame(frameNumber/FPS),'base64');
    if(!encoder.stdin.write(png))await once(encoder.stdin,'drain');
    if(frameNumber%120===0)console.log('Rendered 3D',frameNumber,'/',FPS*DURATION);
  }
  encoder.stdin.end();
  const [code]=await once(encoder,'exit');
  if(code!==0)throw Error('MP4 encoding failed: '+logs.slice(-2000));
  encoder=null;
  for(const t of [0,3,7.9,10.5,13.5,17.5,20.5,24.5,28.5])
    await fs.writeFile(path.join(out,'scene-'+String(t).replace('.','-')+'.png'),
      Buffer.from(await frame(t),'base64'));
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames',
    '-show_entries','stream=codec_name,width,height,nb_read_frames:format=duration',
    '-of','json',clip],{encoding:'utf8'}));
  const stream=probe.streams[0];
  assert.equal(stream.codec_name,'h264');
  assert.equal(stream.width,W);assert.equal(stream.height,H);
  assert.equal(Number(stream.nb_read_frames),FPS*DURATION);
  assert.ok(Math.abs(Number(probe.format.duration)-DURATION)<.05);
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({
    reference:'User-supplied 1000857556.mp4 first 30 seconds',
    actualSource:'Original generic SceneProgram3D geometry, no AI calls',
    approvedArtisticQuality:false,visualReviewPending:true,
    duration:DURATION,fps:FPS,frames:FPS*DURATION,dimensions:[W,H],
    nodeCount:details.objects,cutCount:details.cuts,cutActivity:details.cutActivity,
    cameraStableWithinCuts:true,
    observations:'Technical rendering and motion tests cannot certify scene fidelity, readability or believable load transfer.',
    samples,browserErrors:errors
  },null,2));
  console.log('PASS 30s real 3D hoist: five active cuts, cargo-linked rope, geared motor, H264 and no off-shot clipping');
} finally {
  if(encoder)encoder.kill('SIGKILL');
  await browser.close();
}
