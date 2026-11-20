import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve('tmp/current-engine-video');
const frames=path.join(root,'frames');
await mkdir(frames,{recursive:true});
const frameRate=18,duration=12,total=Math.round(frameRate*duration);
const browser=await chromium.launch({
  headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage',
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl']
});
try{
 const page=await browser.newPage({
   viewport:{width:576,height:1060},
   deviceScaleFactor:1
 });
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:4198/render-engine-clip.html',{
   waitUntil:'domcontentloaded',timeout:60000
 });
 await page.waitForFunction(()=>window.__sceneReady||window.__sceneError,{timeout:60000});
 const info=await page.evaluate(()=>({ready:window.__sceneReady,error:window.__sceneError,info:window.__sceneInfo}));
 assert.equal(info.error,null,'The current engine failed to construct: '+info.error);
 assert.equal(info.ready,true);
 assert.equal(info.info.duration,12);
 assert.equal(info.info.simulatedAi,false);
 assert.ok(info.info.objects>=35,'Too few objects for a worksite scene');
 const canvas=page.locator('#frame');
 assert.equal(await canvas.count(),1);
 const elapsed=[];
 for(let i=0;i<total;i++){
   const t=i/frameRate;
   const result=await page.evaluate(time=>window.renderDemoFrame(time),t);
   assert.ok(result.time>=0&&result.time<12);
   assert.ok(result.chapter>=1&&result.chapter<=3);
   await canvas.screenshot({
     type:'png',
     path:path.join(frames,'f'+String(i).padStart(4,'0')+'.png')
   });
   if(i%36===0)console.log('Rendered frame '+(i+1)+'/'+total+', time='+t.toFixed(2));
   elapsed.push(result.time);
 }
 assert.deepEqual(errors,[],'WebGL emitted errors during frame render');
 await writeFile(path.join(root,'render-report.json'),JSON.stringify({
   generatedBy:'CrieSeuVideo SceneProgram3D (procedural; NOT a paid Gemini generation)',
   durationSeconds:duration,frameRate,frames:total,
   dimensions:[576,1024],
   chapters:['problema: container no canteiro','grua: transporte com cabos','solução: descida no caminhão'],
   sceneNodes:info.info.objects,
   source:'current main-branch compiler and Three.js engine',
   audio:'silent — no ElevenLabs call',
   lastFrameTime:elapsed.at(-1),
   browserErrors:errors,
 },null,2));
 console.log('PASSED frames='+total+' sceneNodes='+info.info.objects);
} finally{
 await browser.close();
}
