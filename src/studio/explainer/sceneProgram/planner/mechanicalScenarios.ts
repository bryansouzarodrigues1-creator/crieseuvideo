/**
 * Three independent, deliberately simple integration fixtures.
 * These are QA scenes, NOT templates exposed as user stories or AI outputs.
 * Purpose: prove that the same causal motor-to-output coupling works in
 * distinct 3D settings and with different props. Scenic terrain/water/forest
 * generation is owned separately by the scenery-kit branch.
 */
import { normalizeSceneProgram, type ProgramSource, type SceneProgram } from '../score';
import { compileStoryEvents, type CompiledStoryboard } from './events';
import { compileStoryMotion, type StoryMotionBindings } from './choreographer';

export type MechanicalSetting = 'workshop'|'city'|'harbor';
export interface MechanicScenario {
  setting:MechanicalSetting;
  sources:ProgramSource[];
  storyboard:CompiledStoryboard;
  program:SceneProgram;
  bindings:StoryMotionBindings;
}

const s='s1';
const group=(id:string,position:number[],parent?:string)=>
  ({id,kind:'group',contextSourceId:s,position,...(parent?{parent}:{})});
const mesh=(id:string,shape:string,size:number[],color:string,position:number[],parent?:string,extra:Record<string,unknown>={})=>
  ({id,kind:'mesh',contextSourceId:s,color,position,geometry:{shape,size},...(parent?{parent}:{}),...extra});
const block=(id:string,size:number[],color:string,position:number[],parent?:string)=>
  mesh(id,'box',size,color,position,parent);
const story=(text:string,act:string,move:string,finish:string)=>{
  const sources:ProgramSource[]=[{sourceId:s,text,duration:6}];
  const plan=compileStoryEvents({
    version:1,duration:6,
    entities:[
      {id:'start',kind:'place'},{id:'finish',kind:'place'},
      {id:'cargo',kind:'prop',at:'start'},
      {id:'machine',kind:'mechanism',at:'start',controls:['cargo']}
    ],
    events:[
      {id:'start-machine',sourceId:s,evidence:act,start:0,end:1,action:'activate',subject:'machine',
        purpose:'Mostrar acionamento real do mecanismo antes de mover a carga'},
      {id:'move-cargo',sourceId:s,evidence:move,start:1,end:5,action:'operate',subject:'cargo',
        mechanism:'machine',destination:'finish',dependsOn:['start-machine'],
        purpose:'Revelar a mesma carga deslocando-se pela ação do motor'},
      {id:'end-cargo',sourceId:s,evidence:finish,start:5,end:6,action:'focus',subject:'cargo',
        dependsOn:['move-cargo'],purpose:'Mostrar a carga alcançando o destino da história'}
    ]
  },sources);
  return {sources,plan};
};
export function buildMechanicalScenario(setting:MechanicalSetting):MechanicScenario {
  const data = setting==='workshop'
    ? story('O motor liga e a esteira leva a caixa de ferramentas até a área de montagem.',
        'O motor liga','a esteira leva a caixa de ferramentas','até a área de montagem')
    : setting==='city'
    ? story('O guincho liga e puxa o carrinho com materiais pela rua até o armazém.',
        'O guincho liga','puxa o carrinho com materiais pela rua','até o armazém')
    : story('O guincho do porto liga e recolhe o barco pela água até o cais.',
        'O guincho do porto liga','recolhe o barco pela água','até o cais');
  const offset = setting==='harbor' ? [0,0,6] : setting==='city' ? [7,0,0] : [5,0,0];
  const floor=setting==='harbor'?'#3C81A5':setting==='city'?'#525963':'#C5AF93';
  const nodes:any[]=[
    block('surface',[36,.18,24],floor,[0,-.10,0]),
    group('machine',[-3,.2,-1]),
    block('engine-shell',[1.4,.62,.85],'#277EAE',[0,.45,0],'machine'),
    block('engine-foot',[1.65,.16,1.1],'#344B61',[0,0,0],'machine'),
    group('drum-shaft',[.82,.54,0],'machine'),
    mesh('drum','cylinder',[.26,.26,.52],'#C8D2D9',[0,0,0],'drum-shaft',{rotation:[Math.PI/2,0,0]}),
    block('drum-marker',[.42,.08,.18],'#EEC268',[0,0,.3],'drum-shaft'),
    group('small-gear-shaft',[-.18,.71,.56],'machine'),
    mesh('small-gear','cylinder',[.22,.22,.12],'#DE9E4D',[0,0,0],'small-gear-shaft',{rotation:[Math.PI/2,0,0]}),
    block('small-gear-marker',[.32,.09,.15],'#FFE59B',[0,0,.13],'small-gear-shaft'),
    group('cargo',setting==='harbor'?[0,.2,0]:[0,.36,0]),
  ];
  if(setting==='workshop'){
    nodes.push(
      block('belt',[9,.14,1.8],'#5F7375',[2.5,.28,0]),
      block('belt-edge-a',[9,.22,.12],'#F2D76A',[2.5,.44,.88]),
      block('belt-edge-b',[9,.22,.12],'#F2D76A',[2.5,.44,-.88]),
      block('carton',[1,.7,.85],'#BA8A5B',[0,.24,0],'cargo'),
      block('carton-tape',[.19,.71,.86],'#E8D0A0',[0,.24,0],'cargo'),
      block('rear-workshop-wall',[16,5,.22],'#A5BAC2',[2,2.5,-4]),
      block('workbench',[2,.14,1.2],'#7B9FA5',[7,.65,-2]),
      block('tool-cabinet',[1.8,2,.8],'#4E8199',[-6,1,-3])
    );
  } else if(setting==='city'){
    nodes.push(
      block('road',[28,.12,9],'#3E454A',[1,0,0]),
      block('lane-a',[2,.03,.13],'#E7CD76',[-2,.09,0]),
      block('lane-b',[2,.03,.13],'#E7CD76',[2,.09,0]),
      block('lane-c',[2,.03,.13],'#E7CD76',[6,.09,0]),
      block('trolley-body',[1.8,.48,1.10],'#D07845',[0,.25,0],'cargo'),
      block('trolley-materials',[1.15,.47,.82],'#B8B8AB',[0,.72,0],'cargo'),
      mesh('wheel-left','cylinder',[.28,.28,.16],'#222F3A',[-.55,.03,.66],'cargo',{rotation:[Math.PI/2,0,0]}),
      mesh('wheel-right','cylinder',[.28,.28,.16],'#222F3A',[.55,.03,.66],'cargo',{rotation:[Math.PI/2,0,0]}),
      block('warehouse',[5,5,3.8],'#C8BBB0',[12,2.5,-5]),
      block('warehouse-door',[1.8,3,.12],'#587993',[10,1.5,-3.05]),
      block('city-building',[4.5,8,4],'#A0B5BB',[-9,4,-6])
    );
  } else {
    nodes.push(
      block('pier',[4,.42,6],'#9D7B53',[-3,.22,0]),
      block('pier-left',[.32,1.5,.32],'#7C6048',[-4,.72,-2]),
      block('pier-right',[.32,1.5,.32],'#7C6048',[-2,.72,2]),
      block('boat-hull',[2.20,.40,1.30],'#D8E1DF',[0,.19,0],'cargo'),
      block('boat-inner',[1.70,.12,.80],'#355A78',[0,.45,0],'cargo'),
      block('boat-cabin',[.85,.75,.76],'#F3C26A',[-.3,.85,0],'cargo'),
      block('boat-window',[.45,.28,.08],'#4A9CC4',[-.30,.94,.41],'cargo'),
      block('distant-shore',[23,.50,2.6],'#A1C3A3',[1,.15,-9]),
      mesh('shore-rock','sphere',[1.15],'#79888A',[4,.35,-8])
    );
  }
  const raw=normalizeSceneProgram({
    version:1,background:setting==='harbor'?'#8CBFDE':setting==='city'?'#BED4DF':'#CFDFE8',
    nodes,
    // Validator requires initial motion data. All cargo/machine shaft movement
    // is intentionally emitted by the story-motion compiler, NOT by this fixture.
    tracks:[{node:'surface',channel:'position',interpolation:'linear',
      keys:[{sourceId:s,phase:0,value:[0,-.10,0]},{sourceId:s,phase:1,value:[0,-.10,0]}]}],
    shots:[{sourceId:s,subjects:['cargo','machine'],
      azimuth:.47,endAzimuth:.47,elevation:.18,distance:1.16}],contacts:[]
  },data.sources);
  const bindings:StoryMotionBindings={
    entityNodes:{cargo:'cargo',machine:'machine'},
    placeAnchors:{start:[0,0,0],finish:offset as [number,number,number]},
    mechanicalDrives:{
      machine:{
        output:'cargo',
        radius:setting==='harbor'?.55:setting==='city'?.32:.24,
        parts:[
          {node:'drum-shaft',axis:'z',ratio:1},
          {node:'small-gear-shaft',axis:'z',ratio:-2}
        ]
      }
    }
  };
  const compiled=compileStoryMotion(data.plan,raw,data.sources,bindings);
  return {setting,sources:data.sources,storyboard:data.plan,program:compiled.program,bindings};
}
