import {normalizeTexture,paintTexture,type SurfaceTexture} from './editorialTextures';
/** Original backdrop made of bounded, declarative vector primitives.
 * Coordinates in a normalized 0..1000 square mapped onto the whole frame.
 * No external assets, code execution, or stock setting required.
 */
type BackdropShape={type:'rect'|'ellipse'|'poly';x:number;y:number;w:number;h:number;color:string;points?:[number,number][];texture?:SurfaceTexture};
export type EditorialBackdrop={top:string;bottom:string;elements:BackdropShape[]};
const hex=(v:unknown):v is string=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const n=(v:unknown,d:number,lo=0,hi=1000)=>typeof v==='number'&&Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):d;
export function normalizeBackdrop(raw:unknown):EditorialBackdrop|undefined{
 if(!raw||typeof raw!=='object')return;
 const o=raw as Record<string,unknown>;
 if(!hex(o.top)||!hex(o.bottom)||!Array.isArray(o.elements))return;
 const elements:BackdropShape[]=[];
 for(const value of o.elements.slice(0,32)){
  if(!value||typeof value!=='object')continue;
  const e=value as Record<string,unknown>;
  if((e.type!=='rect'&&e.type!=='ellipse'&&e.type!=='poly')||!hex(e.color))continue;
  const points=Array.isArray(e.points)?e.points.slice(0,24).filter(p=>Array.isArray(p)&&p.length===2&&p.every(x=>typeof x==='number'&&Number.isFinite(x))).map(p=>[n(p[0],0),n(p[1],0)] as [number,number]):undefined;
  if(e.type==='poly'&&(!points||points.length<3))continue;
  elements.push({type:e.type,x:n(e.x,500),y:n(e.y,500),w:n(e.w,100,1,2000),h:n(e.h,100,1,2000),color:e.color,points,texture:normalizeTexture(e.texture)});
 }
 return {top:o.top,bottom:o.bottom,elements};
}
export function drawEditorialBackdrop(c:CanvasRenderingContext2D,art:EditorialBackdrop,w:number,h:number){
 c.save();
 try{
  c.scale(w/1000,h/1000);
  const gradient=c.createLinearGradient(0,0,0,1000);gradient.addColorStop(0,art.top);gradient.addColorStop(1,art.bottom);
  c.fillStyle=gradient;c.fillRect(0,0,1000,1000);
  for(const e of art.elements){
   c.fillStyle=e.color;c.beginPath();
   if(e.type==='rect')c.rect(e.x-e.w/2,e.y-e.h/2,e.w,e.h);
   else if(e.type==='ellipse')c.ellipse(e.x,e.y,e.w/2,e.h/2,0,0,Math.PI*2);
   else {e.points?.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
   c.fill();
   if(e.texture)paintTexture(c,e.texture,1,{x:0,y:0,w:1000,h:1000});
  }
 }finally{c.restore();}
}
export const BACKDROP_GUIDE=`Crie um fundo original por cena no campo backdrop: {"top":"#14324A","bottom":"#72A6BC","elements":[{"type":"rect","x":500,"y":900,"w":1000,"h":200,"color":"#244653"},{"type":"poly","points":[[0,700],[280,350],[560,700]],"color":"#436A7A"}]}. Coordenadas normalizadas 0..1000 da tela inteira (0,0 no canto superior esquerdo); rect e ellipse usam centro x,y e w,h; poly usa pontos absolutos. Até 32 peças, sem contorno. Construa o lugar real da ação (oficina, fábrica, rua, montanha, cozinha, laboratório), não uma placa atrás do objeto. Mude o ambiente quando a narrativa mudar de lugar, e mantenha continuidade quando a história permanecer no mesmo espaço. Use contraste atrás das legendas.`;
