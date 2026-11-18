import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {normalizeSceneProgram,type ProgramSource} from '../score';
import {terrainHeight} from '../scenery';
import {SceneProgram3D} from '../stage3d';
import {compileWorldScenery} from './worldScenery';
import {buildWorldAndSceneryPreview} from './worldAndSceneryDemo';
const source:ProgramSource[]=[{sourceId:'s1',text:'Uma ilha com lago e floresta recebe um pequeno barco.',duration:6}];
const island={
  id:'island',sourceId:'s1',shape:'terrain',size:[18,18,4],
  position:[4,0,0],color:'#59916A',seed:9,roughness:.7,segments:20
};
const forest={
  id:'forest',sourceId:'s1',shape:'tree',size:[2.4],color:'#84634D',
  foliage:'#337951',seed:2,
  scatter:{ground:'island',count:7,seed:17,spread:[12,12],minimumHeight:.4}
};
const water={id:'water',sourceId:'s1',shape:'water',size:[36,36],
  position:[0,-.5,0],seed:3,wave:.18,color:'#3A8FAD',segments:20};
const proposal=(...regions:unknown[])=>({version:1,regions});

describe('Gemini-defined procedural scenes composed with exact Claude generators',()=>{
  it('creates deterministic real terrain, floating sea, grounded forest and clouds from compact JSON',()=>{
    const input=proposal(island,forest,water,{
      id:'cloud',sourceId:'s1',shape:'cloud',size:[3.4],
      seed:12,color:'#FFFFFF',position:[0,8,0]});
    const a=compileWorldScenery(input,source),b=compileWorldScenery(input,source);
    expect(a).toEqual(b);
    expect(a.audit.environments).toHaveLength(4);
    expect(a.nodes.filter(n=>String(n.id).startsWith('forest-'))).toHaveLength(7);
    expect(a.audit.environments.find(e=>e.id==='island')?.vertices).toBe(441);
    const terrain=a.nodes.find(n=>n.id==='island') as any;
    expect(terrain.geometry).toMatchObject({
      shape:'terrain',size:[18,18,4],seed:9,roughness:.7,segments:20
    });
    expect((a.nodes.find(n=>n.id==='water') as any).geometry).toMatchObject({
      shape:'water',wave:.18,segments:20
    });
    for(const node of a.nodes.filter(n=>String(n.id).startsWith('forest-')) as any[]){
      const pos=node.position as number[];
      const localX=pos[0]-4,localZ=pos[2];
      const h=terrainHeight({
        size:[18,18,4],seed:9,roughness:.7
      },localX,localZ);
      expect(pos[1]).toBeCloseTo(h,6);
      expect(h).toBeGreaterThan(.4);
    }
    const program=normalizeSceneProgram({
      version:1,background:'#ADD8E6',nodes:a.nodes,
      tracks:[{node:'island',channel:'position',interpolation:'linear',
        keys:[{sourceId:'s1',phase:0,value:[4,0,0]},
          {sourceId:'s1',phase:1,value:[4,0,0]}]}],
      shots:[{sourceId:'s1',subjects:['island','cloud'],azimuth:.3,elevation:.2,distance:1.25}],
      contacts:[]
    },source);
    const stage=new SceneProgram3D(program,source);
    try {
      const waterMesh=stage.nodes.get('water') as THREE.Mesh<THREE.BufferGeometry>;
      stage.update(0);
      const first=Array.from(waterMesh.geometry.getAttribute('position').array);
      stage.update(1.2);
      const later=Array.from(waterMesh.geometry.getAttribute('position').array);
      expect(later).not.toEqual(first); // time-varying vertices, not a frozen t=0 mesh
      for(const region of ['island','water','cloud','forest']){
        expect(stage.nodes.get(region)).toBeDefined();
      }
      for(const n of stage.nodes.values()){
        expect(n.position.toArray().every(Number.isFinite)).toBe(true);
      }
      stage.frame(9/16);
      expect(stage.camera.position.toArray().every(Number.isFinite)).toBe(true);
    }finally{stage.dispose();}
  });

  it('rejects remote and executable scene definitions, invalid seeds and invalid dimensions',()=>{
    expect(()=>compileWorldScenery(proposal({...island,url:'https://bad.test'}),source))
      .toThrow(/campo desconhecido/);
    expect(()=>compileWorldScenery(proposal({...island,script:'eval()'}),source))
      .toThrow(/campo desconhecido/);
    expect(()=>compileWorldScenery(proposal({...island,seed:1.4}),source))
      .toThrow(/fora do limite/);
    expect(()=>compileWorldScenery(proposal({...island,size:[8,8]}),source))
      .toThrow(/dimensões/);
    expect(()=>compileWorldScenery(proposal({...island,segments:200}),source))
      .toThrow(/fora do limite/);
  });

  it('rejects invalid terrain ties, duplicate entity ids and unavailable shoreline positions',()=>{
    expect(()=>compileWorldScenery(proposal(forest),source))
      .toThrow(/terreno real/);
    expect(()=>compileWorldScenery(proposal(island,water,{...forest,
      scatter:{...forest.scatter,ground:'water'}}),source))
      .toThrow(/terreno real/);
    expect(()=>compileWorldScenery(proposal(island,island),source))
      .toThrow(/duplicados/);
    expect(()=>compileWorldScenery(proposal(island),source,[{id:'island'}]))
      .toThrow(/reutiliza ID/);
    expect(()=>compileWorldScenery(proposal(island,{...forest,
      scatter:{...forest.scatter,minimumHeight:15}}),source))
      .toThrow(/posicionar árvores/);
  });

  it('retains separate visual assemblies and causal mechanics in 3 independent worlds',()=>{
    for(const setting of ['workshop','city','harbor'] as const){
      const movie=buildWorldAndSceneryPreview(setting);
      expect(movie.sceneryAudit.environments.length).toBeGreaterThanOrEqual(3);
      expect(movie.program.nodes.some(n=>n.id==='cargo')).toBe(true);
      expect(movie.program.nodes.some(n=>n.id==='drum-shaft')).toBe(true);
      expect(movie.program.nodes.some(n=>n.id.startsWith('cargo-'))).toBe(true);
      const stage=new SceneProgram3D(movie.program,movie.sources);
      try{
        const cargo=stage.nodes.get('cargo')!;
        for(const t of [0,1,3,5,6]){
          stage.update(t);
          expect(stage.nodes.get('cargo')).toBe(cargo);
          expect(stage.nodes.get('drum-shaft')).toBeDefined();
        }
        stage.frame(9/16);
        expect(stage.camera.position.toArray().every(Number.isFinite)).toBe(true);
      }finally{stage.dispose();}
    }
  });
});
