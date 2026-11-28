import {normalizeTexture} from './editorialTextures';
import {normalizeMaterial,normalizeContactShadow} from './editorialMaterials';
import {normalizeGroupSupport,normalizeGroupAttachment,groupIssues} from './editorialGroups';
import {normalizeEditorialFraming} from './editorialFraming';
import {normalizeShapeMotion,type ShapeMotionKey} from './shapeMotion';
import type {ExplainerScene} from './plan';
import {normalizeEditorialShot} from './editorialCamera';
import {normalizeBackdrop} from './editorialBackdrop';
export type SceneEdit={target:string;op:'move';dx:number;dy:number}|{target:string;op:'color';color:string}|{target:'camera';op:'camera';shot:string}|{target:'background';op:'background';backdrop:unknown}|{target:string;op:'motion';motion:unknown}|{target:string;op:'resize';factor:number}|{target:'camera';op:'framing';framing:unknown}|{target:string;op:'support';support:unknown}|{target:string;op:'attachment';attachment:unknown}|{target:string;op:'material';material:unknown}|{target:string;op:'shadow';shadow:unknown}|{target:string;op:'texture';texture:unknown};
export function sceneInventory(scene:ExplainerScene){
 return {text:scene.text,camera:scene.camera,framing:scene.framing,backdrop:scene.backdrop,shapes:(scene.drawing??[]).map((s,i)=>({...s,id:'shape_'+i})),groups:(scene.groups??[]).map(g=>({...g,target:'group_'+g.id}))};
}
const number=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=300;
const within=(v:number)=>Number.isFinite(v)&&Math.abs(v)<=560;
function strictMotion(value:unknown):ShapeMotionKey[]{
 if(!Array.isArray(value)||!value.length||value.length>12)throw Error('Trajetória inválida.');
 let last=-1;
 for(const key of value){
  if(!key||typeof key!=='object'||typeof key.time!=='number'||!Number.isFinite(key.time)||key.time<=last||key.time>30||key.time<0)throw Error('Tempo inválido.');
  last=key.time;
  for(const [field,min,max] of [['dx',-440,440],['dy',-440,440],['rotation',-360,360],['scale',.05,3],['opacity',0,1]] as const){
   const v=key[field];if(v!==undefined&&(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max))throw Error('Chave fora do limite.');
  }
  if(key.ease!==undefined&&!['smooth','linear','step'].includes(key.ease))throw Error('Interpolação inválida.');
 }
 const normalized=normalizeShapeMotion(value);
 if(!normalized||normalized.length>12)throw Error('Trajetória inválida.');
 return normalized;
}
/** Atomic edits to one authored scene; no arbitrary execution or text/timing changes. */
export function applySceneEdits(scene:ExplainerScene,raw:unknown):ExplainerScene{
 if(scene.visual!=='custom'||scene.composition!=='authored'||!scene.drawing)throw Error('Revisão disponível apenas para composição autoral.');
 if(!Array.isArray(raw)||raw.length>8)throw Error('Correções inválidas.');
 const drawing=scene.drawing.map(s=>({...s,points:s.points?.map(p=>[...p] as [number,number])}));
 const groups=(scene.groups??[]).map(g=>({...g}));
 const out={...scene,drawing,groups};
 const move=(i:number,dx:number,dy:number)=>{
  const s=drawing[i];
  if(!s||!within(s.x+dx)||!within(s.y+dy)||s.points?.some(([x,y])=>!within(x+dx)||!within(y+dy)))throw Error('Movimento fora do limite.');
  drawing[i]={...s,x:s.x+dx,y:s.y+dy,points:s.points?.map(([x,y])=>[x+dx,y+dy])};
 };
 for(const value of raw){
  if(!value||typeof value!=='object')throw Error('Correção inválida.');
  const e=value as Record<string,unknown>;
  const target=e.target;
  if(typeof target!=='string')throw Error('Alvo inválido.');
  if(e.op==='texture'&&/^shape_(0|[1-9][0-9]*)$/.test(target)){
   const i=Number(target.slice(6)),s=drawing[i];
   if(!s||!['circle','ellipse','rect','poly'].includes(s.type))throw Error('Peça não aceita textura.');
   if(e.texture===null)drawing[i]={...s,texture:undefined};
   else{const texture=normalizeTexture(e.texture);if(!texture)throw Error('Textura inválida.');drawing[i]={...s,texture};}
  }else if(e.op==='material'&&/^shape_(0|[1-9][0-9]*)$/.test(target)){
   const i=Number(target.slice(6)),s=drawing[i];
   if(!s||!['circle','ellipse','rect','poly'].includes(s.type))throw Error('Peça não aceita material.');
   if(e.material===null){drawing[i]={...s,material:undefined};}
   else{const material=normalizeMaterial(e.material);if(!material)throw Error('Material inválido.');drawing[i]={...s,material};}
  }else if(e.op==='shadow'&&target.startsWith('group_')){
   const g=groups.find(g=>'group_'+g.id===target);if(!g)throw Error('Grupo inexistente.');
   if(e.shadow===null)delete g.shadow;
   else{const shadow=normalizeContactShadow(e.shadow);if(!shadow||!g.support)throw Error('Sombra exige apoio válido.');g.shadow=shadow;}
  }else if(e.op==='attachment'&&target.startsWith('group_')){
   const g=groups.find(g=>'group_'+g.id===target);if(!g)throw Error('Grupo inexistente.');
   if(e.attachment===null)delete g.attachment;
   else{const a=normalizeGroupAttachment(e.attachment);if(!a)throw Error('Vínculo inválido.');g.attachment=a;}
  }else if(e.op==='support'&&target.startsWith('group_')){
   const g=groups.find(g=>'group_'+g.id===target);if(!g)throw Error('Grupo inexistente.');
   if(e.support===null){delete g.support;delete g.shadow;}
   else{const support=normalizeGroupSupport(e.support);if(!support)throw Error('Apoio inválido.');g.support=support;}
  }else if(e.op==='framing'&&target==='camera'){
   const frame=normalizeEditorialFraming(e.framing);if(!frame)throw Error('Enquadramento inválido.');out.framing=frame;
  }else if(e.op==='motion'){
   const motion=strictMotion(e.motion);
   if(target.startsWith('group_')){
    const g=groups.find(g=>'group_'+g.id===target);if(!g)throw Error('Grupo inexistente.');g.motion=motion;
   }else if(/^shape_(0|[1-9][0-9]*)$/.test(target)){
    const i=Number(target.slice(6));if(!drawing[i])throw Error('Peça inexistente.');drawing[i]={...drawing[i],anim:'none',motion};
   }else throw Error('Alvo desconhecido.');
  }else if(e.op==='resize'&&typeof e.factor==='number'&&Number.isFinite(e.factor)&&e.factor>=.5&&e.factor<=2){
   const factor=e.factor;
   const resizeMotion=(motion:ShapeMotionKey[]|undefined)=>strictMotion((motion??[{time:0,scale:1}]).map(k=>({...k,scale:k.scale*factor})));
   if(target.startsWith('group_')){
    const g=groups.find(g=>'group_'+g.id===target);if(!g)throw Error('Grupo inexistente.');g.motion=resizeMotion(g.motion);
   }else if(/^shape_(0|[1-9][0-9]*)$/.test(target)){
    const i=Number(target.slice(6)),shape=drawing[i];if(!shape)throw Error('Peça inexistente.');
    if(!shape.motion&&shape.anim!=='none')throw Error('Defina trajetória explícita antes de redimensionar animação automática.');
    drawing[i]={...shape,anim:'none',motion:resizeMotion(shape.motion)};
   }else throw Error('Alvo desconhecido.');
  }else if(e.op==='camera'&&target==='camera'){
   const shot=normalizeEditorialShot(e.shot);if(!shot)throw Error('Câmera inválida.');out.camera=shot;
  }else if(e.op==='background'&&target==='background'){
   const art=normalizeBackdrop(e.backdrop);if(!art)throw Error('Cenário inválido.');out.backdrop=art;
  }else if(e.op==='move'&&number(e.dx)&&number(e.dy)){
   const dx=e.dx,dy=e.dy;
   if(target.startsWith('group_')){
    const g=groups.find(g=>'group_'+g.id===target);if(!g||!within(g.x+dx)||!within(g.y+dy))throw Error('Grupo inválido.');
    drawing.forEach((s,i)=>{if(s.group===g.id)move(i,dx,dy);});
    if(g.support){const {anchorX,anchorY,surfaceY}=g.support;if(!within(anchorX+dx)||!within(anchorY+dy))throw Error('Âncora fora do limite.');g.support={anchorX:anchorX+dx,anchorY:anchorY+dy,surfaceY};}
    if(g.attachment){const a=g.attachment;if(!within(a.anchorX+dx)||!within(a.anchorY+dy))throw Error('Âncora fora do limite.');g.attachment={...a,anchorX:a.anchorX+dx,anchorY:a.anchorY+dy};}
    for(const follower of groups){const a=follower.attachment;if(a?.target===g.id){if(!within(a.targetX+dx)||!within(a.targetY+dy))throw Error('Âncora fora do limite.');follower.attachment={...a,targetX:a.targetX+dx,targetY:a.targetY+dy};}}
    g.x+=dx;g.y+=dy;
   }else if(/^shape_(0|[1-9][0-9]*)$/.test(target)){const i=Number(target.slice(6));move(i,dx,dy);}
   else throw Error('Alvo desconhecido.');
  }else if(e.op==='color'&&/^shape_(0|[1-9][0-9]*)$/.test(target)&&typeof e.color==='string'&&/^#[0-9a-f]{6}$/i.test(e.color)){
   const i=Number(target.slice(6));if(!drawing[i])throw Error('Peça inexistente.');drawing[i]={...drawing[i],color:e.color,material:undefined};
  }else throw Error('Operação não permitida.');
 }
 const issues=groupIssues(drawing,groups);if(issues.length)throw Error(issues.join('; '));
 return out;
}
