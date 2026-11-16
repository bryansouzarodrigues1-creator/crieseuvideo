/**
 * Offline render of the EXACT validated scene returned by the one approved
 * Gemini API call. This script performs ZERO external AI requests. It opens
 * the real React studio, captures 5 actual WebGL frames and exports a mobile
 * H.264 MP4 (no narration, as approved).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const out = path.resolve('tmp/authorized-gemini-3d-trial');
const plan = JSON.parse(await fs.readFile(path.join(out, 'program.json'), 'utf8'));
assert.ok(plan.sceneProgram && plan.scenes?.length && plan.engine !== '2d', 'Missing verified real 3D program');
const script = plan.scenes.map(s=>s.text).join(' ');
assert.ok(script.length > 20 && script.length < 6000, 'Invalid narration text');
const duration = plan.scenes.reduce((n,s)=>n+s.duration,0);
assert.ok(duration >= 5 && duration <= 20, 'Unexpected trial length');
const PORT=4185, base='http://127.0.0.1:'+PORT;
await fs.mkdir(out,{recursive:true});
const server=spawn('bun',['run','dev','--','--host','127.0.0.1','--port',String(PORT),'--strictPort'],{
  env:{...process.env,CI:'true',NO_COLOR:'1',
    VITE_SUPABASE_URL:'https://qa3d.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only',
    // Prevent the stage renderer from ever seeing a Gemini provider key.
    FREEFORM_3D_GEMINI_API_KEY:'',
    GEMINI_API_KEY:'',
  },
  stdio:['ignore','pipe','pipe'],
});
let tail='';
for(const stream of [server.stdout,server.stderr]) stream.on('data',b=>{tail=(tail+b.toString()).slice(-4000);});
async function waitForVite(){
  for(let i=0;i<180;i++){
    if(server.exitCode!==null) throw Error('Vite exited: '+tail);
    try{const r=await fetch(base,{signal:AbortSignal.timeout(800)});
      if(r.ok&&r.headers.get('content-type')?.includes('text/html'))return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw Error('Vite not ready: '+tail);
}
let browser;
let intercepted=0;
const errors=[],frames=[];
try{
  await waitForVite();
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
  ]});
  const page=await browser.newPage({viewport:{width:393,height:852},acceptDownloads:true});
  const syntheticJWT='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.qa3d-not-real';
  await page.addInitScript(({key,token})=>localStorage.setItem(key,JSON.stringify({
    access_token:token,refresh_token:'qa3d-only',token_type:'bearer',
    expires_in:1800000000,expires_at:4100000000,
    user:{id:'123e4567-e89b-42d3-a456-426614174000',aud:'authenticated',
      role:'authenticated',email:'qa3d@example.invalid',app_metadata:{},
      user_metadata:{},created_at:'2026-01-01T00:00:00.000Z'},
  })),{key:'sb-qa3d-auth-token',token:syntheticJWT});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/ai/explainer-plan',route=>{
    intercepted++;
    const body=route.request().postDataJSON();
    assert.equal(body.mode,'program');
    assert.equal(body.engine,'3d');
    assert.equal(body.script,script);
    assert.equal(route.request().headers()['authorization'],'Bearer '+syntheticJWT);
    if(intercepted>1)throw Error('Unexpected duplicate generation request');
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({plan,source:'ai',provider:'gemini',model:'validated-single-call-result'})});
  });
  await page.route('**/api/ai/feedback',route=>route.fulfill({
    status:200,contentType:'application/json',body:'{}',
  }));
  await page.route('**/*',route=>{
    const url=route.request().url();
    return url.startsWith(base+'/')||url===base+'/'?route.fallback():route.abort();
  });
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('heading',{name:'Do roteiro à animação.'}).waitFor();
  await page.getByRole('button',{name:/3D livre.*Gemini direto/i}).click();
  assert.equal(intercepted,0);
  await page.getByLabel('Roteiro / narração').fill(script);
  await page.getByLabel('Duração do vídeo').selectOption('custom');
  await page.getByRole('spinbutton',{name:'Duração em segundos'}).fill(String(Math.round(duration)));
  const voice=page.getByRole('button',{name:'Com narração'});
  if(await voice.isVisible())await voice.click();
  await page.getByRole('button',{name:'Programar 3D com Gemini'}).click();
  await page.getByRole('status').getByText(/3D livre:/).waitFor({timeout:90000});
  assert.equal(intercepted,1);
  const pause=page.getByRole('button',{name:'Pausar'});
  if(await pause.isVisible())await pause.click();
  const timeline=page.getByRole('slider',{name:'Linha do tempo'});
  const canvas=page.locator('.explainer-canvas-wrap canvas');

  for(const [i,f] of [.02,.23,.46,.72,.96].entries()){
    const t=duration*f;
    await timeline.evaluate((input,time)=>{
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      setter.call(input,String(time));
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
    },t);
    await page.waitForTimeout(180);
    const data=await canvas.evaluate(c=>{
      const context=c.getContext('2d'),pixels=context.getImageData(0,0,c.width,c.height).data;
      const samples=new Set();
      for(let k=0;k<pixels.length;k+=160) samples.add(pixels[k]+','+pixels[k+1]+','+pixels[k+2]);
      return {width:c.width,height:c.height,colors:samples.size,png:c.toDataURL('image/png').split(',')[1]};
    });
    assert.equal(data.width,720);assert.equal(data.height,1280);
    assert.ok(data.colors>20,'Blank scene: '+data.colors+' colors');
    const png=Buffer.from(data.png,'base64');
    const hash=createHash('sha256').update(png).digest('hex');
    frames.push({time:+t.toFixed(3),sha256:hash,colors:data.colors});
    await fs.writeFile(path.join(out,'gemini-frame-'+i+'.png'),png);
  }
  const variation=new Set(frames.map(f=>f.sha256)).size;
  await fs.writeFile(path.join(out,'frame-analysis.json'),JSON.stringify({
    realGeminiPlan:true,externalModelCallsDuringRender:0,
    interceptedProgramRequests:intercepted,frameCount:frames.length,
    distinctFrames:variation,frames,errors
  },null,2));
  assert.ok(variation>=3,'Generated scene is too static; review the captured frames.');

  const pendingDownload=page.waitForEvent('download',{timeout:300000});
  await page.getByRole('button',{name:'Baixar vídeo'}).click();
  const downloaded=await pendingDownload;
  const native=path.join(out,'gemini-native'+path.extname(downloaded.suggestedFilename()));
  await downloaded.saveAs(native);
  const mp4=path.join(out,'crieseuvideo-turbina-gemini-3d.mp4');
  execFileSync('ffmpeg',['-v','error','-y','-i',native,'-an','-c:v','libx264',
    '-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',mp4],{
    timeout:210000,
  });
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames',
    '-show_entries','format=duration,size:stream=codec_type,codec_name,width,height,nb_read_frames',
    '-of','json',mp4],{encoding:'utf8'}));
  const video=probe.streams.find(s=>s.codec_type==='video');
  assert.equal(video?.codec_name,'h264');
  assert.equal(video.width,720);assert.equal(video.height,1280);
  assert.ok(Math.abs(Number(probe.format.duration)-duration)<0.2);
  assert.ok(Number(video.nb_read_frames)>=Math.floor(duration*29));
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,'video-report.json'),JSON.stringify({
    status:'VALIDATED_FILE_NOT_ARTISTIC_APPROVAL',
    modelInferenceCallsDuringRender:0,
    duration:Number(probe.format.duration),resolution:'720x1280',
    videoFrames:Number(video.nb_read_frames),filename:path.basename(mp4),
    bytes:Number(probe.format.size),uniqueWebGLSnapshots:variation,
  },null,2));
  console.log('PASS: real Gemini scene plan rendered in React Studio and exported as a verified H.264 MP4; no additional model calls.');
}finally{
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise(resolve=>{
    if(server.exitCode!==null||server.signalCode!==null)return resolve();
    server.once('exit',resolve);
    setTimeout(()=>{server.kill('SIGKILL');resolve();},2000).unref();
  });
}
