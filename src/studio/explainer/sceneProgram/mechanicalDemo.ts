/** Offline QA fixture, not shipped as a preset or included in the Gemini prompt.
 * SceneProgram already supports all of these pieces generically. */
export const mechanicalDemoScript = 'Um liquidificador é montado. A jarra encaixa na base e suas lâminas começam a girar.';

const s='s1';
const node=(id: string, kind: 'group'|'mesh', position: number[], other: Record<string,unknown>={})=>
  ({id,kind,contextSourceId:s,position,...other});
const mesh=(id:string,shape:string,size:number[],color:string,position:number[],other:Record<string,unknown>={})=>
  node(id,'mesh',position,{geometry:{shape,size},color,...other});
const key=(phase:number,value:number[])=>({sourceId:s,phase,value});

export function mechanicalDemoProgram(){
  const nodes=[
    mesh('countertop','box',[12,.20,7],'#C3A58F',[0,-.1,0]),
    mesh('back-wall','box',[14,7,.18],'#C8DEE8',[0,3,-3.8]),
    node('motor-unit','group',[0,0,0]),
    mesh('motor-base','cylinder',[.79,.91,.78],'#364C62',[0,.57,0],{parent:'motor-unit',
      material:{metalness:.35,roughness:.42}}),
    mesh('motor-ring','cylinder',[.68,.68,.09],'#B8CCDA',[0,.97,0],{parent:'motor-unit'}),
    mesh('dial','cylinder',[.15,.15,.07],'#EDBB66',[0,.56,.83],{parent:'motor-unit',
      rotation:[Math.PI/2,0,0]}),
    mesh('status-light','sphere',[.055],'#9CE9BF',[.37,.62,.74],{parent:'motor-unit',
      material:{roughness:.2,metalness:0,emissive:'#58E69E',emissiveIntensity:.7}}),
    node('jar-assembly','group',[0,2.75,0]),
    node('glass-jar','mesh',[0,0,0],{parent:'jar-assembly',color:'#A5E1F2',
      geometry:{shape:'lathe',segments:40,
        profile:[[0,0],[.38,0],[.44,.08],[.55,.20],[.67,1.05],[.70,1.34]]},
      material:{metalness:.04,roughness:.09,opacity:.44,emissive:'#1D3544',emissiveIntensity:.07}}),
    mesh('jar-bottom','cylinder',[.38,.38,.12],'#D8E7EC',[0,.07,0],{parent:'jar-assembly',
      material:{metalness:.1,roughness:.25,opacity:.65}}),
    mesh('jar-handle','torus',[.46,.095],'#647F93',[.81,.74,0],{parent:'jar-assembly',
      rotation:[0,0,.12]}),
    mesh('lid','cylinder',[.73,.73,.12],'#344B62',[0,1.40,0],{parent:'jar-assembly'}),
    mesh('lid-cap','cylinder',[.20,.20,.11],'#B4CBD5',[0,1.50,0],{parent:'jar-assembly'}),
    node('blade-rotor','group',[0,.22,0],{parent:'jar-assembly'}),
    mesh('blade-left','box',[.90,.045,.19],'#D7E2E8',[0,0,0],{parent:'blade-rotor',
      material:{metalness:.85,roughness:.18}}),
    mesh('blade-right','box',[.19,.045,.90],'#CBD9E4',[0,.03,0],{parent:'blade-rotor',
      material:{metalness:.85,roughness:.18}}),
    mesh('blade-hub','cylinder',[.14,.14,.18],'#526C7D',[0,.07,0],{parent:'blade-rotor'}),
    mesh('shadow','cylinder',[.85,.85,.018],'#829DAC',[0,.01,0],{parent:'motor-unit',
      material:{opacity:.23,roughness:1,metalness:0}}),
  ];
  const tracks=[
    {node:'jar-assembly',channel:'position',interpolation:'smooth',
      keys:[key(0,[0,2.75,0]),key(.08,[0,2.75,0]),key(.48,[0,1.01,0]),
        key(.56,[0,1.01,0]),key(1,[0,1.01,0])]},
    {node:'blade-rotor',channel:'rotation',interpolation:'linear',
      keys:[key(0,[0,0,0]),key(.55,[0,0,0]),key(1,[0,6.10,0])]},
    {node:'jar-assembly',channel:'rotation',interpolation:'smooth',
      keys:[key(0,[0,-.15,0]),key(.47,[0,0,0]),key(1,[0,0,0])]},
  ];
  return {version:1,background:'#D5E6EC',nodes,tracks,
    shots:[{sourceId:s,subjects:['motor-unit','jar-assembly'],
      azimuth:.48,endAzimuth:.62,elevation:.17,distance:1.18}],contacts:[]};
}

export const mechanicalDemoResponse=()=>({
  title:'Montagem de liquidificador — 3D procedural',
  scenes:[{sourceId:s,visual:'character',mood:'neutral',palette:'teal'}],
  sceneProgram:mechanicalDemoProgram(),
});
