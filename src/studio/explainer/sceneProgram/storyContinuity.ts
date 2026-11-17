/**
 * Read-only editorial coherence audit for the generic 3D scene language.
 *
 * Movement checks prove angles/positions changed, not that a story advances.
 * This makes repeated shots, missing causal visual bridges and off-screen
 * action measurable without copying any particular video topic.
 *
 * These are diagnostics, NOT semantic AI evaluation; human review remains
 * necessary before calling an animation clear, logical or entertaining.
 */
import { compileSceneProgram, type ProgramNode, type ProgramSource,
  type ProgramChannel, type SceneProgram, type Vec3 } from './score';

export type StoryContinuityFinding =
  | { kind:'overlong_cut'; sourceId:string; cut:number; duration:number }
  | { kind:'repeated_framing'; sourceId:string; cut:number; previous:number }
  | { kind:'weak_visual_bridge'; sourceId:string; cut:number; previous:number }
  | { kind:'only_decorative_rotation'; sourceId:string; cut:number; duration:number }
  | { kind:'unshown_action_before_reveal'; sourceId:string; cut:number; node:string; seconds:number };

export interface EditorialCut {
  sourceId:string; cut:number; start:number; end:number; seconds:number;
  focus:string[]; newFocus:string[];
  changedPositionalSubjects:string[]; changedRotationalSubjects:string[];
  continuousFocusWithPrevious:boolean;
}
export interface StoryContinuityReport {
  version:1;
  duration:number;
  cuts:EditorialCut[];
  findings:StoryContinuityFinding[];
  longCutCount:number;
  uniqueFocusRatio:number;
  visualBridgeRatio:number;
  limitations:string;
}
const xyzDiff=(a:Vec3,b:Vec3)=>Math.hypot(
  a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const resultChannel=(s:ReturnType<ReturnType<typeof compileSceneProgram>['sample']> extends Map<string,infer State> ? State:never,c:ProgramChannel):Vec3=>
  c==='position'||c==='rotation'||c==='scale'?s[c]:s.pose[c]??[0,0,0];

export function auditStoryContinuity(
  program:SceneProgram,
  sources:ProgramSource[],
  options:{maxCutSeconds?:number}={}
):StoryContinuityReport {
  const score=compileSceneProgram(program,sources);
  const maxCutSeconds=options.maxCutSeconds??3.5;
  const byId=new Map(program.nodes.map(n=>[n.id,n]));
  const ancestry=(id:string):Set<string>=>{
    const visited=new Set<string>();
    let item:ProgramNode|undefined=byId.get(id);
    for(let i=0;item&&i<32;i++) {
      visited.add(item.id);
      item=item.parent?byId.get(item.parent):undefined;
    }
    return visited;
  };
  const related=(a:string,b:string)=> a===b||ancestry(a).has(b)||ancestry(b).has(a);
  const relatedTo=(node:string,subjects:string[])=>subjects.some(s=>related(node,s));
  const parts:EditorialCut[]=[];
  const findings:StoryContinuityFinding[]=[];
  let bridged=0, comparisons=0, newSubjects=0, totalSubjects=0;
  for(const span of score.spans){
    const shot=program.shots.find(s=>s.sourceId===span.sourceId)!;
    const shots=shot.cuts??[{phase:0,subjects:shot.subjects,hide:[] as string[]}];
    for(let i=0;i<shots.length;i++){
      const cut=shots[i],previous=shots[i-1];
      const start=span.start+span.duration*cut.phase;
      const end=span.start+span.duration*(shots[i+1]?.phase??1);
      const seconds=end-start;
      const focus=[...cut.subjects];
      const prevFocus=previous?.subjects??[];
      const newFocus=focus.filter(x=>!relatedTo(x,prevFocus));
      newSubjects+=newFocus.length;totalSubjects+=focus.length;
      const a=score.sample(start),b=score.sample(end);
      const positional=new Set<string>(),rotational=new Set<string>();
      for(const track of program.tracks){
        if(!relatedTo(track.node,focus))continue;
        if((cut.hide??[]).some(h=>related(track.node,h)))continue;
        const before=a.get(track.node),after=b.get(track.node);
        if(!before||!after)continue;
        const d=xyzDiff(resultChannel(before,track.channel),resultChannel(after,track.channel));
        if(d<(track.channel==='rotation'?.20:.12))continue;
        if(track.channel==='position'||track.channel==='scale')positional.add(track.node);
        else if(track.channel==='rotation')rotational.add(track.node);
      }
      const continuous=!!previous&&focus.some(x=>relatedTo(x,prevFocus));
      if(previous){
        comparisons++;
        if(continuous)bridged++;
        else findings.push({kind:'weak_visual_bridge',sourceId:span.sourceId,cut:i,previous:i-1});
        if(focus.length===prevFocus.length&&focus.every((x,k)=>x===prevFocus[k])&&
           Math.abs(cut.azimuth-previous.azimuth)<.08&&Math.abs(cut.elevation-previous.elevation)<.08)
          findings.push({kind:'repeated_framing',sourceId:span.sourceId,cut:i,previous:i-1});
      }
      if(seconds>maxCutSeconds)
        findings.push({kind:'overlong_cut',sourceId:span.sourceId,cut:i,duration:Number(seconds.toFixed(2))});
      if(positional.size===0&&rotational.size>0&&seconds>2.5)
        findings.push({kind:'only_decorative_rotation',sourceId:span.sourceId,cut:i,duration:Number(seconds.toFixed(2))});
      parts.push({sourceId:span.sourceId,cut:i,start,end,seconds:Number(seconds.toFixed(3)),focus,newFocus,
        changedPositionalSubjects:[...positional],changedRotationalSubjects:[...rotational],
        continuousFocusWithPrevious:continuous});
    }
  }
  return {version:1,duration:score.duration,cuts:parts,findings,
    longCutCount:findings.filter(f=>f.kind==='overlong_cut').length,
    uniqueFocusRatio:Number((newSubjects/Math.max(totalSubjects,1)).toFixed(3)),
    visualBridgeRatio:comparisons?Number((bridged/comparisons).toFixed(3)):1,
    limitations:'Detects editorial symptoms via actual scene data. No model can infer story meaning, goals, causality or emotion reliably from these geometric checks alone. Visual and narration review are required.'
  };
}
