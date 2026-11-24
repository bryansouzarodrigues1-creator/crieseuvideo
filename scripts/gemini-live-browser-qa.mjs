/**
 * Replays ONE REAL Gemini-authored validated scene in the ACTUAL CrieSeuVideo
 * Three.js renderer. No AI calls are made here. Saves screenshots, frame QA
 * and an MP4 (or WebM if the runner lacks an AVC encoder).
 *
 * Never substitutes a deterministic hand-authored fixture for a missing model
 * output; missing tmp/gemini-live-3d/scene-plan.json => SKIPPED, not pass.
 */
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir=path.resolve('tmp/gemini-live-3d');
const planFile=path.join(dir,'scene-plan.json');
if(!existsSync(planFile)){
 console.log('GEMINI_LIVE_BROWSER_SKIPPED: no real Gemini response to render');
 process.exit(0);
}
await mkdir(dir,{recursive:true});
const {plan,syntheticScript}=JSON.parse(await readFile(planFile,'utf8'));
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--use-gl=angle',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader',
]});
const frames=[];
const errors=[];
let exportStatus='not_started',videoFilename=null;
try{
 const page=await browser.newPage({viewport:{width:800,height:900},acceptDownloads:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4198/',{waitUntil:'domcontentloaded',timeout:60000});
 const setup=await page.evaluate(async({plan,syntheticScript})=>{
   const qa=await import('/src/studio/explainer/sceneProgram/planner/geminiLiveBrowserLab.ts');
   return qa.installGeminiLiveQaScene(plan,syntheticScript);
 },{plan,syntheticScript});
 assert.ok(setup.nodes>=12,'Gemini produced an almost empty world');
 assert.ok(setup.camera.length>=3,'Camera QA did not run');
 for(const [time,label] of [[0,'01-first'],[2,'02-pickup'],[5,'03-transfer'],[8,'04-lowering'],[11.8,'05-last']]){
   if(time>=setup.seconds)continue;
   await page.evaluate(async t=>{
     const qa=await import('/src/studio/explainer/sceneProgram/planner/geminiLiveBrowserLab.ts');
     qa.renderGeminiQaFrame(t);
   },time);
   const target=path.join(dir,label+'.png');
   await page.locator('#gemini-live-canvas').screenshot({path:target});
   frames.push({time,label,filename:label+'.png'});
 }
 // Encoding is a browser capability, not a reason to fake a finished MP4.
 try{
   const downloadPromise=page.waitForEvent('download',{timeout:210000});
   const encoded=await page.evaluate(async()=>{
     const qa=await import('/src/studio/explainer/sceneProgram/planner/geminiLiveBrowserLab.ts');
     const {canvas,duration}=qa.getGeminiQaState();
     const exporter=await import('/src/studio/utils/deterministic3dExport.ts');
     const result=await exporter.encodeFixedFrame3DClip({
       canvas,durationSeconds:duration,fps:12,
       renderFrame:t=>qa.renderGeminiQaFrame(t),
     });
     const filename='gemini-motor-3d-real.'+result.filenameExtension;
     const url=URL.createObjectURL(result.blob);
     const a=document.createElement('a');
     a.href=url;a.download=filename;
     document.body.appendChild(a);a.click();a.remove();
     return {filename,frames:result.frames,extension:result.filenameExtension};
   });
   const downloaded=await downloadPromise;
   videoFilename=encoded.filename;
   await downloaded.saveAs(path.join(dir,videoFilename));
   exportStatus='completed_'+encoded.extension;
 }catch(err){
   exportStatus='unavailable_'+(err instanceof Error?err.message.slice(0,120):'unknown');
 }
 const report={
   status:'real_gemini_compiled_and_rendered',provider:'gemini',
   source:'Live API plan; not a deterministic demo replacement',
   seconds:setup.seconds,nodes:setup.nodes,
   frames,videoFilename,exportStatus,
   hardIssues:setup.hardIssues,
   cameraQA:setup.camera,
   errors,
 };
 await writeFile(path.join(dir,'render-report.json'),JSON.stringify(report,null,2));
 console.log('GEMINI_LIVE_RENDER_STATUS='+JSON.stringify({
   provider:report.provider,frames:frames.length,hardIssues:setup.hardIssues.length,
   videoFilename,exportStatus,errors:errors.length,
 }));
 assert.deepEqual(errors,[],'Browser runtime error');
}finally{await browser.close();}
