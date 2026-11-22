// Actual src/studio/explainer/render.ts; no custom drawing or hand-authored scenes.
import {drawExplainerFrame} from '../../../src/studio/explainer/render';
import {totalDuration,type ExplainerPlan} from '../../../src/studio/explainer/plan';
import {encodeFixedFrame3DClip} from '../../../src/studio/utils/deterministic3dExport';
const reply=await (await fetch('/gemini-response.json')).json();
const original:ExplainerPlan=reply.plan;
if(reply.source!=='gemini'||reply.thinkingLevel!=='HIGH')throw Error('not Gemini High');
const secs=40/original.scenes.length;
const plan:ExplainerPlan={...original,scenes:original.scenes.map(scene=>({...scene,voice:{duration:secs-0.65,start:0,end:secs-0.65}}))};
if(Math.abs(totalDuration(plan)-40)>.01)throw Error('duration mismatch '+totalDuration(plan));
const canvas=document.querySelector<HTMLCanvasElement>('#screen')!;
const ctx=canvas.getContext('2d')!;
const frame=(t:number)=>{ctx.clearRect(0,0,720,1280);drawExplainerFrame(ctx,plan,Math.max(0,Math.min(39.999,t)));};
const api={
 sceneCount:plan.scenes.length,
 frame(t:number){frame(t);return canvas.toDataURL('image/png').split(',')[1];},
 async exportPart(start:number){
  const video=await encodeFixedFrame3DClip({canvas,durationSeconds:20,fps:30,renderFrame:t=>frame(start+t)});
  if(video.filenameExtension!=='mp4'||video.frames!==600)throw Error('Not fixed-frame MP4');
  const url=URL.createObjectURL(video.blob),a=document.createElement('a');
  a.href=url;a.download=`gemini-high-motion2d-${start}.mp4`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  return video.frames;
 }
};
(window as any).proof=api;
frame(0);
document.body.dataset.ready='true';
