/**
 * Visual quality loop contract. Real renderer must supply three RGBA frames
 * and a repeat of the first frame (A -> B -> A). Nothing here makes a model
 * call or assumes that pixel differences prove good storytelling.
 */
export interface FrameSample{
 at:number;width:number;height:number;rgba:Uint8Array;
 clippedLabels?:string[];
 intersections?:string[];
}
export interface VisualProbe{
 frames:[FrameSample,FrameSample,FrameSample];
 replayFirst:FrameSample;
}
export type VisualProblemCode=
 'invalid_frame'|'nondeterministic_replay'|'static_animation'|
 'blank_frame'|'clipped_text'|'geometry_intersection';
export interface VisualProblem{code:VisualProblemCode;detail:string}
export interface VisualReport{
 ok:boolean;problems:VisualProblem[];
 changedPixelFraction:number;uniqueColorCount:number;
}

const sameFrame=(a:FrameSample,b:FrameSample)=>{
 if(a.width!==b.width||a.height!==b.height||a.rgba.length!==b.rgba.length)return false;
 for(let i=0;i<a.rgba.length;i++)if(a.rgba[i]!==b.rgba[i])return false;
 return true;
};
const valid=(f:FrameSample)=>Number.isFinite(f.at)&&
 Number.isInteger(f.width)&&Number.isInteger(f.height)&&f.width>0&&f.height>0&&
 f.rgba.length===f.width*f.height*4;
export function inspectVisualProbe(probe:VisualProbe):VisualReport{
 const problems:VisualProblem[]=[];
 const frames=[...probe.frames,probe.replayFirst];
 if(frames.some(f=>!valid(f))||probe.replayFirst.at!==probe.frames[0].at){
  return {ok:false,changedPixelFraction:0,uniqueColorCount:0,
   problems:[{code:'invalid_frame',detail:'Quadros ou instante de repetição inválidos.'}]};
 }
 if(!sameFrame(probe.frames[0],probe.replayFirst))
  problems.push({code:'nondeterministic_replay',detail:'O mesmo instante não reproduziu pixels idênticos.'});
 const [a,b,c]=probe.frames;
 let changed=0;const pixels=a.width*a.height;
 if(a.width!==b.width||a.height!==b.height||a.width!==c.width||a.height!==c.height){
  problems.push({code:'invalid_frame',detail:'Resoluções diferentes entre os quadros.'});
 }else{
  for(let p=0;p<pixels;p++){
   const i=p*4;
   if(Math.abs(a.rgba[i]-b.rgba[i])+Math.abs(a.rgba[i+1]-b.rgba[i+1])+
      Math.abs(a.rgba[i+2]-b.rgba[i+2])+Math.abs(a.rgba[i+3]-b.rgba[i+3])>8||
      Math.abs(c.rgba[i]-b.rgba[i])+Math.abs(c.rgba[i+1]-b.rgba[i+1])+
      Math.abs(c.rgba[i+2]-b.rgba[i+2])+Math.abs(c.rgba[i+3]-b.rgba[i+3])>8)
    changed++;
  }
  if(changed/pixels<.002)
   problems.push({code:'static_animation',detail:'Quase nenhuma mudança visual nos três quadros.'});
 }
 let uniqueColorCount=0;
 for(const f of probe.frames){
  const colors=new Set<number>();
  for(let i=0;i<f.rgba.length;i+=4){
   const color=((f.rgba[i]>>3)<<10)|((f.rgba[i+1]>>3)<<5)|(f.rgba[i+2]>>3);
   colors.add(color);
   if(colors.size>=3)break;
  }
  uniqueColorCount=Math.max(uniqueColorCount,colors.size);
 }
 if(uniqueColorCount<=1)
  problems.push({code:'blank_frame',detail:'Quadros parecem conter uma única cor.'});
 const clipped=frames.flatMap(f=>f.clippedLabels||[]);
 if(clipped.length)problems.push({code:'clipped_text',
  detail:'Texto fora da safe area: '+[...new Set(clipped)].slice(0,5).join(', ')});
 const overlaps=frames.flatMap(f=>f.intersections||[]);
 if(overlaps.length)problems.push({code:'geometry_intersection',
  detail:'Interseções detectadas: '+[...new Set(overlaps)].slice(0,5).join(', ')});
 return {ok:problems.length===0,problems,
  changedPixelFraction:pixels?changed/pixels:0,uniqueColorCount};
}

export type AttemptResult<T>={
 status:'passed'|'repaired'|'failed';
 plan:T;
 initial:VisualReport;
 final:VisualReport;
 repairCalls:0|1;
};

/**
 * Exactly one bounded correction. Image-aware AI critics must be injected by
 * an authenticated provider adapter; no paid model auto-fallback. The critic
 * can return issues beyond these basic pixel measurements.
 */
export async function validateWithSingleRepair<T>(
 initialPlan:T,
 renderProbe:(plan:T)=>Promise<VisualProbe>,
 repair:(plan:T,probe:VisualProbe,report:VisualReport)=>Promise<T>,
 validatePlan:(plan:T)=>void,
):Promise<AttemptResult<T>>{
 validatePlan(initialPlan);
 const first=await renderProbe(initialPlan);
 const firstReport=inspectVisualProbe(first);
 if(firstReport.ok)return {status:'passed',plan:initialPlan,
  initial:firstReport,final:firstReport,repairCalls:0};
 // Never retry in a loop; ONE correction and ONE re-render at most.
 const candidate=await repair(initialPlan,first,firstReport);
 validatePlan(candidate);
 const final=inspectVisualProbe(await renderProbe(candidate));
 return {status:final.ok?'repaired':'failed',
  plan:candidate,initial:firstReport,final,repairCalls:1};
}
