import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {SceneProgram3D} from '../stage3d';
import {compileComplexWorldBatch} from './complexWorldBatch';
import {buildComplexWorldBatchDemo,COMPLEX_WORLD_QA_REQUEST} from './complexWorldBatchDemo';
import {validatePolygon2D} from '../profile2d';

describe('single proposal -> multiple independent large 3D worlds',()=>{
  it('compiles arca, secure prison and motorcycle in one request, each with isolated geometry budgets',()=>{
    const result=buildComplexWorldBatchDemo();
    expect(result.audit.clips).toBe(3);
    expect(result.duration).toBe(18);
    expect(result.clips.map(c=>c.id)).toEqual(['noahs-ark','security-prison','sport-motorcycle']);
    expect(result.clips.every(c=>c.program.nodes.length>20)).toBe(true);
    expect(result.clips.every(c=>c.program.shots.length===2)).toBe(true);
    expect(result.audit.totalParts).toBeGreaterThan(40);
    const [ark,prison,bike]=result.clips;
    expect(ark.program.nodes.find(n=>n.id==='ark-hull')?.geometry?.shape).toBe('extrude');
    expect(ark.program.nodes.find(n=>n.id==='ocean')?.geometry?.shape).toBe('water');
    expect(prison.program.nodes.find(n=>n.id==='compound-razor')?.repeat?.count).toBe(30);
    expect(bike.program.nodes.find(n=>n.id==='bike-fairing')?.geometry?.shape).toBe('extrude');
    expect(bike.program.nodes.find(n=>n.id==='bike-fwheel')?.kind).toBe('group');
  });
  it('renders Three.js stages with scene boundaries and animated objects',()=>{
    const batch=buildComplexWorldBatchDemo();
    const stages=batch.clips.map(clip=>new SceneProgram3D(clip.program,clip.sources));
    try{
      const [ark,prison,bike]=stages;
      for(const stage of stages){
        stage.update(0);
        stage.frame(9/16);
        expect(stage.camera.position.toArray().every(Number.isFinite)).toBe(true);
        for(const n of stage.nodes.values())
          expect(n.position.toArray().every(Number.isFinite)).toBe(true);
        stage.update(6);
      }
      ark.update(0);const y0=ark.nodes.get('ark')!.position.y;
      ark.update(3);const y1=ark.nodes.get('ark')!.position.y;
      expect(y1).not.toBeCloseTo(y0,4);
      prison.update(0);const x0=prison.nodes.get('compound-gate')!.position.x;
      prison.update(6);const x1=prison.nodes.get('compound-gate')!.position.x;
      expect(x1-x0).toBeGreaterThan(3);
      bike.update(3);const wheel0= bike.nodes.get('bike-fwheel')!.rotation.z;
      bike.update(6);const wheel1= bike.nodes.get('bike-fwheel')!.rotation.z;
      expect(Math.abs(wheel1-wheel0)).toBeGreaterThan(10);
      const hull=ark.nodes.get('ark-hull') as THREE.Mesh;
      const g=hull.geometry as THREE.BufferGeometry;
      expect(g.getAttribute('position').count).toBeGreaterThan(20);
      expect(new THREE.Box3().setFromObject(hull).getSize(new THREE.Vector3()).z).toBeGreaterThan(4);
    }finally{stages.forEach(s=>s.dispose());}
  });
  it('rejects invalid batches and does not leak IDs or geometry across shots',()=>{
    const batch=structuredClone(COMPLEX_WORLD_QA_REQUEST) as any;
    batch.clips[1].id='noahs-ark';
    expect(()=>compileComplexWorldBatch(batch)).toThrow(/duplicado/);
    batch.clips[1].id='security-prison';
    batch.clips[1].sceneProgram.shots[0].subjects=['ark'];
    expect(()=>compileComplexWorldBatch(batch)).toThrow(/câmera citou/);
    batch.clips[1].sceneProgram.shots[0].subjects=['compound'];
    batch.clips[1].worldBlueprints.objects[0].parts[0].geometry={shape:'mesh',javascript:'alert(1)'};
    expect(()=>compileComplexWorldBatch(batch)).toThrow();
    const oversized={...COMPLEX_WORLD_QA_REQUEST,clips:Array(13).fill(COMPLEX_WORLD_QA_REQUEST.clips[0])};
    expect(()=>compileComplexWorldBatch(oversized)).toThrow(/entre 1 e 12/);
  });
});
describe('safe silhouette extrusion',()=>{
  it('accepts a concave hull and rejects intersecting, degenerate and malicious profiles',()=>{
    expect(validatePolygon2D([[0,0],[2,0],[2,2],[1,1],[0,2]])).toHaveLength(5);
    expect(()=>validatePolygon2D([[0,0],[2,2],[0,2],[2,0]])).toThrow(/inválido/);
    expect(()=>validatePolygon2D([[0,0],[0,0],[2,1]])).toThrow(/degenerad/);
    expect(()=>validatePolygon2D([[0,0],[2,0],[1,Infinity]])).toThrow(/numéricos/);
    expect(()=>validatePolygon2D([[0,0],[2,0],[0,2],[0,0]])).toThrow(/duplicados/);
  });
});
