import {normalizeShapeMotion,sampleShapeMotion,type ShapeMotionKey} from './shapeMotion';
import type {Shape} from './drawing';
export interface GroupSupport {anchorX:number;anchorY:number;surfaceY:number}
export interface EditorialGroup {id:string;x:number;y:number;motion:ShapeMotionKey[];support?:GroupSupport}
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
  result.push({id:g.id,x:Math.max(-560,Math.min(560,g.x)),y:Math.max(-560,Math.min(560,g.y)),motion,...(support?{support}:{})});
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
 }
 return [...new Set(issues)];
}
/** Canvas transform around the shared authored pivot, with local member motions preserved. */
export function groupPose(g:EditorialGroup,t:number){
 const p=sampleShapeMotion(g.motion,t);
 if(!g.support)return p;
 // The authored contact point is transformed with the same pivot, rotation
 // and scale as the group. Override only vertical translation. Deterministic
 // for any seek time, including between keyframes.
 const {anchorX,anchorY,surfaceY}=g.support,a=p.rotation*Math.PI/180;
 const dy=surfaceY-g.y-p.scale*((anchorX-g.x)*Math.sin(a)+(anchorY-g.y)*Math.cos(a));
 return {...p,dy};
}
export function groupPoint(g:EditorialGroup,x:number,y:number,t:number){
 const p=groupPose(g,t),a=p.rotation*Math.PI/180,dx=(x-g.x)*p.scale,dy=(y-g.y)*p.scale;
 return {x:g.x+p.dx+dx*Math.cos(a)-dy*Math.sin(a),y:g.y+p.dy+dx*Math.sin(a)+dy*Math.cos(a)};
}
export const GROUP_GUIDE=`Para um objeto composto que se move inteiro (máquina, veículo, pessoa, caixa), dê a todas as peças o mesmo campo group:"motor" e depth:"middle". Na cena, use groups:[{"id":"motor","x":0,"y":100,"motion":[{"time":0},{"time":2,"dx":150,"rotation":20}]}]. x,y são o pivô comum em coordenadas do desenho. As peças mantêm suas posições relativas. Cada peça ainda pode ter motion próprio (por exemplo roda girando). Até 12 grupos, sem grupos aninhados. Um grupo não pode misturar planos. Não repita a trajetória do grupo nas peças.`;

export const SUPPORT_GUIDE=`Para manter um objeto apoiado numa superfície horizontal estática durante TODA a cena, desenhe a superfície na arte, no MESMO plano do grupo (não no backdrop), e acrescente ao grupo support:{"anchorX":0,"anchorY":123,"surfaceY":200}. anchorX/Y são coordenadas absolutas de um ponto de contato do objeto em repouso (ex.: base de uma roda); surfaceY é a coordenada da linha superior da superfície desenhada. O motor resolve dy a cada quadro, inclusive quando o grupo muda de escala/rotação. dx continua livre; mantenha o objeto dentro da extensão horizontal da superfície. Não use se o objeto pula, voa ou é levantado. Este recurso prende um ponto, não simula colisão nem garante contato de todas as rodas. Para apoiar em outro plano ou superfície móvel, use direção manual por enquanto.`;
