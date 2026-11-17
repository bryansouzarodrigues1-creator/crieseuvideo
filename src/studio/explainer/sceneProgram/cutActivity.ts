/**
 * Camera-cut-aware action-density audit, deliberately independent of AI
 * motionChecks. Movement of invisible/off-shot objects cannot justify an
 * otherwise frozen scene. Never substitutes a viewer's artistic judgement.
 */
import { compileSceneProgram, type SceneProgram, type ProgramSource, type ProgramState, type ProgramChannel, type Vec3 } from './score';

export interface CutActivity {
  sourceId: string;
  cutIndex: number;
  start: number;
  end: number;
  focus: string[];
  animated: string[];
  visibleMotionSeconds: number;
  longestStillSeconds: number;
}
export interface CutActivityReport {
  cuts: CutActivity[];
  frozenCuts: Array<{sourceId:string;cutIndex:number;from:number;to:number;seconds:number}>;
  limitation: string;
}
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function value(s:ProgramState|undefined,c:ProgramChannel):Vec3{
  if(!s)return [0,0,0];
  return c==='position'||c==='rotation'||c==='scale'?s[c]:s.pose[c]??[0,0,0];
}
export function auditSceneCutActivity(program:SceneProgram,sources:ProgramSource[],
  options:{stepSeconds?:number;maxStillSeconds?:number}={}):CutActivityReport{
  const score=compileSceneProgram(program,sources);
  const byId=new Map(program.nodes.map(n=>[n.id,n]));
  const inside=(child:string,parent:string)=>{
    let id:string|undefined=child;
    for(let i=0;id&&i<20;i++){
      if(id===parent)return true;
      id=byId.get(id)?.parent;
    }
    return false;
  };
  const step=Math.max(.05,Math.min(.5,options.stepSeconds??.2));
  const idleThreshold=Math.max(.5,options.maxStillSeconds??1.5);
  const cuts:CutActivity[]=[];
  const frozenCuts:CutActivityReport['frozenCuts']=[];
  for(const span of score.spans){
    const shot=program.shots.find(x=>x.sourceId===span.sourceId)!;
    const shotCuts=shot.cuts??[{phase:0,subjects:shot.subjects,hide:[] as string[]}];
    shotCuts.forEach((cut,index)=>{
      const start=span.start+cut.phase*span.duration;
      const end=span.start+(shotCuts[index+1]?.phase??1)*span.duration;
      const relevant=program.tracks.filter(track=>
        cut.subjects.some(subject=>inside(track.node,subject)||inside(subject,track.node)) &&
        !(cut.hide??[]).some(hidden=>inside(track.node,hidden)));
      const slices=Math.max(1,Math.ceil((end-start)/step));
      const dt=(end-start)/slices;
      const animated=new Set<string>();
      let visibleMotionSeconds=0, longestStillSeconds=0,stillFrom:number|null=null;
      const commitStill=(until:number)=>{
        if(stillFrom===null)return;
        const seconds=until-stillFrom;
        longestStillSeconds=Math.max(longestStillSeconds,seconds);
        if(seconds>=idleThreshold)frozenCuts.push({
          sourceId:span.sourceId,cutIndex:index,
          from:Number(stillFrom.toFixed(3)),to:Number(until.toFixed(3)),
          seconds:Number(seconds.toFixed(3))});
        stillFrom=null;
      };
      for(let i=0;i<slices;i++){
        const a=start+i*dt,b=start+(i+1)*dt;
        const before=score.sample(a),after=score.sample(b);
        const moving=relevant.some(track=>{
          const d=distance(value(before.get(track.node),track.channel),value(after.get(track.node),track.channel));
          const perSecond=track.channel==='position'? .035:track.channel==='scale'?.04:.09;
          if(d>=perSecond*dt){animated.add(track.node);return true;}
          return false;
        });
        if(moving){visibleMotionSeconds+=dt;commitStill(a);}
        else if(stillFrom===null)stillFrom=a;
      }
      commitStill(end);
      cuts.push({
        sourceId:span.sourceId,cutIndex:index,start,end,
        focus:[...cut.subjects],animated:[...animated].sort(),
        visibleMotionSeconds:Number(visibleMotionSeconds.toFixed(3)),
        longestStillSeconds:Number(longestStillSeconds.toFixed(3))
      });
    });
  }
  return {cuts,frozenCuts,limitation:'Measured animated curves in shot focus (excluding hidden sets); object occlusion and artistic impact still need pixel review.'};
}
