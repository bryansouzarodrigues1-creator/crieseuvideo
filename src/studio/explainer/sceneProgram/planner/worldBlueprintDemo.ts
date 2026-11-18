/**
 * Visual QA fixture: three different generated-by-schema 3D assemblies.
 *
 * These are hand-authored EXAMPLES of valid Gemini output, not a closed
 * library of objects and not an actual Gemini invocation. The engine uses
 * the same generic compiler for any other valid shape, feature and grouping.
 */
import type { ProgramNode, SceneProgram } from '../score';
import { compileStoryMotion } from './choreographer';
import { buildMechanicalScenario, type MechanicalSetting } from './mechanicalScenarios';
import { compileWorldBlueprints } from './worldBlueprints';

const box=(id:string,feature:string,color:string,size:number[],position:number[],
  extra:Record<string,unknown>={})=>
  ({id,feature,color,position,geometry:{shape:'box',size,bevel:.04},...extra});
const cylinder=(id:string,feature:string,color:string,size:number[],position:number[],
  extra:Record<string,unknown>={})=>
  ({id,feature,color,position,geometry:{shape:'cylinder',size},...extra});

function design(setting:MechanicalSetting):unknown {
  const toolbox={
    id:'cargo',role:'prop',sourceId:'s1',name:'Caixa de ferramentas detalhada com travas',
    position:[0,.36,0],features:['carcaca','tampa','alca','travas'],
    parts:[
      box('carcaca','carcaca','#357E90',[1.05,.58,.74],[0,.25,0]),
      box('tampa','tampa','#4EA9B4',[1.12,.16,.79],[0,.61,0]),
      {id:'alca',feature:'alca',color:'#1E3845',position:[0,.77,0],
        rotation:[Math.PI/2,0,0],geometry:{shape:'torus',size:[.17,.07]}},
      box('travas','travas','#E5C06D',[.14,.19,.065],[-.35,.58,.40],
        {mirror:'x'})
    ]
  };
  const streetCart={
    id:'cargo',role:'prop',sourceId:'s1',name:'Carrinho de carga industrial com rodas',
    position:[0,.36,0],features:['chassi','rodas','carga','alca'],
    parts:[
      box('chassi','chassi','#C4683D',[2.0,.34,1.0],[0,.22,0]),
      {id:'rodas',feature:'rodas',color:'#222B32',
        position:[.70,-.07,.52],rotation:[Math.PI/2,0,0],
        geometry:{shape:'torus',size:[.28,.09]},mirror:'z'},
      {id:'rodas2',feature:'rodas',color:'#222B32',
        position:[-.70,-.07,.52],rotation:[Math.PI/2,0,0],
        geometry:{shape:'torus',size:[.28,.09]},mirror:'z'},
      box('carga','carga','#BDB9A8',[1.35,.68,.72],[0,.73,0]),
      {id:'alca',feature:'alca',color:'#5E7683',position:[-1.15,.45,0],
        geometry:{shape:'tube',size:[.06],
          points:[[0,0,-.40],[-.14,.55,-.40],[-.14,.55,.40],[0,0,.40]]}}
    ]
  };
  const boat={
    id:'cargo',role:'prop',sourceId:'s1',name:'Pequeno barco de pesca com cabine e janelas',
    position:[0,.2,0],features:['casco','convés','cabine','janelas','bandeira'],
    parts:[
      box('casco','casco','#E7E1C8',[2.8,.56,1.32],[0,.21,0]),
      box('conves','convés'.normalize('NFD').replace(/[\u0300-\u036f]/g,''),'#325D77',[2.4,.12,1.10],[0,.52,0]),
      box('cabine','cabine','#F3C26F',[.98,.84,.84],[-.44,.91,0]),
      box('janelas','janelas','#397A9B',[.56,.36,.07],[-.44,1.01,.435],{mirror:'z'}),
      cylinder('bandeira','bandeira','#E3E9ED',[.035,.035,.85],[.88,1.30,0]),
      box('estandarte','bandeira','#DA7745',[.42,.22,.03],[1.11,1.59,0])
    ]
  };
  // Keep this as deliberate source data, not a lookup inside a production
  // object registry or a user-facing choice list.
  const cargo=setting==='workshop'?toolbox:setting==='city'?streetCart:boat;
  const environment=setting==='workshop'
    ? {id:'toolrack',role:'environment',sourceId:'s1',name:'Estante de ferramentas',
       features:['suportes','equipamentos'],position:[-4,0,-3.2],
       parts:[
         box('suportes','suportes','#506879',[.16,2.8,.13],[0,1.4,0],
           {repeat:{count:3,step:[1.35,0,0],jitter:[0,0,0],seed:2}}),
         box('equipamentos','equipamentos','#D9A44C',[.75,.18,.42],[.5,1.2,.08],
           {repeat:{count:3,step:[1.35,0,0],jitter:[0,0,0],seed:7}})
       ]}
    : setting==='city'
    ? {id:'streetlights',role:'environment',sourceId:'s1',name:'Postes urbanos com luz',
       features:['hastes','luminarias'],position:[-6,0,3],
       parts:[
         cylinder('hastes','hastes','#718A94',[.065,.065,3.6],[0,1.8,0],
           {repeat:{count:4,step:[3.8,0,0],jitter:[0,0,0],seed:8}}),
         box('luminarias','luminarias','#F4D68B',[.53,.16,.35],[0,3.67,.12],
           {repeat:{count:4,step:[3.8,0,0],jitter:[0,0,0],seed:8}})
       ]}
    : {id:'buoys',role:'environment',sourceId:'s1',name:'Boias de sinalização portuárias',
       features:['boias','marcas'],position:[-1,.05,-3],
       parts:[
         {id:'boias',feature:'boias',color:'#D5533D',position:[0,.2,0],
           geometry:{shape:'lathe',profile:[[0,0],[.24,0],[.30,.26],[.16,.42],[0,.53]]},
           repeat:{count:5,step:[2,0,0],jitter:[0,0,0],seed:5}},
         cylinder('marcas','marcas','#F0DD9A',[.07,.07,.28],[0,.75,0],
           {repeat:{count:5,step:[2,0,0],jitter:[0,0,0],seed:5}})
       ]};
  // The user script owns the semantic story; this proposal only specifies
  // appearance and the environment for that one source phrase.
  return {version:1,objects:[cargo,environment]};
}

export function buildWorldBlueprintPreview(setting:MechanicalSetting){
  const trial=buildMechanicalScenario(setting);
  const sourceNodes=trial.program.nodes;
  const descendants=new Set(['cargo']);
  let changed=true;
  while(changed){
    changed=false;
    for(const n of sourceNodes){
      if(n.parent&&descendants.has(n.parent)&&!descendants.has(n.id)){
        descendants.add(n.id);changed=true;
      }
    }
  }
  const kept=sourceNodes.filter(n=>!descendants.has(n.id));
  const world=compileWorldBlueprints(design(setting),trial.sources,kept);
  const tracks=trial.program.tracks.filter(t=>
    t.node!=='cargo'&&t.node!=='drum-shaft'&&t.node!=='small-gear-shaft');
  const base={...trial.program,nodes:[...kept,...world.nodes],tracks};
  const output=compileStoryMotion(trial.storyboard,base as unknown as SceneProgram,
    trial.sources,trial.bindings);
  return {...trial,program:output.program,worldAudit:world.audit,diagnostics:output.diagnostics};
}
