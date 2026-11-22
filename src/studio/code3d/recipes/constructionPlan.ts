import { validDuration } from '../contract';

export const CONSTRUCTION_STAGES = ['projects','piles','caps','columns','beams','floors','partitions','facade','roof','services','finishes','parking'] as const;
export type ConstructionStage = typeof CONSTRUCTION_STAGES[number];
export type ConstructionShot = {
  start: number; end: number; target: [number,number,number]; direction: [number,number,number]; span: number;
  kind?: 'wide' | 'cutaway' | 'plan' | 'entrance' | 'escalator' | 'corridor' | 'cinema';
};
export type ConstructionRecipe = {
  area?: number; floors?: number; totalCost?: number; timelineDuration?: number; clipStart?: number; clipDuration?: number;
  title?: string; footprint?: [number,number][]; hookEnd?: number;
  timings?: Partial<Record<ConstructionStage,[number,number]>>;
  costs?: [number,number][]; shots?: ConstructionShot[];
  timeMap?: { start: number; duration: number; source: number; rate?: number }[];
  captions?: { start: number; end: number; text: string }[];
};
const BASE = { projects:[6,17],piles:[27,30],caps:[33,35],columns:[36,39.8],beams:[37.8,42],floors:[42.4,45],partitions:[46,49],facade:[51,59.5],roof:[60.5,65],services:[66,75],finishes:[77,94],parking:[95,101] };
const numeric=(v:number|undefined,d:number,min:number,max:number,name:string)=>{const n=v===undefined?d:v;if(!Number.isFinite(n)||n<min||n>max)throw new Error(`${name} fora do intervalo permitido.`);return n;};
const finiteVector=(v:number[],n:number)=>v.length===n&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<=10000);

/** A reusable scene compiler; the resulting string runs only in the existing opaque sandbox. */
export function normalizeConstructionRecipe(input: ConstructionRecipe = {}) {
  const timelineDuration=numeric(input.timelineDuration,10,8,180,'Duração da linha do tempo');
  const clipDuration=validDuration(input.clipDuration);if(clipDuration===null||clipDuration>12)throw new Error('O clipe precisa ter entre 8 e 12 segundos.');
  const clipStart=numeric(input.clipStart,0,0,timelineDuration-clipDuration,'Início do clipe');
  const area=numeric(input.area,40000,8000,120000,'Área'),floors=numeric(input.floors,2,1,4,'Pavimentos');
  if(!Number.isInteger(floors))throw new Error('Pavimentos precisa ser inteiro.');
  const totalCost=numeric(input.totalCost,240000000,0,1e11,'Custo ilustrativo');
  const scale=timelineDuration/134, timings={} as Record<ConstructionStage,[number,number]>;
  for(const key of CONSTRUCTION_STAGES){const pair=input.timings?.[key]??BASE[key].map(x=>x*scale) as [number,number];if(!finiteVector(pair,2)||pair[0]<0||pair[1]<=pair[0]||pair[1]>180)throw new Error(`Intervalo inválido: ${key}`);timings[key]=pair;}
  const footprint=input.footprint??[[-60,-40],[-40,-60],[40,-60],[60,-40],[60,32],[26,50],[18,50],[18,120],[-18,120],[-18,50],[-26,50],[-60,32]];
  if(footprint.length<3||footprint.length>32||!footprint.every(p=>finiteVector(p,2)))throw new Error('Contorno inválido.');
  const polygonArea=Math.abs(footprint.reduce((sum,p,i)=>{const q=footprint[(i+1)%footprint.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
  if(polygonArea<1)throw new Error('O contorno precisa ter área.');
  const shots=input.shots??[
    {start:0,end:timelineDuration*.07,target:[0,4,25],direction:[.55,.9,1],span:390},
    {start:timelineDuration*.07,end:timelineDuration*.25,target:[0,0,20],direction:[.3,1.2,1],span:290,kind:'plan'},
    {start:timelineDuration*.25,end:timelineDuration*.36,target:[-12,-7,30],direction:[.8,.4,1],span:85,kind:'cutaway'},
    {start:timelineDuration*.36,end:timelineDuration*.72,target:[0,5,25],direction:[.5,.85,1],span:290},
    {start:timelineDuration*.72,end:timelineDuration,target:[0,7,35],direction:[.6,.8,1],span:350},
  ] as ConstructionShot[];
  for(const s of shots)if(![s.start,s.end,s.span].every(Number.isFinite)||s.start<0||s.end>180||!finiteVector(s.target,3)||!finiteVector(s.direction,3)||s.direction.every(x=>x===0)||s.end<=s.start||s.span<15||s.span>1000)throw new Error('Enquadramento inválido.');
  const costs=input.costs??[[0,0],[17*scale,.025*totalCost],[35*scale,.1333333333*totalCost],[45*scale,.3583333333*totalCost],[59.5*scale,.4833333333*totalCost],[65*scale,.55*totalCost],[75*scale,.8*totalCost],[94*scale,.95*totalCost],[101*scale,totalCost]];
  if(costs.length<2||costs.some((p,i)=>p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>180||p[1]<0||p[1]>1e11||(i>0&&(p[0]<=costs[i-1][0]||p[1]<costs[i-1][1]))))throw new Error('Contador inválido.');
  const timeMap=input.timeMap??[{start:0,duration:timelineDuration,source:0,rate:1}];
  for(const m of timeMap)if(![m.start,m.duration,m.source,m.rate??1].every(Number.isFinite)||m.start<0||m.duration<=0||m.source<0||(m.rate??1)<0||(m.rate??1)>2)throw new Error('Mapa de tempo inválido.');
  const captions=input.captions??[{start:0,end:timelineDuration*.25,text:'Do projeto à fundação.'},{start:timelineDuration*.25,end:timelineDuration*.7,text:'Cada peça entra na sua etapa.'},{start:timelineDuration*.7,end:timelineDuration,text:'O mesmo edifício, pronto.'}];
  if(captions.some(c=>!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.end<=c.start||typeof c.text!=='string'||c.text.length>120))throw new Error('Legenda inválida.');
  const config={area,floors,totalCost,timelineDuration,clipStart,clipDuration,title:(input.title??'CUSTO ILUSTRATIVO').slice(0,50),footprint,polygonArea,hookEnd:numeric(input.hookEnd,6*scale,0,180,'Fim da abertura'),timings,costs,shots,timeMap,captions};
  return config;
}
