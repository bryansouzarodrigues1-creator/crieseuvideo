import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin='http://127.0.0.1:4198';
const out=path.resolve('tmp/editorial2d-visual-qa');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[],report=[];
try{
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error'&&!/favicon/.test(msg.text()))errors.push(msg.text());});
  let aiRequests=0;
  page.on('request',r=>{
    if(/(generativelanguage\.googleapis\.com|api\.anthropic\.com|ai\.gateway\.lovable\.dev)/.test(r.url()))aiRequests++;
  });
  await page.goto(origin+'/cinema-2d',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('heading',{name:/CrieSeuVideo · Cinema 2D/}).waitFor({timeout:60000});
  const svg=page.locator('svg[data-testid="storytelling-svg"]');
  await svg.waitFor({state:'visible',timeout:20000});
  await page.evaluate(()=>document.fonts.ready);

  async function capture(name,step){
    const info=await svg.evaluate(el=>{
      const viewport=el.getBoundingClientRect();
      const texts=[];
      for(const node of el.querySelectorAll('text')){
        const b=node.getBoundingClientRect();
        const x=(b.x-viewport.x)*1080/viewport.width;
        const y=(b.y-viewport.y)*1920/viewport.height;
        const w=b.width*1080/viewport.width;
        const h=b.height*1920/viewport.height;
        const isUserHeadline=node.getAttribute('font-weight')==='850';
        const isCaption=node.classList.contains('story-caption');
        if(isUserHeadline||isCaption)texts.push({text:node.textContent?.trim()||'',x,y,w,h,isCaption,isUserHeadline});
      }
      return {width:viewport.width,height:viewport.height,texts,
        visibleScene:el.getAttribute('aria-label'),
        gridCount:el.querySelectorAll('[data-icon-index]').length,
        actorLabels:[...el.querySelectorAll('.actor-label')].map(x=>x.textContent),
      };
    });
    assert.ok(info.width>100 && info.height>100,'SVG is missing/too small');
    for(const t of info.texts){
      assert.ok(t.x>=60 && t.x+t.w<=965,
        name+' ('+step+'s): unsafe '+(t.isCaption?'caption':'headline')+' "'+t.text+'" x='+t.x.toFixed(1)+'..'+(t.x+t.w).toFixed(1));
      assert.ok(t.y>=170 && t.y+t.h<=1730,
        name+' ('+step+'s): unsafe vertical text "'+t.text+'" y='+t.y.toFixed(1));
    }
    const filename=name+'_'+String(Math.round(step)).padStart(2,'0')+'s.png';
    await svg.screenshot({path:path.join(out,filename),animations:'disabled',timeout:20000});
    report.push({preset:name,time:step,file:filename,...info});
  }

  async function verifyPreset(name,duration,labels){
    const forward=page.getByRole('button',{name:'+5s',exact:true});
    const backward=page.getByRole('button',{name:'−5s',exact:true});
    await capture(name,0);
    for(let t=5;t<duration;t+=5){
      await forward.click();
      await capture(name,t);
    }
    await forward.click();
    await capture(name,duration);
    assert.equal(await page.locator('[role="alert"]').count(),0,'Studio showed an error');
    if(labels.length){
      const seen=report.filter(x=>x.preset===name).flatMap(x=>x.actorLabels);
      for(const label of labels)assert.ok(seen.includes(label),'Missing actor shirt label '+label);
    }
    await backward.click();await backward.click();
    const b1=await svg.screenshot({animations:'disabled'});
    await forward.click();await backward.click();
    const b2=await svg.screenshot({animations:'disabled'});
    assert.ok(b1.equals(b2),name+': seek is not deterministic at same time');
    assert.equal(aiRequests,0,'Opening local templates triggered an AI call');
  }

  await verifyPreset('ovos',42,['1','2']);
  await page.getByRole('button',{name:'Modelo · Loja (34s)',exact:true}).click();
  await verifyPreset('loja',34,['L']);

  const viewportStatus=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert.ok(viewportStatus.scrollWidth<=viewportStatus.viewport+3,'Mobile UI scrolls sideways unexpectedly');
  assert.equal(aiRequests,0);
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,'visual-qa-report.json'),JSON.stringify({
    passed:true,
    screenshots:report.length,
    checks:['mobile responsive','SVG text safe margins','two templates','deterministic seek','console/page errors','no unapproved AI provider request'],
    note:'This is deterministic layout QA only, NOT semantic judgment by Gemini Vision. Screenshots are produced for a later multimodal review.',
    frames:report
  },null,2));
  console.log('PASS Cinema 2D visual QA: '+report.length+' frames and 0 paid provider calls.');
}finally{await browser.close();}
