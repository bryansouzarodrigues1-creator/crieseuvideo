/** Real renderer comparison, fixture authored locally, not Gemini or Alex output.
 * Run against the existing Vite CI server. No paid provider or network model.
 */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='tmp/unified-3d-qa/editorial';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:412,height:915}});
  let providerRequests=0;
  await page.route(/generativelanguage\.googleapis\.com|ai\.gateway\.lovable\.dev|api\.elevenlabs\.io/,route=>{providerRequests++;return route.abort();});
  await page.goto('http://127.0.0.1:4198/',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const {drawExplainerFrame}=await import('/src/studio/explainer/render.ts');
    const {normalizePlan,fitToTrack,totalDuration}=await import('/src/studio/explainer/plan.ts');
    const {motionAudit}=await import('/src/studio/explainer/motionAudit.ts');
    const {encodeFixedFrame3DClip}=await import('/src/studio/utils/deterministic3dExport.ts');
    const scene=(text,drawing)=>({text,drawing,visual:'custom',mood:'neutral',palette:'teal',setting:'office'});
    const coin=(x,y,dx)=>({type:'coin',x,y,size:.65,depth:'middle',anim:'none',motion:[
      {time:0,dx:0},{time:2,dx,ease:'smooth'},{time:4,dx}
    ]});
    const wall={type:'rect',x:0,y:20,w:740,h:440,color:'#173D53',depth:'back',anim:'none'};
    const floor={type:'rect',x:0,y:400,w:730,h:55,color:'#143044',depth:'front',anim:'none'};
    const scenes=[
      scene('Uma moeda sozinha parece não fazer diferença.',[wall,coin(-150,0,260),floor]),
      scene('Mas guardar um pouco toda semana muda o resultado.',[wall,coin(-240,-100,230),coin(-240,100,230),{type:'chart',x:220,y:0,size:.7,depth:'middle',anim:'none'},floor]),
      scene('O dinheiro acumulado pode financiar ferramentas para trabalhar.',[wall,{type:'laptop',x:180,y:0,size:.7,depth:'middle',anim:'none'},coin(-240,0,100),floor]),
      scene('O segredo é transformar pequenas decisões em um hábito.',[wall,{type:'clock',x:-170,y:0,size:.85,depth:'middle',anim:'none'},{type:'check',x:180,y:0,size:.85,depth:'front',anim:'none',motion:[{time:0,opacity:0,scale:.5},{time:1.5,opacity:1,scale:1}]},floor])
    ];
    const script=scenes.map(s=>s.text).join(' ');
    const plan=fitToTrack(normalizePlan({title:'Pequenas decisões',scenes},script,'9:16'),20);
    const canvas=document.createElement('canvas');canvas.width=360;canvas.height=640;
    const ctx=canvas.getContext('2d');
    const captures=[];
    const audio=new AudioBuffer({length:48000*20,numberOfChannels:1,sampleRate:48000});
    // A quiet reference tone, not speech; proves the audio muxer only.
    const samples=audio.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=.018*Math.sin(i*2*Math.PI*220/48000);
    for(const engine of ['2d','2.5d']){
      const directed={...plan,engine};
      const render=t=>drawExplainerFrame(ctx,directed,t);
      const stills=[2,7,12,17].map(t=>{render(t);return canvas.toDataURL('image/png').split(',')[1];});
      render(7);const first=canvas.toDataURL();render(17);render(7);
      const seekStable=first===canvas.toDataURL();
      const encoded=await encodeFixedFrame3DClip({canvas,durationSeconds:20,fps:12,renderFrame:render,audioBuffer:audio});
      const bytes=new Uint8Array(await encoded.blob.arrayBuffer());
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      captures.push({engine,stills,seekStable,frames:encoded.frames,extension:encoded.filenameExtension,video:btoa(binary)});
    }
    return {duration:totalDuration(plan),audit:motionAudit(plan),captures};
  });
  assert.ok(Math.abs(result.duration-20)<1e-8);
  assert.equal(providerRequests,0);
  assert.equal(result.captures.length,2);
  assert.notEqual(result.captures[0].stills[0],result.captures[1].stills[0],'Depth mode produced identical first shot');
  for(const clip of result.captures){
    assert.equal(clip.seekStable,true,'Non-deterministic frame');
    assert.equal(clip.frames,240);
    const bytes=Buffer.from(clip.video,'base64');
    const {Input,BlobSource,ALL_FORMATS}=await import('mediabunny');
    const input=new Input({source:new BlobSource(new Blob([bytes])),formats:ALL_FORMATS});
    assert.ok(await input.getPrimaryAudioTrack(),'Missing audio track');
    assert.ok(await input.getPrimaryVideoTrack(),'Missing video track');
    await writeFile(out+'/'+clip.engine+'.'+clip.extension,bytes);
    for(let i=0;i<clip.stills.length;i++)await writeFile(out+'/'+clip.engine+'-'+i+'.png',Buffer.from(clip.stills[i],'base64'));
  }
  await writeFile(out+'/report.json',JSON.stringify({duration:result.duration,audit:result.audit,providerRequests,frames:240,source:'manual fixture',audio:'reference tone, not Alex narration',quality:'requires visual review'},null,2));
}finally{await browser.close();}
