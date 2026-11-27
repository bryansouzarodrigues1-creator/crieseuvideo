import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('tmp/compact-ai-worlds/editorial');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report=[];
try{
  const page=await browser.newPage({viewport:{width:420,height:780},acceptDownloads:true});
  await page.goto('http://127.0.0.1:4198/',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{
    const {normalizePlan,fitToTrack}=await import('/src/studio/explainer/plan.ts');
    const {drawExplainerFrame}=await import('/src/studio/explainer/render.ts');
    const {encodeFixedFrame3DClip}=await import('/src/studio/utils/deterministic3dExport.ts');
    const {motionAudit}=await import('/src/studio/explainer/motionAudit.ts');
    const scene=(text,setting,drawing)=>({text,visual:'custom',palette:'teal',mood:'neutral',setting,drawing});
    const shape=(type,x,y,size,depth,extra={})=>({type,x,y,size,depth,anim:'none',...extra});
    const move=(x,y)=>[{time:0,dx:0,dy:0},{time:3,dx:x,dy:y}];
    const scenes=[
      scene('Uma pizzaria tem boas pizzas, mas poucas pessoas conhecem seu trabalho.','city_day',[
        shape('house',-170,60,0.9,'back'),shape('person',120,120,.85,'middle'),
        shape('coin',230,-120,.7,'front',{motion:move(-110,120)})]),
      scene('O dono cria um site simples para mostrar seu cardápio.','office',[
        shape('laptop',0,30,1,'middle'),shape('hand',260,180,.65,'front',{motion:move(-130,-130)}),
        shape('plant',0,0,1,'back'),shape('clock',-280,-130,.45,'back')].filter(x=>x.type!=='plant')),
      scene('Agora os clientes encontram a loja e fazem seus pedidos.','city_day',[
        shape('phone',-160,15,.8,'middle'),shape('person',190,100,.75,'back'),
        shape('check',230,-160,.55,'front',{motion:move(-90,100)})]),
      scene('Mais pessoas conhecem a pizzaria. Esse é o poder da presença digital.','office',[
        shape('chart',0,20,1,'middle'),shape('coin',-290,100,.6,'back'),
        shape('arrow',230,-150,.65,'front',{motion:move(-100,-55)})])
    ];
    const raw={title:'Pizzaria — teste técnico',scenes};
    const script=scenes.map(s=>s.text).join(' ');
    const base=fitToTrack(normalizePlan(raw,script,'9:16'),20);
    const canvas=document.createElement('canvas');canvas.id='editorial-qa';
    canvas.width=360;canvas.height=640;
    document.body.replaceChildren(canvas);
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Canvas unavailable');
    // A synthetic audio signal is ONLY a mux/clock fixture, never labelled Alex.
    const audio=new AudioBuffer({length:20*24000,sampleRate:24000,numberOfChannels:1});
    const samples=audio.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=.035*Math.sin(2*Math.PI*440*i/24000)*(i%24000<2400?1:0);
    globalThis.editorialQA={
      draw(engine,time){drawExplainerFrame(ctx,{...base,engine},time);return canvas.toDataURL();},
      audit(){return motionAudit(base);},
      async encode(engine){
        const result=await encodeFixedFrame3DClip({canvas,durationSeconds:20,fps:24,audioBuffer:audio,
          renderFrame:t=>drawExplainerFrame(ctx,{...base,engine},t)});
        const url=URL.createObjectURL(result.blob);
        const a=document.createElement('a');a.href=url;a.download='editorial-'+engine+'.'+result.filenameExtension;a.click();
        return {frames:result.frames,fps:result.fps,bytes:result.blob.size,format:result.filenameExtension};
      }
    };
  });
  const audit=await page.evaluate(()=>globalThis.editorialQA.audit());
  assert.equal(audit.directedScenes,4);
  const render=(engine,time)=>page.evaluate(({engine,time})=>globalThis.editorialQA.draw(engine,time),{engine,time});
  for(const engine of ['2d','2.5d']){
    const a=await render(engine,2);
    const b=await render(engine,3);
    assert.notEqual(a,b,'Motion must visibly change the frame');
    assert.equal(await render(engine,2),a,'Seeking must reproduce the same pixels');
    for(const t of [2,7,12,17]){
      await render(engine,t);
      await page.locator('#editorial-qa').screenshot({path:path.join(out,engine+'-'+t+'.png')});
    }
    const pending=page.waitForEvent('download',{timeout:180000});
    const info=await page.evaluate(engine=>globalThis.editorialQA.encode(engine),engine);
    const dl=await pending;await dl.saveAs(path.join(out,dl.suggestedFilename()));
    assert.equal(info.frames,480);assert.ok(info.bytes>10000);
    report.push({engine,...info});
  }
  assert.notEqual(await render('2d',3),await render('2.5d',3),'Depth should affect pixels');
  await writeFile(path.join(out,'report.json'),JSON.stringify({passed:true,audit,report,
    provenance:'Hand-authored test fixture; actual production renderer; synthetic test tone, not Gemini direction or Alex narration.'},null,2));
}finally{await browser.close();}
