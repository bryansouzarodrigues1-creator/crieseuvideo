// Exercise the real studio, explicit recipe button, source import and native export.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const mode=process.env.CONSTRUCTION_MODE||'preview',group=Number(process.env.CONSTRUCTION_GROUP||0);
const ids=mode==='preview'?Array.from({length:10},(_,i)=>i):[group*2,group*2+1];
const out=path.resolve(mode==='preview'?'tmp/construction-preview':`tmp/construction-group-${group}`);await mkdir(out,{recursive:true});
const source=await readFile('scripts/fixtures/construction-study.js','utf8'),provenance=JSON.parse(await readFile('scripts/fixtures/construction-study.provenance.json','utf8'));
assert.equal(createHash('sha256').update(source).digest('hex'),provenance.source_sha256);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:1100},acceptDownloads:true});const errors=[],consoleErrors=[],providerRequests=[],generationRequests=[],clips=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,900));});
page.on('request',r=>{if(/ai.gateway.lovable.dev|generativelanguage.googleapis.com/.test(r.url()))providerRequests.push(r.url().split('?')[0]);if(r.method()==='POST'&&/_serverFn/.test(r.url()))generationRequests.push(r.url().split('?')[0]);});
let stage='start',id=-1;
try{
 await page.goto((process.env.CONSTRUCTION_URL||'http://127.0.0.1:4198')+'/motor-3d/codigo',{waitUntil:'domcontentloaded',timeout:60000});const input=page.locator('#code3d-import');await input.waitFor({timeout:60000});
 assert.equal(await page.locator('iframe').count(),0,'No unsolicited default video');
 await page.getByRole('button',{name:'Carregar construção por etapas',exact:true}).click();
 const ready=async()=>{await page.waitForFunction(()=>/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||''),undefined,{timeout:60000});assert.match(await page.locator('main').innerText(),/estado: pronto/,(await page.getByRole('alert').allTextContents()).join('\n'));};
 await ready();assert.match(await page.locator('main').innerText(),/Modelo de construção · nenhuma chamada à IA/);
 await page.locator('#code3d-quality').selectOption('hd');await ready();
 for(id of ids){
  stage='import '+id;const previous=await page.locator('iframe').getAttribute('srcdoc');
  await input.setInputFiles({name:`construction-${id}.js`,mimeType:'text/javascript',buffer:Buffer.from('const CONSTRUCTION_CLIP_START='+id*12+';\n'+source)});
  await page.waitForFunction(old=>{const f=document.querySelector('iframe');return f&&f.srcdoc!==old&&/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||'');},previous,{timeout:60000});await ready();
  assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
  const frame=()=>page.frames().find(f=>f.url()==='about:srcdoc');
  assert.deepEqual(await frame().evaluate(()=>{const c=document.querySelector('canvas');return[c.width,c.height];}),[720,1280]);
  const seek=async t=>{await page.getByRole('slider',{name:'Linha do tempo'}).fill(String(t));await page.waitForTimeout(220);return frame().evaluate(()=>{const c=document.createElement('canvas');c.width=72;c.height=128;const x=c.getContext('2d');x.drawImage(document.querySelector('canvas'),0,0,72,128);return Array.from(x.getImageData(0,0,72,128).data);});};
  const samples=[];stage='frames '+id;
  const times=mode==='preview'?[.1,3.0,6.0,9.0,11.5]:[1.0,6.0,11.0];
  for(const t of times){samples.push(await seek(t));const raw=await frame().evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]);await writeFile(path.join(out,`clip-${String(id).padStart(2,'0')}-${t.toFixed(1)}s.png`),Buffer.from(raw,'base64'));}
  const repeated=await seek(6);const comparison=samples[times.indexOf(6)];let diff=0;for(let k=0;k<repeated.length;k++)diff=Math.max(diff,Math.abs(repeated[k]-comparison[k]));assert.ok(diff<=3,`Replay difference ${diff}`);assert.ok(new Set(repeated).size>50);
  let filename=null,ext=null;
  if(mode!=='preview'||id===2){
   // First trial is deliberately lower-resolution; full movie keeps HD/30.
   if(mode==='preview'){await page.locator('#code3d-quality').selectOption('preview');await ready();}
   stage='export '+id;console.log(`EXPORT_START clip=${id}`);const waiting=page.waitForEvent('download',{timeout:600000});await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).click();const download=await waiting;ext=download.suggestedFilename().endsWith('.mp4')?'mp4':'webm';filename=`Shopping_Motor_Cena_${String(id).padStart(2,'0')}_12s.${ext}`;await download.saveAs(path.join(out,filename));await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).waitFor({timeout:15000});console.log(`EXPORT_DONE clip=${id}`);
   if(mode==='preview'){await page.locator('#code3d-quality').selectOption('hd');await ready();}
  }
  clips.push({clip:id,filename,ext,duration:12,fps:mode==='preview'&&filename?24:30,width:mode==='preview'&&filename?432:720,height:mode==='preview'&&filename?768:1280,maxReplayDiff:diff});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(providerRequests,[]);assert.deepEqual(generationRequests,[]);
 await writeFile(path.join(out,'report.json'),JSON.stringify({passed:true,mode,group,clips,provenance,renderer:'Code3DStudio: explicit construction recipe, opaque WebGL sandbox, import and native fixed-frame export',errors,consoleErrors,providerRequests:0,generationRequests:0,commit:process.env.GITHUB_SHA||null},null,2));console.log(`PASS: ${mode} ${group}`);
}catch(error){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(path.join(out,'failure.json'),JSON.stringify({stage,id,error:String(error),errors,consoleErrors,visible:await page.locator('main').innerText().catch(()=>''),providerRequests,generationRequests},null,2));throw error;}finally{await browser.close();}
