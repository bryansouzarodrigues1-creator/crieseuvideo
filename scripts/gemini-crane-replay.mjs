import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const recipe=JSON.parse(await readFile('tmp/gemini-live-proof/recipe.json','utf8'));
const archived=JSON.parse(await readFile('tmp/gemini-live-proof/clip.json','utf8'));
const output='tmp/gemini-crane-replay';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:412,height:850}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4198/',{waitUntil:'domcontentloaded',timeout:60000});
  const report=await page.evaluate(async({recipe,sources})=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {compileCompactWorld}=await import('/src/studio/explainer/sceneProgram/planner/compactWorldDirector.ts');
    const {SceneProgram3D}=await import('/src/studio/explainer/sceneProgram/stage3d.ts');
    const clip=compileCompactWorld(recipe,sources);
    const canvas=document.createElement('canvas');
    canvas.id='live-crane';
    canvas.style.cssText='position:fixed;top:0;left:0;z-index:99999;width:360px;height:640px';
    document.body.appendChild(canvas);
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
    renderer.setPixelRatio(1);
    renderer.setSize(360,640,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    const stage=new SceneProgram3D(clip.program,clip.sources);
    window.renderCraneAt=(t)=>{stage.render(renderer,t,360,640);return canvas.toDataURL('image/png').length;};
    return {duration:clip.duration,audit:clip.audit,tracks:clip.program.tracks.length};
  },{recipe,sources:archived.sources});
  assert.equal(report.duration,archived.duration);
  assert.ok(report.tracks>0);
  const frames=[];
  for(const [i,t] of [0,2,4,6,7.8].entries()){
    const size=await page.evaluate(t=>window.renderCraneAt(t),t);
    assert.ok(size>12000,'Empty render');
    const path=output+'/frame-'+i+'.png';
    await page.locator('#live-crane').screenshot({path});
    frames.push(await readFile(path));
  }
  assert.notDeepEqual(frames[0],frames[4],'No change in rendered timeline');
  assert.deepEqual(errors,[]);
  await writeFile(output+'/report.json',JSON.stringify({...report,distinctFrames:true,sourceRun:45517586991,aiCalls:0},null,2));
  console.log('PASS actual archived Gemini scene rendered in WebGL:',JSON.stringify(report));
}finally{await browser.close();}
