import {normalizeShapeMotion,sampleShapeMotion,type ShapeMotionKey} from './shapeMotion';
import type {Shape} from './drawing';
export interface GroupSupport {anchorX:number;anchorY:number;surfaceY:number}
export interface GroupAttachment {carrier:string;start:number;end:number;anchorX:number;anchorY:number;carrierX:number;carrierY:number}
export interface EditorialGroup {id:string;x:number;y:number;motion:ShapeMotionKey[];support?:GroupSupport;attachment?:GroupAttachment}
export function normalizeGroupAttachment(raw:unknown):GroupAttachment|undefined{
 if(!raw||typeof raw!=='object')return;
 const a=raw as Record<string,unknown>;
 const valid=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 if(!validGroupId(a.carrier)||!valid(a.start,0,30)||!valid(a.end,0,30)||a.end<=a.start||
 !valid(a.anchorX,-560,560)||!valid(a.anchorY,-560,560)||!valid(a.carrierX,-560,560)||!valid(a.carrierY,-560,560))return;
 return {carrier:a.carrier,start:a.start,end:a.end,anchorX:a.anchorX,anchorY:a.anchorY,carrierX:a.carrierX,carrierY:a.carrierY};
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
  result.push({id:g.id,x:Math.max(-560,Math.min(560,g.x)),y:Math.max(-560,Math.min(560,g.y)),motion,...(support?{support}:{}),...(attachment?{attachment}:{})});
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
  const a=g.attachment;
  if(a){
   const carrier=groups.find(x=>x.id===a.carrier);
   if(!carrier||carrier===g||carrier.attachment||g.support){
    issues.push('Vínculo incompatível ou circular: '+g.id);continue;
   }
   const carrierMember=shapes.find(s=>s.group===carrier.id);
   if(!carrierMember||!members[0]||(carrierMember.depth??'middle')!==(members[0].depth??'middle')){
    issues.push('Vínculo entre planos diferentes: '+g.id);continue;
   }
   const own=basePoint(g,a.anchorX,a.anchorY,a.start),other=basePoint(carrier,a.carrierX,a.carrierY,a.start);
   if(Math.hypot(own.x-other.x,own.y-other.y)>12)issues.push('Âncoras distantes no instante de pegar: '+g.id);
  }
 }
 return [...new Set(issues)];
}
/** Canvas transform around the shared authored pivot, with local member motions preserved. */
function basePose(g:EditorialGroup,t:number){
 const p=sampleShapeMotion(g.motion,t);
 if(!g.support)return p;
 // The authored contact point is transformed with the same pivot, rotation
 // and scale as the group. Override only vertical translation. Deterministic
 // for any seek time, including between keyframes.
 const {anchorX,anchorY,surfaceY}=g.support,a=p.rotation*Math.PI/180;
 const dy=surfaceY-g.y-p.scale*((anchorX-g.x)*Math.sin(a)+(anchorY-g.y)*Math.cos(a));
 return {...p,dy};
}
function pointFromPose(g:EditorialGroup,x:number,y:number,p:ReturnType<typeof basePose>){
 const a=p.rotation*Math.PI/180,dx=(x-g.x)*p.scale,dy=(y-g.y)*p.scale;
 return {x:g.x+p.dx+dx*Math.cos(a)-dy*Math.sin(a),y:g.y+p.dy+dx*Math.sin(a)+dy*Math.cos(a)};
}
function basePoint(g:EditorialGroup,x:number,y:number,t:number){return pointFromPose(g,x,y,basePose(g,t));}
/** Translation-only attachment. Preserve the initial offset, and freeze the
 * correction on release so a continuous authored track never jumps. */
export function groupPose(g:EditorialGroup,t:number,groups:readonly EditorialGroup[]=[]){
 const p=basePose(g,t),a=g.attachment;
 if(!a||t<=a.start||g.support)return p;
 const carrier=groups.find(x=>x.id===a.carrier);
 if(!carrier||carrier===g||carrier.attachment)return p;
 const at=Math.min(t,a.end);
 const c0=basePoint(carrier,a.carrierX,a.carrierY,a.start),c1=basePoint(carrier,a.carrierX,a.carrierY,at);
 const o0=basePoint(g,a.anchorX,a.anchorY,a.start),o1=basePoint(g,a.anchorX,a.anchorY,at);
 return {...p,dx:p.dx+c1.x-c0.x-o1.x+o0.x,dy:p.dy+c1.y-c0.y-o1.y+o0.y};
}
export function groupPoint(g:EditorialGroup,x:number,y:number,t:number,groups:readonly EditorialGroup[]=[]){
 return pointFromPose(g,x,y,groupPose(g,t,groups));
}
export const GROUP_GUIDE=`Para um objeto composto que se move inteiro (máquina, veículo, pessoa, caixa), dê a todas as peças o mesmo campo group:"motor" e depth:"middle". Na cena, use groups:[{"id":"motor","x":0,"y":100,"motion":[{"time":0},{"time":2,"dx":150,"rotation":20}]}]. x,y são o pivô comum em coordenadas do desenho. As peças mantêm suas posições relativas. Cada peça ainda pode ter motion próprio (por exemplo roda girando). Até 12 grupos, sem grupos aninhados. Um grupo não pode misturar planos. Não repita a trajetória do grupo nas peças.`;

export const SUPPORT_GUIDE=`Para manter um objeto apoiado numa superfície horizontal estática durante TODA a cena, desenhe a superfície na arte, no MESMO plano do grupo (não no backdrop), e acrescente ao grupo support:{"anchorX":0,"anchorY":123,"surfaceY":200}. anchorX/Y são coordenadas absolutas de um ponto de contato do objeto em repouso (ex.: base de uma roda); surfaceY é a coordenada da linha superior da superfície desenhada. O motor resolve dy a cada quadro, inclusive quando o grupo muda de escala/rotação. dx continua livre; mantenha o objeto dentro da extensão horizontal da superfície. Não use se o objeto pula, voa ou é levantado. Este recurso prende um ponto, não simula colisão nem garante contato de todas as rodas. Para apoiar em outro plano ou superfície móvel, use direção manual por enquanto.`;

export const ATTACHMENT_GUIDE=`Para pegar, transportar e soltar um objeto, dê IDs distintos ao grupo carregador e ao grupo carregado, no mesmo plano. No carregado use attachment:{"carrier":"mao","start":1,"end":3,"anchorX":0,"anchorY":0,"carrierX":100,"carrierY":0}. Âncoras são pontos absolutos na arte em repouso. No instante start, faça os pontos coincidirem usando as trajetórias originais (tolerância de 12 unidades, diferença inicial preservada). Entre start e end, o motor acompanha a posição da âncora do carregador; rotação e escala do carregado continuam próprias. Depois de end, a correção acumulada é mantida, sem teletransporte; mantenha a trajetória original parada para depositar. Não combine attachment e support no carregado. Sem cadeias, ciclos, ou física de mãos. Use enquadramento fixo quando necessário. Tempos em segundos locais até 30 e dentro da duração da cena.`;
