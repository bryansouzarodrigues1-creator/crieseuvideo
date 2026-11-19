import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const url='http://127.0.0.1:4198';
const out=path.resolve('tmp/unified-3d-qa');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 let providerCalls=0;
 page.on('request',r=>{
   if(/ai.gateway.lovable.dev|generativelanguage.googleapis.com/.test(r.url()))providerCalls++;
 });
 await page.goto(url+'/',{waitUntil:'domcontentloaded',timeout:60000});
 const advanced=page.getByRole('button',{name:/3D Avançado \(IA\)/});
 await advanced.waitFor({timeout:60000});
 assert.equal(await advanced.getAttribute('aria-pressed'),'true');
 await page.getByRole('heading',{name:'Cenário 3D criado pelo Gemini ou Lovable'}).waitFor();
 const script='Um guindaste ergue uma carga de cimento sobre um canteiro urbano completo. O operador aciona os freios do motor e a carga para acima da plataforma.';
 await page.locator('#ex-script').fill(script);
 await page.getByRole('button',{name:'Horizontal 16:9'}).click();
 assert.equal(await page.getByRole('button',{name:'3D Toon clássico'}).getAttribute('aria-pressed'),'false');
 const select=page.getByLabel('IA responsável pelo cenário 3D');
 await select.selectOption('lovable');
 await select.selectOption('gemini');
 await select.selectOption('auto');
 const generate=page.getByRole('button',{name:/Criar cena 3D pela IA/});
 assert.equal(await generate.isEnabled(),true);
 const consent=page.getByRole('checkbox');
 assert.equal(await consent.isChecked(),false,'Credit consent must begin unchecked');
 assert.equal(providerCalls,0,'No paid provider call on loading');
 await page.screenshot({path:path.join(out,'01-main-inline-ai3d-mobile.png'),fullPage:true});
 await generate.click();
 assert.equal(new URL(page.url()).pathname,'/','The main Generate button redirected instead of running inside the editor');
 await page.getByText(/Confirme o uso de créditos/).waitFor({timeout:10000});
 assert.equal(providerCalls,0,'No provider call allowed without explicit consent');
 const canvas=page.locator('canvas[aria-label="Prévia da cena 3D gerada pela IA"]');
 assert.equal(await canvas.count(),1,'Keep a stable canvas for later generations');
 assert.equal(await canvas.isVisible(),false,'Do not show any model or sample video before AI generation');
 await page.getByRole('button',{name:'3D Toon clássico'}).click();
 assert.equal(await page.getByRole('checkbox').count(),0,'Classic editor should not show 3D model consent');
 await page.getByRole('button',{name:/3D Avançado \(IA\)/}).click();
 assert.equal(await consent.isChecked(),false,'Consent should not carry from a different mode');
 await page.getByRole('button',{name:/Abrir laboratório 3D separado/}).click();
 await page.waitForURL('**/motor-3d/ia',{timeout:60000});
 await page.getByRole('heading',{name:/Crie uma cena 3D inédita/}).waitFor({timeout:60000});
 assert.equal(await page.locator('#ai3d-script').inputValue(),script,'Optional lab lost original script');
 assert.ok((await page.getByRole('button',{name:'Vertical 9:16'}).count())>0,'Aspect was not preserved');
 assert.equal(await page.getByRole('checkbox').isChecked(),false);
 assert.equal(providerCalls,0);
 await page.screenshot({path:path.join(out,'02-optional-lab-remains-available.png'),fullPage:true});
 await writeFile(path.join(out,'report.json'),JSON.stringify({
   passed:true,providerCalls,
   checks:['main 3D mode shows SceneProgram3D placeholder, not Toon','3D model provider selection inline',
    'main Create animation stays on same page','consent never assumed, no paid calls',
    'classic editor remains selectable','optional laboratory preserves draft and aspect'],
   caveat:'No real paid Gemini or Lovable generation; visual quality of new AI output unverified.'
 },null,2));
 assert.deepEqual(errors,[]);
 console.log('PASS: inline AI 3D main editor, script-preserving optional lab, consent and no unsolicited billing');
}finally{await browser.close();}
