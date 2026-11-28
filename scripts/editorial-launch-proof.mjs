/** Offline, real Alex narration + actual production renderer/exporter.
 * The storyboard is authored by hand, not a Gemini result. */
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const live=process.env.EDITORIAL_LIVE_PROOF==='1';
const out=live?'tmp/editorial-live-proof':'tmp/editorial-launch-proof';
await mkdir(out,{recursive:true});
const defaultScript='O quarto está quente. O ar-condicionado puxa o ar do ambiente. O fluido refrigerante absorve calor e o leva para fora. O ar volta mais frio. O aparelho não cria frio, ele transporta calor.';

const supplied=live?JSON.parse(await readFile(out+'/plan.json','utf8')):null;
if(live&&(!supplied?.plan?.scenes?.length||supplied.script!==defaultScript||supplied.plan.engine!=='2.5d'))throw Error('Accepted Gemini plan required; no manual fallback.');
const script=defaultScript;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:412,height:915}});
 let providerRequests=0;const external=[];
 await page.route('**/*',route=>{const url=route.request().url();if(url.includes('/api/ai/')){providerRequests++;return route.abort();}if(url.startsWith('http://127.0.0.1:4198/')||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();external.push(new URL(url).origin);return route.abort();});
 // Isolate the real studio modules from unrelated login/analytics initialization.
 await page.route('http://127.0.0.1:4198/__editorial-proof',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset=utf-8><title>Editorial proof</title>'}));
 await page.goto('http://127.0.0.1:4198/__editorial-proof',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async({script,supplied})=>{
  const {normalizePlan,fitToTrack,totalDuration}=await import('/src/studio/explainer/plan.ts');
  const {exportEditorialVideo}=await import('/src/studio/explainer/editorialExport.ts');
  const {inspectEditorialFrames}=await import('/src/studio/explainer/editorialReview.ts');
  const {drawExplainerFrame}=await import('/src/studio/explainer/render.ts');
  await document.fonts.ready;
  const ac=new AudioContext();
  const {synthesizeAlexInBrowser}=await import('/src/studio/components/alexBrowser.ts');
  const file=await synthesizeAlexInBrowser({text:script,speed:1,signal:AbortSignal.timeout(300000)});
  const wav=new Uint8Array(await file.arrayBuffer());
  const track=await ac.decodeAudioData(wav.buffer.slice(0));await ac.close();
  const part=(type,x,y,p)=>({type,x,y,anim:'none',depth:'middle',strokeWidth:0,...p});
  const rect=(x,y,w,h,color,p={})=>part('rect',x,y,{w,h,color,...p});
  const circle=(x,y,r,color,p={})=>part('circle',x,y,{r,color,...p});
  const line=(points,color,size=1)=>part('line',0,0,{points,color,stroke:color,size});
  const bg=(top,bottom,elements)=>({top,bottom,elements});
  const room=bg('#B96F45','#F7CE98',[{type:'rect',x:500,y:895,w:1000,h:210,color:'#AD754E'},{type:'rect',x:760,y:260,w:280,h:330,color:'#E8E3D4'},{type:'rect',x:760,y:260,w:250,h:300,color:'#F8C55D'}]);
  const inside=bg('#24415C','#86B2C2',[{type:'rect',x:500,y:920,w:1000,h:160,color:'#4B7185'}]);
  const cool=bg('#416A88','#C5E2E8',[{type:'rect',x:500,y:895,w:1000,h:210,color:'#789EAE'},{type:'rect',x:760,y:260,w:280,h:330,color:'#E8E3D4'},{type:'rect',x:760,y:260,w:250,h:300,color:'#A8D3E8'}]);
  const actor={id:'worker',style:{skin:'#D7A27D',hair:'#503329',shirt:'#26778B',pants:'#293A4C',haircut:'short'},action:'react',expression:'worried',facing:'right',speaking:false};
  const unit=[rect(115,-90,340,115,'#F2F5F7',{material:{kind:'linear',light:'#FFFFFF',dark:'#A5BDCD',angle:90}}),rect(115,-46,295,28,'#506779'),rect(115,-46,245,5,'#AFC7D5'),circle(251,-112,6,'#4CA875')];
  const flow=(x,y,color,dx,dy)=>circle(x,y,10,color,{motion:[{time:0,dx:0,dy:0,opacity:0},{time:.4,opacity:1},{time:2,dx,dy,opacity:1},{time:3,dx,dy,opacity:0}]});
  const scene=(text,drawing,backdrop,camera='static')=>({text,drawing,backdrop,camera,visual:'custom',composition:'authored',mood:'neutral',palette:'teal',framing:{x:0,y:0,zoom:1}});
  const scenes=[
   scene('O quarto está quente.',[rect(0,190,740,45,'#AD754E',{depth:'back'}),part('actor',-100,10,{actor,size:1.1}),...unit,circle(270,105,35,'#F49D35',{motion:[{time:0,scale:.9},{time:2,scale:1.1}]})],room),
   scene('O ar-condicionado puxa o ar do ambiente.',[...unit,...[-60,0,60].map(x=>flow(x,105,'#F4A54B',115-x,-140)),rect(0,205,700,40,'#7896A3',{depth:'back'})],inside,'push_in'),
   scene('O fluido refrigerante absorve calor e o leva para fora.',[
    rect(-160,0,185,235,'#D4E5EC'),rect(180,0,185,235,'#C4D4DD'),line([[-160,-100],[-160,100],[180,100],[180,-100],[-160,-100]],'#B9783C',1.2),
    circle(-160,0,52,'#6DBBD8',{material:{kind:'radial',light:'#D8F5FF',dark:'#337A9D'}}),circle(180,0,52,'#EA9159',{material:{kind:'radial',light:'#FFE8B2',dark:'#A94B31'}}),
    flow(-160,-100,'#F5A14B',340,0),flow(-160,100,'#F5A14B',340,0)
   ],inside),
   scene('O ar volta mais frio. O aparelho não cria frio, ele transporta calor.',[rect(0,190,740,45,'#789EAE',{depth:'back'}),part('actor',-100,10,{actor:{...actor,action:'idle',expression:'happy'},size:1.1}),...unit,...[-30,40,110].map(x=>flow(115,-40,'#63C3E4',x-115,140))],cool,'pull_out')
  ];
  const plan={...fitToTrack(supplied?supplied.plan:normalizePlan({title:'Como o ar-condicionado funciona',scenes},script,'9:16'),track.duration),engine:'2.5d'};
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;
  const context=canvas.getContext('2d');
  const review=inspectEditorialFrames(plan),stills=[];
  for(const f of [.12,.38,.64,.88]){drawExplainerFrame(context,plan,totalDuration(plan)*f);stills.push(canvas.toDataURL('image/jpeg',.9).split(',')[1]);}
  const video=await exportEditorialVideo({plan,track,canvas});
  let binary='';const b=new Uint8Array(await video.blob.arrayBuffer());for(let i=0;i<b.length;i+=8192)binary+=String.fromCharCode(...b.subarray(i,i+8192));
  let voiceBinary='';for(let i=0;i<wav.length;i+=8192)voiceBinary+=String.fromCharCode(...wav.subarray(i,i+8192));
  return {wav:btoa(voiceBinary),video:btoa(binary),extension:video.filenameExtension,frames:video.frames,fps:video.fps,voiceSeconds:track.duration,timelineSeconds:totalDuration(plan),review,stills};
 },{script,supplied});
 assert.equal(providerRequests,0);
 const externalSpeech=external;
 await writeFile(out+'/network.json',JSON.stringify({blockedExternal:external,blockedNonFont:externalSpeech},null,2));
 assert.equal(externalSpeech.length,0,'Unexpected external request during studio proof');
 await writeFile(out+'/alex.wav',Buffer.from(result.wav,'base64'));
 assert.ok(Math.abs(result.voiceSeconds-result.timelineSeconds)<.001);
 assert.equal(result.frames,Math.round((result.timelineSeconds+.35)*30));
 assert.ok(Buffer.from(result.video,'base64').length>10000);
 await writeFile(out+'/ar-condicionado.'+result.extension,Buffer.from(result.video,'base64'));
 for(const [i,still] of result.stills.entries())await writeFile(out+'/scene-'+(i+1)+'.jpg',Buffer.from(still,'base64'));
 await writeFile(out+'/report.json',JSON.stringify({script,source:live?'accepted Gemini plan, real local Alex audio, production renderer and exporter':'manual authored storyboard, real local Alex audio, production renderer and exporter',voiceSeconds:result.voiceSeconds,timelineSeconds:result.timelineSeconds,frames:result.frames,fps:result.fps,extension:result.extension,review:result.review,providerRequests,limitations:live?'desktop Chromium; approximate word timings; visual quality requires review':'desktop Chromium; approximate word timings; not Gemini output'},null,2));
}finally{await browser.close();}
