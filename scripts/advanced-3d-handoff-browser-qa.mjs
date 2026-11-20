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
 // Account action must be accessible BEFORE an unsuccessful paid generation.
 // Do not click it in CI: Google OAuth is an external user interaction.
 const login=page.getByRole('button',{name:'Entrar com Google para gerar 3D'});
 await login.waitFor({timeout:15000});
 const alternate=page.getByRole('button',{name:'Não aparece uma conta? Entrar por e-mail'});
 await alternate.click();
 await page.getByRole('group',{name:'Login sem Google'}).waitFor();
 await page.getByLabel('Seu e-mail').fill('nao-e-email');
 await page.getByRole('button',{name:'Enviar link para entrar'}).click();
 await page.getByText(/Informe um e-mail válido/).waitFor();
 assert.equal(providerCalls,0,'Invalid email must not trigger paid generation');
 await page.getByRole('button',{name:'Fechar login por e-mail'}).click();
 assert.equal(providerCalls,0,'Checking auth status must not invoke the AI');
 // A full-page Google return may reload the studio; preserve only the draft,
 // not consent or credentials, and consume the draft after restoring it.
 const redirectDraft='Uma bateria descarregada impede o celular de ligar na bancada. Uma bateria nova encaixa e a tela acende mostrando a solução.';
 await page.evaluate((draft)=>sessionStorage.setItem('crieseuvideo.ai3d.login-draft.v1',
   JSON.stringify({script:draft,aspect:'16:9',provider:'gemini'})),redirectDraft);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'3D Avançado (IA)'}).waitFor();
 await page.waitForFunction((draft)=>document.querySelector('#ex-script')?.value===draft,redirectDraft,{timeout:20000});
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('crieseuvideo.ai3d.login-draft.v1')),null,
   'Login draft must be removed once restored');
 assert.equal(await page.getByRole('checkbox').count(),0,
   'No extra paid-call authorization checkbox; generation click is explicit intent');
 assert.equal(providerCalls,0,'Draft return must not pay for generation');
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
 assert.equal(await page.getByRole('checkbox').count(),0,'No extra credit confirmation checkbox');
 assert.match(await page.locator('.explainer-advanced-settings').first().innerText(),/pode consumir créditos/);
 assert.equal(providerCalls,0,'No paid provider call on loading');
 await page.screenshot({path:path.join(out,'01-main-inline-ai3d-mobile.png'),fullPage:true});
 await generate.click();
 assert.equal(new URL(page.url()).pathname,'/','The main Generate button redirected instead of running inside the editor');
 await page.getByText(/Para criar cenários 3D, entre na sua conta/).waitFor({timeout:10000});
 assert.equal(providerCalls,0,'Unauthenticated click must not call a paid model');
 const canvas=page.locator('canvas[aria-label="Prévia da cena 3D gerada pela IA"]');
 assert.equal(await canvas.count(),1,'Keep a stable canvas for later generations');
 assert.equal(await canvas.isVisible(),false,'Do not show any model or sample video before AI generation');
 await page.getByRole('button',{name:'3D Toon clássico'}).click();
 assert.equal(await page.getByRole('checkbox').count(),0,'Classic editor should not have credit confirmation');
 await page.getByRole('button',{name:/3D Avançado \(IA\)/}).click();
 assert.equal(await page.getByRole('checkbox').count(),0,'No checkbox when switching modes');
 await page.getByRole('button',{name:/Abrir laboratório 3D separado/}).click();
 await page.waitForURL('**/motor-3d/ia',{timeout:60000});
 await page.getByRole('heading',{name:/Crie uma cena 3D inédita/}).waitFor({timeout:60000});
 assert.equal(await page.locator('#ai3d-script').inputValue(),script,'Optional lab lost original script');
 assert.ok((await page.getByRole('button',{name:'Vertical 9:16'}).count())>0,'Aspect was not preserved');
 assert.equal(await page.getByRole('checkbox').count(),0,'No authorization box in optional lab');
 assert.equal(providerCalls,0);
 await page.screenshot({path:path.join(out,'02-optional-lab-remains-available.png'),fullPage:true});
 await writeFile(path.join(out,'report.json'),JSON.stringify({
   passed:true,providerCalls,
   checks:['main 3D mode shows SceneProgram3D placeholder, not Toon','3D model provider selection inline',
    'main Create stays on same page','no extra checkbox, unauthenticated call blocked',
    'classic editor remains selectable','optional laboratory preserves draft and aspect'],
   caveat:'No real paid Gemini or Lovable generation; visual quality of new AI output unverified.'
 },null,2));
 assert.deepEqual(errors,[]);
 console.log('PASS: one-click AI 3D form, session-gated requests, no unsolicited billing');
}finally{await browser.close();}
