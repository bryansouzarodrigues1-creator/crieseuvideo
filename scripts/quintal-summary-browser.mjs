// Two native 10-second exports; reuse the garden models and source recording.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='tmp/quintal-summary';await mkdir(out,{recursive:true});
const base=await readFile('scripts/fixtures/quintal.scene.js','utf8'),fragment=await readFile('scripts/fixtures/quintal-summary.fragment.js','utf8');
assert.ok(base.includes(' renderAt(0);'));assert.ok(base.includes('return {duration:DURATION,renderAt,dispose()'));
const assembled=base.replace(' renderAt(0);',fragment+'\n renderSummaryAt(0);').replace('return {duration:DURATION,renderAt,dispose()','return {duration:DURATION,renderAt:renderSummaryAt,dispose()');assert.ok(assembled.length<80000);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:1150},acceptDownloads:true});let stage='start',provider=0;const errors=[],exports=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/ai.gateway.lovable.dev|generativelanguage.googleapis.com|fal.run/.test(r.url()))provider++;});
try{
 await page.goto('http://127.0.0.1:4198/motor-3d/codigo',{waitUntil:'domcontentloaded',timeout:60000});await page.locator('#code3d-import').waitFor({timeout:60000});await page.locator('#code3d-quality').selectOption('hd');
 for(const offset of [0,10]){
  stage='import '+offset;const old=await page.locator('iframe').count()?await page.locator('iframe').getAttribute('srcdoc'):null;
  const code=assembled.replace('/* SEGMENT_CONFIG */','const SEGMENT_OFFSET='+offset+'; const SEGMENT_DURATION=10;');
  await page.locator('#code3d-import').setInputFiles({name:'quintal-summary-'+offset+'.js',mimeType:'text/javascript',buffer:Buffer.from(code)});
  await page.waitForFunction(old=>{const f=document.querySelector('iframe');return f&&f.srcdoc!==old&&/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||'');},old,{timeout:90000});assert.match(await page.locator('main').innerText(),/estado: pronto/,(await page.getByRole('alert').allTextContents()).join('\n'));assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
  const f=page.frames().find(x=>x.url()==='about:srcdoc');
  for(const t of (offset===0?[.2,4.2,4.55,5.1,5.6,6.5,7.2,7.65,8.25,9.5]:[10.99,12.7,13.1,13.8,15,18.3])){
   if(t<offset||t>=offset+10)continue;await page.getByRole('slider',{name:'Linha do tempo'}).fill(String(Math.round((t-offset)*20)/20));await page.waitForTimeout(100);const png=await f.evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]);await writeFile(out+'/frame-'+t.toFixed(2)+'.png',Buffer.from(png,'base64'));
  }
  stage='export '+offset;console.log('EXPORT_START '+offset);const pending=page.waitForEvent('download',{timeout:600000});const failed=page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=alert]')).some(x=>/Exportação falhou/.test(x.textContent||'')),undefined,{timeout:600000}).then(()=>{throw Error('Native export failed');});await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).click();const d=await Promise.race([pending,failed]);assert.ok(d.suggestedFilename().endsWith('.mp4'));await d.saveAs(out+'/Resumo_'+offset+'.mp4');await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).waitFor({timeout:20000});exports.push({offset,duration:10,frames:300});console.log('EXPORT_DONE '+offset);
 }
 assert.deepEqual(errors,[]);assert.equal(provider,0);await writeFile(out+'/report.json',JSON.stringify({passed:true,width:720,height:1280,fps:30,exports,providerRequests:provider,errors,sourceSHA256:createHash('sha256').update(assembled).digest('hex'),commit:process.env.GITHUB_SHA||null,origin:'20-second manually directed native summary, using original garden models and rigid component assembly.'},null,2));
}catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify({stage,error:String(e),errors,visible:await page.locator('main').innerText().catch(()=> '')},null,2));throw e;}finally{await browser.close();}
