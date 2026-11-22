// Identical native rendering for both original model programs; no code repairs.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='tmp/thinking-ab';await mkdir(out,{recursive:true});
const experiment=JSON.parse(await readFile(out+'/experiment.json','utf8'));assert.equal(experiment.totalRequests,2);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const level of ['low','high']){
  const arm=experiment.arms.find(a=>a.level===level);const result={level,rendered:false,providerAccepted:arm.providerAccepted,manualCreativeEdits:false};let page,stage='prepare',providerRequests=0;const errors=[];
  try{
   if(!arm.codeReady)throw Error('No executable program: '+arm.preparationFailure);
   const code=await readFile(`${out}/${level}.js`);assert.equal(createHash('sha256').update(code).digest('hex'),arm.codeSHA256);
   page=await browser.newPage({viewport:{width:1100,height:1150},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/generativelanguage.googleapis.com|ai.gateway.lovable.dev/.test(r.url()))providerRequests++;});
   await page.goto('http://127.0.0.1:4198/motor-3d/codigo',{waitUntil:'domcontentloaded',timeout:60000});await page.locator('#code3d-import').waitFor({timeout:60000});await page.locator('#code3d-quality').selectOption('hd');
   stage='import';await page.locator('#code3d-import').setInputFiles({name:level+'.js',mimeType:'text/javascript',buffer:code});
   await page.waitForFunction(()=>/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||''),undefined,{timeout:90000});assert.match(await page.locator('main').innerText(),/estado: pronto/,(await page.getByRole('alert').allTextContents()).join('\n'));
   assert.equal(Number(await page.getByRole('slider',{name:'Linha do tempo'}).getAttribute('max')),8);assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');const frame=page.frames().find(f=>f.url()==='about:srcdoc');assert.ok(frame);
   stage='samples';const samples=[];
   for(const t of [0,.5,1,1.5,2,2.5,3,3.5,4,4.5,4.95]){await page.getByRole('slider',{name:'Linha do tempo'}).fill(String(t));await page.waitForTimeout(100);const png=await frame.evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]);await writeFile(`${out}/${level}-frame-${t.toFixed(2)}.png`,Buffer.from(png,'base64'));samples.push(t);}
   stage='native export';console.log('EXPORT_START '+level);const pending=page.waitForEvent('download',{timeout:600000});const failure=page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=alert]')).some(e=>/Exportação falhou/.test(e.textContent||'')),undefined,{timeout:600000}).then(()=>{throw Error('Native export failed.');});await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).click();const d=await Promise.race([pending,failure]);assert.ok(d.suggestedFilename().endsWith('.mp4'));await d.saveAs(`${out}/${level}-native-8s.mp4`);console.log('EXPORT_DONE '+level);
   assert.equal(providerRequests,0);assert.deepEqual(errors,[]);Object.assign(result,{rendered:true,duration:8,comparedDuration:5,width:720,height:1280,fps:30,frames:240,codeSHA256:arm.codeSHA256,samples});
  }catch(error){Object.assign(result,{stage,error:String(error),errors});if(page){await page.screenshot({path:`${out}/${level}-failure.png`,fullPage:true}).catch(()=>{});const frame=page.frames().find(f=>f.url()==='about:srcdoc');if(frame)await frame.evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]).then(png=>writeFile(`${out}/${level}-rejected-frame.png`,Buffer.from(png,'base64'))).catch(()=>{});}}
  finally{result.browserProviderRequests=providerRequests;results.push(result);if(page)await page.close();}
 }
 await writeFile(out+'/render.json',JSON.stringify({results,totalGenerationRequests:experiment.totalRequests,creativeRepairs:0,comparisonFrames:150,audio:false,renderer:'Same native Code 3D player/export, HD 30fps, Chromium SwiftShader for both arms.',qualityApproved:false,limitation:'Execution and replay checks do not certify anatomy, contact or visual clarity.'},null,2));
 if(!results.some(r=>r.rendered))throw Error('Neither arm rendered; preserve both failures without retries.');
}finally{await browser.close();}
