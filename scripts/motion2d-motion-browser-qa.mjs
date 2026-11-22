import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const out='tmp/motion2d-keyframes';await mkdir(out,{recursive:true});
const js=await readFile(out+'/harness.js');
const server=createServer((req,res)=>{
 if(req.url?.split('?')[0]==='/harness.js'){
  res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});res.end(js);
 }else{
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  res.end('<!doctype html><html lang="pt-BR"><meta charset="UTF-8"><title>Motion 2D Keyframe QA</title><body style="margin:0;background:#171722"><canvas id="screen" width="720" height="1280"></canvas><script type="module" src="/harness.js"></script></body></html>');
 }
});
await new Promise(resolve=>server.listen(4219,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={engine:'original CrieSeuVideo Motion 2D',authorship:'hand-authored, not Gemini',providerRequests:0,errors:[],duration:8,fps:30,frames:240};
let page;
try{
 page=await browser.newPage({viewport:{width:760,height:800},acceptDownloads:true});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('request',r=>{if(/generativelanguage.googleapis.com|ai.gateway.lovable.dev/.test(r.url()))report.providerRequests++});
 await page.goto('http://127.0.0.1:4219/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:30000});
 for(const t of [.3,.9,1.7,2.6,3.7,4.3,5.8,7.5]){
  const png=await page.evaluate(t=>window.motionQA.frame(t),t);
  await writeFile(`${out}/frame-${t.toFixed(1)}.png`,Buffer.from(png,'base64'));
 }
 const a=await page.evaluate(()=>window.motionQA.frame(1.3));
 await page.evaluate(()=>window.motionQA.frame(6.4));
 const b=await page.evaluate(()=>window.motionQA.frame(1.3));
 assert.equal(a,b,'Pixel replay changed after reverse seeking');
 report.seekReplayEqual=true;
 const first=await page.evaluate(()=>window.motionQA.frame(.3));
 const next=await page.evaluate(()=>window.motionQA.frame(2.6));
 assert.notEqual(first,next,'Animation not visible');
 report.movementVisible=true;
 const pending=page.waitForEvent('download',{timeout:600000});
 const frames=await page.evaluate(()=>window.motionQA.export());
 assert.equal(frames,240);
 const video=out+'/motion2d-gemini-keyframe-engine-QA.mp4';
 await (await pending).saveAs(video);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,codec_name','-of','json',video],{encoding:'utf8'}));
 const v=probe.streams[0];
 assert.equal(v.codec_name,'h264');assert.equal(v.width,720);assert.equal(v.height,1280);assert.equal(Number(v.nb_read_frames),240);
 assert.equal(report.providerRequests,0);assert.deepEqual(report.errors,[]);
 report.output=video;report.succeeded=true;
 console.log('MOTION_2D_NATIVE_KEYFRAMES_OK',video);
}finally{
 await writeFile(out+'/report.json',JSON.stringify(report,null,2));
 await page?.close().catch(()=>{});await browser.close();await new Promise(r=>server.close(r));
}
