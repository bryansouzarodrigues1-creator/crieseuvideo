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
    await Promise.all([document.fonts.load("40px 'Lilita One'"),document.fonts.load("700 40px 'Plus Jakarta Sans'"),document.fonts.load("800 40px 'Plus Jakarta Sans'")].map(p=>p.catch(()=>{})));
    await document.fonts.ready;
    const {drawExplainerFrame}=await import('/src/studio/explainer/render.ts');
    const {normalizePlan,fitToTrack,totalDuration}=await import('/src/studio/explainer/plan.ts');
    const {motionAudit}=await import('/src/studio/explainer/motionAudit.ts');
    const {inspectEditorialFrames}=await import('/src/studio/explainer/editorialReview.ts');
    const {previewEditorialRepair}=await import('/src/studio/explainer/editorialRepairPreview.ts');
    const {encodeFixedFrame3DClip}=await import('/src/studio/utils/deterministic3dExport.ts');
    const scenery=(top,bottom,ground,detail)=>({top,bottom,elements:[
      {type:'rect',x:500,y:870,w:1000,h:260,color:ground},...detail
    ]});
    const workshop=scenery('#16354A','#457489','#273E48',[
      {type:'rect',x:180,y:230,w:240,h:280,color:'#83AAB6'},
      {type:'rect',x:180,y:230,w:12,h:280,color:'#29495C'},
      {type:'rect',x:800,y:320,w:220,h:360,color:'#35596A'}
    ]);
    const road=scenery('#276B90','#A3D7DE','#32454C',[
      {type:'poly',points:[[0,740],[220,410],[440,740]],color:'#568D81'},
      {type:'poly',points:[[370,740],[750,310],[1000,740]],color:'#39756F'}
    ]);
    const factory=scenery('#362D42','#866F75','#33313E',[
      {type:'rect',x:200,y:290,w:330,h:500,color:'#615E70'},
      {type:'rect',x:800,y:220,w:230,h:300,color:'#A5B0B1'}
    ]);
    const part=(type,x,y,extras)=>({type,x,y,depth:'middle',anim:'none',strokeWidth:0,...extras});
    const truck=[
      part('rect',-60,0,{w:300,h:140,color:'#E4B34C',group:'truck'}),
      part('rect',115,30,{w:100,h:90,color:'#DB7044',group:'truck'}),
      part('rect',125,8,{w:54,h:36,color:'#ACDDE5',group:'truck'}),
      part('circle',-150,85,{r:38,color:'#25333E',group:'truck'}),
      part('circle',120,85,{r:38,color:'#25333E',group:'truck'}),
      part('circle',-150,85,{r:15,color:'#C2CED2',group:'truck'}),
      part('circle',120,85,{r:15,color:'#C2CED2',group:'truck'})
    ];
    const scene=(text,drawing,backdrop,groups=[],camera='static')=>({text,drawing,backdrop,groups,camera,composition:'authored',visual:'custom',mood:'neutral',palette:'teal'});
    const scenes=[
      scene('Na oficina as peças formam um veículo de carga.',truck,workshop,[],'slide_right'),
      scene('Na estrada o veículo transporta a carga até a fábrica.',truck,road,[{id:'truck',x:0,y:0,motion:[{time:0,dx:-160},{time:4,dx:160,ease:'linear'}]}],'slide_right'),
      scene('Na fábrica a carga é retirada e segue para a produção.',[
        part('rect',0,200,{w:680,h:48,color:'#808F9D',depth:'back'}),
        part('rect',-130,85,{w:190,h:150,color:'#C88A4C',group:'box'}),
        part('rect',-130,85,{w:26,h:150,color:'#EBC48C',group:'box'}),
        part('rect',-130,45,{w:190,h:12,color:'#9C6235',group:'box'}),
        part('circle',-250,242,{r:36,color:'#252F38'}),
        part('circle',250,242,{r:36,color:'#252F38'})
      ],factory,[{id:'box',x:-130,y:85,motion:[{time:0},{time:4,dx:260,ease:'linear'}]}],'push_in'),
      scene('Cada etapa depende de peças trabalhando juntas.',truck,factory)
    ];
    // Static compositions share the same grouped truck geometry; supply the
    // identity track so the group validator preserves those members.
    for(const scene of scenes)if(scene.drawing.some(s=>s.group==='truck')&&!scene.groups.length)scene.groups=[{id:'truck',x:0,y:0,motion:[{time:0}]}];
    const script=scenes.map(s=>s.text).join(' ');
    const plan=fitToTrack(normalizePlan({title:'Pequenas decisões',scenes},script,'9:16'),20);
    const canvas=document.createElement('canvas');canvas.width=360;canvas.height=640;
    const ctx=canvas.getContext('2d');
    const captures=[];
    const audio=new AudioBuffer({length:48000*20,numberOfChannels:1,sampleRate:48000});
    // Silent reference buffer; proves track muxing without unpleasant test tones.
    // Silent audio track only for container/mux verification; no fake narration.
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
    const review=inspectEditorialFrames({...plan,engine:'2d'});
    const blank=inspectEditorialFrames({title:'Empty',aspect:'9:16',engine:'2d',scenes:[{...plan.scenes[0],drawing:[],groups:[],camera:'static'}]});
    const original={...plan,engine:'2d'};
    const before=JSON.stringify(original);
    const fixed=previewEditorialRepair(original,0,[{target:'shape_0',op:'color',color:'#FF2244'}]);
    const noop=previewEditorialRepair(original,0,[{target:'shape_0',op:'move',dx:0,dy:0}]);
    const repair={frames:fixed.frames.map(f=>({fraction:f.fraction,difference:f.difference,before:f.before.split(',')[1],after:f.after.split(',')[1]})),blocked:fixed.blocked,noVisibleChange:fixed.noVisibleChange,noop:noop.noVisibleChange,unchanged:before===JSON.stringify(original)};
    const stage=normalizePlan({scenes:[{text:'A caixa se move.',visual:'custom',composition:'authored',camera:'static',framing:{x:.5,y:.4,scale:1},backdrop:{top:'#111111',bottom:'#111111',elements:[]},drawing:[{type:'rect',x:0,y:0,w:160,h:100,color:'#FFFFFF',strokeWidth:0,anim:'none'}]}]},'A caixa se move.','9:16');
    stage.engine='2d';
    const moved=previewEditorialRepair(stage,0,[{target:'shape_0',op:'move',dx:0,dy:160}]);
    const unsafe=previewEditorialRepair(stage,0,[{target:'framing',op:'framing',framing:{x:.5,y:.78,scale:1}}]);
    const trajectory=previewEditorialRepair(stage,0,[{target:'shape_0',op:'motion',motion:[{time:0},{time:2,dx:100}]}]);
    const placement={visibleMove:!moved.noVisibleChange,blockedMove:moved.blocked,unsafeBlocked:unsafe.blocked,unsafeIssues:unsafe.introduced.map(i=>i.code),trajectoryVisible:!trajectory.noVisibleChange};
    return {duration:totalDuration(plan),audit:motionAudit(plan),review,blank,captures,repair,placement};
  });
  assert.ok(Math.abs(result.duration-20)<1e-8);
  assert.equal(providerRequests,0);
  assert.equal(result.captures.length,2);
  assert.notEqual(result.captures[0].stills[0],result.captures[1].stills[0],'Depth mode produced identical first shot');
  for(const clip of result.captures){
    assert.equal(clip.frames,240);
    const bytes=Buffer.from(clip.video,'base64');
    const {Input,BlobSource,ALL_FORMATS}=await import('mediabunny');
    const input=new Input({source:new BlobSource(new Blob([bytes])),formats:ALL_FORMATS});
    assert.ok(await input.getPrimaryAudioTrack(),'Missing audio track');
    assert.ok(await input.getPrimaryVideoTrack(),'Missing video track');
    await writeFile(out+'/'+clip.engine+'.'+clip.extension,bytes);
    for(let i=0;i<clip.stills.length;i++)await writeFile(out+'/'+clip.engine+'-'+i+'.png',Buffer.from(clip.stills[i],'base64'));
  }
  await writeFile(out+'/report.json',JSON.stringify({duration:result.duration,audit:result.audit,providerRequests,frames:240,source:'manual fixture',audio:'silent test track, not Alex narration',quality:'requires human visual review',localReview:result.review,blankReview:result.blank,seekStable:result.captures.map(c=>({engine:c.engine,stable:c.seekStable}))},null,2));
  for(const clip of result.captures)assert.equal(clip.seekStable,true,'Non-deterministic frame: '+clip.engine);
  assert.equal(result.review.frames,12);
  assert.equal(result.repair.frames.length,3);
  assert.equal(result.repair.blocked,false);
  assert.equal(result.repair.noVisibleChange,false);
  assert.equal(result.repair.noop,true);
  assert.equal(result.repair.unchanged,true);
  assert.equal(result.placement.visibleMove,true);
  assert.equal(result.placement.blockedMove,false);
  assert.equal(result.placement.unsafeBlocked,true);
  assert.ok(result.placement.unsafeIssues.includes('unsafe_art'));
  assert.equal(result.placement.trajectoryVisible,true);
  await writeFile(out+'/framing-report.json',JSON.stringify(result.placement,null,2));
  for(const f of result.repair.frames){
    await writeFile(out+'/repair-'+f.fraction+'-before.jpg',Buffer.from(f.before,'base64'));
    await writeFile(out+'/repair-'+f.fraction+'-after.jpg',Buffer.from(f.after,'base64'));
  }
  await writeFile(out+'/repair-report.json',JSON.stringify({...result.repair,frames:result.repair.frames.map(({fraction,difference})=>({fraction,difference}))},null,2));
  assert.deepEqual(result.review.issues.filter(i=>i.code==='repeated_background').map(i=>i.scene),[4]);
  assert.ok(result.blank.issues.some(i=>i.code==='empty_art'),'Blank art must be detected');
  assert.ok(result.review.metrics[1].motion>.004,'Moving linked truck must register as action');
  assert.ok(result.review.issues.some(i=>i.scene===4&&i.code==='little_motion'),'Static final shot must be detected');
}finally{await browser.close();}
