import {actorHandPoint} from './editorialActor';
import {normalizeContactShadow,type ContactShadow} from './editorialMaterials';
import {normalizeShapeMotion,sampleShapeMotion,type ShapeMotionKey} from './shapeMotion';
import type {Shape} from './drawing';
export interface GroupSupport {anchorX:number;anchorY:number;surfaceY:number}
export interface GroupAttachment {target:string;start:number;end:number;anchorX:number;anchorY:number;targetX:number;targetY:number}
export interface ActorGrip {actor:string;hand:'left'|'right';start:number;end:number;anchorX:number;anchorY:number}
export interface EditorialGroup {id:string;x:number;y:number;motion:ShapeMotionKey[];support?:GroupSupport;attachment?:GroupAttachment;shadow?:ContactShadow;grip?:ActorGrip}
export function normalizeGroupAttachment(raw:unknown):GroupAttachment|undefined{
 if(!raw||typeof raw!=='object')return;
 const a=raw as Record<string,unknown>;
 const coordinate=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=560;
 const time=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=30;
 if(!validGroupId(a.target)||!time(a.start)||!time(a.end)||a.end<=a.start||!coordinate(a.anchorX)||!coordinate(a.anchorY)||!coordinate(a.targetX)||!coordinate(a.targetY))return;
 return {target:a.target,start:a.start,end:a.end,anchorX:a.anchorX,anchorY:a.anchorY,targetX:a.targetX,targetY:a.targetY};
}
export function normalizeActorGrip(raw:unknown):ActorGrip|undefined{
 if(!raw||typeof raw!=='object')return;
 const a=raw as Record<string,unknown>;
 const n=(v:unknown,lo:number,hi:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
 if(!validGroupId(a.actor)||(a.hand!=='left'&&a.hand!=='right')||!n(a.start,0,30)||!n(a.end,0,30)||a.end<=a.start||!n(a.anchorX,-560,560)||!n(a.anchorY,-560,560))return;
 return {actor:a.actor,hand:a.hand,start:a.start,end:a.end,anchorX:a.anchorX,anchorY:a.anchorY};
}
export function normalizeGroupSupport(raw:unknown):GroupSupport|undefined{
 if(!raw||typeof raw!=='object')return;
 const s=raw as Record<string,unknown>;
 const valid=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=560;
 if(!valid(s.anchorX)||!valid(s.anchorY)||!valid(s.surfaceY))return;
 return {anchorX:s.anchorX,anchorY:s.anchorY,surfaceY:s.surfaceY};
}
export function validGroupId(v:unknown):v is string{return typeof v==='string'&&/^[a-z][a-z0-9_-]{0,31}$/.test(v);}
export function normalizeGroups(raw:unknown):EditorialGroup[]{
 if(!Array.isArray(raw))return [];
 const result:EditorialGroup[]=[];
 for(const value of raw.slice(0,12)){
  if(!value||typeof value!=='object')continue;
  const g=value as Record<string,unknown>;
  if(!validGroupId(g.id)||result.some(x=>x.id===g.id))continue;
  if(typeof g.x!=='number'||typeof g.y!=='number'||!Number.isFinite(g.x)||!Number.isFinite(g.y))continue;
  const motion=normalizeShapeMotion(g.motion);
  if(!motion)continue;
  const support=normalizeGroupSupport(g.support);
  if(g.support!==undefined&&!support)continue;
  const attachment=normalizeGroupAttachment(g.attachment);
  if(g.attachment!==undefined&&!attachment)continue;
  const grip=normalizeActorGrip(g.grip);
  if(g.grip!==undefined&&!grip)continue;
  const shadow=normalizeContactShadow(g.shadow);
  result.push({id:g.id,x:Math.max(-560,Math.min(560,g.x)),y:Math.max(-560,Math.min(560,g.y)),motion,...(support?{support}:{}),...(attachment?{attachment}:{}),...(support&&shadow?{shadow}:{}),...(grip?{grip}:{})});
 }
 return result;
}
export function groupIssues(shapes:readonly Shape[],groups:readonly EditorialGroup[]):string[]{
 const issues:string[]=[];
 for(const shape of shapes)if(shape.group&&!groups.some(g=>g.id===shape.group))issues.push('Grupo inexistente: '+shape.group);
 for(const g of groups){
  const members=shapes.filter(s=>s.group===g.id);
  if(members.length<2)issues.push('Grupo precisa de duas peças: '+g.id);
  if(new Set(members.map(s=>s.depth??'middle')).size>1)issues.push('Grupo dividido entre planos: '+g.id);
  if(g.grip){
   const a=g.grip,targets=shapes.filter(s=>s.actor?.id===a.actor),target=targets[0];
   const hand=target&&actorHandPoint(target,a.start,a.hand);
   const from=pointWithPose(g,a.anchorX,a.anchorY,baseGroupPose(g,a.start));
   if(targets.length!==1||!hand||g.support||g.attachment||(target.depth??'middle')!==(members[0]?.depth??'middle')||hand.opacity<.99||Math.hypot(from.x-hand.x,from.y-hand.y)>16*hand.scale)issues.push('Captura pela mão inválida: '+g.id);
  }
  if(g.attachment){
   const a=g.attachment,target=groups.find(t=>t.id===a.target);
   if(!target||target.id===g.id||(target.attachment||target.grip)||g.support){issues.push('Vínculo inválido: '+g.id);continue;}
   const targetMembers=shapes.filter(s=>s.group===target.id);
   if(!targetMembers.length||(members[0]?.depth??'middle')!==(targetMembers[0]?.depth??'middle'))issues.push('Vínculo entre planos diferentes: '+g.id);
   // The director must bring the two points together before the pickup.
   const from=pointWithPose(g,a.anchorX,a.anchorY,baseGroupPose(g,a.start));
   const to=pointWithPose(target,a.targetX,a.targetY,baseGroupPose(target,a.start));
   if(Math.hypot(from.x-to.x,from.y-to.y)>0.01)issues.push('Vínculo começa sem contato: '+g.id);
  }
 }
 return [...new Set(issues)];
}
/** Canvas transform around the shared authored pivot, with local member motions preserved. */
function baseGroupPose(g:EditorialGroup,t:number){
 const p=sampleShapeMotion(g.motion,t);
 if(!g.support)return p;
 // The authored contact point is transformed with the same pivot, rotation
 // and scale as the group. Override only vertical translation. Deterministic
 // for any seek time, including between keyframes.
 const {anchorX,anchorY,surfaceY}=g.support,a=p.rotation*Math.PI/180;
 const dy=surfaceY-g.y-p.scale*((anchorX-g.x)*Math.sin(a)+(anchorY-g.y)*Math.cos(a));
 return {...p,dy};
}
function pointWithPose(g:EditorialGroup,x:number,y:number,p:ReturnType<typeof baseGroupPose>){
 const a=p.rotation*Math.PI/180,dx=(x-g.x)*p.scale,dy=(y-g.y)*p.scale;
 return {x:g.x+p.dx+dx*Math.cos(a)-dy*Math.sin(a),y:g.y+p.dy+dx*Math.sin(a)+dy*Math.cos(a)};
}
/** One-level, temporary positional attachment. The release retains the last
 * offset, so authored movement resumes without jumping to the old position. */
export function groupPose(g:EditorialGroup,t:number,groups:readonly EditorialGroup[]=[],shapes:readonly Shape[]=[]){
 const p=baseGroupPose(g,t),a=g.attachment;
 const grip=g.grip;
 if(grip&&!g.support&&!a&&t>=grip.start){
  const actor=shapes.find(s=>s.actor?.id===grip.actor),at=Math.min(t,grip.end);
  const hand=actor&&actorHandPoint(actor,at,grip.hand),initial=actor&&actorHandPoint(actor,grip.start,grip.hand);
  if(hand&&initial){
   const from=pointWithPose(g,grip.anchorX,grip.anchorY,baseGroupPose(g,at)),start=pointWithPose(g,grip.anchorX,grip.anchorY,baseGroupPose(g,grip.start));
   return {...p,dx:p.dx+hand.x-initial.x+start.x-from.x,dy:p.dy+hand.y-initial.y+start.y-from.y};
  }
 }
 if(!a||g.support||t<a.start)return p;
 const target=groups.find(v=>v.id===a.target);
 if(!target||target===g||target.attachment||target.grip)return p;
 const at=Math.min(t,a.end);
 const from=pointWithPose(g,a.anchorX,a.anchorY,baseGroupPose(g,at));
 const to=pointWithPose(target,a.targetX,a.targetY,baseGroupPose(target,at));
 return {...p,dx:p.dx+to.x-from.x,dy:p.dy+to.y-from.y};
}
export function groupPoint(g:EditorialGroup,x:number,y:number,t:number,groups:readonly EditorialGroup[]=[],shapes:readonly Shape[]=[]){
 return pointWithPose(g,x,y,groupPose(g,t,groups,shapes));
}
export const GROUP_GUIDE=`Para um objeto composto que se move inteiro (máquina, veículo, pessoa, caixa), dê a todas as peças o mesmo campo group:"motor" e depth:"middle". Na cena, use groups:[{"id":"motor","x":0,"y":100,"motion":[{"time":0},{"time":2,"dx":150,"rotation":20}]}]. x,y são o pivô comum em coordenadas do desenho. As peças mantêm suas posições relativas. Cada peça ainda pode ter motion próprio (por exemplo roda girando). Até 12 grupos, sem grupos aninhados. Um grupo não pode misturar planos. Não repita a trajetória do grupo nas peças.`;

export const SUPPORT_GUIDE=`Para manter um objeto apoiado numa superfície horizontal estática durante TODA a cena, desenhe a superfície na arte, no MESMO plano do grupo (não no backdrop), e acrescente ao grupo support:{"anchorX":0,"anchorY":123,"surfaceY":200}. anchorX/Y são coordenadas absolutas de um ponto de contato do objeto em repouso (ex.: base de uma roda); surfaceY é a coordenada da linha superior da superfície desenhada. O motor resolve dy a cada quadro, inclusive quando o grupo muda de escala/rotação. dx continua livre; mantenha o objeto dentro da extensão horizontal da superfície. Não use se o objeto pula, voa ou é levantado. Este recurso prende um ponto, não simula colisão nem garante contato de todas as rodas. Para apoiar em outro plano ou superfície móvel, use direção manual por enquanto.`;

export const ATTACHMENT_GUIDE=`Para carregar um grupo com outro por um intervalo, defina attachment no grupo carregado: {"target":"mao","start":1,"end":4,"anchorX":0,"anchorY":0,"targetX":0,"targetY":0}. As âncoras são pontos absolutos das geometrias em repouso; o motor alinha esses pontos enquanto start<=tempo<=end. Antes de start, as trajetórias devem levar ambos os pontos exatamente à mesma posição (tolerância 0.01 unidade), evitando teleporte. Após end, o grupo retém o deslocamento acumulado, e sua própria trajetória continua a partir dali. Use uma trajetória própria constante durante o transporte para facilitar o planejamento da soltura. Ambos os grupos precisam estar no mesmo plano, sem vínculos encadeados ou support no grupo carregado. O alvo pode ter support. O vínculo segue a transformação do grupo alvo, não movimentos individuais das peças; para mão articulada, use um grupo de mão. Não é colisão ou IK.`;
