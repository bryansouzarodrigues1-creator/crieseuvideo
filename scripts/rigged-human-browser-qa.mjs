/**
 * Real headless Chrome/WebGL/Three.js QA: verified CC0 humanoids, skinning,
 * deterministic named animation clips, prop socket and 8-second H.264 video.
 * No Gemini, no paid API, no actual user data. This is authored control footage.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';

const base='http://127.0.0.1:4175';
const output=path.resolve('tmp/rigged-lab');
await fs.mkdir(output,{recursive:true});
const errors=[], violations=[];
const browser=await chromium.launch({
  headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'],
});
let ff;
try{
  const page=await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push('request '+r.url()+' '+r.failure()?.errorText));
  await page.route('**/*',route=>{
    if(!route.request().url().startsWith(base+'/') && route.request().url()!==base)
      return route.abort();
    return route.continue();
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.ready==='rigged-qa',{},{timeout:40000})
    .catch(async e=>{throw new Error('Rig did not initialize: '+JSON.stringify(errors)+' / '+await page.locator('#status').innerText()+' / '+e)});
  const info=await page.evaluate(()=>({
    worker:(window).__riggedLab.workerClips,
    casual:(window).__riggedLab.casualClips,
  }));
  for(const names of [info.worker,info.casual])
    for(const needed of ['CharacterArmature|Walk','CharacterArmature|Idle_Neutral','CharacterArmature|Interact'])
      assert.ok(names.includes(needed),'Missing real rig clip '+needed);
  const sample=async t=>page.evaluate(t=>(window).__riggedLab.seek(t),t);
  const frame=async t=>page.evaluate(t=>{
    (window).__riggedLab.seek(t);
    return (window).__riggedLab.frame().split(',')[1];
  },t);
  const before=await sample(5.817),after=await sample(5.823);
  assert.equal(before.owner,'worker');
  assert.equal(after.owner,'casual');
  assert.ok(before.riggedSkinnedMeshes>=2,'Scene has no two skinned characters');
  const distance=Math.hypot(...before.toolPosition.map((x,i)=>x-after.toolPosition[i]));
  assert.ok(distance<.20,'Prop teleports during transfer: '+distance);
  assert.ok(after.toolHandDistance<.36,'Prop detached from second wrist');
  assert.ok(before.toolHandDistance<.36,'Prop detached from first wrist');
  for(const t of [0,1.2,2.8,3.6,4.5,5.5,6.8,8]){
    const state=await sample(t);
    assert.equal(state.riggedSkinnedMeshes,before.riggedSkinnedMeshes);
    assert.ok(state.toolHandDistance<.4,'Lost prop constraint at '+t);
    violations.push(state);
  }
  const a=createHash('sha256').update(await frame(3.65)).digest('hex');
  await frame(7.1);await frame(.15);
  const b=createHash('sha256').update(await frame(3.65)).digest('hex');
  assert.equal(a,b,'Frame at 3.65s depends on seeking order');

  const artifact=path.join(output,'rigged-humans-8s.mp4');
  ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',
      '-f','image2pipe','-framerate','24','-vcodec','png','-i','pipe:0',
      '-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',
      '-movflags','+faststart',artifact],{stdio:['pipe','ignore','pipe']});
  let stderr='';ff.stderr.on('data',x=>{stderr+=String(x)});
  const frames=8*24,shots=[.7,2.4,3.6,5.7,7.4];
  for(let i=0;i<frames;i++){
    const t=i/24,base64=await frame(t);
    const png=Buffer.from(base64,'base64');
    if(!ff.stdin.write(png))await once(ff.stdin,'drain');
    if(i%48===0)console.log('Rendered',i,'/',frames);
  }
  ff.stdin.end();
  const [code]=await once(ff,'exit');
  if(code!==0)throw new Error('ffmpeg failed: '+stderr);
  ff=null;
  for(const t of shots){
    const png=Buffer.from(await frame(t),'base64');
    await fs.writeFile(path.join(output,'shot-'+String(t).replace('.','-')+'.png'),png);
  }
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries',
    'stream=codec_name,width,height,nb_read_frames:format=duration','-of','json',artifact],{encoding:'utf8'}));
  const video=probe.streams[0];
  assert.equal(video.nb_read_frames,String(frames));
  assert.equal(video.codec_name,'h264');
  assert.equal(video.width,720);assert.equal(video.height,1280);
  assert.ok(Math.abs(Number(probe.format.duration)-8)<.04);
  // Independent acting-quality gate: a physically attached prop is NOT a
  // believable pickup/handoff if the adults occupy the same body space, or
  // the animation repertoire never expresses a grasp/crouch. Reject instead
  // of calling this a professional animation because the H264 encoded.
  const ACTOR_MIN_ROOT_SEPARATION_METRES=.85;
  const actingSamples=violations.filter(x=>x.time>=2.8 && x.time<=6.8).map(x=>({
    time:x.time,
    actorRootSeparationMetres:Math.hypot(
      x.workerPosition[0]-x.casualPosition[0],
      x.workerPosition[2]-x.casualPosition[2]),
    workerClip:x.workerClip,
    casualClip:x.casualClip,
    headScreenSeparationPixels:Math.hypot(
      x.headScreenPixels.worker[0]-x.headScreenPixels.casual[0],
      x.headScreenPixels.worker[1]-x.headScreenPixels.casual[1]),
    headScreenPixels:x.headScreenPixels,
  }));
  const overlapping=actingSamples.filter(x=>
    x.actorRootSeparationMetres<ACTOR_MIN_ROOT_SEPARATION_METRES);
  const MIN_HEAD_SCREEN_SEPARATION_PIXELS=70;
  const occludedHeads=actingSamples.filter(x=>
    !Number.isFinite(x.headScreenSeparationPixels) ||
    x.headScreenSeparationPixels<MIN_HEAD_SCREEN_SEPARATION_PIXELS);
  const pickupClipAvailable=info.worker.some(x=>/(pickup|grab|crouch|bend)/i.test(x.split('|').pop().replace(/[_-]/g,' ')));
  const actingFailures=[
    ...overlapping.map(x=>'Actors too close for an intelligible handoff at '+x.time+'s: '+x.actorRootSeparationMetres.toFixed(3)+'m'),
    ...occludedHeads.map(x=>'Actor heads overlap in final camera at '+x.time+'s: '+x.headScreenSeparationPixels.toFixed(1)+'px'),
    ...(!pickupClipAvailable?['No verified pickup/crouch clip or IK grasp motion in this lab; hand attachment alone is not pickup acting']:[]),
  ];
  const actingQuality={
    status:actingFailures.length?'FAIL_REQUIRES_VISUAL_REVISION':'PASS_GEOMETRY_ONLY_REQUIRES_HUMAN_REVIEW',
    minRootSeparationMetres:ACTOR_MIN_ROOT_SEPARATION_METRES,
    minHeadScreenSeparationPixels:MIN_HEAD_SCREEN_SEPARATION_PIXELS,
    pickupClipAvailable,
    samples:actingSamples,
    failures:actingFailures,
    limitations:'Geometry cannot prove gesture quality or object visibility; human MP4 review is still required.',
  };
  const report={
    claim:'Offline agent-authored rigged-human engine experiment. NOT autonomous Gemini generation.',
    realProviderCalls:0,sourceLicense:'Quaternius Ultimate Modular Men Pack, CC0',
    sourceModels:['Worker.glb','Casual.glb'],
    observedClips:info,
    trackedFrames:frames,
    resolution:[720,1280],fps:24,
    propTransferWorldJumpMeters:distance,
    actingQuality,
    screenshotSeekingDeterministic:true,
    browserErrors:errors,
    samples:violations,
  };
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);
  // Keep MP4 and JSON as CI artifacts even on acting failure; the authored
  // lab remains diagnostic, but is no longer labeled an acting success.
  if(actingFailures.length)throw new Error('ACTING_QA_FAILED: '+actingFailures.join('; '));
  console.log('PASS physical constraints and geometric acting gate; final human video review still required',
    JSON.stringify({frames,distance}));
}finally{
  if(ff){ff.kill('SIGKILL')}
  await browser.close();
}
