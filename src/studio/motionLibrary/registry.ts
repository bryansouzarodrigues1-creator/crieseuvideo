import {z} from 'zod';

/**
 * Typed, deterministic motion graphics primitives. AI chooses PARAMETERS, not
 * arbitrary JavaScript, for the R$1 introduction bundle. No HTTP, fonts,
 * external images, timers, random numbers, or unsafe code evaluation.
 */
const base=z.object({
 duration:z.number().min(1).max(15),
 theme:z.enum(['midnight','paper','ocean']).default('midnight'),
});
const title=base.extend({
 kind:z.literal('title-card'),
 title:z.string().trim().min(1).max(60),
 subtitle:z.string().trim().max(90).default(''),
}).strict();
const stat=base.extend({
 kind:z.literal('stat-bars'),
 title:z.string().trim().min(1).max(60),
 bars:z.array(z.object({
  label:z.string().trim().min(1).max(18),
  value:z.number().min(0).max(100),
 }).strict()).min(2).max(4),
}).strict();
const comparison=base.extend({
 kind:z.literal('comparison'),
 title:z.string().trim().min(1).max(60),
 left:z.string().trim().min(1).max(40),
 right:z.string().trim().min(1).max(40),
}).strict();
const steps=base.extend({
 kind:z.literal('steps'),
 title:z.string().trim().min(1).max(60),
 steps:z.array(z.string().trim().min(1).max(40)).min(2).max(4),
}).strict();
export const MotionClipSchema=z.discriminatedUnion('kind',[title,stat,comparison,steps]);
export type MotionClip=z.infer<typeof MotionClipSchema>;
export const MotionVideoSchema=z.object({
 version:z.literal(1),
 clips:z.array(MotionClipSchema).min(1).max(3),
}).strict().superRefine((v,ctx)=>{
 const total=v.clips.reduce((s,c)=>s+c.duration,0);
 if(total>15)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Vídeo de entrada limitado a 15s.'});
});
export type MotionVideo=z.infer<typeof MotionVideoSchema>;
export const MOTION_LIBRARY_IDS=['title-card','stat-bars','comparison','steps'] as const;

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const ease=(x:number)=>{const c=clamp(x);return c*c*(3-2*c);};
const themes={
 midnight:{back:'#0B1221',text:'#F8FAFC',sub:'#B6C6DB',accent:'#67E8F9',panel:'#172C45'},
 paper:{back:'#F7F4ED',text:'#111827',sub:'#475569',accent:'#E67E22',panel:'#EDE4D2'},
 ocean:{back:'#071D33',text:'#F8FAFC',sub:'#BCD5E8',accent:'#27C2F7',panel:'#103453'},
} as const;

export function renderMotionClip(
 ctx:CanvasRenderingContext2D,width:number,height:number,clip:MotionClip,seconds:number
):void{
 if(width<=0||height<=0||!Number.isFinite(seconds))throw new Error('Canvas/tempo inválidos');
 const color=themes[clip.theme],t=clamp(seconds/clip.duration);
 const visibleBottom=height*0.80; // reserved lower zone for captions
 ctx.save();
 try{
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle=color.back;ctx.fillRect(0,0,width,height);
  ctx.fillStyle=color.accent;ctx.fillRect(0,0,width,Math.max(7,height*.008));
  ctx.textAlign='left';
  const pad=width*.08;
  ctx.globalAlpha=ease(t*8);
  ctx.fillStyle=color.sub;ctx.font=`600 ${Math.round(width*.035)}px sans-serif`;
  ctx.fillText('CRIESEUVIDEO',pad,height*.12);
  ctx.globalAlpha=1;
  const heading=(v:string,y:number,size=.065)=>{
    ctx.fillStyle=color.text;ctx.font=`800 ${Math.round(width*size)}px sans-serif`;
    ctx.fillText(v,pad,y,width-pad*2);
  };
  if(clip.kind==='title-card'){
   const dy=(1-ease(t*6))*height*.09;
   heading(clip.title,visibleBottom*.42+dy,.078);
   ctx.globalAlpha=ease(t*4-0.2);
   ctx.fillStyle=color.sub;ctx.font=`500 ${Math.round(width*.042)}px sans-serif`;
   ctx.fillText(clip.subtitle,pad,visibleBottom*.56,width-pad*2);
   ctx.globalAlpha=1;
   ctx.fillStyle=color.accent;ctx.fillRect(pad,visibleBottom*.65,(width-pad*2)*ease(t*2),height*.01);
  }else if(clip.kind==='stat-bars'){
   heading(clip.title,visibleBottom*.23);
   const row=visibleBottom*.60/clip.bars.length;
   const growth=ease(t*1.7);
   clip.bars.forEach((bar,i)=>{
    const y=visibleBottom*.30+i*row;
    ctx.fillStyle=color.sub;ctx.font=`600 ${Math.round(width*.035)}px sans-serif`;
    ctx.fillText(bar.label,pad,y-8,width-pad*2);
    ctx.fillStyle=color.panel;ctx.fillRect(pad,y,width-pad*2,height*.03);
    ctx.fillStyle=color.accent;ctx.fillRect(pad,y,(width-pad*2)*bar.value/100*growth,height*.03);
   });
  }else if(clip.kind==='comparison'){
   heading(clip.title,visibleBottom*.24);
   const gap=width*.025,left=pad,cell=(width-pad*2-gap)/2, y=visibleBottom*.34;
   ctx.fillStyle=color.panel;ctx.fillRect(left,y,cell,height*.29);
   ctx.fillRect(left+cell+gap,y,cell,height*.29);
   ctx.fillStyle=color.accent;ctx.fillRect(width/2-gap/2,y,gap,height*.29*ease(t*2));
   ctx.fillStyle=color.text;ctx.font=`700 ${Math.round(width*.040)}px sans-serif`;
   ctx.fillText(clip.left,left+width*.02,y+height*.14,cell-width*.04);
   ctx.fillText(clip.right,left+cell+gap+width*.02,y+height*.14,cell-width*.04);
  }else{
   heading(clip.title,visibleBottom*.21);
   const row=visibleBottom*.60/clip.steps.length;
   clip.steps.forEach((value,i)=>{
    const y=visibleBottom*.33+i*row;
    const progress=ease((t*clip.steps.length-i)*2);
    if(progress===0)return;
    ctx.globalAlpha=progress;ctx.fillStyle=color.accent;ctx.beginPath();
    ctx.arc(pad+width*.03,y,width*.026,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=color.text;ctx.font=`600 ${Math.round(width*.038)}px sans-serif`;
    ctx.fillText(value,pad+width*.09,y+width*.013,width*.72);
    ctx.globalAlpha=1;
   });
  }
 }finally{ctx.restore();}
}

/** A composition with deterministic, seekable frame output. */
export function createReusableMotionVideo(
 canvas:HTMLCanvasElement,input:unknown
):{duration:number;renderAt:(seconds:number)=>void;dispose:()=>void}{
 const parsed=MotionVideoSchema.parse(input);
 const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('Canvas 2D indisponível.');
 const duration=parsed.clips.reduce((s,c)=>s+c.duration,0);
 return {
  duration,
  renderAt(seconds:number){
   if(!Number.isFinite(seconds))throw new Error('Tempo inválido.');
   let local=Math.max(0,Math.min(duration,seconds));
   let clip=parsed.clips[parsed.clips.length-1];
   for(const current of parsed.clips){
    clip=current;
    if(local<=current.duration)break;
    local-=current.duration;
   }
   renderMotionClip(ctx,canvas.width,canvas.height,clip,Math.min(clip.duration,local));
  },
  dispose(){},
 };
}
