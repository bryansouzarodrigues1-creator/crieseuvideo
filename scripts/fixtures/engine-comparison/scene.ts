// Controlled authoring, NOT Gemini output. Only the existing public contracts.
import { normalizeSceneProgram, type ProgramSource } from '../../../src/studio/explainer/sceneProgram/score';
import type { ExplainerPlan } from '../../../src/studio/explainer/plan';

const house = (lit = false) => [
  {type:'house',x:180,y:180,size:1.1,color:lit?'#ffd27a':'#d1c4ae',anim:'none',delay:0},
  {type:'sun',x:290,y:-190,size:.45,anim:'none',delay:0},
];
// Deliberately stay within the existing 2D primitive and layout limits.
// No synthetic voice timings: empty text disables speech captions; action labels
// are a separate common mastering layer, and the native clock maps 7.2s to 12s.
export const plan: ExplainerPlan = {title:'Comparação solar',aspect:'9:16',scenes:[
  {text:'',visual:'custom',mood:'worried',palette:'teal',setting:'sky_day',drawing:[
    ...house(),{type:'person',x:-260,y:180,size:.8,color:'#ed9240',mood:'worried',anim:'shake',delay:0},
    {type:'xmark',x:150,y:-30,size:.42,anim:'pop',delay:.4}
  ] as any},
  {text:'',visual:'custom',mood:'neutral',palette:'teal',setting:'sky_day',drawing:[
    {type:'rect',x:0,y:90,w:650,h:350,color:'#b9ccdf',anim:'pop',delay:0},
    {type:'rect',x:0,y:90,w:560,h:270,color:'#174a89',anim:'pop',delay:.4},
    {type:'line',x:0,y:90,points:[[-240,-30],[240,-30],[240,65],[-240,65],[-240,160],[240,160]],color:'#77b9e9',size:.28,anim:'none',delay:.8},
    {type:'line',x:0,y:90,points:[[-155,-35],[-155,210],[0,210],[0,-35],[155,-35],[155,210]],color:'#77b9e9',size:.28,anim:'none',delay:1},
    {type:'check',x:280,y:-180,size:.35,anim:'pop',delay:1.65}
  ] as any},
  {text:'',visual:'custom',mood:'happy',palette:'teal',setting:'sky_day',drawing:[
    ...house(true),
    {type:'rect',x:-240,y:170,w:145,h:190,color:'#43b798',anim:'pop',delay:0},
    {type:'line',x:0,y:90,points:[[-160,160],[-70,160],[-70,230],[35,230]],color:'#ffd050',size:.7,anim:'none',delay:.25},
    {type:'check',x:80,y:-30,size:.42,anim:'pop',delay:.75}
  ] as any}
]};

export const sources: ProgramSource[] = [
 {sourceId:'s1',text:'Uma casa sem energia, bateria e peças de um painel solar.',duration:4},
 {sourceId:'s2',text:'O suporte e as células do painel solar se encaixam sob o vidro.',duration:4},
 {sourceId:'s3',text:'A bateria se conecta pelo cabo, a corrente passa e a janela da casa acende.',duration:4},
];
const nodes:any[]=[], tracks:any[]=[];
const group=(id:string,position:number[],more:any={})=>nodes.push({id,kind:'group',position,contextSourceId:'s1',...more});
const mesh=(id:string,shape:string,size:number[],color:string,position:number[],more:any={})=>nodes.push({id,kind:'mesh',position,color,geometry:{shape,size},contextSourceId:'s1',...more});
const curve=(node:string,channel:string,keys:[string,number,number[]][],interpolation='smooth')=>tracks.push({node,channel,interpolation,keys:keys.map(([sourceId,phase,value])=>({sourceId,phase,value}))});

mesh('ground','box',[22,.2,18],'#97bd9b',[0,-.12,0]);
group('house',[1.45,0,-1.8]);
mesh('walls','box',[2.25,2.1,1.8],'#eddbc0',[0,1.05,0],{parent:'house'});
// Roof is a triangular-prism mesh, not a rotated cube.
nodes.push({id:'roof',kind:'mesh',parent:'house',position:[0,2.1,0],color:'#ad6347',contextSourceId:'s1',geometry:{shape:'extrude',contour:[[-1.35,0],[1.35,0],[0,.93]],depth:2.15}});
mesh('door','box',[.56,1.25,.05],'#76523e',[.56,.625,.93],{parent:'house'});
mesh('window-frame','box',[.91,.84,.09],'#f6f1db',[-.53,1.35,.94],{parent:'house'});
mesh('window-dark','box',[.73,.65,.02],'#233e58',[-.53,1.35,1],{parent:'house'});
mesh('window-lit','box',[.73,.65,.025],'#ffe29b',[-.53,1.35,1.025],{parent:'house',scale:[.01,.01,.01],material:{emissive:'#ffce69',emissiveIntensity:.7}});
mesh('window-cross-v','box',[.045,.70,.04],'#efe5cc',[-.53,1.35,1.05],{parent:'house'});
mesh('window-cross-h','box',[.78,.045,.04],'#efe5cc',[-.53,1.35,1.05],{parent:'house'});
group('panel',[-1.2,0,.25],{rotation:[0,.08,0]});
mesh('leg-a','box',[.12,.8,.14],'#a5b6bd',[-.8,.4,.18],{parent:'panel'});
mesh('leg-b','box',[.12,.8,.14],'#a5b6bd',[.8,.4,.18],{parent:'panel'});
group('assembly',[0,.92,0],{parent:'panel',rotation:[-.32,0,0]});
mesh('support','box',[2.15,1.45,.12],'#d6e1e7',[0,0,0],{parent:'assembly'});
for(let row=0;row<2;row++)for(let col=0;col<3;col++){
 const id=`cell-${row}-${col}`,x=(col-1)*.65,y=(row-.5)*.66;
 mesh(id,'box',[.60,.60,.035],'#204f91',[x,y+2.5,.18],{parent:'assembly',contextSourceId:'s2'});
 const phase=.14+(row*3+col)*.085;
 curve(id,'position',[['s1',0,[x,y+2.5,.18]],['s1',1,[x,y+2.5,.18]],['s2',phase,[x,y+2.5,.18]],['s2',phase+.16,[x,y,.085]],['s3',1,[x,y,.085]]]);
}
mesh('glass','box',[1.99,1.31,.018],'#94d5ec',[0,3.7,.21],{parent:'assembly',contextSourceId:'s2',material:{opacity:.24}});
curve('glass','position',[['s1',0,[0,3.7,.21]],['s2',.73,[0,3.7,.21]],['s2',.95,[0,0,.12]],['s3',1,[0,0,.12]]]);
group('battery',[.12,0,1.15]);
mesh('battery-case','box',[.62,.76,.45],'#388b78',[0,.38,0],{parent:'battery'});
mesh('battery-top','box',[.68,.10,.49],'#263c4b',[0,.78,0],{parent:'battery'});
mesh('terminal','cylinder',[.05,.05,.12],'#f4ba49',[.15,.88,0],{parent:'battery'});
mesh('plug','box',[.17,.11,.15],'#f1b34c',[-.80,.9,1.15]);
curve('plug','position',[['s1',0,[-.80,.9,1.15]],['s3',.03,[-.80,.9,1.15]],['s3',.24,[.27,.9,1.15]],['s3',1,[.27,.9,1.15]]]);
nodes.push({id:'cable',kind:'mesh',position:[0,0,0],contextSourceId:'s3',color:'#3c4249',geometry:{shape:'tube',size:[.027],points:[[-1.1,.65,.45],[-.8,.2,1.15],[.12,.15,1.35],[.4,.2,.6],[.55,.5,-.75],[.9,1.1,-.75]]}});
for(let i=0;i<5;i++){
 const id=`energy-${i}`;mesh(id,'sphere',[.055],'#ffe46b',[-1.1,.65,.45],{contextSourceId:'s3',scale:[.01,.01,.01],material:{emissive:'#ffcf54',emissiveIntensity:.9}});
 const a=.24+i*.095,b=a+.31;
 curve(id,'scale',[['s1',0,[.01,.01,.01]],['s3',a-.01,[.01,.01,.01]],['s3',a,[1,1,1]],['s3',Math.min(.99,b),[1,1,1]]],'step');
 curve(id,'position',[['s1',0,[-1.1,.65,.45]],['s3',a,[-1.1,.65,.45]],['s3',a+.09,[-.1,.2,1.35]],['s3',a+.2,[.55,.5,-.75]],['s3',Math.min(.99,b),[.9,1.1,-.75]]],'linear');
}
curve('window-lit','scale',[['s1',0,[.01,.01,.01]],['s3',.51,[.01,.01,.01]],['s3',.54,[1,1,1]],['s3',1,[1,1,1]]]);
mesh('sun','sphere',[.46],'#f5cf68',[3.9,5.9,-5.6],{material:{emissive:'#efb951',emissiveIntensity:.5}});
// Actor remains a presenter: the engine's own pose system is visible, not a bespoke replacement.
nodes.push({id:'worker',kind:'actor',position:[-3.45,0,-.35],rotation:[0,.3,0],color:'#db8a47',contextSourceId:'s1'});
curve('worker','headRotation',[['s1',0,[0,.2,0]],['s1',1,[0,.2,0]],['s2',.4,[0,.55,0]],['s3',1,[0,.15,0]]]);
const shots=[
 {sourceId:'s1',subjects:['house','panel','battery','worker'],azimuth:.13,endAzimuth:.13,elevation:.20,distance:1.08},
 {sourceId:'s2',subjects:['panel'],azimuth:.08,endAzimuth:.08,elevation:.10,distance:1.06},
 {sourceId:'s3',subjects:['house','panel','battery'],azimuth:.13,endAzimuth:.13,elevation:.20,distance:1.08},
];
export const program=normalizeSceneProgram({version:1,background:'#a6d4e6',nodes,tracks,shots,contacts:[]},sources);
