/** Visual / conversion QA for the public CrieSeuVideo prelaunch page.
 * Uses the real Vite/TanStack browser page. No AI calls, no purchases.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const base = 'http://127.0.0.1:4198';
const out = path.resolve('tmp/mobile-touch-scroll');
await mkdir(out,{recursive:true});
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report = [];
try {
 for (const width of [360,390,768,1440]) {
  const height = width > 800 ? 900 : 844;
  const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('heading',{name:/Sua ideia merece virar vídeo/i}).waitFor({timeout:30000});
  const hero = page.locator('.csv2-hero');
  const benefits = page.locator('.csv2-benefit-card');
  assert.equal(await benefits.count(),4,'Must explain four concrete individual benefits');
  const group = page.locator('#grupo a[href*="chat.whatsapp.com"]');
  assert.equal(await group.count(),1,'Invite after product description missing');
  const actual = await group.getAttribute('href');
  assert.ok(actual?.includes('Jba8u5eY9heEw9fGj9rnCg'),'Wrong WhatsApp group invite');
  const positions = await page.evaluate(() => {
    const a=document.querySelector('.csv2-benefits');
    const b=document.querySelector('#grupo');
    const c=document.querySelector('.csv2-hero');
    return {
      hero:a?.getBoundingClientRect().top ?? null,
      benefitsTop:a?.getBoundingClientRect().top ?? null,
      groupTop:b?.getBoundingClientRect().top ?? null,
      heroBottom:c?.getBoundingClientRect().bottom ?? null,
      scrollWidth:document.documentElement.scrollWidth,
      viewportWidth:document.documentElement.clientWidth,
    };
  });
  assert.ok(positions.groupTop>positions.benefitsTop,'Group CTA must come after the benefits');
  assert.ok(positions.scrollWidth<=positions.viewportWidth+3,
    'Horizontal overflow at '+width+': '+JSON.stringify(positions));
  assert.equal(await page.locator('.csv2-showcase').count(),1,'Visual hero showcase missing');
  assert.ok((await page.locator('.csv2-illustration-note').innerText()).includes('ilustrativa'),
    'Illustration cannot be confused with a rendered customer video');
  assert.ok((await page.locator('h1').innerText()).includes('virar vídeo'),
    'Primary promise is unclear');
  const priceText = (await page.locator('main').innerText()).toLowerCase();
  assert.ok(!priceText.includes('100 vídeos')&&!priceText.includes('qualquer nicho'),
    'Unsubstantiated marketing claim');
  const link = page.getByRole('link',{name:/Descubra o que você pode criar/i});
  assert.equal(await link.getAttribute('href'),'#beneficios');
  const login=page.getByRole('link',{name:/Entrar \/ Criar conta|Abrir meu estúdio/i}).first();
  assert.equal(await login.getAttribute('href'),'/estudio');
  await page.screenshot({path:path.join(out,`launch-${width}px.png`),fullPage:true});
  assert.deepEqual(errors,[],'Browser errors on '+width);
  report.push({width,passed:true,benefits:await benefits.count(),horizontalOverflow:false,errors});
  await page.close();
 }
 await writeFile(path.join(out,'launch-report.json'),JSON.stringify({
  passed:true,layoutWidths:[360,390,768,1440],report,
  note:'Validates visual layout and links; paid checkout, live OAuth and video-generation quality not tested.'
 },null,2));
 console.log('PASS: red conversion landing responsive at 360/390/768/1440; four benefits; group after product; no misleading claims');
} finally { await browser.close(); }
