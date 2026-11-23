import type { Ref } from 'react';
import { iconGridPositions, sceneAt, type Actor2D, type StoryBlock, type StorytellingSpec } from './storytelling';

/** Pure time-driven SVG output. No timers or hidden animation state. */
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { const v=clamp(x); return v*v*(3-2*v); };
const points = (t: number, from: number, duration=0.5) => ease((t-from)/duration);

function wrapLabel(value: string, max=26, maxLines=2): string[] {
  const words=value.trim().split(/\s+/).filter(Boolean);
  const lines:string[]=[];let line='';
  for (const word of words) {
    if (!line) {line=word;continue;}
    if ((line+' '+word).length>max) {lines.push(line);line=word;}
    else line+=' '+word;
  }
  if(line)lines.push(line);
  if(lines.length<=maxLines) return lines;
  const trimmed=lines.slice(0,maxLines);
  trimmed[maxLines-1]=trimmed[maxLines-1].slice(0,max-2).trimEnd()+'…';
  return trimmed;
}
function Actor({a,beat}:{a:Actor2D;beat:number}) {
  const mirror=a.facing==='left'?-1:1;
  const armRight=a.pose==='thinking'?'M95,-15 Q124,-50 29,-112'
    :a.pose==='pointing'?'M95,-15 Q145,-30 180,-67'
    :a.pose==='celebrating'?'M95,-15 Q140,-66 124,-130'
    :'M95,-15 Q132,32 137,64';
  const armLeft=a.pose==='celebrating'?'M-95,-15 Q-140,-66 -124,-130'
    :'M-95,-15 Q-135,40 -137,65';
  const mouth=a.pose==='sad'?'M-20,-39 Q0,-59 20,-39'
    :a.pose==='celebrating'?'M-20,-50 Q0,-13 20,-50'
    :'M-18,-43 Q0,-29 18,-43';
  const bounce=a.pose==='celebrating'?Math.sin(beat*6)*2.5:Math.sin(beat*2)*1.2;
  const safeColor=(v:string)=>/^#[a-fA-F0-9]{6}$/.test(v)?v:'#49798B';
  return <g data-testid={'actor-'+a.id} transform={'translate('+a.x+' '+a.y+') scale('+a.scale+')'}>
    <g transform={'translate(0 '+bounce.toFixed(2)+')'}>
      {/* Mirror the anatomy only. The shirt label remains outside this transform. */}
      <g transform={'scale('+mirror+' 1)'}>
        <path d="M-35 85 L-42 188 M35 85 L42 188" stroke={safeColor(a.bodyColor)} strokeWidth="30" strokeLinecap="round"/>
        <path d={armLeft+' '+armRight} stroke={safeColor(a.skinColor)} strokeWidth="23" strokeLinecap="round" fill="none"/>
        <path d="M-97 -16 Q0 -53 97 -16 L65 110 H-65Z" fill={safeColor(a.bodyColor)} stroke="#132b3c" strokeWidth="5"/>
        <circle cx="0" cy="-115" r="73" fill={safeColor(a.skinColor)} stroke="#132b3c" strokeWidth="5"/>
        <path d="M-70 -124 Q-55 -194 0 -191 Q58 -191 71 -119" fill="#182A37"/>
        <circle cx="-25" cy="-116" r="6" fill="#152536"/>
        <circle cx="24" cy="-116" r="6" fill="#152536"/>
        <path d={mouth} stroke="#63473d" strokeWidth="5" fill="none" strokeLinecap="round"/>
      </g>
      {a.shirtLabel && <text className="actor-label" x="0" y="57" textAnchor="middle" fill="#ffffff" fontSize="43" fontFamily="Arial" fontWeight="800">{a.shirtLabel}</text>}
    </g>
  </g>;
}
function Icon({icon}:{icon:'hen'|'egg'|'coin'}) {
  if(icon==='hen')return <g><ellipse cx="0" cy="5" rx="18" ry="16" fill="#FFF4DC"/><circle cx="13" cy="-10" r="12" fill="#FFF4DC"/><path d="M22 -8L36 -3L22 1" fill="#DBA048"/><circle cx="17" cy="-11" r="2" fill="#172D3C"/></g>;
  if(icon==='egg')return <ellipse cx="0" cy="0" rx="13" ry="18" fill="#EAD59B" stroke="#5C4A2A" strokeWidth="2"/>;
  return <g><circle r="16" fill="#DBB864" stroke="#8E642C" strokeWidth="3"/><path d="M-8 0H8" stroke="#76531E" strokeWidth="3"/></g>;
}
function Block({block,local,reveal,index}:{block:StoryBlock;local:number;reveal:number;index:number}) {
  const show=points(local,reveal,.48);
  if (show<=0) return null;
  const motion = (1-show)*18;
  switch(block.type){
    case 'actors': return <g opacity={show} transform={'translate(0 '+motion+')'}>
      {block.actors.map(a=><Actor key={a.id} a={a} beat={local}/>)}
    </g>;
    case 'icon_grid': {
      const pos=iconGridPositions(block.count,block.columns,block.x,block.y,block.gapX,block.gapY);
      return <g data-testid={'grid-'+block.id}>
        {pos.map((p,i)=>{
          const u=points(local,reveal+i* Math.min(.04,2.6/Math.max(1,pos.length)),.3);
          return u>0?<g key={i} opacity={u} transform={'translate('+p.x+' '+(p.y+(1-u)*-16)+') scale('+(.75+.25*u)+')'}>
            <Icon icon={block.icon}/>
          </g>:null;
        })}
      </g>;
    }
    case 'equation': return <g opacity={show} transform={'translate('+block.x+' '+(block.y+motion)+')'}>
      <rect x="-32" y="-92" width="805" height={block.rows.length*102+30} rx="30" fill="#142436" stroke="#577083" strokeWidth="3"/>
      {block.rows.map((r,i)=>{
        const alpha=points(local,reveal+.6+i*.7,.3);
        const col=r.type==='income'?'#10B981':r.type==='cost'?'#EF4444':'#E1B65D';
        return <g key={i} opacity={alpha} transform={'translate(0 '+i*102+')'}>
          <text x="0" y="0" fontSize={r.label.length>24?26:34} fill="#F8FAFC">{r.label}</text>
          <text x="690" y="0" textAnchor="end" fontSize="42" fill={col} fontWeight="800">{r.type==='cost'?'− ':''}{r.amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})}</text>
        </g>;
      })}
    </g>;
    case 'concept':return <g opacity={show} transform={'translate(0 '+motion+')'}>
      <rect x="115" y={640+index*20} width="850" height="375" rx="34" fill="#182C3D" stroke="#CFA452" strokeWidth="4"/>
      <text x="540" y={785+index*20} textAnchor="middle" fill="#F8FAFC" fontSize="73" fontWeight="800">{block.title.slice(0,22)}</text>
      <text x="540" y={900+index*20} textAnchor="middle" fill="#D9B56C" fontSize="40">{block.detail.slice(0,35)}</text>
    </g>;
  }
}
export function StoryFrame({spec,time,svgRef}:{spec:StorytellingSpec;time:number;svgRef?:Ref<SVGSVGElement>}) {
  const scene=sceneAt(spec,time);
  const local=Math.max(0,time-scene.start);
  const dark=scene.theme==='studio_dark';
  const farm=scene.theme==='farm_light';
  const shop=scene.theme==='city_shop';
  const panel=dark?'#0A1628':farm?'#CBE9EB':shop?'#E1EAF0':'#F3EFE6';
  const ink=dark?'#F7F6F1':farm||shop?'#112835':'#18191A';
  const captionLines=wrapLabel(scene.caption,35,2);
  const titleLines=wrapLabel(scene.headline,23,2);
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920" role="img" aria-label={'Prévia 2D: '+scene.headline} data-testid="storytelling-svg" style={{width:'100%',height:'100%',display:'block',background:panel}}>
    <defs>
      <radialGradient id="storyRadial"><stop offset="0" stopColor={dark?'#193451':'#F6F2E8'}/><stop offset="1" stopColor={panel}/></radialGradient>
      <linearGradient id="storySky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B8E1EE"/><stop offset="1" stopColor="#F0ECD0"/></linearGradient>
      <linearGradient id="storyGround" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#76A77E"/><stop offset="1" stopColor="#3C765C"/></linearGradient>
    </defs>
    <style>{'.story-text {font-family:Inter,Arial,sans-serif} .actor-label {paint-order:stroke;stroke:#183347;stroke-width:3px} .story-caption{font-weight:750;letter-spacing:-1px}'}</style>
    <rect x="0" y="0" width="1080" height="1920" fill={farm?'url(#storySky)':'url(#storyRadial)'}/>
    {farm? <g>
      <circle cx="866" cy="360" r="110" fill="#FFE6A0" opacity=".88"/>
      <path d="M0 970 Q350 740 615 910 Q840 825 1080 945 V1510 H0Z" fill="#A2C79B"/>
      <path d="M0 1060 Q350 880 600 1060 Q850 930 1080 1040 V1510 H0Z" fill="url(#storyGround)"/>
      <g fill="#A55F44"><rect x="90" y="870" width="260" height="260"/><path d="M60 870L220 754 380 870Z" fill="#784533"/><rect x="185" y="1010" width="70" height="120" fill="#46342B"/></g>
      <path d="M0 1175H1080M0 1290H1080" stroke="#F5E1A5" strokeWidth="10"/>
    </g>:null}
    {shop?<g>
      <rect x="0" y="1150" width="1080" height="360" fill="#D6C7B3"/>
      <rect x="180" y="540" width="720" height="615" rx="14" fill="#E8D2B5" stroke="#33465D" strokeWidth="8"/>
      <rect x="226" y="680" width="630" height="420" fill="#B9DBE6" stroke="#405C6D" strokeWidth="14"/>
      <rect x="500" y="680" width="80" height="430" fill="#456A7A"/>
      <path d="M160 635L200 530H880L920 635Z" fill="#B65543"/>
      {Array.from({length:10},(_,i)=><rect key={i} x={180+i*72} y="538" width="35" height="97" fill="#F8E5C5"/>)}
      <rect x="390" y="420" width="300" height="86" rx="15" fill="#233748"/>
      <text x="540" y="476" textAnchor="middle" fontSize="41" fontWeight="800" fill="#F8F7F0">LOJA DO BAIRRO</text>
    </g>:null}
    {dark?<g opacity=".14" fill="#B9C7D7">{Array.from({length:40},(_,i)=><circle key={i} cx={(i*211+73)%1080} cy={(i*173+147)%1480} r={2+(i%3)}/>)}</g>:null}
    <text className="story-text" x="78" y="185" fontSize="25" fontWeight="700" letterSpacing="5" fill={ink} opacity=".65">CRIESEUVIDEO  /  CINEMA 2D</text>
    <g opacity={points(local,0,.5)}>
      {titleLines.map((line,i)=><text className="story-text" key={i} x="540" y={300+i*73} fontSize={line.length>22?49:62} fontWeight="850" textAnchor="middle" fill={ink}>{line}</text>)}
    </g>
    {scene.blocks.map((b,i)=><Block key={b.type==='icon_grid'?b.id:i} block={b} local={local} index={i} reveal={.75+i*2.2}/>)}
    <g>
      <rect x="65" y="1502" width="885" height="260" rx="25" fill={dark?'#06101F':'#172534'} opacity=".91"/>
      {captionLines.map((line,i)=><text className="story-text story-caption" key={i} x="508" y={1615+i*58} fontSize="38" fill="#F8FAFC" textAnchor="middle">{line}</text>)}
    </g>
    <text x="75" y="1826" fontSize="26" fill={ink} opacity=".65">{scene.id}</text>
    <rect x="75" y="1860" width={925} height="5" rx="2" fill={dark?'#344357':'#9DA8B0'}/>
    <rect x="75" y="1860" width={925*clamp(time/spec.duration)} height="5" rx="2" fill="#F59E0B"/>
  </svg>;
}
