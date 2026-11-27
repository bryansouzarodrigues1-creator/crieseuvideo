import {normalizeShapeMotion,sampleShapeMotion,type ShapeMotionKey} from './shapeMotion';
import type {Shape} from './drawing';
export interface EditorialGroup {id:string;x:number;y:number;motion:ShapeMotionKey[]}
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
  result.push({id:g.id,x:Math.max(-560,Math.min(560,g.x)),y:Math.max(-560,Math.min(560,g.y)),motion});
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
 return sampleShapeMotion(g.motion,t);
}
export function groupPoint(g:EditorialGroup,x:number,y:number,t:number){
 const p=groupPose(g,t),a=p.rotation*Math.PI/180,dx=(x-g.x)*p.scale,dy=(y-g.y)*p.scale;
 return {x:g.x+p.dx+dx*Math.cos(a)-dy*Math.sin(a),y:g.y+p.dy+dx*Math.sin(a)+dy*Math.cos(a)};
}
export const GROUP_GUIDE=`Para um objeto composto que se move inteiro (máquina, veículo, pessoa, caixa), dê a todas as peças o mesmo campo group:"motor" e depth:"middle". Na cena, use groups:[{"id":"motor","x":0,"y":100,"motion":[{"time":0},{"time":2,"dx":150,"rotation":20}]}]. x,y são o pivô comum em coordenadas do desenho. As peças mantêm suas posições relativas. Cada peça ainda pode ter motion próprio (por exemplo roda girando). Até 12 grupos, sem grupos aninhados. Um grupo não pode misturar planos. Não repita a trajetória do grupo nas peças.`;
