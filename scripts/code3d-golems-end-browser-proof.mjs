// Use the existing import control, opaque sandbox and video-export button.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';import assert from 'node:assert/strict';
const mode=process.env.GOLEMS_PROOF_MODE||'video';
const out=path.resolve(mode==='frames'?'tmp/golems-end-story-preview':'tmp/golems-end-story-engine');await mkdir(out,{recursive:true});
const source=await readFile('scripts/fixtures/code3d-golems-end-story.js','utf8');
const provenance=JSON.parse(await readFile('scripts/fixtures/code3d-golems-end-story.provenance.json','utf8'));
assert.equal(createHash('sha256').update(source).digest('hex'),provenance.source_sha256);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:1100},acceptDownloads:true});
const errors=[],consoleErrors=[],providerRequests=[],generationRequests=[],clips=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,1000));});
page.on('request',r=>{if(/ai.gateway.lovable.dev|generativelanguage.googleapis.com/.test(r.url()))providerRequests.push(r.url().split('?')[0]);if(r.method()==='POST'&&/_serverFn/.test(r.url()))generationRequests.push(r.url().split('?')[0]);});
let stage='start studio',shot=0;
try{
 await page.goto((process.env.GOLEMS_PROOF_URL||'http://127.0.0.1:4198')+'/motor-3d/codigo',{waitUntil:'domcontentloaded',timeout:60000});
 const input=page.locator('#code3d-import');await input.waitFor({timeout:60000});
 for(shot=0;shot<4;shot++){
  stage='import shot '+(shot+1);
  const oldSrc=await page.locator('iframe').count()?await page.locator('iframe').getAttribute('srcdoc'):'';
  const code='const STORY_SHOT='+shot+';\n'+source;
  await input.setInputFiles({name:`golems-end-scene-${shot+1}.js`,mimeType:'text/javascript',buffer:Buffer.from(code)});
  await page.waitForFunction(old=>{const f=document.querySelector('iframe');return f&&f.srcdoc!==old&&/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||'');},oldSrc,{timeout:60000});
  const visible=await page.locator('main').innerText();assert.match(visible,/estado: pronto/,(await page.getByRole('alert').allTextContents()).join('\n'));assert.match(visible,/Código importado · nenhuma chamada à IA/);
  assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
  assert.equal(Number(await page.getByRole('slider',{name:'Linha do tempo'}).getAttribute('max')),10);
  const frame=()=>page.frames().find(f=>f.url()==='about:srcdoc');
  const seek=async t=>{
   await page.getByRole('slider',{name:'Linha do tempo'}).fill(String(t));await page.waitForTimeout(180);
   return frame().evaluate(()=>{const c=document.createElement('canvas');c.width=54;c.height=96;const x=c.getContext('2d');x.drawImage(document.querySelector('canvas'),0,0,54,96);return Array.from(x.getImageData(0,0,54,96).data);});
  };
  stage='capture shot '+(shot+1);const samples=[];
  for(const t of (mode==='frames'?[0,1.5,3.8,4.85,5.4,6.4,7.5,9.6]:[0,3.8,5.4,9.6])){
   const pixels=await seek(t);samples.push({t,pixels});
   const data=await frame().evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]);
   await writeFile(path.join(out,`scene-${shot+1}-${t.toFixed(2)}s.png`),Buffer.from(data,'base64'));
  }
  const middle=samples.find(s=>s.t===3.8).pixels,repeated=await seek(3.8);let maxDiff=0;for(let i=0;i<middle.length;i++)maxDiff=Math.max(maxDiff,Math.abs(middle[i]-repeated[i]));
  assert.ok(maxDiff<=3,`Shot ${shot+1} replay diverged: ${maxDiff}`);assert.notDeepEqual(samples[0].pixels,middle);assert.notDeepEqual(middle,samples.at(-1).pixels);assert.ok(new Set(middle).size>50);
  let filename=null,ext=null;
  if(mode!=='frames'){
   stage='export shot '+(shot+1);console.log('EXPORT_START scene='+String(shot+1));
   const waiting=page.waitForEvent('download',{timeout:600000});
   await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).click();
   const download=await waiting;ext=download.suggestedFilename().endsWith('.mp4')?'mp4':'webm';filename=`Golems_End_Cena_${shot+1}_10s.${ext}`;await download.saveAs(path.join(out,filename));
   await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).waitFor({timeout:15000});console.log('EXPORT_DONE scene='+String(shot+1)+' file='+filename);
  }
  clips.push({shot:shot+1,filename,ext,duration:10,frames:240,fps:24,width:432,height:768,maxReplayDiff:maxDiff});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(providerRequests,[]);assert.deepEqual(generationRequests,[]);
 await page.screenshot({path:path.join(out,'studio-exported.png'),fullPage:true});
 await writeFile(path.join(out,'report.json'),JSON.stringify({passed:true,mode,renderer:'Actual CrieSeuVideo Code3DStudio UI, opaque WebGL sandbox and existing fixed-frame export',route:'/motor-3d/codigo',source:provenance,clips,providerRequests:0,generationRequests:0,errors,consoleErrors,commit:process.env.GITHUB_SHA||null,limitation:'Original story code imported by the test driver; no autonomous Gemini generation or production deployment. Sound and final clip assembly are separate.'},null,2));
 console.log('PASS: '+mode+' proof for all four story clips; no model requests');
}catch(error){
 await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(path.join(out,'failure.json'),JSON.stringify({stage,shot:shot+1,error:String(error),errors,consoleErrors,visible:await page.locator('main').innerText().catch(()=>''),providerRequests,generationRequests},null,2));throw error;
}finally{await browser.close();}
