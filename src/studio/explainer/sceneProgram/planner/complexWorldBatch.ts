/**
 * One declarative request -> several independently validated, independently
 * renderable scenes. This avoids squeezing a whole film into the 160-node
 * limit of ONE SceneProgram. No AI requests, presets, executable scripts or
 * external URLs. Authoring the JSON is the job of a future AI planner.
 */
import {
  normalizeSceneProgram, compileSceneProgram,
  type ProgramSource, type SceneProgram
} from '../score';
import {compileWorldBlueprints} from './worldBlueprints';
import {compileWorldScenery} from './worldScenery';
import type {ClipPresentation} from '../presentation';

export class ComplexWorldBatchError extends Error {
  readonly code='invalid_complex_world_batch';
}
const bad=(message:string):never=>{throw new ComplexWorldBatchError(message);};
const record=(raw:unknown,name:string):Record<string,unknown> =>
  raw&&typeof raw==='object'&&!Array.isArray(raw) ? raw as Record<string,unknown>
    :bad(name+' deve ser objeto JSON.');
const only=(r:Record<string,unknown>,keys:string[],name:string)=>{
  for(const key of Object.keys(r))if(!keys.includes(key))
    bad(name+' contém campo inesperado '+key);
};
const safeId=(x:unknown):x is string=>typeof x==='string'&&/^[a-z][a-z0-9_-]{0,29}$/.test(x);

export interface ComplexWorldClip {
  id:string;
  sources:ProgramSource[];
  duration:number;
  program:SceneProgram;
  /** Optional client-side editorial text; not accepted as AI JSON by compiler. */
  presentation?:ClipPresentation;
  audit:{
    objectCount:number;objectParts:number;sceneryRegions:number;
    sceneNodes:number;shotCount:number;
    estimatedVertexLimit:number;
  };
}
export interface ComplexWorldBatch {
  version:1;
  clips:ComplexWorldClip[];
  duration:number;
  audit:{clips:number;totalNodes:number;totalParts:number;generation:string;};
}

export function compileComplexWorldBatch(raw:unknown):ComplexWorldBatch {
  let jsonLength=0;
  try{jsonLength=JSON.stringify(raw).length;}catch{return bad('Lote não serializável.');}
  if(!jsonLength||jsonLength>480000)bad('Lote de cenas grande demais.');
  const root=record(raw,'batch');
  only(root,['version','clips'],'batch');
  if(root.version!==1)bad('Versão de lote desconhecida.');
  const rawClips=root.clips;
  if(!Array.isArray(rawClips)||rawClips.length<1||rawClips.length>12)
    bad('O lote deve ter entre 1 e 12 cenas.');
  const ids=new Set<string>();
  const clips:ComplexWorldClip[]=[];
  let duration=0,totalNodes=0,totalParts=0;
  for(const item of rawClips as unknown[]){
    const clip=record(item,'clip');
    only(clip,['id','sources','sceneProgram','worldBlueprints','worldScenery'],'clip');
    const clipId=clip.id;
    if(!safeId(clipId)||ids.has(clipId))bad('ID de cena inválido ou duplicado.');
    ids.add(clipId as string);
    const rawSources=clip.sources;
    if(!Array.isArray(rawSources)||rawSources.length<1||rawSources.length>12)
      bad('Cada cena deve conter entre 1 e 12 trechos de roteiro.');
    const sources:ProgramSource[]=[];
    const sourceIds=new Set<string>();
    for(const rawSource of rawSources as unknown[]){
      const s=record(rawSource,'source');
      only(s,['sourceId','text','duration'],'source');
      const sourceId=s.sourceId,sourceText=s.text,sourceDuration=s.duration;
      if(!safeId(sourceId)||sourceIds.has(sourceId))bad('Frase de cena duplicada ou inválida.');
      if(typeof sourceText!=='string'||!sourceText.trim()||sourceText.length>1000)
        bad('Texto da frase ausente ou extenso.');
      if(typeof sourceDuration!=='number'||!Number.isFinite(sourceDuration)||
         sourceDuration<.3||sourceDuration>60)bad('Duração de frase fora do intervalo.');
      sourceIds.add(sourceId as string);
      sources.push({sourceId:sourceId as string,text:(sourceText as string).trim(),duration:sourceDuration as number});
    }
    const span=sources.reduce((acc,s)=>acc+s.duration!,0);
    if(span>180)bad('Uma cena isolada ultrapassou três minutos.');
    duration+=span;
    if(duration>720)bad('Lote ultrapassou doze minutos.');
    const proposal=record(clip.sceneProgram,'sceneProgram');
    const sceneNodes=proposal.nodes;
    if(!Array.isArray(sceneNodes))bad('sceneProgram precisa de nodes.');
    const validatedNodes=sceneNodes as Record<string,unknown>[];
    const blueprint=clip.worldBlueprints===undefined?undefined:
      compileWorldBlueprints(clip.worldBlueprints,sources,validatedNodes as {id:string}[]);
    const nodes=blueprint?[...validatedNodes,...blueprint.nodes]:validatedNodes;
    const scenery=clip.worldScenery===undefined?undefined:
      compileWorldScenery(clip.worldScenery,sources,nodes as {id:string}[]);
    const expanded={...proposal,nodes:scenery?[...nodes,...scenery.nodes]:nodes};
    const program=normalizeSceneProgram(expanded,sources);
    // Exercise the full compiler: shot chronology, track times and contacts.
    compileSceneProgram(program,sources);
    const audit={
      objectCount:blueprint?.audit.objects.length??0,
      objectParts:blueprint?.audit.objects.reduce((s,o)=>s+o.parts+o.mirrored,0)??0,
      sceneryRegions:scenery?.audit.environments.length??0,
      sceneNodes:program.nodes.length,shotCount:program.shots.length,
      estimatedVertexLimit:250000
    };
    clips.push({id:clipId as string,sources,duration:span,program,audit});
    totalNodes+=audit.sceneNodes;
    totalParts+=audit.objectParts;
  }
  return {version:1,clips,duration,audit:{
    clips:clips.length,totalNodes,totalParts,
    generation:'Declarative batch compiled and validated; no AI requests or cinematic QA implied.'
  }};
}
