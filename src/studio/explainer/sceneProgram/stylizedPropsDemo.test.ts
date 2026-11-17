import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SceneProgram3D } from './stage3d';
import { normalizeSceneProgram, compileSceneProgram } from './score';
import { mechanicalDemoProgram, mechanicalDemoScript } from './mechanicalDemo';
import { stylizedPropsProgram, stylizedPropsScript } from './stylizedPropsDemo';

const source = [{sourceId:'s1',text:stylizedPropsScript,duration:8}];

describe('non-human 3D variety with existing generic scene grammar', () => {
  it('renders a recognizable compound tomato instead of a red sphere placeholder', () => {
    const p=normalizeSceneProgram(stylizedPropsProgram(),source);
    const parts=p.nodes.filter(n=>n.parent==='fruit');
    expect(p.nodes.filter(n=>n.kind==='actor')).toHaveLength(0);
    expect(p.nodes.find(n=>n.id==='tomato-body')?.geometry?.shape).toBe('lathe');
    expect(parts.filter(n=>n.id.startsWith('tomato-lobe-'))).toHaveLength(5);
    expect(parts.filter(n=>n.id.startsWith('green-sepal-'))).toHaveLength(5);
    expect(parts.some(n=>n.id==='stem')).toBe(true);
    expect(p.nodes.some(n=>n.id==='crate')).toBe(true);
    expect(p.shots[0]!.motion).toBe('locked');
  });

  it('creates physical 3D meshes, animates the subject and keeps its full journey framed', () => {
    const p=normalizeSceneProgram(stylizedPropsProgram(),source);
    const stage=new SceneProgram3D(p,source);
    try {
      expect((stage.nodes.get('tomato-body') as THREE.Mesh).geometry).toBeInstanceOf(THREE.LatheGeometry);
      const score=compileSceneProgram(p,source);
      expect(score.sample(0).get('tomato')?.position).not.toEqual(score.sample(8).get('tomato')?.position);
      for (const aspect of [9/16,16/9]) {
        const cameras=new Map<number,number[]>();
        for(const t of [0,1.5,2.5,3.6,4.4,5.5,6.5,8]) {
          stage.update(t);stage.frame(aspect);
          const d=stage.diagnostics();
          const cut=t<2.64?0:t<5.84?1:2;
          if(!cameras.has(cut))cameras.set(cut,d.camera);
          else d.camera.forEach((x,i)=>expect(x).toBeCloseTo(cameras.get(cut)![i],5));
          expect(d.projectedBounds.min[0]).toBeGreaterThan(-.9);
          expect(d.projectedBounds.max[0]).toBeLessThan(.9);
          expect(d.projectedBounds.min[1]).toBeGreaterThan(-.7);
          expect(d.projectedBounds.max[1]).toBeLessThan(.9);
        }
        expect(cameras.size).toBe(3);
        expect(cameras.get(0)).not.toEqual(cameras.get(1));
      }
    } finally {stage.dispose();}
  });

  it('supports a completely different mechanical animation with the SAME renderer', () => {
    const stage=new SceneProgram3D(normalizeSceneProgram(mechanicalDemoProgram(),
      [{sourceId:'s1',text:mechanicalDemoScript,duration:8}]),
      [{sourceId:'s1',text:mechanicalDemoScript,duration:8}]);
    try {
      expect(stage.actors.size).toBe(0);
      expect(stage.nodes.has('jar-assembly')).toBe(true);
      expect(stage.nodes.has('blade-rotor')).toBe(true);
      stage.update(8);stage.frame(9/16);
      expect(stage.diagnostics().projectedBounds.min[0]).toBeGreaterThan(-1);
    } finally {stage.dispose();}
  });
});
