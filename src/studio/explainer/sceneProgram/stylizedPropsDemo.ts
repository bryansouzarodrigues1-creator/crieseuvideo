/** Offline QA fixture, not a hardcoded Gemini scene or production preset.
 * Demonstrates a recognizable organic prop built from the EXISTING generic
 * SceneProgram mesh/lathe/hierarchy language, with no human rig and no GLB.
 */
export const stylizedPropsScript = 'Um tomate maduro se solta da planta, cai no chão e rola até uma caixa de madeira.';
const sourceId = 's1';
const node = (id: string, kind: 'group' | 'mesh', position: number[], props: Record<string,unknown> = {}) =>
  ({id,kind,contextSourceId:sourceId,position,...props});
const mesh = (id: string, shape: string, size: number[], color: string, position: number[], props: Record<string,unknown> = {}) =>
  node(id,'mesh',position,{geometry:{shape,size},color,...props});
const key = (phase: number, value: number[]) => ({sourceId,phase,value});

export function stylizedPropsProgram() {
  const nodes = [
    mesh('earth','box',[12,.18,9],'#7F9B72',[0,-.12,0]),
    mesh('backdrop','box',[10,5,.14],'#E3D5BF',[0,2.5,-3.9]),
    node('plant','group',[-1.14,0,-.1]),
    mesh('vine','tube',[.065],'#477D45',[0,0,0],{parent:'plant',geometry:{
      shape:'tube',size:[.065],points:[[0,.02,0],[-.10,.50,0],[.06,1.18,.02],[.23,2.04,.03]]}}),
    mesh('vine-leaf-a','sphere',[.28],'#54A45C',[-.34,1.2,.08],{parent:'plant',scale:[1.3,.25,.53],rotation:[0,0,-.32]}),
    mesh('vine-leaf-b','sphere',[.22],'#6EB86C',[.34,1.66,.03],{parent:'plant',scale:[1.2,.24,.5],rotation:[0,0,.38]}),
    node('tomato','group',[-.92,1.72,.15]),
    node('fruit','group',[0,0,0],{parent:'tomato'}),
    node('tomato-body','mesh',[0,0,0],{parent:'fruit',color:'#E84A38',
      geometry:{shape:'lathe',segments:30,profile:[
        [0,-.42],[.24,-.39],[.40,-.26],[.46,-.04],[.42,.22],[.28,.36],[.10,.36],[0,.32],
      ]},material:{roughness:.76,metalness:0,opacity:1,emissive:'#000000',emissiveIntensity:0}}),
    // Volumetric lobes give the recognizable irregular silhouette: NOT a red sphere.
    ...Array.from({length:5},(_,i)=>{
      const a=i*Math.PI*2/5,r=.24;
      return mesh('tomato-lobe-'+i,'sphere',[.275],i%2?'#E84A38':'#E34C39',
        [Math.cos(a)*r,-.045,Math.sin(a)*r],{parent:'fruit',scale:[.83,1.25,.83]});
    }),
    mesh('stem','cylinder',[.065,.07,.29],'#39753D',[0,.47,0],{parent:'fruit',rotation:[0,0,.14]}),
    ...Array.from({length:5},(_,i)=>{
      const a=i*Math.PI*2/5;
      return mesh('green-sepal-'+i,'cone',[.115,.43],'#3F8A46',
        [Math.cos(a)*.19,.365,Math.sin(a)*.19],{parent:'fruit',rotation:[Math.sin(a)*.95,0,-Math.cos(a)*.95]});
    }),
    node('crate','group',[2.12,0,0]),
    mesh('crate-floor','box',[1.56,.16,1.14],'#B77B48',[0,.21,0],{parent:'crate',geometry:{shape:'box',size:[1.56,.16,1.14],bevel:.035}}),
    mesh('crate-back','box',[1.56,.58,.13],'#A86A3E',[0,.49,-.50],{parent:'crate'}),
    mesh('crate-right','box',[.12,.58,1.15],'#C18A59',[.70,.49,0],{parent:'crate'}),
    mesh('crate-front','box',[1.56,.40,.12],'#BD8756',[0,.40,.50],{parent:'crate'}),
    mesh('crate-left','box',[.12,.58,1.15],'#C18A59',[-.70,.49,0],{parent:'crate'}),
    mesh('crate-rim','box',[1.59,.08,.12],'#69482C',[0,.78,-.50],{parent:'crate'}),
  ];
  return {version:1,background:'#BFE1DF',nodes,
    tracks:[
      {node:'tomato',channel:'position',interpolation:'smooth',
        keys:[key(0,[-.92,1.72,.15]),key(.24,[-.92,1.72,.15]),key(.47,[-.18,.48,.15]),
          key(.55,[.06,.41,.15]),key(.77,[.85,.41,.15]),key(1,[.98,.41,.15])]},
      {node:'tomato',channel:'rotation',interpolation:'smooth',
        keys:[key(0,[0,0,-.2]),key(.28,[0,0,-.2]),key(.48,[0,0,0]),key(.78,[0,0,-2.7]),key(1,[0,0,-2.9])]},
    ],
    shots:[{sourceId,subjects:['tomato','crate','plant'],azimuth:.36,endAzimuth:1.0,
      elevation:.13,distance:1.12,cuts:[
        {phase:0,subjects:['tomato','plant'],azimuth:.36,elevation:.13,distance:1.08},
        {phase:.33,subjects:['tomato'],azimuth:.48,elevation:.12,distance:1.10},
        {phase:.73,subjects:['tomato','crate'],azimuth:.36,elevation:.13,distance:1.10},
      ]}],
    contacts:[],
    motionChecks:[
      {sourceId,node:'tomato',channel:'position',kind:'change',startPhase:.25,endPhase:.56,threshold:1.0},
      {sourceId,node:'tomato',channel:'rotation',kind:'change',startPhase:.54,endPhase:.82,threshold:1.3},
      {sourceId,node:'tomato',channel:'position',kind:'hold',startPhase:.86,endPhase:1,threshold:.2},
    ]};
}
