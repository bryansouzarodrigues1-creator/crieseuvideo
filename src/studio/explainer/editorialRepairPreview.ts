import {applySceneEdits} from './editorialEdits';
import {drawExplainerFrame} from './render';
import {sceneStart,sceneDuration,type ExplainerPlan} from './plan';
import {inspectEditorialFrames,frameDifference,type EditorialReview} from './editorialReview';

export function compareEditorialReviews(before:EditorialReview,after:EditorialReview){
 const key=(i:EditorialReview['issues'][number])=>i.scene+':'+i.code;
 const old=new Set(before.issues.map(key)),next=new Set(after.issues.map(key));
 const introduced=after.issues.filter(i=>!old.has(key(i)));
 const resolved=before.issues.filter(i=>!next.has(key(i)));
 return {introduced,resolved,blocked:introduced.some(i=>i.code==='empty_art')};
}
export function buildRepairCandidate(plan:ExplainerPlan,index:number,edits:unknown):ExplainerPlan{
 if(!Number.isInteger(index)||index<0||index>=plan.scenes.length)throw Error('Cena inexistente.');
 const scene=applySceneEdits(plan.scenes[index],edits);
 return {...plan,scenes:plan.scenes.map((s,i)=>i===index?scene:s)};
}
export type RepairPreview=ReturnType<typeof previewEditorialRepair>;
/** Both sides use the real renderer, at the same absolute times.
 * No external requests. Coverage/motion are heuristics, not aesthetic scores. */
export function previewEditorialRepair(plan:ExplainerPlan,index:number,edits:unknown){
 if(plan.engine==='3d')throw Error('Revisão exclusiva do 2D/2.5D.');
 const candidate=buildRepairCandidate(plan,index,edits);
 const before=inspectEditorialFrames(plan),after=inspectEditorialFrames(candidate);
 const comparison=compareEditorialReviews(before,after);
 const canvas=document.createElement('canvas');
 canvas.width=plan.aspect==='9:16'?216:384;canvas.height=plan.aspect==='9:16'?384:216;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw Error('Canvas indisponível.');
 const frames:{fraction:number;before:string;after:string;difference:number}[]=[];
 try{
  for(const fraction of [.2,.5,.8]){
   const t=sceneStart(plan,index)+sceneDuration(plan.scenes[index])*fraction;
   drawExplainerFrame(ctx,plan,t);
   const oldPixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const beforeImage=canvas.toDataURL('image/jpeg',.82);
   drawExplainerFrame(ctx,candidate,t);
   const difference=frameDifference(oldPixels,ctx.getImageData(0,0,canvas.width,canvas.height).data);
   frames.push({fraction,before:beforeImage,after:canvas.toDataURL('image/jpeg',.82),difference});
  }
  return {candidate,before,after,...comparison,frames,noVisibleChange:frames.every(f=>f.difference<.001)};
 }finally{canvas.width=1;canvas.height=1;}
}
