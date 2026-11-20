/**
 * Reusable narrative overlay for a SceneProgram3D clip.
 *
 * Data-only, deterministic and safe to render both in a responsive preview
 * and in an offscreen MP4/WebM compositor. No timers, AI requests or text
 * hidden in meshes. Every problem/solution must correspond to visible action.
 */
export interface PresentationBeat {
  start: number;
  end: number;
  problem: string;
  solution: string;
  subject: string;
}
export interface ClipPresentation {
  title: string;
  narration: string;
  beats: PresentationBeat[];
}

export function activeBeat(p: ClipPresentation, t: number): PresentationBeat | undefined {
  if(!Number.isFinite(t))return undefined;
  return p.beats.find((b,i)=>t>=b.start&&(t<b.end||i===p.beats.length-1&&t<=b.end));
}

function fitLines(ctx:CanvasRenderingContext2D,text:string,maxWidth:number,maxLines:number):string[]{
  const words=text.trim().split(/\s+/);
  const lines:string[]=[];let current='';
  for(const word of words){
    const test=current?current+' '+word:word;
    if(ctx.measureText(test).width>maxWidth&&current){
      lines.push(current);current=word;
    }else current=test;
  }
  if(current)lines.push(current);
  return lines.slice(0,maxLines);
}

export function drawClipPresentation(
  ctx:CanvasRenderingContext2D,
  presentation:ClipPresentation|undefined,
  sceneTime:number,width:number,height:number
):void{
  if(!presentation||width<=0||height<=0)return;
  const beat=activeBeat(presentation,sceneTime);
  if(!beat)return;
  const portrait=height>width;
  const k=Math.min(width/(portrait?720:1280),height/(portrait?1280:720));
  const pad=portrait?42*k:55*k;
  const left=portrait?38*k:52*k;
  const panelWidth=width-left*2;
  const top=portrait?50*k:35*k;
  const headlineFont=portrait?36*k:30*k;
  const subFont=portrait?30*k:24*k;
  const eyebrowFont=portrait?23*k:18*k;
  const accent='#b5e16d';
  ctx.save();
  ctx.textBaseline='top';
  // Semi-transparent captions preserve readability without hiding the model.
  const introH=portrait?161*k:124*k;
  ctx.fillStyle='rgba(5,12,24,0.86)';
  ctx.beginPath();ctx.roundRect(left,top,panelWidth,introH,16*k);ctx.fill();
  ctx.fillStyle=accent;
  ctx.font=`700 ${eyebrowFont}px system-ui,sans-serif`;
  ctx.fillText('PROBLEMA  /  '+beat.subject.toUpperCase(),left+pad,top+21*k);
  ctx.fillStyle='#ffffff';
  ctx.font=`750 ${headlineFont}px system-ui,sans-serif`;
  const lines=fitLines(ctx,beat.problem,panelWidth-pad*2,2);
  lines.forEach((line,i)=>ctx.fillText(line,left+pad,top+58*k+i*43*k));
  const elapsed=Math.max(0,sceneTime-beat.start);
  // The solution arrives AFTER the issue, synchronized to the actual
  // component's motion in the underlying scene. No instant spoiler text.
  if(elapsed>=1.0){
    const footerH=portrait?143*k:112*k;
    const bottom=height-(portrait?58*k:35*k)-footerH;
    ctx.fillStyle='rgba(5,12,24,0.88)';
    ctx.beginPath();ctx.roundRect(left,bottom,panelWidth,footerH,16*k);ctx.fill();
    ctx.fillStyle=accent;
    ctx.font=`750 ${eyebrowFont}px system-ui,sans-serif`;
    ctx.fillText('SOLUÇÃO',left+pad,bottom+17*k);
    ctx.fillStyle='#ffffff';
    ctx.font=`600 ${subFont}px system-ui,sans-serif`;
    fitLines(ctx,beat.solution,panelWidth-pad*2,2).forEach((line,i)=>
      ctx.fillText(line,left+pad,bottom+51*k+i*34*k));
  }
  // A three-stage progress bar makes timeline structure explicit.
  const markerY=height-19*k;
  ctx.fillStyle='rgba(255,255,255,.32)';
  ctx.fillRect(left,markerY,panelWidth,4*k);
  const t=Math.max(0,Math.min(1,sceneTime/presentation.beats[presentation.beats.length-1].end));
  ctx.fillStyle=accent;
  ctx.fillRect(left,markerY,panelWidth*t,4*k);
  ctx.restore();
}
