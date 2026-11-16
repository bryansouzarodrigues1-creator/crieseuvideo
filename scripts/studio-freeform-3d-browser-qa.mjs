/**
 * Exercises the ACTUAL CrieSeuVideo React app, not just the isolated lab.
 * Gemini is fully mocked at the browser network boundary: zero model charges.
 * The scene schema comes from the same server-side normalization as production.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { normalizePlan } from '../src/studio/explainer/plan.ts';
import { withTargetDuration } from '../src/studio/explainer/duration.ts';
import { mechanicalDemoScript, mechanicalDemoResponse, mechanicalDemoProgram } from '../src/studio/explainer/sceneProgram/mechanicalDemo.ts';
import { makeSceneProgramCandidate } from '../src/studio/explainer/sceneProgram/candidate.ts';

const PORT = 4173;
const base = 'http://127.0.0.1:' + PORT;
const output = path.resolve('tmp/real-studio-3d-qa');
await fs.mkdir(output, {recursive:true});

const server = spawn('bun',['run','dev','--','--host','127.0.0.1','--port',String(PORT),'--strictPort'],{
  env:{...process.env, CI:'true', NO_COLOR:'1',
    // Dummy browser-side Supabase config. No real token or network connection.
    VITE_SUPABASE_URL:'https://qa3d.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only',
  },stdio:['ignore','pipe','pipe'],
});
let serverTail = '';
for (const stream of [server.stdout,server.stderr]) stream.on('data', buffer=>{
  serverTail = (serverTail+buffer.toString()).slice(-5000);
});
const ready=async()=>{
  for(let i=0;i<150;i++){
    if(server.exitCode!==null)throw Error('Vite exited before ready: '+serverTail);
    try {
      const response=await fetch(base,{signal:AbortSignal.timeout(800)});
      if(response.ok&&response.headers.get('content-type')?.includes('text/html'))return;
    } catch {}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw Error('Vite did not start within 75 seconds: '+serverTail);
};
let browser;
const errors=[], seenRequests=[];
try{
  await ready();
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
    '--use-gl=angle','--use-angle=swiftshader'
  ]});
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1,
    acceptDownloads:true});
  // The demo uses the actual browser Supabase getSession() path. This fixture
  // is not a verified identity: the backend never receives it, because API
  // calls are intercepted. Real authorization is covered by gate unit tests.
  const syntheticJWT='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.qa3d-not-a-real-token';
  await page.addInitScript(({key,token})=>{
    localStorage.setItem(key,JSON.stringify({
      access_token:token,refresh_token:'qa3d-refresh-only',token_type:'bearer',
      expires_in:1800000000,expires_at:4100000000,
      user:{id:'123e4567-e89b-42d3-a456-426614174000',aud:'authenticated',
        role:'authenticated',email:'qa3d@example.invalid',app_metadata:{},user_metadata:{},
        created_at:'2026-01-01T00:00:00.000Z'},
    }));
  },{key:'sb-qa3d-auth-token',token:syntheticJWT});
  page.on('pageerror',err=>errors.push('pageerror: '+err.message));
  page.on('console',msg=>{
    if(msg.type()!=='error')return;
    const message=msg.text();
    // Expected: external fonts intentionally blocked by the offline QA browser,
    // and the deliberate HTTP 503 fixture used to test failure recovery.
    if(/Failed to load resource: net::ERR_FAILED/.test(message) ||
       /Failed to load resource: the server responded with a status of 50[23]/.test(message))return;
    errors.push('console: '+message.slice(0,250));
  });
  let providerRequests=0;
  await page.route('**/api/ai/explainer-plan',async route=>{
    providerRequests++;
    const data=route.request().postDataJSON();
    const auth=route.request().headers()['authorization'];
    assert.equal(auth,'Bearer '+syntheticJWT,'Expected browser owner session header, not a Google API key.');
    seenRequests.push(data);
    if(providerRequests===1){
      const normalized=withTargetDuration(normalizePlan(mechanicalDemoResponse(),
        mechanicalDemoScript,'9:16'),8);
      const plan={...normalized,engine:'3d'};
      assert.deepEqual(data,{script:mechanicalDemoScript,aspect:'9:16',mode:'program',
        engine:'3d',targetDuration:8,gallery:[]});
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({plan,source:'ai',provider:'gemini',model:'simulated'})});
      return;
    }
    if(providerRequests===3){
      const invalid={...mechanicalDemoProgram(),javascript:'unsafe code must never run'};
      const candidate=makeSceneProgramCandidate(invalid,[{sourceId:'s1',text:mechanicalDemoScript}]);
      await route.fulfill({status:502,contentType:'application/json',
        body:JSON.stringify({error:'O programa contém um campo não suportado.',
          code:'invalid_scene_program',candidate})});
      return;
    }
    if(providerRequests===4){
      assert.equal(data.mode,'program');
      assert.ok(data.previousProposal,'Explicit repair did not send rejected Gemini program');
      assert.equal(data.previousProposal.program.javascript,'unsafe code must never run');
      assert.match(data.repairIssue,/campo não suportado/);
      assert.equal(data.script,mechanicalDemoScript);
      const normalized=withTargetDuration(normalizePlan(mechanicalDemoResponse(),
        mechanicalDemoScript,data.aspect),8);
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({plan:{...normalized,engine:'3d'},source:'ai',
          provider:'gemini',model:'simulated-repair'})});
      return;
    }
    await route.fulfill({status:503,contentType:'application/json',
      body:JSON.stringify({error:'Provedor indisponível (teste), nenhuma cena substituída.'})});
  });
  await page.route('**/api/ai/feedback',route=>route.fulfill({status:200,
    contentType:'application/json',body:'{}'}));
  // Offline browser: abort everything outside our local app. The application
  // must produce 3D with the procedural engine, not remote fonts/images/CDN.
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith(base+'/') || url===base+'/')return route.fallback();
    return route.abort();
  });
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('heading',{name:'Do roteiro à animação.'}).waitFor({timeout:60000});
  await page.getByRole('button',{name:/3D livre.*Gemini direto/i}).click();
  assert.equal(providerRequests,0,'Selecting 3D mode must not call Gemini or Lovable');
  await page.getByLabel('Roteiro / narração').fill(mechanicalDemoScript);
  await page.getByLabel('Duração do vídeo').selectOption('custom');
  await page.getByRole('spinbutton',{name:'Duração em segundos'}).fill('8');
  const narrate=page.getByRole('button',{name:'Com narração'});
  if(await narrate.isVisible())await narrate.click();
  await page.getByRole('button',{name:'Programar 3D com Gemini'}).click();
  await page.getByRole('status').getByText(/3D livre: 4 ações verificadas matematicamente/).waitFor({timeout:70000});
  assert.equal(providerRequests,1,'Must perform exactly one requested planning call');
  assert.equal(await page.getByLabel('Texto da cena 1').inputValue(),mechanicalDemoScript);
  const pause=page.getByRole('button',{name:'Pausar'});
  if(await pause.isVisible())await pause.click();

  const timeline=page.getByRole('slider',{name:'Linha do tempo'});
  const canvas=page.locator('.explainer-canvas-wrap canvas');
  const frames=[];
  async function seek(time,name){
    // React controlled ranges require the native setter to emit a trusted-like
    // change event (direct .value assignment alone is ignored by React).
    await timeline.evaluate((element,t)=>{
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      setter.call(element,String(t));
      element.dispatchEvent(new Event('input',{bubbles:true}));
      element.dispatchEvent(new Event('change',{bubbles:true}));
    },time);
    await page.waitForTimeout(160);
    const report=await canvas.evaluate(c=>{
      const g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;
      const colors=new Set();
      for(let i=0;i<d.length;i+=Math.max(4,Math.floor(d.length/25000/4)*4)){
        colors.add(d[i]+','+d[i+1]+','+d[i+2]);
      }
      return {w:c.width,h:c.height,colors:colors.size,png:c.toDataURL('image/png')};
    });
    assert.equal(report.w,720);assert.equal(report.h,1280);
    assert.ok(report.colors>20,'Canvas is blank or not a real rendered scene: '+report.colors+' colors');
    const buffer=Buffer.from(report.png.split(',')[1],'base64');
    const hash=createHash('sha256').update(buffer).digest('hex');
    frames.push({time,hash,colors:report.colors});
    await fs.writeFile(path.join(output,name+'.png'),buffer);
    return hash;
  }
  const a=await seek(1,'studio-assembly-1');
  const b=await seek(5,'studio-assembly-5');
  const c=await seek(7.7,'studio-rotating-blades');
  assert.equal(new Set([a,b,c]).size,3,'Assembly scene did not render three visually distinct moments');

  // The secondary provider failure must NOT replace the previous working
  // preview, reset the audio, invent frames or fall back to a static presenter.
  const before=await seek(5,'studio-before-502');
  await page.getByRole('button',{name:'Programar 3D com Gemini'}).click();
  await page.getByRole('status').getByText(/HTTP 503|Provedor indisponível|Direção não aplicada/).waitFor({timeout:30000});
  assert.equal(providerRequests,2);
  assert.equal(await page.getByLabel('Texto da cena 1').inputValue(),mechanicalDemoScript);
  const after=await seek(5,'studio-after-502');
  assert.equal(after,before,'Failed Gemini response replaced or modified the previous 3D preview');

  // Existing 3D programs must adapt to landscape without re-inference.
  await page.getByRole('button',{name:'Horizontal 16:9'}).click();
  await page.waitForTimeout(300);
  const landscape=await canvas.evaluate(c=>({w:c.width,h:c.height,empty:c.getContext('2d').getImageData(10,10,1,1).data[3]===0}));
  assert.deepEqual(landscape,{w:1280,h:720,empty:false});
  assert.equal(providerRequests,2);
  // The first retry to program a NEW scene is a manual request. When the
  // server rejects the generated JSON it must return inert feedback and offer
  // a *separate* button, not silently spend another Gemini call.
  await page.getByRole('button',{name:'Programar 3D com Gemini'}).click();
  await page.getByRole('button',{name:'Corrigir com Gemini'}).waitFor({timeout:30000});
  assert.equal(providerRequests,3,'Invalid program must not trigger automatic retries');
  assert.equal(await page.getByLabel('Texto da cena 1').inputValue(),mechanicalDemoScript);
  await page.getByRole('button',{name:'Corrigir com Gemini'}).click();
  await page.getByRole('status').getByText(/3D livre: 4 ações verificadas matematicamente/).waitFor({timeout:60000});
  assert.equal(providerRequests,4,'Only the user may start the repair call');
  await page.getByRole('button',{name:'Programar 3D com Gemini'}).waitFor();
  assert.equal(await page.getByLabel('Texto da cena 1').inputValue(),mechanicalDemoScript);

  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({
    result:'PASS',source:'production React editor',provider:'Gemini mocked at route',
    paidCalls:0,unpromptedCalls:0,manualCalls:providerRequests,planPreservedOnError:true,manualRepairValidated:true,
    preservesExactNarration:true,program:'lathe+hierarchical-mechanical-timeline',
    aspectRatios:['9:16','16:9'],frames,landscape,
    errors,requestedData:seenRequests
  },null,2));
  assert.deepEqual(errors,[],'Unhandled errors in real React Studio');
  console.log('PASS real CrieSeuVideo studio dynamic 3D; 3 different frames, preservation on 503, opt-in repair on 502, landscape, zero real AI calls.');
}finally{
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise(resolve=>{
    if(server.exitCode!==null||server.signalCode!==null)return resolve();
    server.once('exit',resolve);
    setTimeout(()=>{server.kill('SIGKILL');resolve();},2000).unref();
  });
}
