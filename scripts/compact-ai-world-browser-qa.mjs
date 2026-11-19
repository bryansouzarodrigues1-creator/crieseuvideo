import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const root='http://127.0.0.1:4198';
const output=path.resolve('tmp/compact-ai-worlds');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const errors=[];
const report=[];
try {
  const page=await browser.newPage({viewport:{width:412,height:850}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root+'/',{waitUntil:'domcontentloaded',timeout:60000});
  for(const kind of ['crane','motorcycle','boat']){
    const at=(time)=>page.evaluate(async({kind,time})=>{
      const module=await import('/src/studio/explainer/sceneProgram/planner/compactWorldBrowserLab.ts');
      return module.showCompactWorldForQA(kind,time);
    },{kind,time});
    const initial=await at(0);
    assert.ok(initial.nodes>=12,'Empty scene graph for '+kind);
    assert.ok(initial.parts>=8,'Scene missing parts for '+kind);
    assert.ok(initial.tracks>=1,'Object not animated in '+kind);
    assert.ok(initial.pixels>=12000,'Rendered empty image in '+kind);
    const canvas=page.locator('#compact-qa-canvas');
    await canvas.screenshot({path:path.join(output,kind+'-initial.png')});
    const after=await at(6.5);
    assert.equal(after.nodes,initial.nodes,'Renderer scene changed structure unexpectedly');
    await canvas.screenshot({path:path.join(output,kind+'-after.png')});
    const initialBytes=await (await import('node:fs/promises')).readFile(path.join(output,kind+'-initial.png'));
    const finalBytes=await (await import('node:fs/promises')).readFile(path.join(output,kind+'-after.png'));
    assert.notDeepEqual(initialBytes,finalBytes,'3D scene has no visual change across its timeline: '+kind);
    report.push({kind,scene:initial,distinctFrames:true});
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(output,'report.json'),JSON.stringify({
    passed:true,worlds:report,
    note:'These are programmatic QA scenes, not actual Gemini/Lovable responses or cinematic quality ratings.'
  },null,2));
  console.log('PASS: Three different compact recipes compiled, rendered in WebGL, and visibly changed at different times');
}finally{
  await browser.close();
}
