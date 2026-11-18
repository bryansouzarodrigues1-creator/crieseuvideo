/**
 * Native Android-like swipe test. Checking document.scrollTo alone misses CSS
 * / WebGL touch interception, so use Chromium's Input.dispatchTouchEvent.
 */
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const out=path.resolve('tmp/mobile-touch-scroll');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({
  headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
const page=await browser.newPage({
  viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,
});
const session=await page.context().newCDPSession(page);
const errors=[];
page.on('pageerror',err=>errors.push(err.message));

async function metrics(selector){
  return page.evaluate(sel=>{
    // Both studios use their own native scrolling panes so embedded Lovable
    // iframe parents cannot lock or intercept document-level scrolling.
    const root=sel?document.querySelector(sel):document.scrollingElement;
    return {y:root?.scrollTop??0,scrollHeight:root?.scrollHeight??0,
      viewport:root?.clientHeight??0,overflowY:getComputedStyle(document.body).overflowY};
  },selector);
}
async function swipe(x,yStart,yEnd){
  const point=(y)=>[{x,y}];
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(yStart)});
  for(let i=1;i<=16;i++){
    const y=yStart+(yEnd-yStart)*i/16;
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(y)});
    await new Promise(resolve=>setTimeout(resolve,18));
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(450);
}
async function assertSwipe(label,x,start,end,selector){
  const before=await metrics(selector);
  assert.ok(before.scrollHeight-before.viewport>90,
    label+': page must be taller than viewport, got '+JSON.stringify(before));
  await swipe(x,start,end);
  const after=await metrics(selector);
  assert.ok(after.y-before.y>75,
    label+': native finger swipe must scroll the page. '+JSON.stringify({before,after}));
  console.log('PASS',label,Math.round(before.y),'->',Math.round(after.y));
}

try{
  const base='http://127.0.0.1:4198';
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByText('Seu próximo vídeo começa aqui').waitFor({timeout:60000});
  assert.equal((await metrics()).overflowY,'auto','Global body must not be overflow:hidden');
  await assertSwipe('home editor vertical swipe',195,725,265,'.production-workspace');
  await page.screenshot({path:path.join(out,'01-home-scrolled-on-android.png')});

  await page.goto(base+'/motor-3d',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('heading',{name:/Motor 3D de verdade/}).waitFor({timeout:60000});
  await assertSwipe('3D page before WebGL activation',195,720,260,'.native-3d-studio');
  await page.screenshot({path:path.join(out,'02-3d-scrolled-before-activation.png')});

  const start=page.getByRole('button',{name:'Carregar motor 3D'});
  await start.click();
  await page.waitForFunction(()=>{
    const c=document.querySelector('.native-3d-screen canvas');
    return c?.width===270&&c?.height===480;
  },null,{timeout:60000});
  await page.locator('.native-3d-studio').evaluate(el=>{el.scrollTop=0;});
  await page.waitForTimeout(350);
  const canvas=page.locator('.native-3d-screen canvas');
  assert.equal(await canvas.evaluate(c=>getComputedStyle(c).touchAction),
    'pan-y','Canvas should permit vertical touch scrolling');
  const rect=await canvas.boundingBox();
  assert.ok(rect,'WebGL preview should be visible');
  const startY=Math.round(Math.min(775,rect.y+Math.min(rect.height-25,Math.max(50,rect.height*.7))));
  const endY=Math.max(130,startY-330);
  await assertSwipe('3D page swipe starting ON WebGL canvas',Math.round(rect.x+rect.width*.5),startY,endY,'.native-3d-studio');
  await page.screenshot({path:path.join(out,'03-3d-scrolled-from-canvas.png')});

  await page.getByRole('button',{name:'Reproduzir'}).click();
  await page.waitForFunction(()=>Number(
    document.querySelector('input[aria-label="Linha do tempo 3D"]')?.value||0)>.07,
    null,{timeout:25000});
  await page.getByRole('button',{name:'Pausar'}).click();
  // Reproduce the actual user environment: the project preview is framed by
  // a Lovable-like fixed-height host whose document cannot scroll.
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
    <body style="margin:0;height:100dvh;overflow:hidden">
      <iframe id="lovable-preview" title="CrieSeuVideo preview"
        src="${base}/motor-3d"
        style="border:0;display:block;width:100vw;height:100dvh"></iframe>
    </body></html>`);
  const embedded=page.frameLocator('#lovable-preview');
  await embedded.getByRole('heading',{name:/Motor 3D de verdade/}).waitFor({timeout:60000});
  const internal=embedded.locator('.native-3d-studio');
  const before=await internal.evaluate(el=>({y:el.scrollTop,extent:el.scrollHeight-el.clientHeight}));
  assert.ok(before.extent>120,'Embedded studio must contain internal scrollable content');
  await swipe(195,720,225);
  const after=await internal.evaluate(el=>el.scrollTop);
  assert.ok(after-before.y>75,
    'Fixed-height Lovable iframe swallowed the finger swipe: '+JSON.stringify({before,after}));
  await page.screenshot({path:path.join(out,'04-embedded-lovable-scroll.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: native mobile touch swipes work on home, 3D canvas, and fixed-height Lovable iframe');
}finally{
  await session.detach();
  await browser.close();
}
