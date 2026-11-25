/** Development-only Chromium visual QA. Not a user-facing sample or AI output. */
import * as THREE from 'three';
import {compileCompactWorld} from './compactWorldDirector';
import {SceneProgram3D} from '../stage3d';
import {auditShotVisibilityAt} from '../shotVisibilityAudit';
import {sourceBriefsFromScript} from './aiWorldDirector';

const source=sourceBriefsFromScript(
  'O mecanismo se move dentro de um cenário completo com todos os objetos principais visíveis. '+
  'A segunda câmera mostra a ação acontecendo e a posição final do objeto.'
);
const threeBeatSource=sourceBriefsFromScript(
  'O guindaste levanta a carga cuidadosamente acima dos obstáculos do canteiro. '+
  'O carrinho leva a mesma carga suspensa até a plataforma de destino. '+
  'O cabo desce e apoia a carga na plataforma sem que o objeto desapareça.'
);

const data={
  crane:{
    version:1,setting:'industrial',background:'#C1D8E8',
    entities:[
      {id:'crane',name:'Guindaste com tambor de cabo',kind:'crane',at:[-2,0,0],size:[7,9,3],color:'#E5A944'},
      {id:'load',name:'Carga de materiais de construção',kind:'cargo',at:[1,1,0],size:[1.6,1.2,1.5],color:'#AC825D'},
    ],action:{target:'load',kind:'lift',delta:[0,3,0]},
  },
  craneSequence:{
    version:1,setting:'industrial',background:'#C1D8E8',
    entities:[
      {id:'crane',name:'Guindaste com carrinho suspenso',kind:'crane',at:[-2,0,0],size:[7,9,3],color:'#E5A944'},
      {id:'load',name:'Carga única em três operações',kind:'cargo',at:[0,0,0],size:[1.5,1,1],color:'#AC825D'},
      {id:'landing',name:'Plataforma elevada de recebimento',kind:'platform',at:[2.2,0,0],size:[2.4,1,2.8],color:'#839BA3'},
    ],
    actions:[
      {sourceId:'s1',target:'load',kind:'lift',delta:[0,4,0]},
      {sourceId:'s2',target:'load',kind:'move',delta:[2.2,0,0]},
      {sourceId:'s3',target:'load',kind:'lower',delta:[0,-3,0],onto:'landing'},
    ],
  },
  motorcycle:{
    version:1,setting:'city',background:'#BED6E7',
    entities:[
      {id:'street',name:'Conjunto de edifícios comerciais',kind:'building',at:[-6,0,-8],size:[7,10,4],color:'#879EAD'},
      {id:'motorbike',name:'Moto urbana em deslocamento',kind:'motorcycle',at:[0,0,1],size:[2.8,1.7,1.5],color:'#DB6742'},
    ],action:{target:'motorbike',kind:'drive',delta:[5,0,0]},
  },
  boat:{
    version:1,setting:'coast',background:'#9FCDE4',
    entities:[
      {id:'vessel',name:'Barco com cabine e convés',kind:'boat',at:[0,0,0],size:[12,5,4],color:'#E2E7E5'},
      {id:'warehouse',name:'Galpão nas proximidades do cais',kind:'building',at:[-6,0,-8],size:[7,6,3],color:'#A9B1B8'},
    ],action:{target:'vessel',kind:'sail',delta:[0,0,4]},
  },
} as const;

let renderer:THREE.WebGLRenderer|null=null;
let stage:SceneProgram3D|null=null;
let canvas:HTMLCanvasElement|null=null;

export function showCompactWorldForQA(kind:keyof typeof data,seconds?:number,width=360,height=640){
  stage?.dispose();
  renderer?.dispose();
  canvas?.remove();
  const clip=compileCompactWorld(data[kind],kind==='craneSequence'?threeBeatSource:source);
  canvas=document.createElement('canvas');
  canvas.id='compact-qa-canvas';
  canvas.style.cssText='position:fixed;top:0;left:0;z-index:99999;display:block;width:'+width+'px;height:'+height+'px;touch-action:none';
  document.body.appendChild(canvas);
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setPixelRatio(1);
  renderer.setSize(width,height,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  stage=new SceneProgram3D(clip.program,clip.sources);
  stage.render(renderer,seconds??0,width,height);
  const visibility=auditShotVisibilityAt(stage,seconds??0,width/height);
  return {kind,nodes:clip.program.nodes.length,objects:clip.audit.objectCount,visibility,
    parts:clip.audit.objectParts,tracks:clip.program.tracks.length,seconds:clip.duration,
    pixels:canvas.toDataURL('image/png').length,width,height};
}
