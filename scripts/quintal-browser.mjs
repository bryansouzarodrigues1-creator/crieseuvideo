// Manually directed original garden; actual Code 3D import, opaque iframe and native export.
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const cfg=JSON.parse(await readFile('scripts/fixtures/quintal.render.json','utf8'));
const preview=cfg.mode==='preview',group=Number(process.env.QUINTAL_GROUP||cfg.group||0),groups=cfg.groups||4;
const out=path.resolve('tmp/quintal-'+(preview?'preview':'full-'+group));await mkdir(out,{recursive:true});
const source=await readFile('scripts/fixtures/quintal.scene.js','utf8');
assert.ok(source.length<80000);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:1150},acceptDownloads:true});
const errors=[],exports=[],captures=[];let stage='start',provider=0,generations=0;
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(/ai.gateway.lovable.dev|generativelanguage.googleapis.com|fal.run/.test(r.url()))provider++;if(r.method()==='POST'&&/_serverFn/.test(r.url()))generations++;});
const frame=()=>page.frames().find(f=>f.url()==='about:srcdoc');
async function load(offset,duration=10){
 stage='load '+offset;const old=await page.locator('iframe').getAttribute('srcdoc').catch(()=>null);
 const code=source.replace('/* SEGMENT_CONFIG */','const SEGMENT_OFFSET='+offset+'; const SEGMENT_DURATION='+duration+';');
 await page.locator('#code3d-import').setInputFiles({name:'quintal-'+offset+'.js',mimeType:'text/javascript',buffer:Buffer.from(code)});
 await page.waitForFunction(old=>{const f=document.querySelector('iframe');return f&&f.srcdoc!==old&&/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||'');},old,{timeout:90000});
 assert.match(await page.locator('main').innerText(),/estado: pronto/,(await page.getByRole('alert').allTextContents()).join('\n'));
 assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
}
async function seek(t){await page.getByRole('slider',{name:'Linha do tempo'}).fill(String(t));await page.waitForTimeout(90);}
async function capture(name,t,absolute){
 await seek(t);const data=await frame().evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]);
 await writeFile(path.join(out,name+'.png'),Buffer.from(data,'base64'));captures.push({name,t:absolute});
}
async function exportNative(name,duration,offset){
 stage='export '+name;console.log('EXPORT_START '+name);
 const pending=page.waitForEvent('download',{timeout:900000});
 const failed=page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=alert]')).some(x=>/Exportação falhou|Falha na exportação/.test(x.textContent||'')),undefined,{timeout:900000}).then(()=>{throw new Error('Native export reported a visible failure');});
 await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).click();
 const d=await Promise.race([pending,failed]);assert.ok(d.suggestedFilename().endsWith('.mp4'));await d.saveAs(path.join(out,name+'.mp4'));
 await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).waitFor({timeout:20000});
 exports.push({name,duration,offset,frames:duration*(preview?24:30)});console.log('EXPORT_DONE '+name);
}
try{
 await page.goto('http://127.0.0.1:4198/motor-3d/codigo',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#code3d-import').waitFor({timeout:60000});if(!preview)await page.locator('#code3d-quality').selectOption('hd');
 if(preview){
  const samples=cfg.samples||[1,7,17,24,30,35,42,49,55,62,68,76,83,89,95,101,107,114,122,129,135,140,148,154,160,166,173,179,185,192,202,216,229];
  let previous=-1;for(const t of samples){const base=Math.floor(t/10)*10;if(base!==previous){await load(base,10);previous=base;}await capture('scene-'+String(t).padStart(3,'0'),t-base,t);}
  await load(28,8);await exportNative('Quintal_Teste_Agua_8s',8,28);
 }else{
  const extra=[42,76,95,101,107,114,122,129,135,140,148,166,170,173,185,192,202,229,231];
  for(let i=0;i<24;i++){if(i%groups!==group||(cfg.clips&&!cfg.clips.includes(i)))continue;const offset=i*10,duration=i===23?8:10;await load(offset,duration);await capture('clip-'+String(i).padStart(2,'0'),Math.min(4,duration-.5),offset+4);for(const t of extra)if(t>=offset&&t<offset+duration)await capture('review-'+t,t-offset,t);await exportNative('Quintal_Cena_'+String(i).padStart(2,'0'),duration,offset);}
 }
 assert.deepEqual(errors,[]);assert.equal(provider,0);assert.equal(generations,0);
 const sha=createHash('sha256').update(source).digest('hex');
 await writeFile(path.join(out,'report.json'),JSON.stringify({passed:true,preview,group,captures,exports,width:preview?432:720,height:preview?768:1280,fps:preview?24:30,providerRequests:provider,generationRequests:generations,errors,sceneSHA256:sha,origin:'Original manually directed Three.js program imported into actual Code 3D studio; opaque sandbox, sampled replay and native encoder. Audio/cut editing is separate; no autonomous generation claim.',commit:process.env.GITHUB_SHA||null},null,2));
 console.log('PASS garden '+(preview?'preview':group));
}catch(e){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(path.join(out,'failure.json'),JSON.stringify({stage,error:String(e),errors,provider,generations,visible:await page.locator('main').innerText().catch(()=> '')},null,2));throw e;}finally{await browser.close();}
