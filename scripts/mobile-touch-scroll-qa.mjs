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
    // The old 2D editor has a dedicated scrolling pane; /motor-3d uses
    // document scrolling. Both must accept real native finger gestures.
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
  await assertSwipe('3D page before WebGL activation',195,720,260);
  await page.screenshot({path:path.join(out,'02-3d-scrolled-before-activation.png')});

  const start=page.getByRole('button',{name:'Carregar motor 3D'});
  await start.click();
  await page.waitForFunction(()=>{
    const c=document.querySelector('.native-3d-screen canvas');
    return c?.width===270&&c?.height===480;
  },null,{timeout:60000});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(350);
  const canvas=page.locator('.native-3d-screen canvas');
  assert.equal(await canvas.evaluate(c=>getComputedStyle(c).touchAction),
    'pan-y','Canvas should permit vertical touch scrolling');
  const rect=await canvas.boundingBox();
  assert.ok(rect,'WebGL preview should be visible');
  const startY=Math.round(Math.min(775,rect.y+Math.min(rect.height-25,Math.max(50,rect.height*.7))));
  const endY=Math.max(130,startY-330);
  await assertSwipe('3D page swipe starting ON WebGL canvas',Math.round(rect.x+rect.width*.5),startY,endY);
  await page.screenshot({path:path.join(out,'03-3d-scrolled-from-canvas.png')});

  await page.getByRole('button',{name:'Reproduzir'}).click();
  await page.waitForFunction(()=>Number(
    document.querySelector('input[aria-label="Linha do tempo 3D"]')?.value||0)>.07,
    null,{timeout:25000});
  await page.getByRole('button',{name:'Pausar'}).click();
  assert.deepEqual(errors,[]);
  console.log('PASS: native mobile touch swipes work on home and 3D canvas; playback remains interactive');
}finally{
  await session.detach();
  await browser.close();
}
