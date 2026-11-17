/**
 * Exact original, model-authored Gemini 12-second program -> SceneProgram3D
 * direct browser rendering. No Gemini inference; no program/scene rewriting.
 * If IK fails, export a DIAGNOSTIC ONLY video and record failing frames.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const output=path.resolve('tmp/gemini-real-offline-replay');
await fs.mkdir(output,{recursive:true});
const original=await fs.readFile('lab/gemini-real-replay/public/program.json');
const programHash=createHash('sha256').update(original).digest('hex');
const originalPlan=JSON.parse(original.toString());
const duration=originalPlan.targetDuration;
assert.equal(duration,12,'Real source duration unexpectedly differs');
const frames=Math.round(duration*30);
const base='http://127.0.0.1:4188';
const errors=[],requestViolations=[];
let ff=null, browser=null;
try{
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:720,height:1280}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>{if(!r.url().includes('@vite/client'))errors.push('Failed '+r.url());});
  await page.route('**/*',route=>{
    const u=route.request().url();
    if(u.startsWith(base+'/')||u===base+'/')return route.continue();
    requestViolations.push(u.slice(0,150));return route.abort();
  });
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.body.dataset.ready?.startsWith('gemini-replay-'),undefined,{timeout:60000});
  const state=await page.evaluate(()=>({status:document.body.dataset.ready,
      message:document.querySelector('#status')?.textContent,
      physics:(window).__geminiRealReplay?.physicsVerdict}));
  if(state.status!=='gemini-replay-ready')
    throw Error('Cannot initialize SceneProgram on unchanged Gemini source: '+JSON.stringify({state,errors}));
  const frame=async(time)=>page.evaluate((t)=>(window).__geminiRealReplay.frame(t),time);
  const samples=[];
  for(const t of [.3,1.8,3.7,5.2,6.5,8.8,10.8,11.8]){
    const actual=await frame(t);
    await fs.writeFile(path.join(output,'gemini-real-'+String(t).replace('.','-')+'.png'),Buffer.from(actual.png,'base64'));
    samples.push(actual.sample);
  }
  const hashes=[];
  const outputMp4=path.join(output,'CrieSeuVideo_Gemini_Real_Obra_12s_DIAGNOSTICO.mp4');
  ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','30',
    '-vcodec','png','-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','19',
    '-pix_fmt','yuv420p','-movflags','+faststart',outputMp4],{stdio:['pipe','ignore','pipe']});
  let ffLog='';ff.stderr.on('data',x=>ffLog+=String(x));
  let frameRejectedCount=0, worstIKError=0;
  for(let i=0;i<frames;i++){
    const f=await frame(i/30);
    if(f.sample.frameRejected)frameRejectedCount++;
    worstIKError=Math.max(worstIKError,f.sample.maxIKError);
    const png=Buffer.from(f.png,'base64');
    if(i%15===0)hashes.push(createHash('sha256').update(png).digest('hex'));
    if(!ff.stdin.write(png))await once(ff.stdin,'drain');
    if(i%60===0)console.log('Rendered actual Gemini frames '+i+'/'+frames);
  }
  ff.stdin.end();
  const [ffCode]=await once(ff,'exit');ff=null;
  if(ffCode!==0)throw Error('ffmpeg conversion failed: '+ffLog);
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries',
    'stream=codec_name,width,height,nb_read_frames:format=duration,size','-of','json',
    outputMp4],{encoding:'utf8'}));
  assert.equal(probe.streams[0].nb_read_frames,String(frames));
  assert.equal(probe.streams[0].codec_name,'h264');
  assert.equal(probe.streams[0].width,720);assert.equal(probe.streams[0].height,1280);
  const report={
    status:frameRejectedCount||!state.physics.valid?'DIAGNOSTIC_ONLY_REJECTED_IK':'EXPORT_VALIDATED_PHYSICS_NOT_ARTISTIC',
    source:'ONE_REAL_GEMINI_RESPONSE_UNEDITED',
    sourceRun:'44136484717',
    provider:'gemini',model:'gemini-3.6-flash',
    realGeminiCallsInFirstRun:1,
    realGeminiCallsDuringReplay:0,
    programSHA256:programHash,
    duration,frames,resolution:[720,1280],fps:30,
    uniqueFrameHashesEveryHalfSecond:new Set(hashes).size,
    frameRejectedCount,worstIKError,physicsVerdict:state.physics,
    samples,errors,requestViolations,
  };
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  await fs.copyFile('lab/gemini-real-replay/public/program.json',path.join(output,'original-real-gemini-program.json'));
  assert.deepEqual(requestViolations,[]);assert.deepEqual(errors,[]);
  console.log('Generated real Gemini SceneProgram directly into 360-frame MP4. Verdict:',report.status);
  if(report.status==='DIAGNOSTIC_ONLY_REJECTED_IK') process.exitCode=4; // deliberately reject misleading quality claim
}catch(e){
  await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:(e).message},null,2));
  console.error(e);process.exitCode=1;
}finally{
  if(ff)ff.kill('SIGKILL');
  await browser?.close();
}
