import {normalizeEditorialFraming,type EditorialFraming} from './editorialFraming';
import {normalizeShapeMotion,MOTION_KEY_LIMIT,MOTION_TIME_LIMIT,type ShapeMotionKey} from './shapeMotion';
import type {ExplainerScene} from './plan';
import {normalizeEditorialShot} from './editorialCamera';
import {normalizeBackdrop} from './editorialBackdrop';
export type SceneEdit={target:string;op:'move';dx:number;dy:number}|{target:string;op:'color';color:string}|{target:'camera';op:'camera';shot:string}|{target:'background';op:'background';backdrop:unknown}|{target:'framing';op:'framing';framing:EditorialFraming}|{target:string;op:'motion';motion:unknown}|{target:string;op:'resize';factor:number};
export function sceneInventory(scene:ExplainerScene){
 return {text:scene.text,camera:scene.camera,framing:scene.framing,backdrop:scene.backdrop,shapes:(scene.drawing??[]).map((s,i)=>({...s,id:'shape_'+i})),groups:(scene.groups??[]).map(g=>({...g,target:'group_'+g.id}))};
}
const number=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=300;
const within=(v:number)=>Number.isFinite(v)&&Math.abs(v)<=560;
const motionBounds={time:[0,MOTION_TIME_LIMIT],dx:[-440,440],dy:[-440,440],rotation:[-360,360],scale:[.05,3],opacity:[0,1]} as const;
function strictMotion(raw:unknown):ShapeMotionKey[]{
 if(!Array.isArray(raw)||!raw.length||raw.length>MOTION_KEY_LIMIT)throw Error('Trajetória inválida.');
 let previous=-1;
 for(const value of raw){
  if(!value||typeof value!=='object')throw Error('Chave inválida.');
  const key=value as Record<string,unknown>;
  if(typeof key.time!=='number'||key.time<=previous||previous===-1&&key.time!==0)throw Error('Tempos inválidos.');
  previous=key.time;
  for(const [field,bounds] of Object.entries(motionBounds)){
   const v=key[field];if(v===undefined&&field!=='time')continue;
   if(typeof v!=='number'||!Number.isFinite(v)||v<bounds[0]||v>bounds[1])throw Error('Chave fora dos limites.');
  }
  if(Object.keys(key).some(k=>!(k in motionBounds)&&k!=='ease')||key.ease!==undefined&&!['linear','smooth','step'].includes(String(key.ease)))throw Error('Campo inválido na trajetória.');
 }
 const result=normalizeShapeMotion(raw);
 if(!result)throw Error('Trajetória inválida.');
 return result;
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
  if(e.op==='camera'&&target==='camera'){
   const shot=normalizeEditorialShot(e.shot);if(!shot)throw Error('Câmera inválida.');out.camera=shot;
  }else if(e.op==='background'&&target==='background'){
   const art=normalizeBackdrop(e.backdrop);if(!art)throw Error('Cenário inválido.');out.backdrop=art;
  }else if(e.op==='framing'&&target==='framing'){
   const framing=normalizeEditorialFraming(e.framing);if(!framing)throw Error('Enquadramento inválido.');out.framing=framing;
  }else if(e.op==='motion'||e.op==='resize'){
   const factor=e.factor;
   const update=(current:ShapeMotionKey[]|undefined)=>{
    if(e.op==='motion')return strictMotion(e.motion);
    if(typeof factor!=='number'||!Number.isFinite(factor)||factor<.5||factor>2)throw Error('Escala inválida.');
    const keys=current?.length?current:strictMotion([{time:0}]);
    return strictMotion(keys.map(k=>({...k,scale:k.scale*factor})));
   };
   if(target.startsWith('group_')){
    const g=groups.find(g=>'group_'+g.id===target);if(!g)throw Error('Grupo inválido.');
    g.motion=update(g.motion);
   }else if(/^shape_(0|[1-9][0-9]*)$/.test(target)){
    const i=Number(target.slice(6));if(!drawing[i])throw Error('Peça inexistente.');
    drawing[i]={...drawing[i],motion:update(drawing[i].motion),anim:'none',delay:0};
   }else throw Error('Alvo desconhecido.');
  }else if(e.op==='move'&&number(e.dx)&&number(e.dy)){
   const dx=e.dx,dy=e.dy;
   if(target.startsWith('group_')){
    const g=groups.find(g=>'group_'+g.id===target);if(!g||!within(g.x+dx)||!within(g.y+dy))throw Error('Grupo inválido.');
    drawing.forEach((s,i)=>{if(s.group===g.id)move(i,dx,dy);});g.x+=dx;g.y+=dy;
   }else if(/^shape_(0|[1-9][0-9]*)$/.test(target)){const i=Number(target.slice(6));move(i,dx,dy);}
   else throw Error('Alvo desconhecido.');
  }else if(e.op==='color'&&/^shape_(0|[1-9][0-9]*)$/.test(target)&&typeof e.color==='string'&&/^#[0-9a-f]{6}$/i.test(e.color)){
   const i=Number(target.slice(6));if(!drawing[i])throw Error('Peça inexistente.');drawing[i]={...drawing[i],color:e.color};
  }else throw Error('Operação não permitida.');
 }
 return out;
}
