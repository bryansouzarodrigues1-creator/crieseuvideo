import {describe,it,expect} from 'vitest';
import {createReusableMotionVideo,MOTION_LIBRARY_IDS,MotionVideoSchema} from './registry';

const sample={
 version:1,
 clips:[
  {kind:'title-card',duration:6,theme:'midnight',title:'Pequenos passos',subtitle:'Uma ideia vira um resultado.'},
  {kind:'stat-bars',duration:4,theme:'ocean',title:'Evolução',bars:[{label:'Antes',value:30},{label:'Depois',value:85}]},
  {kind:'steps',duration:5,theme:'paper',title:'Processo',steps:['Aprender','Executar','Melhorar']},
 ],
};
function recordingCanvas(){
 const trace:string[]=[];
 const op=new Set(['save','restore','clearRect','fillRect','fillText','beginPath','arc','fill']);
 const ctx=new Proxy({},{set(_o,k,v){trace.push(String(k)+'='+String(v));return true;},
  get(_o,k){if(op.has(String(k)))return (...args:unknown[])=>{trace.push(String(k)+'('+args.map(a=>String(a)).join(',')+')');};return undefined;}
 }) as unknown as CanvasRenderingContext2D;
 const canvas={width:720,height:1280,getContext:(type:string)=>type==='2d'?ctx:null} as HTMLCanvasElement;
 return {canvas,trace,clear:()=>{trace.length=0;}};
}
describe('motion library: deterministic 2D assets for the R$1 entry pack',()=>{
 it('enforces 15s maximum, allowed scene types and blocks untrusted code',()=>{
  expect(MOTION_LIBRARY_IDS).toHaveLength(4);
  expect(MotionVideoSchema.parse(sample).clips).toHaveLength(3);
  expect(MotionVideoSchema.safeParse({...sample,clips:[{kind:'arbitrary-js',duration:4,code:'fetch(\"//x\")'}]}).success).toBe(false);
  expect(MotionVideoSchema.safeParse({...sample,clips:[{kind:'title-card',duration:16,title:'Mais longo'}]}).success).toBe(false);
  expect(MotionVideoSchema.safeParse({...sample,clips:[{kind:'title-card',duration:10,title:'Um'},{kind:'title-card',duration:10,title:'Dois'}]}).success).toBe(false);
 });
 it('seeks arbitrary times and reproduces the exact same drawing operations',()=>{
  const {canvas,trace,clear}=recordingCanvas();
  const vid=createReusableMotionVideo(canvas,sample);
  expect(vid.duration).toBe(15);
  vid.renderAt(2.3);const first=[...trace];clear();
  vid.renderAt(13.4);const second=[...trace];clear();
  vid.renderAt(2.3);const repeated=[...trace];clear();
  expect(first).toEqual(repeated);
  expect(second).not.toEqual(first);
  vid.renderAt(15);expect(trace.length).toBeGreaterThan(10);
  vid.dispose();
 });
 it('bars and comparison share the same parameterized drawing contract',()=>{
  const {canvas,trace}=recordingCanvas();
  const vid=createReusableMotionVideo(canvas,{version:1,clips:[{
    kind:'comparison',duration:7,theme:'ocean',title:'Escolhas',
    left:'Antes',right:'Depois'
  }]});
  vid.renderAt(5);
  expect(trace.some(x=>x.includes('fillText(Antes'))).toBe(true);
  expect(trace.some(x=>x.includes('fillText(Depois'))).toBe(true);
  expect(()=>createReusableMotionVideo(canvas,{version:1,clips:[]})).toThrow();
 });
});