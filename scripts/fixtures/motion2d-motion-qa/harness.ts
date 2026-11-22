/** Hand-authored ENGINE REGRESSION fixture. Gemini did not generate this sample. */
import {drawExplainerFrame} from '../../../src/studio/explainer/render';
import {normalizePlan,totalDuration,type ExplainerPlan} from '../../../src/studio/explainer/plan';
import {encodeFixedFrame3DClip} from '../../../src/studio/utils/deterministic3dExport';

const raw={
 title:'Regressão: objetos se movem por chaves',
 scenes:[
  {text:'O orçamento é aprovado. Depois o dinheiro precisa ter destino.',visual:'custom',mood:'neutral',palette:'teal',setting:'office',label:'DO PLANO À AÇÃO',drawing:[
   {type:'coin',x:-210,y:90,size:.90,anim:'none',delay:0,color:'#FFD05E',
    motion:[{time:0,dx:-105,dy:60,scale:.65,opacity:0},{time:.9,dx:0,dy:0,scale:1,opacity:1},{time:2.6,dx:175,dy:-100,rotation:35}]},
   {type:'chart',x:185,y:-10,size:.8,anim:'none',delay:0,
    motion:[{time:0,scale:.5,opacity:0},{time:1.2,scale:1,opacity:1}]},
   {type:'check',x:165,y:240,size:.4,anim:'none',delay:0,
    motion:[{time:0,opacity:0,scale:.2},{time:3.1,opacity:0,scale:.2,ease:'step'},{time:3.7,opacity:1,scale:1}]}
  ]},
  {text:'A transparência acompanha cada etapa. E revela o resultado.',visual:'custom',mood:'neutral',palette:'purple',setting:'city_day',label:'MOSTRE O RESULTADO',drawing:[
   {type:'chart',x:-180,y:50,size:.82,anim:'none',delay:0,
    motion:[{time:0,dy:140,opacity:0},{time:1.1,dy:0,opacity:1}]},
   {type:'coin',x:190,y:-150,size:.65,anim:'none',delay:0,
    motion:[{time:0,dx:-210,dy:90,opacity:0},{time:1,dx:-210,dy:90,opacity:1},{time:2.9,dx:0,dy:0,rotation:360}]},
   {type:'stamp',x:0,y:240,size:.66,text:'CONTAS',anim:'none',delay:0,
    motion:[{time:0,scale:.3,opacity:0},{time:2.8,scale:.3,opacity:0,ease:'step'},{time:3.4,scale:1,opacity:1}]}
  ]}
 ]
};
const script=raw.scenes.map(x=>x.text).join(' ');
const plan:ExplainerPlan=normalizePlan(raw,script,'9:16');
plan.scenes=plan.scenes.map(s=>({...s,voice:{duration:3.35,start:0,end:3.35}}));
if(Math.abs(totalDuration(plan)-8)>1e-5)throw Error('Fixture timing mismatch');
if(!plan.scenes.every(s=>s.drawing?.some(x=>x.motion?.length)))throw Error('Motion dropped by normalizer');
const canvas=document.querySelector<HTMLCanvasElement>('#screen')!,ctx=canvas.getContext('2d')!;
function frame(t:number){ctx.clearRect(0,0,720,1280);drawExplainerFrame(ctx,plan,Math.min(7.999,t));}
const api={
 info:{renderer:'Motion 2D original',authorship:'hand-authored QA sample',duration:8},
 frame(t:number){frame(t);return canvas.toDataURL('image/png').split(',')[1];},
 async export(){
  const result=await encodeFixedFrame3DClip({canvas,durationSeconds:8,fps:30,renderFrame:t=>frame(t)});
  if(result.filenameExtension!=='mp4'||result.frames!==240)throw Error('Native MP4 export failed');
  const url=URL.createObjectURL(result.blob),a=document.createElement('a');
  a.href=url;a.download='motion2d-gemini-keyframe-engine-QA.mp4';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  return result.frames;
 }
};
(window as any).motionQA=api;
frame(0);document.body.dataset.ready='true';
