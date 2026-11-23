/**
 * Declarative 2D editorial SceneSpec. The Gemini director produces data,
 * while the renderer composes only registered components.
 */
export const EDITORIAL_COMPONENTS = ['StageShell','DotMatrix','MetricStackItem','AnimatedCounter','VectorDrawIcon','EditorialSerifCaption','DataCardDeck','ImpactStamp','TreemapGrid'] as const;
export type EditorialComponent = typeof EDITORIAL_COMPONENTS[number];
export type Cue = {atWord?:number;atSeconds?:number;duration:number;preset:string};
export type Word = {word:string;start:number;end:number};
export type ElementSpec = {
 id:string;component:EditorialComponent;
 slot:'center_stage'|'left_rail_1'|'right_rail_1'|'lower_third'|'header'|'full_stage';
 props:Record<string,string|number|boolean>;enter:Cue;exit?:Cue;
};
export type SceneSpec = {
 project:{preset:'editorial_2d_v1';resolution:[1080,1920];fps:30|60;duration:number;safeArea:{top:number;bottom:number;left:number;right:number}};
 scenes:{id:string;layout:string;theme:string;elements:ElementSpec[]}[];
};
export type TimedElement = ElementSpec & {enterTime:number;exitTime:number|null};
export function cueTime(cue:Cue,words?:Word[]):number{
 if(cue.atWord!==undefined){
  if(!words)throw new Error('words.json obrigatório para âncora por palavra');
  const item=words[cue.atWord];
  if(!item||!Number.isFinite(item.start))throw new Error('Índice de palavra inválido: '+cue.atWord);
  return item.start;
 }
 if(cue.atSeconds===undefined||!Number.isFinite(cue.atSeconds))throw new Error('Cue precisa de atWord ou atSeconds');
 return cue.atSeconds;
}
export function validateSceneSpec(spec:SceneSpec):string[]{
 const errors:string[]=[];const p=spec.project;
 if(p.resolution[0]!==1080||p.resolution[1]!==1920)errors.push('Resolução deve ser 1080x1920');
 if(!Number.isFinite(p.duration)||p.duration<=0)errors.push('Duração inválida');
 const {left,right,top,bottom}=p.safeArea;
 if([left,right,top,bottom].some(x=>!Number.isFinite(x)||x<0)||left+right>=1080||top+bottom>=1920)errors.push('Safe areas inválidas');
 const ids=new Set<string>();
 for(const scene of spec.scenes)for(const el of scene.elements){
  if(ids.has(el.id))errors.push('ID duplicado: '+el.id);
  ids.add(el.id);
  if(!EDITORIAL_COMPONENTS.includes(el.component))errors.push('Componente desconhecido: '+el.component);
  for(const [label,cue] of [['entrada',el.enter],['saída',el.exit]] as const){
   if(!cue)continue;
   if(cue.duration<0||!Number.isFinite(cue.duration))errors.push(el.id+': duração '+label+' inválida');
   if((cue.atSeconds===undefined)===(cue.atWord===undefined))errors.push(el.id+': escolha apenas atWord ou atSeconds');
   if(cue.atSeconds!==undefined&&(cue.atSeconds<0||cue.atSeconds>p.duration))errors.push(el.id+': '+label+' fora da timeline');
   if(cue.atWord!==undefined&&(!Number.isInteger(cue.atWord)||cue.atWord<0))errors.push(el.id+': palavra inválida');
  }
 }
 return errors;
}
export function compileSceneSpec(spec:SceneSpec,words?:Word[]):TimedElement[]{
 const errors=validateSceneSpec(spec);if(errors.length)throw new Error(errors.join('; '));
 return spec.scenes.flatMap(s=>s.elements.map(el=>({...el,enterTime:cueTime(el.enter,words),exitTime:el.exit?cueTime(el.exit,words):null})));
}
export function resolveSvgBounds(b:{x:number;y:number;width:number;height:number},safe:SceneSpec['project']['safeArea']):boolean{
 return b.x>=safe.left&&b.y>=safe.top&&b.x+b.width<=1080-safe.right&&b.y+b.height<=1920-safe.bottom;
}
