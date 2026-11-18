/**
 * Bridge #1: validated narrative states -> existing SceneProgram keyframes.
 *
 * No meshes or stories are hardcoded here. The art-direction pass supplies
 * named 3D nodes and the positions of semantic locations. The semantic
 * planner dictates WHAT changes, this bridge dictates reproducible transforms.
 *
 * Only isolated root nodes may be moved. Moving a child directly would cause
 * double transforms with a moving parent. Handing/pickup is approximated by
 * a visible offset: this bridge is not IK nor physical attachment yet.
 */
import {
  normalizeSceneProgram, type ProgramKey, type ProgramNode, type ProgramSource,
  type ProgramTrack, type SceneProgram, type Vec3
} from '../score';
import type { CompiledStoryboard, CompiledStoryEvent, StoryEntity } from './events';
import { planGripContacts } from './gripContacts';
import { coupledAngle, prepareMechanicalDrives, type MechanicalDrives } from './mechanicalDrives';

export interface StoryMotionBindings {
  /** Semantic entity id -> already defined SceneProgram3D node id. */
  entityNodes: Record<string, string>;
  /** Place entity id -> absolute Three.js anchor in metres. */
  placeAnchors: Record<string, Vec3>;
  /** World-space offset of a held item from an actor's feet/anchor. */
  heldOffsets?: Record<string, Vec3>;
  /** World-space offset of a resting item from a moving support's anchor. */
  supportOffsets?: Record<string, Vec3>;
  /** Explicit mechanical shafts, never spin the entire 3D motor body. */
  motorVisuals?: Record<string, { node: string; axis?: 'x' | 'y' | 'z'; revolutions: number }>;
  /** Preferred causal option: gear/wheel angles are calculated from the driven load's travel. */
  mechanicalDrives?: MechanicalDrives;
}
export interface StoryMotionDiagnostics {
  events: Array<{
    id:string;action:string;start:number;end:number;nodeIds:string[];
    movedMetres:number; visibleMechanicalMotion:boolean
  }>;
  gripWindows: Array<{ cargo: string; actor: string; from: number; to: number; contactCount: number }>;
  limitations:string;
}
export interface StoryMotionResult {
  program:SceneProgram;
  diagnostics:StoryMotionDiagnostics;
}
export class StoryMotionError extends Error { readonly code='invalid_story_motion'; }

const problem=(message:string):never=>{ throw new StoryMotionError(message); };
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dist=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const point=(v:unknown,label:string):Vec3=>{
  if(!Array.isArray(v) || v.length!==3 || v.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>180))
    return problem(label+' não é um ponto 3D válido.');
  return [...v] as Vec3;
};
const finite=(v:unknown,label:string,max:number)=>{
  if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>max)problem(label+' inválido.');
  return v as number;
};

export function compileStoryMotion(
  storyboard:CompiledStoryboard,
  base:SceneProgram,
  sources:ProgramSource[],
  bindings:StoryMotionBindings
):StoryMotionResult {
  if(storyboard.version!==1 || !sources.length ||
     storyboard.sourceSignature!==JSON.stringify(sources.map(s=>[s.sourceId,s.text])))
    problem('O storyboard pertence a outro roteiro.');
  const spans: Array<{sourceId:string;start:number;end:number}> = [];
  let cursor=0;
  for(const source of sources) {
    const duration=source.duration??3;
    if(!Number.isFinite(duration)||duration<=0)problem('Duração inválida de frase.');
    spans.push({sourceId:source.sourceId,start:cursor,end:cursor+duration});
    cursor+=duration;
  }
  if(Math.abs(cursor-storyboard.duration)>.01)
    problem('A duração dos acontecimentos difere da duração das cenas.');
  const nodes = new Map(base.nodes.map(n=>[n.id,n]));
  const entities=new Map(storyboard.entities.map(e=>[e.id,e]));
  const position=new Map<string,Vec3>();
  const values=new Map<string,Map<'position'|'rotation',Array<{t:number;value:Vec3}>>>();
  const resolvedId=(entityId:string):string=>{
    const id=bindings.entityNodes[entityId];
    const n=id?nodes.get(id):undefined;
    if(!n || n.parent)problem('Identidade '+entityId+' precisa corresponder a um nó-raiz 3D real.');
    return id;
  };
  for(const e of storyboard.entities){
    if(e.kind==='place'){
      point(bindings.placeAnchors[e.id], 'Âncora '+e.id);
      continue;
    }
    const id=resolvedId(e.id);
    if([...position.keys()].some(other=>bindings.entityNodes[other]===id))
      problem('Dois objetos da história foram associados à MESMA malha.');
    position.set(e.id,[...nodes.get(id)!.position]);
  }
  // Cannot compile two competing sources of truth for the same root transform.
  const movingNodeIds=new Set([...position.keys()].map(x=>resolvedId(x)));
  for(const track of base.tracks){
    if(movingNodeIds.has(track.node)&&track.channel==='position')
      problem('O roteiro geométrico tenta mover um objeto que já é governado pelo planejador.');
  }
  for(const [e,v] of Object.entries(bindings.heldOffsets??{})) {
    if(!entities.has(e)) problem('Offset de mão cita objeto ausente.');
    point(v,'Offset de mão '+e);
  }
  for(const [e,v] of Object.entries(bindings.supportOffsets??{})) {
    if(!entities.has(e)) problem('Offset de suporte cita objeto ausente.');
    point(v,'Offset de suporte '+e);
  }
  for(const [e,m] of Object.entries(bindings.motorVisuals??{})){
    if(entities.get(e)?.kind!=='mechanism')problem('Eixo visual cita mecanismo inexistente.');
    if(!nodes.has(m.node))problem('Eixo do motor não existe na cena.');
    if(movingNodeIds.has(m.node))problem('Eixo visual não pode ser o corpo principal do motor.');
    finite(m.revolutions,'Voltas do motor',25);
  }
  const drives=prepareMechanicalDrives(bindings.mechanicalDrives,base.nodes,base.tracks,storyboard.entities,bindings.entityNodes);
  for(const drive of drives) if(bindings.motorVisuals?.[drive.mechanism])
    problem('Uma máquina não pode usar voltas arbitrárias e transmissão causal ao mesmo tempo.');
  const push=(node:string,channel:'position'|'rotation',t:number,value:Vec3)=>{
    let byChannel=values.get(node);
    if(!byChannel){byChannel=new Map();values.set(node,byChannel);}
    let keys=byChannel.get(channel);
    if(!keys){keys=[];byChannel.set(channel,keys);}
    const previous=keys[keys.length-1];
    if(previous && t<previous.t-1e-6)problem('Ordem de keyframes invertida.');
    if(previous && Math.abs(t-previous.t)<1e-6){previous.value=[...value];return;}
    keys.push({t,value:[...value]});
  };
  // Explicit initial key prevents interpolations from jumping straight toward
  // an event's first ending position.
  for(const [semantic,v] of position) push(resolvedId(semantic),'position',0,v);
  const shaftPos=new Map<string,Vec3>();
  for(const [sem,m] of Object.entries(bindings.motorVisuals??{})){
    const n=nodes.get(m.node)!; shaftPos.set(sem,[...n.rotation]);
    if(base.tracks.some(t=>t.node===m.node&&t.channel==='rotation'))
      problem('O eixo do motor recebeu rotações contraditórias de duas fontes.');
    push(m.node,'rotation',0,n.rotation);
  }
  const drivenRotation=new Map<string,Vec3>();
  for(const drive of drives)for(const part of drive.parts){
    const initial:[number,number,number]=[...nodes.get(part.node)!.rotation];
    drivenRotation.set(part.node,initial);
    push(part.node,'rotation',0,initial);
  }
  const betweenPlaces=(from:string|null|undefined,to:string|null|undefined):Vec3=>{
    if(!from || !to)return problem('Movimento sem origem ou destino físico.');
    return sub(point(bindings.placeAnchors[to],'Destino '+to),
      point(bindings.placeAnchors[from],'Origem '+from));
  };
  const deltaFor=(event:CompiledStoryEvent):Vec3=>
    betweenPlaces(event.effects.find(x=>x.entity===event.subject)?.before.at,event.destination);
  const diagnostics:StoryMotionDiagnostics['events']=[];
  for(const event of storyboard.events) {
    const span=spans.find(x=>x.sourceId===event.sourceId);
    if(!span||event.start<span.start-1e-5||event.end>span.end+1e-5)
      problem('A ação '+event.id+' não cabe na frase correspondente. Ajuste o storyboard, não recorte a ação.');
    const touched=new Map<string,Vec3>();
    const begin=event.start,finish=event.end;
    const before=new Map([...position].map(([k,v])=>[k,[...v] as Vec3]));
    const set=(sem:string,p:Vec3)=>{
      if(!position.has(sem))problem('Não existe corpo 3D para o objeto '+sem);
      position.set(sem,p);touched.set(sem,p);
    };
    switch(event.action){
      case 'focus':
      case 'react':
      case 'change':
        // No fake gesture from a change in semantic "mode".
        // A second animation author must provide body/face curves explicitly.
        break;
      case 'pick_up':{
        const who=event.actor!;
        const offset=point(bindings.heldOffsets?.[event.subject]??[.25,1.18,.25],'Mão '+event.subject);
        set(event.subject,add(position.get(who)!,offset));
        break;
      }
      case 'put_down':{
        const v=event.support
          ? add(position.get(event.support)!,point(bindings.supportOffsets?.[event.subject]??[0,.3,0],'Apoio'))
          : add(point(bindings.placeAnchors[event.destination!],'Chão'),point(bindings.supportOffsets?.[event.subject]??[0,.15,0],'Chão da carga'));
        set(event.subject,v);
        break;
      }
      case 'carry':
      case 'move':
      case 'operate':{
        const moveId=event.action==='carry'?event.actor!:event.subject;
        const delta=event.action==='carry'
          ? betweenPlaces(event.effects.find(x=>x.entity===moveId)?.before.at,event.destination)
          :deltaFor(event);
        for(const e of event.effects){
          if(e.after.at!==e.before.at && position.has(e.entity))
            set(e.entity,add(position.get(e.entity)!,delta));
        }
        break;
      }
      case 'activate':
      case 'deactivate':
        break;
    }
    let moved=0;
    for(const [sem,end] of touched){
      const node=resolvedId(sem),start=before.get(sem)!;
      moved+=dist(start,end);
      if(dist(start,end)>.00001){
        push(node,'position',begin,start);
        push(node,'position',finish,end);
      }
    }
    let visibleMechanicalMotion=false;
    if(event.action==='operate'){
      const m=event.mechanism!;
      const drive=drives.find(d=>d.mechanism===m);
      if(drive){
        if(drive.output!==event.subject)
          problem('O acontecimento move uma carga diferente daquela ligada ao motor.');
        const from=before.get(event.subject),to=position.get(event.subject);
        if(!from||!to)problem('Não existe deslocamento da carga para acionar o motor.');
        for(const part of drive.parts){
          const current=drivenRotation.get(part.node)!;
          const deltaAngle=coupledAngle(from!,to!,drive.radius,part.ratio);
          const axis=part.axis==='x'?0:part.axis==='y'?1:2;
          const next:[number,number,number]=[...current];
          next[axis]+=deltaAngle;
          if(Math.abs(next[axis])>190)
            problem('Engrenagem excede o orçamento angular da animação.');
          push(part.node,'rotation',begin,current);
          push(part.node,'rotation',finish,next);
          drivenRotation.set(part.node,next);
          visibleMechanicalMotion=true;
        }
      }
      const visual=drive?undefined:bindings.motorVisuals?.[m];
      if(visual){
        const shaft=shaftPos.get(m)!;
        const axis=visual.axis==='x'?0:visual.axis==='y'?1:2;
        const next:[number,number,number]=[...shaft];
        next[axis]+=Math.PI*2*visual.revolutions;
        if(Math.abs(next[axis])>190)problem('A rotação do eixo excede o limite do motor.');
        push(visual.node,'rotation',begin,shaft);
        push(visual.node,'rotation',finish,next);
        shaftPos.set(m,next);visibleMechanicalMotion=true;
      }
    }
    diagnostics.push({
      id:event.id,action:event.action,start:begin,end:finish,
      nodeIds:[...touched].map(([s])=>resolvedId(s)),
      movedMetres:Number(moved.toFixed(4)),visibleMechanicalMotion
    });
  }
  // Map absolute seconds back to the correct original source ID and phase.
  // The original SceneProgram's declarative validator remains authoritative.
  const key=(t:number,value:Vec3):ProgramKey=>{
    let span=spans.find(s=>t>=s.start-1e-5&&t<s.end-1e-5);
    if(!span)span=spans[spans.length-1];
    const phase=Math.max(0,Math.min(1,(t-span!.start)/(span!.end-span!.start)));
    return {sourceId:span!.sourceId,phase,value};
  };
  const added:ProgramTrack[]=[];
  for(const [node,channels] of values)for(const [channel,changes] of channels){
    if(changes.length<2)continue;
    added.push({node,channel,interpolation:'linear',
      keys:changes.map(x=>key(x.t,x.value))});
  }
  const gripPlan=planGripContacts(storyboard,sources,bindings.entityNodes);
  const program=normalizeSceneProgram({
    version:1, background:base.background,nodes:base.nodes,
    tracks:[...base.tracks,...added],shots:base.shots,
    contacts:[...base.contacts,...gripPlan.contacts],motionChecks:base.motionChecks??[]
  },sources);
  return {program,diagnostics:{
    events:diagnostics,gripWindows:gripPlan.windows,
    limitations:'Compila movimentos e contatos de mãos com a carga para o IK existente. Não simula peso, dedos, rig real, física, solas apoiadas ou câmera cinematográfica; verifique erros de alcance e render do MP4.'
  }};
}
