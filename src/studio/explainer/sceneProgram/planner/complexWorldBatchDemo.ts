/**
 * Hand-authored stress fixtures, NOT Gemini creations or fixed product presets.
 * Deliberately different silhouettes, moving structures and spatial depth.
 * The generic batch compiler accepts other scene proposals without these IDs.
 */
import {compileComplexWorldBatch} from './complexWorldBatch';

type Extra=Record<string,unknown>;
const box=(id:string,feature:string,color:string,size:number[],position:number[],extra:Extra={})=>({
  id,feature,color,position,geometry:{shape:'box',size},...extra
});
const cyl=(id:string,feature:string,color:string,size:number[],position:number[],extra:Extra={})=>({
  id,feature,color,position,geometry:{shape:'cylinder',size},...extra
});
const tube=(id:string,feature:string,color:string,points:number[][],position:number[],extra:Extra={})=>({
  id,feature,color,position,geometry:{shape:'tube',size:[.07],points},...extra
});
const extrude=(id:string,feature:string,color:string,contour:number[][],depth:number,position:number[],extra:Extra={})=>({
  id,feature,color,position,geometry:{shape:'extrude',contour,depth},...extra
});
const group=(id:string,position:number[],extra:Extra={})=>({
  id,kind:'group',position,...extra
});
const keys=(node:string,channel:string,points:{sourceId:string,phase:number,value:number[]}[])=>({
  node,channel,interpolation:'smooth',keys:points
});
const k=(sourceId:string,phase:number,value:number[])=>({sourceId,phase,value});
const sources=(a:string,b:string)=>[
  {sourceId:'s1',text:a,duration:3},
  {sourceId:'s2',text:b,duration:3}
];
const shots=(a:string[],b:string[],angle=.30)=>[
  {sourceId:'s1',subjects:a,azimuth:angle,endAzimuth:angle,elevation:.23,distance:1.09},
  {sourceId:'s2',subjects:b,azimuth:angle+.40,endAzimuth:angle+.42,elevation:.19,distance:1.12}
];

const ark={
  id:'ark',role:'prop',sourceId:'s1',name:'Arca de madeira com casco afilado e dois conveses',
  position:[0,.3,0],
  features:['casco','quilha','conves','cabine','telhado','vigas','janelas','guarda-corpo','porta','ornamentos'],
  parts:[
    extrude('hull','casco','#805638',[[-8,1.35],[7.1,1.35],[9.0,.75],[7.0,-1.1],[-6.9,-1.1],[-8.3,-.55]],5.2,[0,0,0]),
    extrude('keel','quilha','#573B2A',[[-7,-1.05],[7,-1.05],[5.6,-1.52],[-5.9,-1.5]],1.7,[0,0,0]),
    box('deck','conves','#B98553',[17.4,.24,6.15],[0,1.50,0]),
    // The animals now traverse a physical sloped boarding ramp, not the sea.
    box('gangway','conves','#D0A270',[1.8,.14,4.6],[3.55,1.18,4.9],
      {rotation:[.25,0,0]}),
    box('topdeck','conves','#B78B59',[11.5,.2,5.6],[-.3,5.0,0]),
    box('cabin','cabine','#B68A57',[11.4,3.6,5.25],[-.3,3.23,0]),
    extrude('roof','telhado','#5E4032',[[-6.4,0],[5.6,0],[4.8,1.4],[-5.7,1.4]],6.0,[-.3,5.0,0]),
    box('sidebeams','vigas','#6A4831',[.18,3.15,.24],[-5.5,3.05,2.56],
      {repeat:{count:9,step:[1.29,0,0],seed:1}}),
    box('rearbeams','vigas','#6A4831',[.18,3.15,.24],[-5.5,3.05,-2.56],
      {repeat:{count:9,step:[1.29,0,0],seed:2}}),
    box('ports-a','janelas','#2D4F61',[.75,.55,.05],[-4.9,3.75,2.66],
      {repeat:{count:7,step:[1.42,0,0],seed:3}}),
    box('ports-b','janelas','#2D4F61',[.75,.55,.05],[-4.9,3.75,-2.66],
      {repeat:{count:7,step:[1.42,0,0],seed:4}}),
    box('rail-a','guarda-corpo','#634531',[.10,.9,.13],[-7.4,1.95,2.92],
      {repeat:{count:13,step:[1.16,0,0],seed:5}}),
    box('rail-b','guarda-corpo','#634531',[.10,.9,.13],[-7.4,1.95,-2.92],
      {repeat:{count:13,step:[1.16,0,0],seed:6}}),
    box('rail-top-a','guarda-corpo','#634531',[15.1,.11,.15],[0,2.35,2.92]),
    box('rail-top-b','guarda-corpo','#634531',[15.1,.11,.15],[0,2.35,-2.92]),
    group('hatch',[3.55,2.75,2.72]),
    box('hatch-panel','porta','#62442F',[1.3,2.15,.18],[.65,0,0],{parent:'hatch'}),
    box('hatch-trim','porta','#D9BA79',[.13,1.96,.24],[.07,0,.10],{parent:'hatch'}),
    cyl('hatch-handle','porta','#D0B06B',[.09,.09,.13],[1.16,-.22,.16],{parent:'hatch'}),
    box('strakes','ornamentos','#D4A875',[15.1,.10,.13],[0,.36,2.68]),
    box('strakes2','ornamentos','#D4A875',[15.1,.10,.13],[0,.36,-2.68]),
    cyl('mast','ornamentos','#6B4834',[.11,.11,2.3],[-3.4,6.55,0]),
    box('banner','ornamentos','#E6CF90',[1.1,.65,.06],[-2.85,7.2,0])
  ]
};
const animals={
  id:'animals',role:'prop',sourceId:'s2',name:'Dois animais quadrúpedes de formas distintas',
  position:[3.55,1.0,6.2],features:['corpo','cabeca','patas','orelhas','cauda','olhos'],
  parts:[
    {id:'body',feature:'corpo',color:'#A47B53',position:[0,1.0,0],
      geometry:{shape:'capsule',size:[.49,1.15]},rotation:[0,0,Math.PI/2],
      repeat:{count:2,step:[0,0,1.45],seed:8}},
    {id:'head',feature:'cabeca',color:'#BA966D',position:[.78,1.12,0],
      geometry:{shape:'sphere',size:[.36]},repeat:{count:2,step:[0,0,1.45],seed:8}},
    box('feet-a','patas','#72543A',[.15,.78,.18],[-.54,.46,.28],
      {repeat:{count:2,step:[0,0,1.45],seed:8},mirror:undefined}),
    box('feet-b','patas','#72543A',[.15,.78,.18],[.52,.46,.28],
      {repeat:{count:2,step:[0,0,1.45],seed:8}}),
    {id:'ears',feature:'orelhas',color:'#9A7352',position:[.9,1.5,.24],
      geometry:{shape:'cone',size:[.12,.32]},repeat:{count:2,step:[0,0,1.45],seed:8}},
    tube('tail','cauda','#634833',[[0,.0,0],[-.25,.26,0],[-.4,.37,0]],[-.75,1.05,0],
      {repeat:{count:2,step:[0,0,1.45],seed:8}}),
    {id:'eyes',feature:'olhos',color:'#151E20',position:[.99,1.26,.28],
      geometry:{shape:'sphere',size:[.06]},repeat:{count:2,step:[0,0,1.45],seed:8}}
  ]
};
const compound={
  id:'compound',role:'environment',sourceId:'s1',name:'Prisão fortificada com torres e pátio interno',
  features:['muralhas','forte','torres','coberturas','janelas','cercas','arame','portao','holofotes','celas','passarelas'],
  parts:[
    box('leftwall','muralhas','#868D91',[8.6,6.2,1.4],[-7.4,3.1,0]),
    box('rightwall','muralhas','#868D91',[8.6,6.2,1.4],[7.4,3.1,0]),
    box('backwall','muralhas','#7C8991',[22,7.1,1.2],[0,3.55,-13]),
    box('block','forte','#A6B0B6',[18,6.4,6.3],[0,3.2,-8.7]),
    box('towers','torres','#A0A9AD',[3.8,11.4,3.9],[-12.1,5.7,0],
      {repeat:{count:2,step:[24.2,0,0],seed:10}}),
    box('roofs','coberturas','#454E57',[4.5,.6,4.5],[-12.1,11.68,0],
      {repeat:{count:2,step:[24.2,0,0],seed:10}}),
    box('lookout','janelas','#1E3F58',[2.7,1.6,.11],[-12.1,9.25,2.0],
      {repeat:{count:2,step:[24.2,0,0],seed:10}}),
    box('fenceposts','cercas','#C5CBC5',[.11,2.1,.11],[-10.5,6.6,.6],
      {repeat:{count:37,step:[.60,0,0],seed:1}}),
    box('fencebar','cercas','#A6BCC3',[22,.11,.11],[0,7.55,.62]),
    {id:'razor',feature:'arame',position:[-10.2,7.75,.62],color:'#B8BEC1',
      geometry:{shape:'torus',size:[.34,.07]},rotation:[Math.PI/2,0,0],
      repeat:{count:30,step:[.70,0,0],seed:11}},
    group('gate',[0,0,1.1]),
    box('gate-top','portao','#475762',[4.45,.38,.20],[0,4.2,0],{parent:'gate'}),
    box('gate-bottom','portao','#475762',[4.45,.35,.20],[0,.2,0],{parent:'gate'}),
    box('gate-bars','portao','#C1C8CC',[.16,3.72,.20],[-2.05,2.12,0],
      {parent:'gate',repeat:{count:12,step:[.37,0,0],seed:4}}),
    box('light-posts','holofotes','#EAE5C1',[.18,2.0,.18],[-12.1,12.90,0],
      {repeat:{count:2,step:[24.2,0,0],seed:10}}),
    {id:'lamps',feature:'holofotes',color:'#F8E5B4',position:[-12.1,13.85,.8],
      geometry:{shape:'cone',size:[.44,.75]},rotation:[Math.PI/2,0,0],
      material:{emissive:'#F1E0A0',emissiveIntensity:.9},
      repeat:{count:2,step:[24.2,0,0],seed:10}},
    box('cellframes','celas','#485D6D',[1.25,1.55,.10],[-7.7,4.0,-5.45],
      {repeat:{count:8,step:[2.2,0,0],seed:3}}),
    box('cellbars','celas','#D5DEE1',[.10,1.4,.13],[-8.1,4.0,-5.36],
      {repeat:{count:22,step:[.7,0,0],seed:3}}),
    box('walkway','passarelas','#596670',[22,.22,2.0],[0,6.34,-.8]),
    box('guards','passarelas','#BFC8C7',[.13,1.05,.13],[-10.5,6.82,-1.3],
      {repeat:{count:27,step:[.80,0,0],seed:2}})
  ]
};
const patrol={
  id:'patrol',role:'prop',sourceId:'s2',name:'Viatura de patrulha passando pelo portão',
  position:[0,.5,8],features:['carroceria','vidros','rodas','sinalizador','farol'],
  parts:[
    extrude('body','carroceria','#303D50',[[-2,-.3],[2,-.3],[2,.4],[1.2,.5],[.6,1.3],[-1.2,1.3],[-1.75,.55]],1.45,[0,0,0]),
    box('windows','vidros','#4A7690',[1.8,.62,.08],[-.2,.66,.75],{mirror:'z'}),
    {id:'wheels','feature':'rodas',color:'#202A2D',position:[-1.25,-.33,.81],
      geometry:{shape:'torus',size:[.48,.14]},mirror:'z'},
    {id:'wheels2','feature':'rodas',color:'#202A2D',position:[1.30,-.33,.81],
      geometry:{shape:'torus',size:[.48,.14]},mirror:'z'},
    box('beacon','sinalizador','#D65444',[.9,.18,.38],[0,1.49,0],
      {material:{emissive:'#B44233',emissiveIntensity:.9}}),
    box('headlights','farol','#E8E9C4',[.12,.26,.31],[2.04,.1,.48],{mirror:'z'})
  ]
};
const bike={
  id:'bike',role:'prop',sourceId:'s1',name:'Motocicleta esportiva detalhada com chassi e transmissão',
  position:[-4,0,0],
  features:['carenagem','tanque','banco','chassi','motor','rodas','raios','garfo','guidao','farol','escape','suspensao','paralama'],
  parts:[
    extrude('fairing','carenagem','#D0432E',[[-1.2,.35],[.1,.45],[1.25,.65],[1.05,1.1],[.45,1.37],[-.66,1.04]],.59,[0,0,0]),
    extrude('tank','tanque','#E3593D',[[-.7,1.06],[.35,1.07],[.63,1.37],[.05,1.62],[-.55,1.48]],.61,[0,0,0]),
    box('seat','banco','#20252B',[1.32,.16,.6],[-.9,1.36,0]),
    tube('chassis','chassi','#ADB7C0',[[-1.05,.76,0],[.55,.66,0],[.12,1.21,0],[-1.05,.76,0]],[0,0,0]),
    cyl('engine','motor','#70767A',[.43,.43,.55],[-.1,.7,0],{rotation:[Math.PI/2,0,0]}),
    box('fins','motor','#9DA5A7',[.92,.08,.66],[-.12,.59,0],
      {repeat:{count:5,step:[0,.12,0],seed:6}}),
    group('fwheel',[1.14,.66,0]),
    {id:'fronttire',parent:'fwheel',feature:'rodas',color:'#1E2328',
      geometry:{shape:'torus',size:[.62,.14]}},
    {id:'frontrim',parent:'fwheel',feature:'rodas',color:'#B0BEC6',
      geometry:{shape:'torus',size:[.42,.06]}},
    box('frontspoke1','raios','#DEE2E0',[.10,1.08,.055],[0,0,0],{parent:'fwheel'}),
    box('frontspoke2','raios','#DEE2E0',[1.08,.10,.055],[0,0,0],{parent:'fwheel'}),
    group('rwheel',[-1.30,.66,0]),
    {id:'reartire',parent:'rwheel',feature:'rodas',color:'#1E2328',
      geometry:{shape:'torus',size:[.62,.14]}},
    {id:'rearrim',parent:'rwheel',feature:'rodas',color:'#B0BEC6',
      geometry:{shape:'torus',size:[.42,.06]}},
    box('rearspoke1','raios','#DEE2E0',[.10,1.08,.055],[0,0,0],{parent:'rwheel'}),
    box('rearspoke2','raios','#DEE2E0',[1.08,.10,.055],[0,0,0],{parent:'rwheel'}),
    tube('forka','garfo','#9DA9B2',[[1.15,.66,.4],[1.0,1.46,.35],[.82,1.63,.30]],[0,0,0]),
    tube('forkb','garfo','#9DA9B2',[[1.15,.66,-.4],[1.0,1.46,-.35],[.82,1.63,-.30]],[0,0,0]),
    tube('handle','guidao','#363F46',[[.73,1.54,-.62],[.93,1.65,0],[.73,1.54,.62]],[0,0,0]),
    cyl('lamp','farol','#E3E9DD',[.33,.33,.28],[1.22,1.28,0],
      {rotation:[Math.PI/2,0,0],material:{emissive:'#E9E6C5',emissiveIntensity:.6}}),
    tube('exhaust','escape','#B4BAB9',[[-.65,.56,-.42],[-1.32,.72,-.5],[-1.92,.9,-.5]],[0,0,0]),
    cyl('muffler','escape','#6A747E',[.18,.18,.75],[-1.68,.9,-.5],{rotation:[0,0,Math.PI/2]}),
    cyl('rearshock','suspensao','#D9C981',[.13,.13,.55],[-.9,.75,.34],{rotation:[0,0,-.5]}),
    extrude('fender','paralama','#D0432E',[[.3,1.32],[.72,1.4],[1.2,1.3],[1.3,1.08],[.93,1.12]],.72,[0,0,0])
  ]
};
const street={
  id:'street',role:'environment',sourceId:'s1',name:'Avenida com faixa central e loja',
  features:['asfalto','faixas','loja','vitrines','postes','calcada'],
  parts:[
    box('asphalt','asfalto','#3D454B',[46,.14,12],[0,-.10,0]),
    box('line','faixas','#E4D8AD',[2.2,.018,.14],[-20,-.02,0],
      {repeat:{count:16,step:[2.7,0,0],seed:9}}),
    box('store','loja','#8B9EAA',[8,5.7,4.5],[0,2.85,-8.5]),
    box('shopglass','vitrines','#416E82',[6.2,3.1,.08],[0,2.8,-6.22]),
    cyl('lamps','postes','#536977',[.08,.08,5.4],[-17,2.7,-5.5],
      {repeat:{count:6,step:[6.8,0,0],seed:11}}),
    box('sidewalk','calcada','#9DA19B',[45,.22,4.3],[0,.0,-7])
  ]
};
const floor=(sourceId:string,size:number[],color:string)=>({
  id:'ground',kind:'mesh',contextSourceId:sourceId,color,
  position:[0,-.18,0],geometry:{shape:'box',size}
});
const storyboard=(background:string,nodes:unknown[],tracks:unknown[],a:string[],b:string[],azimuth=.30)=>({
  version:1,background,nodes,tracks,shots:shots(a,b,azimuth),contacts:[]
});
const vessel={
  id:'noahs-ark',
  sources:sources('Uma grande arca de madeira balança sobre o oceano em meio às nuvens.',
    'Uma porta da arca se abre enquanto um par de animais caminha para o convés.'),
  sceneProgram:storyboard('#96C9D8',[
    // A world-sized platform is never used to frame the camera.
  ],[
    keys('ark','position',[k('s1',0,[0,.3,0]),k('s1',1,[.18,.48,0]),k('s2',1,[.3,.34,0])]),
    keys('ark-hatch','rotation',[k('s1',0,[0,0,0]),k('s2',0,[0,0,0]),k('s2',1,[0,-1.12,0])]),
    keys('animals','position',[k('s1',0,[3.55,1.0,6.2]),k('s2',0,[3.55,1.0,6.2]),k('s2',1,[3.55,2.0,3.4])])
  ],['ark'],['ark-hatch','animals'],.43),
  worldBlueprints:{version:1,objects:[ark,animals]},
  worldScenery:{version:1,regions:[
    {id:'ocean',sourceId:'s1',shape:'water',size:[80,80],
      position:[0,-.30,0],color:'#387F9A',wave:.25,segments:32,seed:3},
    {id:'sky-cloud-1',sourceId:'s1',shape:'cloud',size:[7],
      position:[-13,9,-17],color:'#F6F2E8',seed:4},
    {id:'sky-cloud-2',sourceId:'s1',shape:'cloud',size:[5],
      position:[15,10,-19],color:'#FFFFFF',seed:8}
  ]}
};
const penitentiary={
  id:'security-prison',
  sources:sources('Uma prisão de segurança máxima é vigiada por torres, cercas e holofotes.',
    'O portão blindado desliza e uma viatura atravessa a entrada.'),
  sceneProgram:storyboard('#93AAB5',[floor('s1',[95,.3,95],'#676E71')],[
    keys('compound-gate','position',[k('s1',0,[0,0,1.1]),k('s2',0,[0,0,1.1]),k('s2',1,[4.2,0,1.1])]),
    keys('patrol','position',[k('s1',0,[0,.5,8]),k('s2',0,[0,.5,8]),k('s2',1,[0,.5,-3.5])])
  ],['compound'],['compound-gate','patrol'],.25),
  worldBlueprints:{version:1,objects:[compound,patrol]},
  worldScenery:{version:1,regions:[
    {id:'gray-clouds',sourceId:'s1',shape:'cloud',size:[5],
      position:[13,13,-23],color:'#DDE1E2',seed:9},
    {id:'yard-rock',sourceId:'s1',shape:'rock',size:[1.0],
      position:[8,.5,8],color:'#9C9995',seed:6}
  ]}
};
const motorcycle={
  id:'sport-motorcycle',
  sources:sources('Uma motocicleta esportiva mostra carenagem, motor, suspensão e rodas.',
    'A motocicleta acelera pela avenida, fazendo as rodas girarem.'),
  sceneProgram:storyboard('#AFDCE5',[],[
    keys('bike','position',[k('s1',0,[-4,0,0]),k('s1',1,[-2.9,0,0]),k('s2',1,[5,0,0])]),
    keys('bike-fwheel','rotation',[k('s1',0,[0,0,0]),k('s1',1,[0,0,-1.8]),k('s2',1,[0,0,-14.5])]),
    keys('bike-rwheel','rotation',[k('s1',0,[0,0,0]),k('s1',1,[0,0,-1.8]),k('s2',1,[0,0,-14.5])])
  ],['bike'],['bike'],.30),
  worldBlueprints:{version:1,objects:[bike,street]},
  worldScenery:{version:1,regions:[
    {id:'road-tree-one',sourceId:'s1',shape:'tree',size:[4],
      position:[-7,0,-9],color:'#66543F',foliage:'#53834A',seed:10},
    {id:'road-tree-two',sourceId:'s1',shape:'tree',size:[5],
      position:[10,0,-10],color:'#68593F',foliage:'#467B5A',seed:13},
    {id:'road-cloud',sourceId:'s1',shape:'cloud',size:[3.2],
      position:[0,11,-21],color:'#FFFFFF',seed:8}
  ]}
};
export const COMPLEX_WORLD_QA_REQUEST={version:1,clips:[vessel,penitentiary,motorcycle]};
export function buildComplexWorldBatchDemo(){
  return compileComplexWorldBatch(COMPLEX_WORLD_QA_REQUEST);
}
/** Mobile browser entry: compile only the selected scene instead of compiling
 * the arca, prison and motorcycle into three huge scene graphs on every click. */
export function buildComplexWorldClipDemo(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= COMPLEX_WORLD_QA_REQUEST.clips.length) {
    throw new Error('Cena 3D não encontrada.');
  }
  return compileComplexWorldBatch({
    version: 1,
    clips: [COMPLEX_WORLD_QA_REQUEST.clips[index]],
  }).clips[0]!;
}

