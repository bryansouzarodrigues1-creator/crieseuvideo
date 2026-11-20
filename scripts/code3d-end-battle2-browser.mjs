// Original story code goes through the actual studio import, sandbox and exporter.
import {chromium} from 'playwright';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import path from 'node:path';import assert from 'node:assert/strict';
const mode=process.env.BATTLE_MODE||'preview',group=Number(process.env.BATTLE_GROUP||0);
const ids=mode==='preview'?Array.from({length:12},(_,i)=>i):[group*3,group*3+1,group*3+2];
const out=path.resolve(mode==='preview'?'tmp/end-battle2-preview':`tmp/end-battle2-group-${group}`);await mkdir(out,{recursive:true});
const source=await readFile('scripts/fixtures/code3d-end-battle2.js','utf8'),provenance=JSON.parse(await readFile('scripts/fixtures/code3d-end-battle2.provenance.json','utf8'));
assert.equal(createHash('sha256').update(source).digest('hex'),provenance.source_sha256);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:1100},acceptDownloads:true});const errors=[],consoleErrors=[],providerRequests=[],generationRequests=[],clips=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,900));});
page.on('request',r=>{if(/ai.gateway.lovable.dev|generativelanguage.googleapis.com/.test(r.url()))providerRequests.push(r.url().split('?')[0]);if(r.method()==='POST'&&/_serverFn/.test(r.url()))generationRequests.push(r.url().split('?')[0]);});
let stage='start',id=-1;
try{
 await page.goto((process.env.BATTLE_URL||'http://127.0.0.1:4198')+'/motor-3d/codigo',{waitUntil:'domcontentloaded',timeout:60000});const input=page.locator('#code3d-import');await input.waitFor({timeout:60000});
 for(id of ids){
  stage='import '+id;const previous=await page.locator('iframe').count()?await page.locator('iframe').getAttribute('srcdoc'):'';
  await input.setInputFiles({name:`battle-part2-scene-${id+1}.js`,mimeType:'text/javascript',buffer:Buffer.from('const BATTLE_SCENE='+id+';\n'+source)});
  await page.waitForFunction(old=>{const f=document.querySelector('iframe');return f&&f.srcdoc!==old&&/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||'');},previous,{timeout:60000});
  assert.match(await page.locator('main').innerText(),/estado: pronto/,(await page.getByRole('alert').allTextContents()).join('\n'));assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
  const frame=()=>page.frames().find(f=>f.url()==='about:srcdoc');
  const seek=async t=>{await page.getByRole('slider',{name:'Linha do tempo'}).fill(String(t));await page.waitForTimeout(160);return frame().evaluate(()=>{const c=document.createElement('canvas');c.width=54;c.height=96;const x=c.getContext('2d');x.drawImage(document.querySelector('canvas'),0,0,54,96);return Array.from(x.getImageData(0,0,54,96).data);});};
  const samples=[];stage='frames '+id;
  const eventTime=({2:3.4,5:6.8,8:2.4,9:4.5,10:6.5})[id];const captureTimes=[1.5,5.0,8.5,...(eventTime!==undefined?[eventTime]:[])];
  for(const t of captureTimes){samples.push(await seek(t));const raw=await frame().evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]);await writeFile(path.join(out,`scene-${String(id+1).padStart(2,'0')}-${t.toFixed(1)}s.png`),Buffer.from(raw,'base64'));}
  const repeated=await seek(5);let diff=0;for(let k=0;k<repeated.length;k++)diff=Math.max(diff,Math.abs(repeated[k]-samples[1][k]));assert.ok(diff<=3,`Scene ${id+1} replay difference ${diff}`);assert.ok(new Set(repeated).size>50);assert.notDeepEqual(samples[0],samples[2]);
  let filename=null,ext=null;
  if(mode!=='preview'||id===2){
   stage='export '+id;console.log(`EXPORT_START scene=${id+1}`);const waiting=page.waitForEvent('download',{timeout:600000});await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).click();const download=await waiting;ext=download.suggestedFilename().endsWith('.mp4')?'mp4':'webm';filename=`Batalha_End_Parte2_Cena_${String(id+1).padStart(2,'0')}_10s.${ext}`;await download.saveAs(path.join(out,filename));await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).waitFor({timeout:15000});console.log(`EXPORT_DONE scene=${id+1}`);
  }
  clips.push({scene:id+1,filename,ext,duration:10,frames:240,fps:24,width:432,height:768,maxReplayDiff:diff});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(providerRequests,[]);assert.deepEqual(generationRequests,[]);await page.screenshot({path:path.join(out,'studio.png'),fullPage:true});
 await writeFile(path.join(out,'report.json'),JSON.stringify({passed:true,mode,group,clips,provenance,renderer:'Existing Code3DStudio import, opaque WebGL sandbox and native export button',errors,consoleErrors,providerRequests:0,generationRequests:0,commit:process.env.GITHUB_SHA||null,limitation:'Programmed story imported into a repository test instance, not autonomous Gemini generation or production deployment.'},null,2));console.log(`PASS: ${mode} ${group}`);
}catch(error){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(path.join(out,'failure.json'),JSON.stringify({stage,id,error:String(error),errors,consoleErrors,visible:await page.locator('main').innerText().catch(()=>''),providerRequests,generationRequests},null,2));throw error;}finally{await browser.close();}
