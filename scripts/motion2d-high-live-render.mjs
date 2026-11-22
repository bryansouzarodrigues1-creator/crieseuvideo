import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const out='tmp/motion2d-high-live';await mkdir(out,{recursive:true});
const js=await readFile(out+'/harness.js');
const plan=await readFile(out+'/gemini-response.json');
const server=createServer((req,res)=>{
 const url=req.url?.split('?')[0];
 if(url==='/harness.js'){res.writeHead(200,{'content-type':'application/javascript'});res.end(js);}
 else if(url==='/gemini-response.json'){res.writeHead(200,{'content-type':'application/json'});res.end(plan);}
 else{res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html lang="pt-BR"><meta charset="UTF-8"><body style="margin:0;background:#151522"><canvas id="screen" width="720" height="1280"></canvas><script type="module" src="/harness.js"></script></body></html>');}
});
await new Promise(r=>server.listen(4217,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={engine:'original CrieSeuVideo Motion 2D',authorship:'Gemini 3.8 Flash High (from original JSON)',frames:1200,errors:[],providerCallsDuringRender:0};
let page;
try{
 page=await browser.newPage({viewport:{width:760,height:850},acceptDownloads:true});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('request',r=>{if(/generativelanguage.googleapis.com|ai.gateway.lovable.dev/.test(r.url()))report.providerCallsDuringRender++;});
 await page.goto('http://127.0.0.1:4217/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:30000});
 report.sceneCount=await page.evaluate(()=>window.proof.sceneCount);
 for(const t of [0.5,5.3,10.4,15.6,20.3,25.5,30.3,35.2,39.3]){
  const png=await page.evaluate(t=>window.proof.frame(t),t);
  await writeFile(`${out}/preview-${t.toFixed(1)}.png`,Buffer.from(png,'base64'));
 }
 const a=await page.evaluate(()=>window.proof.frame(7.4));
 await page.evaluate(()=>window.proof.frame(35.8));
 const b=await page.evaluate(()=>window.proof.frame(7.4));
 assert.equal(a,b,'Replay must be repeatable');
 report.replayEqual=true;
 for(const start of [0,20]){
  const download=page.waitForEvent('download',{timeout:720000});
  const frames=await page.evaluate(start=>window.proof.exportPart(start),start);
  assert.equal(frames,600);
  await (await download).saveAs(`${out}/gemini-high-motion2d-${start}.mp4`);
  console.log('EXPORTED',start,frames);
 }
 assert.equal(report.providerCallsDuringRender,0);
 assert.deepEqual(report.errors,[]);
 const vlist=out+'/concat.txt';
 await writeFile(vlist,"file 'gemini-high-motion2d-0.mp4'\nfile 'gemini-high-motion2d-20.mp4'\n");
 const final=out+'/Gemini_HIGH_Motion2D_40s_Legendas.mp4';
 execFileSync('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',vlist,'-c','copy',final]);
 const raw=execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_name,width,height,nb_read_frames:format=duration','-of','json',final],{encoding:'utf8'});
 const p=JSON.parse(raw);
 const video=p.streams.find(s=>s.codec_name==='h264');
 assert.equal(Number(video?.nb_read_frames),1200);
 assert.equal(video.width,720);assert.equal(video.height,1280);
 assert.ok(Math.abs(Number(p.format.duration)-40)<.1);
 report.output=final;report.seconds=Number(p.format.duration);
 console.log('MOTION2D_GEMINI_HIGH_VIDEO_OK',final,report.seconds);
}finally{
 await writeFile(out+'/render-report.json',JSON.stringify(report,null,2));
 await page?.close().catch(()=>{});await browser.close();
 await new Promise(r=>server.close(r));
}
