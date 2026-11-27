/** Local, bounded declarative material. No images, shaders or external assets. */
export type EditorialMaterial={kind:'linear';light:string;dark:string;angle:number}|{kind:'radial';light:string;dark:string};
const hex=(v:unknown):v is string=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function normalizeMaterial(raw:unknown):EditorialMaterial|undefined{
 if(!raw||typeof raw!=='object')return;
 const m=raw as Record<string,unknown>;
 if(!hex(m.light)||!hex(m.dark))return;
 if(m.kind==='radial')return {kind:'radial',light:m.light,dark:m.dark};
 if(m.kind==='linear'&&typeof m.angle==='number'&&Number.isFinite(m.angle)&&Math.abs(m.angle)<=360)return {kind:'linear',light:m.light,dark:m.dark,angle:m.angle};
}
export function materialFill(c:CanvasRenderingContext2D,m:EditorialMaterial,w:number,h:number):CanvasGradient{
 const r=Math.max(1,Math.hypot(w,h)/2);
 const angle=m.kind==='linear'?m.angle*Math.PI/180:0;
 const gradient=m.kind==='radial'?c.createRadialGradient(-w*.17,-h*.19,0,0,0,r):c.createLinearGradient(-r*Math.cos(angle),-r*Math.sin(angle),r*Math.cos(angle),r*Math.sin(angle));
 gradient.addColorStop(0,m.light);gradient.addColorStop(1,m.dark);
 return gradient;
}
export type ContactShadow={width:number; height:number; opacity:number};
export function normalizeContactShadow(raw:unknown):ContactShadow|undefined{
 if(!raw||typeof raw!=='object')return;
 const s=raw as Record<string,unknown>;
 const within=(n:unknown,min:number,max:number):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 if(!within(s.width,10,800)||!within(s.height,4,100)||!within(s.opacity,.05,.65))return;
 return {width:s.width,height:s.height,opacity:s.opacity};
}
/** Contact shadow, in the same projected plane as the support line. */
export function drawContactShadow(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,opacity:number){
 c.save();
 try{
  c.translate(x,y);c.scale(w/2,h/2);
  const g=c.createRadialGradient(0,0,0,0,0,1);
  g.addColorStop(0,'rgba(8,15,24,'+opacity+')');g.addColorStop(.6,'rgba(8,15,24,'+(opacity*.5)+')');g.addColorStop(1,'rgba(8,15,24,0)');
  c.fillStyle=g;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();
 }finally{c.restore();}
}
export const MATERIAL_GUIDE=`Acabamento opcional de primitivas circle, ellipse, rect e poly: material:{"kind":"linear","light":"#F4D78A","dark":"#A86A32","angle":90} ou {"kind":"radial","light":"#D7F4FF","dark":"#347B99"}. Mantenha a luz coerente em toda cena. Gradientes discretos para volume, não em todos os objetos. Para uma peça plana, omita material. Sombras de contato: em grupo com support, acrescente shadow:{"width":320,"height":24,"opacity":0.35}. A superfície deve aparecer ANTES das peças do grupo na lista, no mesmo plano; a sombra é desenhada antes do primeiro membro, na linha de apoio, centrada no pivô horizontal transformado. Não crie sombras soltas. Não é iluminação 3D física.`;
