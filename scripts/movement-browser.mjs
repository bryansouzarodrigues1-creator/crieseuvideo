// Original 12s acting study through the real Code 3D studio. No model requests.
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const mode=JSON.parse(await readFile('scripts/fixtures/movement.render.json','utf8')).mode;
const out=path.resolve('tmp/movement-'+mode);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:1100},acceptDownloads:true});const errors=[],consoleErrors=[];let provider=0,generations=0,stage='start';
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,700));});
page.on('request',r=>{if(/ai.gateway.lovable.dev|generativelanguage.googleapis.com/.test(r.url()))provider++;if(r.method()==='POST'&&/_serverFn/.test(r.url()))generations++;});
const frame=()=>page.frames().find(f=>f.url()==='about:srcdoc');
const ready=async()=>{await page.waitForFunction(()=>/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||''),undefined,{timeout:60000});assert.match(await page.locator('main').innerText(),/estado: pronto/,(await page.getByRole('alert').allTextContents()).join('\n'));assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');};
const seek=async t=>{await page.getByRole('slider',{name:'Linha do tempo'}).fill(String(t));await page.waitForTimeout(160);return frame().evaluate(()=>{const c=document.createElement('canvas');c.width=72;c.height=128;const ctx=c.getContext('2d');ctx.drawImage(document.querySelector('canvas'),0,0,72,128);return [...ctx.getImageData(0,0,72,128).data];});};
const capture=async(name,t)=>{const pixels=await seek(t);const data=await frame().evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]);await writeFile(path.join(out,name+'-'+t.toFixed(2)+'.png'),Buffer.from(data,'base64'));return pixels;};
try{
 await page.goto('http://127.0.0.1:4198/motor-3d/codigo',{waitUntil:'domcontentloaded',timeout:60000});await page.locator('#code3d-import').waitFor({timeout:60000});assert.equal(await page.locator('iframe').count(),0);
 if(mode==='full')await page.locator('#code3d-quality').selectOption('hd');
 stage='load movement';await page.getByRole('button',{name:'Testar caminhada e escada',exact:true}).click();await ready();assert.match(await page.locator('main').innerText(),/Caminhada e encaixes · nenhuma chamada à IA/);
 const size=await frame().evaluate(()=>{const c=document.querySelector('canvas');return[c.width,c.height];});assert.deepEqual(size,mode==='full'?[720,1280]:[432,768]);
 const times=[.1,1.3,2.5,3.6,4.8,5.5,6.5,8.3,10.5,11.7];let base;
 for(const t of times){const pixels=await capture('movement',t);if(t===6.5)base=pixels;}
 await seek(.5);const repeated=await seek(6.5);let diff=0;for(let i=0;i<base.length;i++)diff=Math.max(diff,Math.abs(base[i]-repeated[i]));assert.equal(diff,0);assert.ok(new Set(base).size>50);
 stage='native export';console.log('EXPORT_START '+mode);const waiting=page.waitForEvent('download',{timeout:600000});const failed=page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=alert]')).some(x=>/Exportação falhou/.test(x.textContent||'')),undefined,{timeout:600000}).then(()=>{throw new Error('Native export failed');});
 await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).click();const download=await Promise.race([waiting,failed]);assert.ok(download.suggestedFilename().endsWith('.mp4'));await download.saveAs(path.join(out,'Motor_Caminhada_Encaixes_12s_sem_som.mp4'));await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).waitFor({timeout:15000});console.log('EXPORT_DONE '+mode);
 const input=page.locator('#code3d-import');
 const load=async(code,name)=>{const old=await page.locator('iframe').getAttribute('srcdoc');await input.setInputFiles({name,mimeType:'text/javascript',buffer:Buffer.from(code)});await page.waitForFunction(old=>{const f=document.querySelector('iframe');return f&&f.srcdoc!==old&&/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||'');},old,{timeout:60000});await ready();};
 stage='legacy 4-argument compatibility';await load(await readFile('scripts/fixtures/code3d-crane.js','utf8'),'legacy-crane.js');await capture('legacy-four-arguments',4);
 stage='updated construction recipe';await page.getByRole('button',{name:'Carregar construção por etapas',exact:true}).click();await ready();await capture('construction-default',7.7);
 stage='updated construction contacts';await load('const CONSTRUCTION_CLIP_START=72;\n'+await readFile('scripts/fixtures/construction-study.js','utf8'),'construction-contacts.js');for(const t of [1,6,11])await capture('construction-contacts',t);
 assert.deepEqual(errors,[]);assert.equal(provider,0);assert.equal(generations,0);
 const hash=async f=>createHash('sha256').update(await readFile(f)).digest('hex');
 await writeFile(path.join(out,'report.json'),JSON.stringify({passed:true,mode,width:size[0],height:size[1],fps:mode==='full'?30:24,duration:12,frames:mode==='full'?360:288,maxReplayDiff:diff,legacyFourArguments:true,updatedConstruction:true,providerRequests:provider,generationRequests:generations,errors,consoleErrors,helper_sha256:await hash('src/studio/code3d/sceneToolsRuntime.js'),scene_sha256:await hash('src/studio/code3d/recipes/walkwayReviewRuntime.js'),origin:'Manually directed original study using fixed engine helpers, informed by user-provided Gemini examples. Not autonomous Gemini generation.',renderer:'Actual Code3DStudio recipe button, opaque sandbox and native fixed-frame exporter',commit:process.env.GITHUB_SHA||null},null,2));console.log('PASS '+mode);
}catch(e){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(path.join(out,'failure.json'),JSON.stringify({stage,error:String(e),errors,consoleErrors,visible:await page.locator('main').innerText().catch(()=>''),provider,generations},null,2));throw e;}finally{await browser.close();}
