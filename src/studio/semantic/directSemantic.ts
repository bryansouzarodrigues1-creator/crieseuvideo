import {z} from 'zod';

/**
 * DirectSemantic v0: a model returns WHAT must happen using named entities.
 * The renderer / choreographer owns all world coordinates, IK and camera maths.
 * This is a causal preflight, NOT a working visual renderer or physical solver.
 */
const id=z.string().min(1).max(40).regex(/^[a-z][a-z0-9_-]*$/);
const common=z.object({id,actorId:id,at:z.number().finite().min(0),duration:z.number().finite().min(.1).max(20)});
const move=common.extend({verb:z.literal('move_to'),zoneId:id}).strict();
const pickup=common.extend({verb:z.literal('pick_up'),propId:id}).strict();
const put=common.extend({verb:z.literal('place_on'),propId:id,zoneId:id}).strict();
const look=common.extend({verb:z.literal('look_at'),targetId:id}).strict();
export const SemanticVerbSchema=z.discriminatedUnion('verb',[move,pickup,put,look]);
export const DirectSemanticSchema=z.object({
 version:z.literal(1),
 duration:z.number().finite().min(1).max(60),
 zones:z.array(z.object({id}).strict()).min(1).max(12),
 actors:z.array(z.object({id,startZone:id}).strict()).min(1).max(6),
 props:z.array(z.object({id,startZone:id}).strict()).max(24),
 actions:z.array(SemanticVerbSchema).min(1).max(60),
}).strict();
export type DirectSemanticPlan=z.infer<typeof DirectSemanticSchema>;
export type SemanticAction=z.infer<typeof SemanticVerbSchema>;
export type CompiledSemanticAction=SemanticAction&{
 actorZoneBefore:string;actorZoneAfter:string;
 heldPropBefore:string|null;heldPropAfter:string|null;
};
export type SemanticCompileResult={
 duration:number;actions:CompiledSemanticAction[];
 finalActorZones:Record<string,string>;
 finalPropZones:Record<string,string|null>;
 diagnostics:{actionId:string;message:string}[];
};
export class SemanticPlanError extends Error{
 readonly code='semantic_plan_invalid';
}

const fail=(message:string):never=>{throw new SemanticPlanError(message);};
function uniqueIds(ids:string[],label:string){
 if(new Set(ids).size!==ids.length)fail(label+': IDs duplicados.');
}
export function compileDirectSemantic(raw:unknown):SemanticCompileResult{
 const parsed=DirectSemanticSchema.safeParse(raw);
 if(!parsed.success)fail('ScenePlan fora do contrato de verbos ou duração.');
 const plan=parsed.data!;
 uniqueIds(plan.zones.map(x=>x.id),'Zona');
 uniqueIds(plan.actors.map(x=>x.id),'Ator');
 uniqueIds(plan.props.map(x=>x.id),'Objeto');
 uniqueIds(plan.actions.map(x=>x.id),'Ação');
 const zones=new Set(plan.zones.map(x=>x.id));
 const actors=new Map(plan.actors.map(x=>[x.id,x.startZone]));
 const props=new Map(plan.props.map(x=>[x.id,x.startZone as string|null]));
 const holders=new Map<string,string|null>(plan.actors.map(x=>[x.id,null]));
 const busy=new Map<string,number>();
 for(const a of plan.actors)if(!zones.has(a.startZone))fail('Zona inicial desconhecida do ator '+a.id);
 for(const p of plan.props)if(!zones.has(p.startZone))fail('Zona inicial desconhecida do objeto '+p.id);
 const ordered=[...plan.actions].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
 const compiled:CompiledSemanticAction[]=[];
 for(const a of ordered){
  if(a.at+a.duration>plan.duration+1e-6)fail(a.id+': evento fora da duração.');
  const zone=actors.get(a.actorId);
  if(zone===undefined)fail(a.id+': ator não declarado.');
  if(a.at<(busy.get(a.actorId)??0)-1e-6)fail(a.id+': ações simultâneas do mesmo ator.');
  const held=holders.get(a.actorId)??null;
  let nextZone=zone,nextHeld=held;
  if(a.verb==='move_to'){
   if(!zones.has(a.zoneId))fail(a.id+': destino não declarado.');
   nextZone=a.zoneId;
  }else if(a.verb==='pick_up'){
   if(!props.has(a.propId))fail(a.id+': objeto não declarado.');
   if(held!==null)fail(a.id+': ator já está carregando '+held);
   const propZone=props.get(a.propId);
   if(propZone===null)fail(a.id+': objeto já está sendo carregado.');
   if(propZone!==zone)fail(a.id+': objeto fora do alcance sem movimento prévio.');
   props.set(a.propId,null);nextHeld=a.propId;
  }else if(a.verb==='place_on'){
   if(!zones.has(a.zoneId))fail(a.id+': apoio/destino desconhecido.');
   if(held!==a.propId)fail(a.id+': ator não está segurando esse objeto.');
   if(zone!==a.zoneId)fail(a.id+': falta aproximar o objeto do destino.');
   props.set(a.propId,a.zoneId);nextHeld=null;
  }else{
   const target=a.targetId;
   if(!zones.has(target)&&!actors.has(target)&&!props.has(target))
    fail(a.id+': alvo de olhar inexistente.');
  }
  actors.set(a.actorId,nextZone);
  holders.set(a.actorId,nextHeld);
  busy.set(a.actorId,a.at+a.duration);
  compiled.push({...a,actorZoneBefore:zone,actorZoneAfter:nextZone,
   heldPropBefore:held,heldPropAfter:nextHeld});
 }
 return {duration:plan.duration,actions:compiled,
  finalActorZones:Object.fromEntries(actors),finalPropZones:Object.fromEntries(props),
  diagnostics:compiled.map(a=>({actionId:a.id,
   message:a.verb==='pick_up'?'Contato e vínculo objeto/mão exigem inspeção visual.':
    a.verb==='place_on'?'Soltar objeto no apoio exige verificar interseções no render.':
    a.verb==='move_to'?'Trajeto, pés e colisões exigem motor e validação de frames.':
     'Direção do olhar exige rig de cabeça/olhos.'}))};
}
