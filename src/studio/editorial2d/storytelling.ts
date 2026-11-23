/**
 * Cinema Editorial 2D — primitive components and deterministic story beats.
 * The director (Gemini) should produce the declarative spec; it must never
 * inject arbitrary SVG/HTML. Characters' labels remain outside mirrored art.
 */
export type StoryPose = 'idle' | 'talking' | 'thinking' | 'pointing' | 'celebrating' | 'sad';
export type Facing = 'left' | 'right';
export type StoryTheme = 'studio_dark' | 'farm_light' | 'math_cream' | 'city_shop';
export type StoryBlock =
  | {type:'actors';actors:Actor2D[]}
  | {type:'icon_grid';id:string;icon:'hen'|'egg'|'coin';count:number;columns:number;x:number;y:number;gapX:number;gapY:number}
  | {type:'equation';rows:EquationRow[];x:number;y:number}
  | {type:'concept';title:string;detail:string};
export interface Actor2D{
 id:string;x:number;y:number;scale:number;facing:Facing;pose:StoryPose;
 bodyColor:string;skinColor:string;shirtLabel?:string;
}
export interface EquationRow{label:string;amount:number;type:'income'|'cost'|'result'}
export interface StoryScene{
 id:string;start:number;end:number;theme:StoryTheme;
 headline:string;caption:string;blocks:StoryBlock[];
}
export interface StorytellingSpec{version:1;title:string;duration:number;fps:30|60;scenes:StoryScene[]}
const escapeXml=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const color=(v:string)=>/^#[0-9a-fA-F]{6}$/.test(v)?v:'#64748B';
const finite=(x:number)=>Number.isFinite(x);
export function validateStory(spec:StorytellingSpec):string[]{
 const errors:string[]=[];
 if(spec.version!==1)errors.push('Unsupported story schema version');
 if(!finite(spec.duration)||spec.duration<=0)errors.push('Invalid duration');
 if(spec.fps!==30&&spec.fps!==60)errors.push('Invalid FPS');
 if(!spec.scenes.length)errors.push('At least one scene required');
 let previousEnd=0;
 const ids=new Set<string>();
 for(const s of spec.scenes){
  if(ids.has(s.id))errors.push('Duplicate scene '+s.id);ids.add(s.id);
  if(!finite(s.start)||!finite(s.end)||s.start<0||s.end<=s.start||s.end>spec.duration)errors.push('Invalid interval '+s.id);
  if(Math.abs(s.start-previousEnd)>0.001)errors.push('Gap or overlap before '+s.id);
  previousEnd=s.end;
  if(s.headline.length>85||s.caption.length>140)errors.push('Too much visible text in '+s.id);
  for(const block of s.blocks){
   if(block.type==='actors'){
    for(const a of block.actors){
     if(!finite(a.x)||!finite(a.y)||a.x<60||a.x>1020||a.y<180||a.y>1510)errors.push('Actor outside safe area: '+a.id);
     if(!finite(a.scale)||a.scale<=0||a.scale>3)errors.push('Invalid actor scale '+a.id);
    }
   } else if(block.type==='icon_grid'){
    if(!Number.isInteger(block.count)||block.count<0||block.count>2000)errors.push('Invalid grid count '+block.id);
    if(!Number.isInteger(block.columns)||block.columns<1||block.columns>100)errors.push('Invalid grid columns '+block.id);
    if([block.x,block.y,block.gapX,block.gapY].some(x=>!finite(x)||x<0))errors.push('Invalid grid geometry '+block.id);
   } else if(block.type==='equation'){
    if(block.rows.some(x=>!finite(x.amount)))errors.push('Invalid equation amounts');
   }
  }
 }
 if(Math.abs(previousEnd-spec.duration)>0.001)errors.push('Last scene does not end at duration');
 return errors;
}
export function sceneAt(spec:StorytellingSpec,t:number):StoryScene{
 if(!spec.scenes.length)throw new Error('No scenes in story');
 const time=Math.max(0,Math.min(spec.duration,Number.isFinite(t)?t:0));
 return spec.scenes.find(s=>time>=s.start&&time<s.end)||spec.scenes[spec.scenes.length-1];
}
export function renderActor2DSvg(actor:Actor2D):string{
 const a=actor;const x=Number(a.x),y=Number(a.y),z=Number(a.scale);
 const hand=a.pose==='pointing'?'-95,-15 -157,-68':a.pose==='celebrating'?'-95,-15 -137,-130':'-95,-15 -136,62';
 const rightHand=a.pose==='celebrating'?'95,-15 137,-130':a.pose==='thinking'?'95,-15 28,-118':'95,-15 136,62';
 const mouth=a.pose==='sad'?'M-16 -44 Q0 -65 16 -44':a.pose==='celebrating'?'M-19 -50 Q0 -12 20 -50':'M-14 -46 Q0 -33 14 -46';
 const head=escapeXml(a.id);
 return '<g data-actor="'+head+'" transform="translate('+x+' '+y+') scale('+z+')">'+
  // Flip only shape geometry, NEVER a text label.
  '<g class="actor-shape" transform="scale('+(a.facing==='left'?-1:1)+' 1)">'+
  '<path d="M-35 85 L-42 185 M35 85 L42 185" stroke="'+color(a.bodyColor)+'" stroke-width="30" stroke-linecap="round"/>'+
  '<path d="M'+hand+' M'+rightHand+'" stroke="'+color(a.skinColor)+'" stroke-width="23" stroke-linecap="round" fill="none"/>'+
  '<path d="M-97 -16 Q0 -53 97 -16 L65 110 H-65Z" fill="'+color(a.bodyColor)+'" stroke="#193046" stroke-width="5"/>'+
  '<circle cx="0" cy="-115" r="73" fill="'+color(a.skinColor)+'" stroke="#193046" stroke-width="5"/>'+
  '<path d="M-70 -124 Q-55 -194 0 -191 Q58 -191 71 -119" fill="#182A37"/>'+
  '<circle cx="-25" cy="-116" r="6" fill="#152536"/><circle cx="24" cy="-116" r="6" fill="#152536"/>'+
  '<path d="'+mouth+'" stroke="#63473d" stroke-width="5" fill="none" stroke-linecap="round"/>'+
  '</g>'+
  (a.shirtLabel?'<text class="actor-label" x="0" y="57" text-anchor="middle" fill="#ffffff" font-size="43" font-family="Arial" font-weight="800">'+escapeXml(a.shirtLabel)+'</text>':'')+
  '</g>';
}
export function iconGridPositions(count:number,columns:number,x:number,y:number,gapX:number,gapY:number):{x:number;y:number}[]{
 if(!Number.isInteger(count)||count<0||count>2000||!Number.isInteger(columns)||columns<1||columns>100)throw new Error('Invalid icon grid');
 return Array.from({length:count},(_,i)=>({x:x+(i%columns)*gapX,y:y+Math.floor(i/columns)*gapY}));
}
export function renderIconGridSvg(block:Extract<StoryBlock,{type:'icon_grid'}>):string{
 const paths={
  egg:'<ellipse cx="0" cy="0" rx="13" ry="18" fill="#EAD59B" stroke="#5C4A2A" stroke-width="2"/>',
  coin:'<circle r="16" fill="#DBB864" stroke="#8E642C" stroke-width="3"/><path d="M-8 0H8" stroke="#76531E" stroke-width="3"/>',
  hen:'<ellipse cx="0" cy="5" rx="18" ry="16" fill="#FFF4DC"/><circle cx="13" cy="-10" r="12" fill="#FFF4DC"/><path d="M22 -8L36 -3L22 1" fill="#DBA048"/><circle cx="17" cy="-11" r="2" fill="#172D3C"/>'
 };
 return '<g data-grid="'+escapeXml(block.id)+'">'+iconGridPositions(block.count,block.columns,block.x,block.y,block.gapX,block.gapY)
 .map(({x,y},i)=>'<g data-icon-index="'+i+'" transform="translate('+x+' '+y+')">'+paths[block.icon]+'</g>').join('')+'</g>';
}
export function formatCurrency(value:number){return value.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});}
export function renderEquationSvg(rows:EquationRow[],x:number,y:number):string{
 return '<g transform="translate('+x+' '+y+')">'+rows.map((r,i)=>{
 const fill=r.type==='income'?'#39B789':r.type==='cost'?'#E56E6E':'#D8B365';
 return '<g transform="translate(0 '+(i*102)+')"><text x="0" y="0" fill="#F4F7FA" font-size="34" font-family="Arial">'+escapeXml(r.label)+'</text>'+
 '<text x="700" y="0" text-anchor="end" fill="'+fill+'" font-size="45" font-weight="bold" font-family="Arial">'+escapeXml((r.type==='cost'?'− ':'')+formatCurrency(r.amount))+'</text></g>';
 }).join('')+'</g>';
}
