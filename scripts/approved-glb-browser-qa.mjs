/** Chromium WebGL QA of a genuine self-contained GLB with embedded animation.
 * The asset is generated locally and served from the approved project path;
 * the Gemini result is mocked, with zero external provider calls. */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import worker from '../dist/server/index.js';

function buildGLB() {
  const points=[-.5,0,0,.5,0,0,0,1,0,0,.3,.7], indexes=[0,1,2,0,3,1,0,2,3,1,3,2];
  const json={
    asset:{version:'2.0',generator:'CrieSeuVideo offline GLB test'},
    scene:0,scenes:[{nodes:[0]}],nodes:[{name:'robot-part',mesh:0}],
    meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],
    materials:[{doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[.18,.74,.92,1],metallicFactor:0,roughnessFactor:.56}}],
    accessors:[
      {bufferView:0,componentType:5126,count:4,type:'VEC3',min:[-.5,0,0],max:[.5,1,.7]},
      {bufferView:1,componentType:5123,count:12,type:'SCALAR'},
      {bufferView:2,componentType:5126,count:3,type:'SCALAR',min:[0],max:[2]},
      {bufferView:3,componentType:5126,count:3,type:'VEC3'}
    ],
    bufferViews:[
      {buffer:0,byteOffset:0,byteLength:48},
      {buffer:0,byteOffset:48,byteLength:24},
      {buffer:0,byteOffset:72,byteLength:12},
      {buffer:0,byteOffset:84,byteLength:36}
    ],
    buffers:[{byteLength:120}],
    animations:[{name:'move-robot-head',samplers:[{input:2,output:3,interpolation:'LINEAR'}],
      channels:[{sampler:0,target:{node:0,path:'translation'}}]}]
  };
  const encoder=new TextEncoder(), bytes=encoder.encode(JSON.stringify(json));
  const jsize=Math.ceil(bytes.length/4)*4, bin=120;
  const buffer=new ArrayBuffer(12+8+jsize+8+bin);
  const view=new DataView(buffer), data=new Uint8Array(buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);
  view.setUint32(12,jsize,true);view.setUint32(16,0x4e4f534a,true);
  data.fill(32,20,20+jsize);data.set(bytes,20);
  const at=20+jsize;view.setUint32(at,bin,true);view.setUint32(at+4,0x004e4942,true);
  points.forEach((n,i)=>view.setFloat32(at+8+i*4,n,true));
  indexes.forEach((n,i)=>view.setUint16(at+8+48+i*2,n,true));
  [0,1,2].forEach((n,i)=>view.setFloat32(at+8+72+i*4,n,true));
  [0,0,0,0,.24,0,0,0,0].forEach((n,i)=>view.setFloat32(at+8+84+i*4,n,true));
  return Buffer.from(buffer);
}
const glb=buildGLB(), assetPath='/__l5e/assets-v1/9878ecc5-49b2-4d40-92d0-0116735797d1/expressive-robot.glb';
const script='O robô caminha pelo laboratório.';
const sample={title:'Robô com GLB e animação',
  scenes:[{sourceId:'s1',visual:'character',mood:'neutral',palette:'teal'}],
  sceneProgram:{version:1,background:'#DDEBF7',nodes:[
    {id:'robot',kind:'model',assetId:'expressive-robot-v1',contextSourceId:'s1',
      position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#FFFFFF'}
  ],tracks:[{node:'robot',channel:'position',interpolation:'smooth',
    keys:[{sourceId:'s1',phase:0,value:[-1.5,0,0]},
      {sourceId:'s1',phase:1,value:[1.5,0,0]}]}],
   shots:[{sourceId:'s1',subjects:['robot'],azimuth:.35,endAzimuth:.62,elevation:.18,distance:1.3}],
   contacts:[]}};
const out=path.resolve('tmp/approved-glb-browser');
await fs.mkdir(out,{recursive:true});
const networkCalls={asset:0,gemini:0};const oldFetch=globalThis.fetch;
globalThis.fetch=async (url,init)=>{
  assert.match(String(url),/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.6-flash:generateContent$/);
  networkCalls.gemini++;
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(sample)}]}}]});
};
const server=http.createServer(async (req,res)=>{
  try{
    if(req.url===assetPath){
      networkCalls.asset++;
      res.writeHead(200,{'content-type':'model/gltf-binary','content-length':String(glb.length)});
      res.end(glb);return;
    }
    const all=[];for await(const data of req)all.push(data);
    const url='http://127.0.0.1:'+server.address().port;
    const result=await worker.fetch(new Request(new URL(req.url||'/',url),{
      method:req.method,headers:req.headers,...(all.length?{body:Buffer.concat(all)}:{})
    }),{GEMINI_API_KEY:'offline-fixture-not-a-real-key'});
    res.writeHead(result.status,Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const errors=[];let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:393,height:852}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.locator('#script').fill(script);
  await page.locator('#duration').selectOption('custom');
  await page.locator('#duration-custom').fill('6');
  await page.locator('#duration-custom').dispatchEvent('change');
  await page.locator('#generate').click();
  await page.waitForFunction(()=>!document.getElementById('generate').disabled,undefined,{timeout:60000});
  await page.waitForFunction(()=>document.getElementById('canvas').dataset.action==='scene-program3d',undefined,{timeout:60000});
  assert.equal(networkCalls.gemini,1);assert.equal(networkCalls.asset,1);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('crieseuvideo-lab-v1')));
  assert.equal(saved.plan.sceneProgram.nodes[0].kind,'model');
  assert.equal(saved.plan.scenes.map(s=>s.text).join(' '),script);
  const hashes=[];
  for(const [i,f] of [.05,.27,.51,.78,.95].entries()){
    const image=await page.evaluate(at=>{
      const timeline=document.getElementById('timeline');
      timeline.value=String(at);timeline.dispatchEvent(new Event('input',{bubbles:true}));
      return document.getElementById('canvas').toDataURL('image/png').split(',')[1];
    },6*f);
    const png=Buffer.from(image,'base64');
    hashes.push(createHash('sha256').update(png).digest('hex'));
    await fs.writeFile(path.join(out,'robot-'+i+'.png'),png);
  }
  assert.equal(new Set(hashes).size,5,'The robot model did not move with the timeline');
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({
    result:'PASS',modelType:'embedded self-contained GLB',importedRealGLB:true,
    animation:'GLTF animation mixer plus authored timeline trajectory',
    samples:hashes,paidModelCalls:0,simulatedGeminiCalls:1,assetRequests:networkCalls.asset
  },null,2));
  console.log('PASS real GLB load, timeline motion, five unique Chromium WebGL frames and no paid model calls.');
}finally{
  globalThis.fetch=oldFetch;await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
