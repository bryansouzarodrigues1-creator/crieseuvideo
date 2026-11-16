/** Real Chromium/WebGL render, fixture-only API and zero paid calls. */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import worker from '../dist/server/index.js';

const script='O liquidificador gira e revela o recipiente de vidro.';
const response={
  title:'Liquidificador 3D procedural',
  scenes:[{sourceId:'s1',visual:'character',mood:'neutral',palette:'teal'}],
  sceneProgram:{
    version:1, background:'#E2EFF0',
    nodes:[
      {id:'blender-base',kind:'mesh',contextSourceId:'s1',position:[0,.05,0],
       color:'#354559',geometry:{shape:'box',size:[1.15,.4,1.2]}},
      {id:'blender-jar',kind:'mesh',contextSourceId:'s1',position:[0,.45,0],
       color:'#D7F4F8',geometry:{shape:'lathe',segments:32,
         profile:[[0,0],[.38,0],[.45,.2],[.56,.95],[.62,1.25]]},
       material:{roughness:.09,metalness:.08,opacity:.60,emissive:'#000000',emissiveIntensity:0}},
      {id:'lid',kind:'mesh',contextSourceId:'s1',position:[0,1.78,0],
       color:'#273D53',geometry:{shape:'cylinder',size:[.65,.65,.13]}},
      {id:'handle',kind:'mesh',contextSourceId:'s1',position:[.69,1.1,0],
       color:'#273D53',geometry:{shape:'torus',size:[.29,.055]}},
      {id:'floor',kind:'mesh',contextSourceId:'s1',position:[0,-.2,0],
       color:'#B4C1BD',geometry:{shape:'box',size:[5,.10,5]}}
    ],
    tracks:[{node:'blender-jar',channel:'rotation',interpolation:'linear',
      keys:[{sourceId:'s1',phase:0,value:[0,0,0]},{sourceId:'s1',phase:1,value:[0,6,0]}]}],
    shots:[{sourceId:'s1',subjects:['blender-base','blender-jar','lid'],
      azimuth:.36,endAzimuth:1.12,elevation:.22,distance:1.3}],
    contacts:[],
  }
};
const output=path.resolve('tmp/hybrid-procedural-preview');
await fs.mkdir(output,{recursive:true});
const nativeFetch=globalThis.fetch;
let calls=0;
globalThis.fetch=async url=>{
  assert.match(String(url),/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.6-flash:generateContent$/);
  calls++;
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(response)}]}}]});
};
const server=http.createServer(async (req,res)=>{
  try{
    const chunks=[];
    for await(const c of req)chunks.push(c);
    const base='http://127.0.0.1:'+server.address().port;
    const result=await worker.fetch(new Request(new URL(req.url||'/',base),{
      method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})
    }),{GEMINI_API_KEY:'fixture-not-real'});
    res.writeHead(result.status,Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;const errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#script').fill(script);
  await page.locator('#duration').selectOption('custom');
  await page.locator('#duration-custom').fill('5');
  await page.locator('#duration-custom').dispatchEvent('change');
  await page.locator('#generate').click();
  await page.waitForFunction(()=>!document.getElementById('generate').disabled);
  await page.waitForFunction(()=>document.getElementById('canvas').dataset.action==='scene-program3d',undefined,{timeout:30000});
  assert.equal(calls,1);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('crieseuvideo-lab-v1')));
  assert.equal(stored.plan.scenes.map(s=>s.text).join(' '),script);
  assert.equal(stored.plan.sceneProgram.nodes.find(n=>n.id==='blender-jar').geometry.shape,'lathe');
  const hashes=[];
  for(const [i,fraction] of [.04,.28,.55,.82,.98].entries()){
    const data=await page.evaluate(at=>{
      const input=document.getElementById('timeline');
      input.value=String(at);input.dispatchEvent(new Event('input',{bubbles:true}));
      const canvas=document.getElementById('canvas');
      return {png:canvas.toDataURL('image/png').split(',')[1],
        info:JSON.parse(canvas.dataset.production||'{}'),action:canvas.dataset.action};
    },5*fraction);
    assert.equal(data.action,'scene-program3d');
    assert.equal(data.info.board,false);
    const png=Buffer.from(data.png,'base64');
    hashes.push(createHash('sha256').update(png).digest('hex'));
    await fs.writeFile(path.join(output,'liquidificador-'+i+'.png'),png);
  }
  assert.equal(new Set(hashes).size,5);
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({
    modelGenerationReal:false,modelResponseSimulated:true,paidCalls:0,
    canvas:'scene-program3d',frameHashes:hashes,textPreserved:true,geometry:'THREE.LatheGeometry'
  },null,2));
  console.log('PASS 5 unique real WebGL frames, scripted generic blender, 0 paid calls.');
}finally{
  globalThis.fetch=nativeFetch;
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
