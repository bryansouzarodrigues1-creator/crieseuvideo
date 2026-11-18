import {describe,expect,it} from 'vitest';
import {normalizeSceneProgram,type ProgramSource} from '../score';
import {SceneProgram3D} from '../stage3d';
import {compileWorldBlueprints} from './worldBlueprints';

const sources:ProgramSource[]=[
  {sourceId:'s1',text:'Um tomate é colhido com cuidado e colocado sobre a bancada.',duration:4},
  {sourceId:'s2',text:'Uma pequena moto chega e estaciona perto de uma árvore.',duration:4}
];
const body={
  id:'tomate',role:'prop',sourceId:'s1',name:'Tomate com folhas e haste',
  position:[0,.2,0],features:['corpo','haste','folhas'],parts:[
    {id:'corpo',feature:'corpo',color:'#D44533',geometry:{
      shape:'lathe',profile:[[0,0],[.45,.06],[.64,.38],[.57,.68],[.21,.80],[0,.81]],segments:24}},
    {id:'haste',feature:'haste',color:'#39783D',position:[0,.83,0],
      geometry:{shape:'cylinder',size:[.09,.10,.22]}},
    {id:'folhas',feature:'folhas',color:'#3F9C50',position:[.25,.80,0],
      rotation:[0,0,-.48],geometry:{shape:'cone',size:[.15,.55]},mirror:'x'}
  ]
};
const moto={
  id:'moto',role:'prop',sourceId:'s2',name:'Motocicleta estilizada',
  features:['tanque','banco','rodas','guidom'],position:[-2,.5,0],
  parts:[
    {id:'tanque',feature:'tanque',color:'#B74538',position:[0,.46,0],
      geometry:{shape:'box',size:[1.95,.62,.52],bevel:.08}},
    {id:'banco',feature:'banco',color:'#2E343C',position:[-.28,.86,0],
      geometry:{shape:'box',size:[.92,.15,.61]}},
    {id:'rodas',feature:'rodas',color:'#212930',position:[.75,-.30,.32],
      rotation:[Math.PI/2,0,0],geometry:{shape:'torus',size:[.33,.095]},mirror:'z'},
    {id:'guidom',feature:'guidom',color:'#D5D5D5',position:[.62,1.0,0],
      geometry:{shape:'tube',size:[.06],points:[[0,0,0],[0,.36,0],[.28,.39,0]]}}
  ]
};
const make=(...objects:unknown[])=>({version:1,objects});
const scene=(nodes:unknown[])=>normalizeSceneProgram({
  version:1,background:'#B6DCE8',nodes:[
    {id:'floor',kind:'mesh',contextSourceId:'s1',color:'#ABC1A0',
      geometry:{shape:'box',size:[17,.1,16]},position:[0,-.15,0]},
    ...nodes
  ],
  tracks:[{node:'tomate',channel:'position',interpolation:'linear',keys:[
    {sourceId:'s1',phase:0,value:[0,.2,0]},
    {sourceId:'s1',phase:1,value:[1.5,.2,0]}]}],
  shots:[
    {sourceId:'s1',subjects:['tomate'],azimuth:.5,elevation:.2,distance:1.1},
    {sourceId:'s2',subjects:['moto'],azimuth:.6,elevation:.2,distance:1.2}
  ],contacts:[]
},sources);

describe('Gemini-origin 3D visual blueprints, not topic presets',()=>{
  it('builds recognizable silhouettes by required semantic features, without custom JavaScript',()=>{
    const result=compileWorldBlueprints(make(body,moto),sources);
    expect(result.audit.objects).toHaveLength(2);
    expect(result.audit.objects[0].features).toEqual(['corpo','haste','folhas']);
    expect(result.audit.totalNodes).toBe(11);
    expect(result.nodes.map(n=>n.id)).toContain('tomate-folhas-m');
    expect(result.nodes.map(n=>n.id)).toContain('moto-rodas-m');
    expect(result.nodes.filter(n=>n.kind==='mesh')).toHaveLength(9);
    const program=scene(result.nodes);
    const stage=new SceneProgram3D(program,sources);
    try{
      for(const t of [0,1,3,4,6,8]){
        stage.update(t);
        expect(stage.nodes.get('tomate')).toBeDefined();
        expect(stage.nodes.get('moto')).toBeDefined();
        expect(stage.nodes.get('tomate-folhas-m')).toBeDefined();
        expect(stage.nodes.get('tomate-corrupcao')).toBeUndefined();
      }
      expect(stage.nodes.get('tomate-corrupcao')).toBeUndefined();
    }finally{stage.dispose();}
  });

  it('keeps new item IDs stable when rendered again (same user design, same nodes)',()=>{
    const a=compileWorldBlueprints(make(body,moto),sources);
    const b=compileWorldBlueprints(make(body,moto),sources);
    expect(a.nodes).toEqual(b.nodes);
    expect(a.nodes[0].id).toBe('tomate');
    expect(a.nodes.some(n=>n.id==='moto')).toBe(true);
  });

  it('creates an entirely different environment using the same grammar and instanced props',()=>{
    const plan=make({
      id:'jardim',role:'environment',sourceId:'s2',name:'Jardim com bancos e postes',
      features:['bancos','postes'],parts:[
        {id:'bancos',feature:'bancos',color:'#9A7F5E',position:[0,0,0],
          geometry:{shape:'box',size:[1.1,.15,.5]},
          repeat:{count:6,step:[1.8,0,0],jitter:[0,0,.3],seed:19}},
        {id:'postes',feature:'postes',color:'#668A8B',position:[0,0,-1],
          geometry:{shape:'cylinder',size:[.08,.08,2.5]},
          repeat:{count:4,step:[2.4,0,0],jitter:[0,0,0],seed:28}}
      ]
    });
    const output=compileWorldBlueprints(plan,sources);
    expect(output.nodes).toHaveLength(3);
    expect(output.nodes[1].repeat).toMatchObject({count:6,seed:19});
  });

  it('rejects a red sphere pretending to be a complex prop',()=>{
    const fake={
      ...body,features:['corpo','folhas'],
      parts:[{id:'bola',feature:'corpo',color:'#E00000',
        geometry:{shape:'sphere',size:[.7]}}]
    };
    expect(()=>compileWorldBlueprints(make(fake),sources)).toThrow(/partes suficientes/);
  });

  it('rejects promised but missing recognizable features',()=>{
    const fake={...body,parts:body.parts.slice(0,2)};
    expect(()=>compileWorldBlueprints(make(fake),sources)).toThrow(/reconhecíveis/);
  });

  it('rejects unsafe remote geometry and arbitrary JavaScript',()=>{
    const injected={...body,script:'fetch("https://bad")'};
    expect(()=>compileWorldBlueprints(make(injected),sources)).toThrow(/não suportado/);
    const fake=structuredClone(body);
    (fake.parts[0].geometry as any).remoteGlb='https://bad.test/model.glb';
    expect(()=>compileWorldBlueprints(make(fake),sources)).toThrow(/não suportado/);
  });

  it('rejects invalid sources, duplicate objects, orphan components and cycles',()=>{
    expect(()=>compileWorldBlueprints(make({...body,sourceId:'ghost'}),sources))
      .toThrow(/roteiro inexistente/);
    expect(()=>compileWorldBlueprints(make(body,body),sources))
      .toThrow(/duplicado/);
    expect(()=>compileWorldBlueprints(make(body),sources,[{id:'tomate'}]))
      .toThrow(/duplicado/);
    const orphan=structuredClone(body);
    (orphan.parts[1] as any).parent='ghost';
    expect(()=>compileWorldBlueprints(make(orphan),sources)).toThrow(/inexistente/);
    const cycle=structuredClone(body);
    (cycle.parts[0] as any).kind='group';
    delete (cycle.parts[0] as any).geometry;
    (cycle.parts[0] as any).parent='haste';
    (cycle.parts[1] as any).kind='group';
    delete (cycle.parts[1] as any).geometry;
    (cycle.parts[1] as any).parent='corpo';
    expect(()=>compileWorldBlueprints(make(cycle),sources)).toThrow(/circular/);
  });

  it('rejects excessive repetition, NaN, huge designs and degenerate mirroring',()=>{
    const huge=structuredClone(body);
    (huge.parts[0] as any).repeat={count:900,step:[0,0,0],seed:1};
    expect(()=>compileWorldBlueprints(make(huge),sources)).toThrow(/80/);
    const nan=structuredClone(body);
    (nan.parts[0] as any).position=[NaN,0,0];
    expect(()=>compileWorldBlueprints(make(nan),sources)).toThrow(/Vetor 3D/);
    const mirror=structuredClone(body);
    (mirror.parts[0] as any).mirror='z';
    expect(()=>compileWorldBlueprints(make(mirror),sources))
      .toThrow(/plano central/);
    expect(()=>compileWorldBlueprints(make(...Array(25).fill(body)),sources))
      .toThrow(/limite/);
  });
});
