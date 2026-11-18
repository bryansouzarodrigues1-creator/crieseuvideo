import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root='http://127.0.0.1:4198';
const out=path.resolve('tmp/ai-3d-qa');
await mkdir(out,{recursive:true});
const errors=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:412,height:915}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  let generationRequests=0;
  page.on('request',r=>{
    if(r.url().includes('generativelanguage.googleapis.com')||r.url().includes('ai.gateway.lovable.dev'))generationRequests++;
  });
  await page.goto(root+'/motor-3d/ia',{waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForTimeout(2500);
  await page.screenshot({path:path.join(out,'route-debug.png'),fullPage:true});
  const body=await page.locator('body').innerText().catch(()=>'(body missing)');
  console.log('AI3D ROUTE DIAGNOSTIC',JSON.stringify({url:page.url(),body:body.slice(0,2200),errors}));
  await page.getByRole('heading',{name:/Crie uma cena 3D inédita/}).waitFor({timeout:12000});
  const script=page.getByLabel('Roteiro da cena: 2 ou 3 frases');
  assert.ok((await script.inputValue()).includes('guindaste'));
  const scriptRect=await script.boundingBox();
  const panelRect=await page.locator('.ai3d-panel').boundingBox();
  assert.ok(scriptRect&&panelRect&&scriptRect.width>panelRect.width*.70,
    'Mobile script editor must be full-width, not trapped in the old three-column scene grid');
  const hasOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+3);
  assert.equal(hasOverflow,false,'Unexpected horizontal overflow on mobile viewport');
  const provider=page.getByLabel('IA responsável pela direção');
  await provider.selectOption('gemini');
  await provider.selectOption('lovable');
  await provider.selectOption('auto');
  assert.equal(await page.getByRole('checkbox').isChecked(),false);
  assert.equal(await page.getByText('A cena 3D aparecerá aqui').count(),1);
  assert.equal(await page.getByRole('button',{name:'Baixar vídeo 3D'}).isDisabled(),true);
  assert.equal(generationRequests,0,'AI calls without a confirmed user click');
  await page.screenshot({path:path.join(out,'ai-3d-mobile-before-cost-consent.png'),fullPage:true});
  await writeFile(path.join(out,'report.json'),JSON.stringify({
    route:'/motor-3d/ia',passed:true,modelCalls:generationRequests,
    checks:['route accessible at mobile width','user can select Gemini or Lovable','explicit credit consent defaults off','no provider call until authorized generation','no fake old preset video'],
    note:'CI validates UI and mocks 3D quality through pure tests. Real provider output and visual quality are not confirmed.',
    errors
  },null,2));
  assert.equal(generationRequests,0);
  assert.deepEqual(errors,[]);
  console.log('PASS: new AI 3D studio loads without spending Gemini/Lovable credits');
}finally{await browser.close();}
