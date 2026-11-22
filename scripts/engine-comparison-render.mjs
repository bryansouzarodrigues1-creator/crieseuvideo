import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='tmp/engine-comparison';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const engine of ['motion2d','toon3d','sceneprogram','code3d','htmlsvg']){
  const page=await browser.newPage({viewport:{width:1100,height:1150},acceptDownloads:true});const errors=[],consoleErrors=[],failedRequests=[];let providerRequests=0;const started=Date.now();
  const result={engine,authorship:'hand-authored controlled fixture',newModelRequests:0,rendered:false};
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('requestfailed',r=>failedRequests.push({url:r.url(),failure:r.failure()}));page.on('request',r=>{if(/generativelanguage.googleapis.com|ai.gateway.lovable.dev/.test(r.url()))providerRequests++;});
  try{
   let frameAt;
   if(engine==='code3d'){
    const code=await readFile('scripts/fixtures/engine-comparison/code3d-solar.js');result.codeSHA256=createHash('sha256').update(code).digest('hex');
    await page.goto('http://127.0.0.1:4198/motor-3d/codigo',{waitUntil:'domcontentloaded',timeout:60000});
    await page.locator('#code3d-import').waitFor({timeout:60000});await page.locator('#code3d-quality').selectOption('hd');
    await page.locator('#code3d-import').setInputFiles({name:'solar-comparison.js',mimeType:'text/javascript',buffer:code});
    await page.waitForFunction(()=>/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||''),undefined,{timeout:90000});
    assert.match(await page.locator('main').innerText(),/estado: pronto/,(await page.getByRole('alert').allTextContents()).join('\n'));
    assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
    const frame=page.frames().find(f=>f.url()==='about:srcdoc');assert.ok(frame);
    frameAt=async t=>{await page.getByRole('slider',{name:'Linha do tempo'}).fill(String(t));await page.waitForTimeout(80);return Buffer.from(await frame.evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]),'base64');};
   }else{
    const response=await page.goto('http://127.0.0.1:4201/scripts/fixtures/engine-comparison/index.html?engine='+engine,{waitUntil:'domcontentloaded',timeout:60000});
    assert.equal(response?.status(),200,'Read-only fixture HTML did not load');
    await page.waitForFunction(()=>document.body.dataset.ready==='true'||window.fixtureError,undefined,{timeout:15000});
    assert.equal(await page.evaluate(()=>window.fixtureError||''),'');
    frameAt=async t=>Buffer.from(await page.evaluate(t=>window.comparison.frame(t),t),'base64');
   }
   for(const t of [0.5,1.5,3.6,4.3,5.3,6.4,7.5,8.6,9.3,10.5,11.7])await writeFile(`${out}/${engine}-${t.toFixed(1)}.png`,await frameAt(t));
   // Report rather than hide a legacy renderer's history-dependent pixels.
   const a=await frameAt(5.3);await frameAt(11.7);const b=await frameAt(5.3);
   result.samplePngEqual=a.equals(b);result.errors=errors;
   console.log('EXPORT_START '+engine);
   const pending=page.waitForEvent('download',{timeout:600000});
   if(engine==='code3d')await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).click();
   else result.encoding=await page.evaluate(()=>window.comparison.export());
   const d=await pending;assert.ok(d.suggestedFilename().endsWith('.mp4'));
   await d.saveAs(`${out}/${engine}-native.mp4`);
   const bytes=await readFile(`${out}/${engine}-native.mp4`);assert.equal(bytes.toString('ascii',4,8),'ftyp');
   assert.ok(bytes.length>10000);assert.equal(providerRequests,0);assert.deepEqual(errors,[]);
   Object.assign(result,{rendered:true,bytes:bytes.length,width:720,height:1280,fps:30,frames:360,duration:12,milliseconds:Date.now()-started});
   console.log('EXPORT_DONE '+engine);
  }catch(e){result.error=String(e);result.errors=errors;result.consoleErrors=consoleErrors;result.failedRequests=failedRequests;result.document=await page.evaluate(()=>({url:location.href,ready:document.body.dataset.ready,api:typeof window.comparison,scripts:Array.from(document.scripts).map(s=>({type:s.type,src:s.src})),text:document.body.innerText})).catch(()=>null);await writeFile(`${out}/${engine}-failure.html`,await page.content().catch(()=>''));await page.screenshot({path:`${out}/${engine}-failure.png`,fullPage:true}).catch(()=>{});console.log('RENDER_FAILED '+engine+' '+e);}
  finally{result.providerRequests=providerRequests;results.push(result);await page.close();await writeFile(out+'/report.json',JSON.stringify({kind:'renderer comparison, not autonomous AI benchmark',productionChanges:false,newModelRequests:0,results},null,2));}
 }
 assert.equal(results.filter(r=>r.rendered).length,5,'Preserve individual failures, but do not label missing arms complete.');
}finally{await browser.close();}
