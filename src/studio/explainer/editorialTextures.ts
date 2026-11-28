/** Deterministic, bounded surface patterns drawn locally, no asset downloads. */
export const TEXTURES=['wood','metal','concrete','fabric','water'] as const;
export type SurfaceTexture={kind:typeof TEXTURES[number];seed:number;scale:number;opacity:number};
export function normalizeTexture(raw:unknown):SurfaceTexture|undefined{
 if(!raw||typeof raw!=='object')return;
 const v=raw as Record<string,unknown>;
 if(!TEXTURES.includes(v.kind as SurfaceTexture['kind']))return;
 const finite=(n:unknown,min:number,max:number):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 if(!finite(v.seed,0,65535)||!Number.isInteger(v.seed)||!finite(v.scale,.5,3)||!finite(v.opacity,.05,.5))return;
 return {kind:v.kind as SurfaceTexture['kind'],seed:v.seed,scale:v.scale,opacity:v.opacity};
}
export function textureRandom(seed:number){
 let state=seed>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
const TILE=96;
const tiles=new Map<string,HTMLCanvasElement>();
const patterns=new WeakMap<CanvasRenderingContext2D,Map<string,CanvasPattern>>();
function cachePut<K,V>(map:Map<K,V>,key:K,value:V){
 if(map.size>=32){const first=map.keys().next();if(!first.done)map.delete(first.value);}
 map.set(key,value);
}
function tileFor(texture:SurfaceTexture){
 const key=texture.kind+':'+texture.seed;
 const previous=tiles.get(key);if(previous)return previous;
 const tile=document.createElement('canvas');tile.width=TILE;tile.height=TILE;
 const c=tile.getContext('2d');if(!c)return;
 const rnd=textureRandom(texture.seed),ink='rgba(15,22,30,.58)',light='rgba(255,255,255,.65)';
 if(texture.kind==='wood'){
  for(let y=3;y<TILE;y+=6){
   const phase=rnd()*6.28,amp=1+rnd()*3;
   c.strokeStyle=y%2?ink:light;c.lineWidth=.6+rnd()*1.2;c.beginPath();
   for(let x=0;x<=TILE;x+=4){const yy=y+Math.sin(x/TILE*Math.PI*2+phase)*amp;x?c.lineTo(x,yy):c.moveTo(x,yy);}
   c.stroke();
  }
 }else if(texture.kind==='metal'){
  for(let y=0;y<TILE;y+=2){c.fillStyle=rnd()<.5?ink:light;c.globalAlpha=.2+rnd()*.8;c.fillRect(0,y,TILE,.4+rnd()*.8);}
 }else if(texture.kind==='concrete'){
  for(let i=0;i<260;i++){const r=.25+rnd()*1.6;c.fillStyle=rnd()<.5?ink:light;c.globalAlpha=.25+rnd()*.75;c.beginPath();c.arc(rnd()*TILE,rnd()*TILE,r,0,Math.PI*2);c.fill();}
 }else if(texture.kind==='fabric'){
  for(let i=0;i<TILE;i+=4){c.fillStyle=ink;c.fillRect(i,0,1,TILE);c.fillStyle=light;c.fillRect(0,i,TILE,1);}
 }else{
  for(let y=6;y<TILE;y+=12){c.strokeStyle=y%24===6?light:ink;c.lineWidth=1.3;c.beginPath();const phase=rnd()*6.28;for(let x=0;x<=TILE;x+=4){const yy=y+Math.sin(x/TILE*Math.PI*4+phase)*2.5;x?c.lineTo(x,yy):c.moveTo(x,yy);}c.stroke();}
 }
 cachePut(tiles,key,tile);return tile;
}
/** Draw only inside the caller's existing path, without changing that path.
 * Coordinates are local to the object, so the texture moves with it. */
export function paintTexture(c:CanvasRenderingContext2D,texture:SurfaceTexture,u:number,bounds:{x:number;y:number;w:number;h:number}){
 if(!(u>0)||bounds.w<=0||bounds.h<=0)return;
 const key=texture.kind+':'+texture.seed;
 let map=patterns.get(c);if(!map){map=new Map();patterns.set(c,map);}
 let pattern=map.get(key);
 if(!pattern){const tile=tileFor(texture);if(!tile)return;const created=c.createPattern(tile,'repeat');if(!created)return;pattern=created;cachePut(map,key,pattern);}
 pattern.setTransform(new DOMMatrix().scale(u*texture.scale));
 c.save();
 try{c.clip();c.globalAlpha*=texture.opacity;c.fillStyle=pattern;c.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);}finally{c.restore();}
}
export const TEXTURE_GUIDE=`Texturas procedurais opcionais em circle, ellipse, rect e poly (arte e elementos do backdrop): texture:{"kind":"wood","seed":17,"scale":1,"opacity":0.24}. kind: wood (veios), metal (escovado), concrete (granulado), fabric (trama), water (ondulações estáticas). seed inteiro 0..65535; preserve para a mesma superfície entre cenas. scale 0.5..3 e opacity 0.05..0.5. A textura fica recortada dentro da forma e acompanha sua transformação; combine com cor e material, use pouca intensidade para não prejudicar a leitura. Não cria geometria 3D nem simulação de água.`;
