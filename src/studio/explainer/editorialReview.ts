import {drawExplainerFrame} from './render';
import {sceneDuration,type ExplainerPlan} from './plan';
export type ReviewIssue={scene:number;code:'empty_art'|'small_art'|'little_motion'|'repeated_background'|'repeated_art';message:string};
export type FrameMetric={coverage:number;motion:number};
export type EditorialReview={scenes:number;frames:number;metrics:FrameMetric[];issues:ReviewIssue[]};
const THRESHOLD=30;
/** Keep only pixels which differ from the independently rendered backdrop.
 * This prevents moving clouds or captions from counting as foreground action. */
export function extractArt(frame:Uint8ClampedArray,back:Uint8ClampedArray):Uint8ClampedArray{
 if(frame.length!==back.length||frame.length%4!==0)throw Error('Dimensões incompatíveis.');
 const art=new Uint8ClampedArray(frame.length);
 for(let i=0;i<frame.length;i+=4){
  if(Math.abs(frame[i]-back[i])+Math.abs(frame[i+1]-back[i+1])+Math.abs(frame[i+2]-back[i+2])<THRESHOLD)continue;
  art[i]=frame[i];art[i+1]=frame[i+1];art[i+2]=frame[i+2];art[i+3]=255;
 }
 return art;
}
export function coverage(art:Uint8ClampedArray){
 let n=0;for(let i=3;i<art.length;i+=4)if(art[i])n++;
 return n/(art.length/4||1);
}
export function frameDifference(a:Uint8ClampedArray,b:Uint8ClampedArray){
 if(a.length!==b.length||a.length%4!==0)throw Error('Dimensões incompatíveis.');
 let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])+Math.abs(a[i+3]-b[i+3])>=THRESHOLD)n++;
 return n/(a.length/4||1);
}
export function inspectEditorialFrames(plan:ExplainerPlan):EditorialReview{
 if(plan.engine==='3d')throw Error('A revisão editorial é exclusiva do 2D/2.5D.');
 const canvas=document.createElement('canvas');canvas.width=plan.aspect==='9:16'?216:384;canvas.height=plan.aspect==='9:16'?384:216;
 const c=canvas.getContext('2d',{willReadFrequently:true});if(!c)throw Error('Canvas indisponível.');
 const report:EditorialReview={scenes:plan.scenes.length,frames:0,metrics:[],issues:[]};
 let start=0,previousBack:Uint8ClampedArray|undefined,previousArt:Uint8ClampedArray|undefined;
 try{
 for(let i=0;i<plan.scenes.length;i++){
  const scene=plan.scenes[i],duration=sceneDuration(scene),arts:Uint8ClampedArray[]=[];
  let middleBack:Uint8ClampedArray|undefined;
  for(const f of [.2,.5,.8]){
   const t=start+duration*f;
   drawExplainerFrame(c,plan,t,'background');
   const back=c.getImageData(0,0,canvas.width,canvas.height).data;
   drawExplainerFrame(c,plan,t,'art');
   const full=c.getImageData(0,0,canvas.width,canvas.height).data;
   arts.push(extractArt(full,back));report.frames++;
   if(f===.5)middleBack=back;
  }
  const maxCoverage=Math.max(...arts.map(coverage));
  const motion=Math.max(frameDifference(arts[0],arts[1]),frameDifference(arts[1],arts[2]),frameDifference(arts[0],arts[2]));
  report.metrics.push({coverage:maxCoverage,motion});
  const add=(code:ReviewIssue['code'],message:string)=>report.issues.push({scene:i+1,code,message});
  if(scene.visual!=='city_night'){
   if(maxCoverage<.002)add('empty_art','Quase nenhum elemento principal visível nas três amostras.');
   else if(maxCoverage<.035)add('small_art','Arte principal ocupa pouco espaço; confira o enquadramento.');
   if(motion<.004)add('little_motion','Pouca mudança visual na ação entre as amostras.');
  }
  if(previousBack&&middleBack&&frameDifference(previousBack,middleBack)<.012)add('repeated_background','Fundo quase igual ao da cena anterior; confirme se há continuidade intencional.');
  if(previousArt&&maxCoverage>.005&&frameDifference(previousArt,arts[1])<.008)add('repeated_art','Composição principal quase igual à cena anterior.');
  previousBack=middleBack;previousArt=arts[1];start+=duration;
 }
 return report;
 }finally{canvas.width=1;canvas.height=1;}
}
