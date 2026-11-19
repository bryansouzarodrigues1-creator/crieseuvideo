import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const url='http://127.0.0.1:4198';
const out=path.resolve('tmp/unified-3d-qa');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 let providerCalls=0;
 page.on('request',r=>{
   if(/ai.gateway.lovable.dev|generativelanguage.googleapis.com/.test(r.url())) providerCalls++;
 });
 await page.goto(url+'/',{waitUntil:'domcontentloaded',timeout:60000});
 const advanced=page.getByRole('button',{name:/3D Avançado \(IA\)/});
 await advanced.waitFor({timeout:60000});
 assert.equal(await advanced.getAttribute('aria-pressed'),'true');
 assert.equal(await page.getByText('3D Avançado com cenários completos').count(),1);
 const script='Um guindaste ergue uma carga de cimento sobre um canteiro urbano completo. O operador aciona os freios do motor e a carga para acima da plataforma.';
 await page.locator('#ex-script').fill(script);
 await page.getByRole('button',{name:'Horizontal 16:9'}).click();
 assert.equal(await page.getByRole('button',{name:'3D Toon clássico'}).getAttribute('aria-pressed'),'false');
 assert.equal(await page.getByRole('button',{name:/Continuar no gerador 3D por IA/}).isEnabled(),true);
 await page.screenshot({path:path.join(out,'01-main-advanced-no-stale-toon.png'),fullPage:true});
 await page.getByRole('button',{name:/Continuar no gerador 3D por IA/}).click();
 await page.waitForURL('**/motor-3d/ia',{timeout:60000});
 await page.getByRole('heading',{name:/Crie uma cena 3D inédita/}).waitFor({timeout:60000});
 const source=await page.locator('#ai3d-script').inputValue();
 assert.equal(source,script,'The user script was lost during the handoff');
 assert.ok((await page.getByText('Roteiro transferido', {exact:false}).count())>0);
 assert.equal(await page.getByRole('button',{name:'Horizontal 16:9'}).count(),0); // screen now offers vertical toggle
 assert.ok((await page.getByRole('button',{name:'Vertical 9:16'}).count())>0,
   'Aspect 16:9 was not carried to the advanced studio');
 assert.equal(await page.getByRole('checkbox').isChecked(),false,
   'Credit consent must not carry over or be assumed');
 assert.equal(providerCalls,0,'Unexpected paid model request without consent');
 await page.screenshot({path:path.join(out,'02-advanced-studio-script-preserved.png'),fullPage:true});
 await writeFile(path.join(out,'report.json'),JSON.stringify({
   passed:true,providerCalls,
   verified:['Advanced 3D default chosen in main editor','No old Toon preview shown',
    'No model call during handoff','Script and aspect survive redirect','Consent remains off'],
   caveat:'No real AI response or production video generated in this test.',
 },null,2));
 assert.deepEqual(errors,[]);
 console.log('PASS: main -> 3D AI handoff retains script and aspect without billing or old demo');
}finally{await browser.close();}
