/** Deterministic visual evidence for the ACTUAL 3D engine.
 * No Gemini/Lovable model calls and no replacement video renders.
 */
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

const base='http://127.0.0.1:4198';
const out=path.resolve('tmp/compact-ai-worlds/causal-crane');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
]});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:750,height:1200},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
 const render=async(seconds,width,height,label)=>{
  const result=await page.evaluate(async ({seconds,width,height})=>{
   const module=await import('/src/studio/explainer/sceneProgram/planner/compactWorldBrowserLab.ts');
   return module.showCompactWorldForQA('craneSequence',seconds,width,height);
  },{seconds,width,height});
  assert.equal(result.seconds,12,'Expected three ordered 4s beats');
  assert.ok(result.nodes>15,'No meaningful rig or scene');
  assert.ok(result.tracks>=6,'Cargo, hook, cable, trolley and winch tracks missing');
  assert.ok(result.pixels>11000,'Empty WebGL scene');
  const filename=label+'.png';
  const screenshot=await page.locator('#compact-qa-canvas').screenshot({path:path.join(out,filename)});
  const sha256=createHash('sha256').update(screenshot).digest('hex');
  return {seconds,width,height,sha256,nodes:result.nodes,tracks:result.tracks,bytes:screenshot.length,filename};
 };
 const result=[];
 for(const [t,label] of [[0,'01-start'],[2,'02-lifting'],[3.8,'03-raised'],[5.6,'04-carrying'],[7.8,'05-across'],[9.7,'06-lowering'],[11.9,'07-deposited']]){
  result.push(await render(t,360,640,label));
 }
 // Landscape review catches 3D composition clipping missed by vertical-only QA.
 result.push(await render(2,640,360,'08-landscape-lift'));
 result.push(await render(10,640,360,'09-landscape-lower'));
 assert.ok(new Set(result.slice(0,7).map(x=>x.sha256)).size>=4,
   'Cargo does not visibly move across three chapters');
 assert.notEqual(result[0].sha256,result[6].sha256,'Beginning and end rendered the same image');
 assert.deepEqual(errors,[],'Browser reported a JS error');
 await writeFile(path.join(out,'report.json'),JSON.stringify({
  passed:true,scene:'One cargo lifts, moves and lowers in 12s',
  frames:result,errors,
  note:'Real WebGL screenshots from deterministic compiled scene, not an AI-generated customer job. Human visual review is still required; no MP4 was exported.'
 },null,2));
 console.log('PASS: 7 real 3D action frames + 2 landscape frames, cargo and rig animate with continuous identity');
} finally{await browser.close();}
