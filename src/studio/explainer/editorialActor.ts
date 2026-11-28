/** Original vector cast: bounded appearance, deterministic articulated poses.
 * Walk is in-place; scene motion supplies displacement. No asset downloads. */
export const ACTOR_ACTIONS=['idle','walk','wave','point','talk','react'] as const;
export const ACTOR_EXPRESSIONS=['neutral','happy','worried','surprised','sad'] as const;
type Action=typeof ACTOR_ACTIONS[number];
type Expression=typeof ACTOR_EXPRESSIONS[number];
export type ActorStyle={skin:string;hair:string;shirt:string;pants:string;haircut:'short'|'swept'|'bald'};
export type EditorialActor={id:string;style:ActorStyle;action:Action;expression:Expression;facing:'left'|'right';speaking:boolean};
const hex=(v:unknown):v is string=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function normalizeActor(raw:unknown):EditorialActor|undefined{
 if(!raw||typeof raw!=='object')return;
 const a=raw as Record<string,unknown>,s=a.style as Record<string,unknown>|undefined;
 if(typeof a.id!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(a.id)||!s||!hex(s.skin)||!hex(s.hair)||!hex(s.shirt)||!hex(s.pants)||!['short','swept','bald'].includes(String(s.haircut)))return;
 if(!ACTOR_ACTIONS.includes(a.action as Action)||!ACTOR_EXPRESSIONS.includes(a.expression as Expression)||!['left','right'].includes(String(a.facing))||typeof a.speaking!=='boolean')return;
 return {id:a.id,style:{skin:s.skin.toUpperCase(),hair:s.hair.toUpperCase(),shirt:s.shirt.toUpperCase(),pants:s.pants.toUpperCase(),haircut:s.haircut as ActorStyle['haircut']},action:a.action as Action,expression:a.expression as Expression,facing:a.facing as EditorialActor['facing'],speaking:a.speaking};
}
export function actorContinuity(scenes:readonly (readonly {actor?:EditorialActor}[])[]):string[]{
 const identities=new Map<string,string>(),issues:string[]=[];
 for(const [i,scene] of scenes.entries()){
  const seen=new Set<string>();
  for(const {actor:a} of scene){
   if(!a)continue;
   const style=JSON.stringify(a.style);
   if(seen.has(a.id))issues.push('Personagem duplicado na cena '+(i+1)+': '+a.id);
   seen.add(a.id);
   if(identities.has(a.id)&&identities.get(a.id)!==style)issues.push('Aparência mudou: '+a.id);
   else identities.set(a.id,style);
  }
 }
 return issues;
}
type Point={x:number;y:number};
const p=(x:number,y:number):Point=>({x,y});
/** Equal-length two-bone IK, clamps unreachable targets. */
export function solveLimb(root:Point,target:Point,length:number,bend:number){
 const dx=target.x-root.x,dy=target.y-root.y,d=Math.hypot(dx,dy);
 const distance=Math.max(.001,Math.min(2*length-.001,d)),ux=d>.000001?dx/d:0,uy=d>.000001?dy/d:1;
 const h=Math.sqrt(Math.max(0,length*length-distance*distance/4));
 return {joint:p(root.x+ux*distance/2-uy*h*bend,root.y+uy*distance/2+ux*h*bend),end:p(root.x+ux*distance,root.y+uy*distance)};
}
export function actorPose(a:EditorialActor,t:number,talk=0){
 const time=Math.max(0,Number.isFinite(t)?t:0),phase=time*Math.PI*2/1.2,walking=a.action==='walk';
 const bob=walking?-3-3*Math.cos(2*phase):Math.sin(time*2.1)*1.5;
 const arms=[-1,1].map(side=>{
  const root=p(side*38,-36+bob);
  let end=p(side*52,48+bob);
  if(walking)end=p(side*52+side*Math.sin(phase)*34,40+bob);
  if(a.action==='wave'&&side===1)end=p(82+Math.sin(time*8)*13,-99+bob);
  if(a.action==='point'&&side===1)end=p(132,-37+bob);
  if(a.action==='talk'&&side===1)end=p(78+Math.sin(time*3)*12,-12-Math.max(0,Math.min(1,talk))*20+bob);
  if(a.action==='react')end=p(side*84,-75+bob);
  return {root,...solveLimb(root,end,49,side)};
 });
 const legs=[-1,1].map(side=>{
  const root=p(side*18,49+bob),s=phase+(side===1?Math.PI:0);
  const end=p(side*22+(walking?Math.sin(s)*35:0),143-(walking?Math.max(0,Math.cos(s))*21:0));
  return {root,...solveLimb(root,end,54,side)};
 });
 let hash=0;for(const ch of a.id)hash=(Math.imul(hash,31)+ch.charCodeAt(0))>>>0;
 const b=(time+(hash%200)/100)%3.7;
 return {bob,arms,legs,blink:b<.18?Math.max(.08,Math.abs(Math.cos(b/.18*Math.PI))):1,headTilt:a.expression==='worried'?.06:a.action==='react'?-.045:Math.sin(time*1.3)*.018};
}
export const ACTOR_BOUNDS={left:-160,right:160,top:-174,bottom:165};
export function drawEditorialActor(c:CanvasRenderingContext2D,a:EditorialActor,u:number,t:number,talk:number){
 const q=actorPose(a,t,talk),s=a.style,ink='#273241';
 const oval=(x:number,y:number,w:number,h:number,color:string)=>{c.beginPath();c.ellipse(x,y,w,h,0,0,Math.PI*2);c.fillStyle=color;c.fill();};
 const rect=(x:number,y:number,w:number,h:number,r:number,color:string)=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=color;c.fill();};
 const line=(from:Point,to:Point,w:number,color:string)=>{c.beginPath();c.moveTo(from.x,from.y);c.lineTo(to.x,to.y);c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.stroke();};
 c.save();
 try{
 c.scale((a.facing==='left'?-1:1)*u,u);
 for(const l of q.legs){line(l.root,l.joint,25,s.pants);line(l.joint,l.end,22,s.pants);rect(l.end.x-13,l.end.y-5,34,15,7,ink);}
 const arm=(i:number)=>{const l=q.arms[i];line(l.root,l.joint,22,s.shirt);line(l.joint,l.end,16,s.skin);oval(l.end.x,l.end.y,10,12,s.skin);};
 arm(0);
 rect(-42,-49+q.bob,84,107,23,s.shirt);
 rect(-13,-67+q.bob,26,27,9,s.skin);
 arm(1);
 c.save();c.translate(0,-106+q.bob);c.rotate(q.headTilt);
 oval(-47,1,10,16,s.skin);oval(47,1,10,16,s.skin);
 rect(-47,-53,94,106,38,s.skin);
 if(s.haircut!=='bald'){
  c.beginPath();c.moveTo(-48,0);c.quadraticCurveTo(-64,-60,-13,-65);
  c.quadraticCurveTo(40,-76,49,-34);c.lineTo(47,-5);c.lineTo(34,-27);
  if(s.haircut==='swept')c.quadraticCurveTo(-8,-10,-23,-40);else c.lineTo(-33,-35);
  c.closePath();c.fillStyle=s.hair;c.fill();
 }
 const surprise=a.expression==='surprised',sad=a.expression==='sad'||a.expression==='worried';
 for(const side of [-1,1]){
  const x=side*19;
  oval(x,-3,11,(surprise?14:10)*q.blink,'#FFFFFF');
  if(q.blink>.3)oval(x+2,-2,4,6*q.blink,ink);
  line(p(x-9,-19+(sad?side*2:0)),p(x+9,-19-(sad?side*2:0)),3,s.haircut==='bald'?ink:s.hair);
 }
 oval(2,11,3,5,'#A96B53');
 const open=a.speaking?Math.max(0,Math.min(1,talk)):0;
 if(open>.08||surprise)oval(0,29,9,4+open*10,'#623339');
 else{c.beginPath();c.moveTo(-12,27);c.quadraticCurveTo(0,a.expression==='happy'?39:sad?20:31,12,27);c.strokeStyle='#623339';c.lineWidth=3;c.stroke();}
 c.restore();
 }finally{c.restore();}
}
export const ACTOR_GUIDE=`Use type:"actor" somente se a narrativa precisar de personagem de corpo inteiro. Exemplo: {"type":"actor","x":0,"y":100,"size":1.5,"anim":"none","actor":{"id":"trabalhador","style":{"skin":"#D7A27D","hair":"#503329","shirt":"#26778B","pants":"#293A4C","haircut":"short"},"action":"walk","expression":"neutral","facing":"right","speaking":false}}. Ações: idle,walk,wave,point,talk,react. Expressões: neutral,happy,worried,surprised,sad. Cabelo short/swept/bald. Preserve exatamente id e style para a mesma pessoa em todas as cenas; IDs diferentes para pessoas diferentes. speaking:true somente para quem fala; a narração fora de quadro não move boca. walk é ciclo no lugar; use motion para deslocar o personagem na direção desejada. Não é IK de contato com objetos externos nem caminhada com pés fixos. Crie cenário e objetos autorais ao redor, não use personagem em toda cena sem razão.`;
