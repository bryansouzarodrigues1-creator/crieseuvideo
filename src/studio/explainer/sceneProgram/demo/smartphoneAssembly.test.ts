import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { compileSceneProgram } from '../score';
import { SceneProgram3D } from '../stage3d';
import { buildSmartphoneAssemblyDemo } from './smartphoneAssembly';

describe('smartphone assembly in the real SceneProgram3D engine', () => {
  it('validates one persistent scene graph, its cameras and its three causal acts', () => {
    const clip = buildSmartphoneAssemblyDemo();
    const score = compileSceneProgram(clip.program, clip.sources);
    expect(clip.duration).toBe(12);
    expect(score.duration).toBe(12);
    expect(clip.program.shots).toHaveLength(3);
    expect(clip.program.shots[0].subjects).toContain('battery');
    expect(clip.program.shots[1].subjects).toContain('processor');
    expect(clip.program.shots[1].subjects).toContain('camera');
    expect(clip.program.shots[2].subjects).toContain('display');
    expect(clip.program.nodes.length).toBeGreaterThan(20);
    expect(clip.program.nodes.filter(n => n.id === 'chassis')).toHaveLength(1);
    expect(clip.program.nodes.filter(n => n.id === 'battery')).toHaveLength(1);
    expect(clip.program.nodes.filter(n => n.id === 'processor')).toHaveLength(1);
    expect(clip.program.nodes.filter(n => n.id === 'camera')).toHaveLength(1);
    expect(clip.program.nodes.filter(n => n.id === 'display')).toHaveLength(1);

    const at = (t: number, id: string) => score.sample(t).get(id)!.position;
    const delta = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

    expect(delta(at(0, 'battery'), at(3.8, 'battery'))).toBeGreaterThan(.9);
    expect(delta(at(4, 'battery'), at(12, 'battery'))).toBeLessThan(.001);
    expect(delta(at(4, 'processor'), at(8, 'processor'))).toBeGreaterThan(.7);
    expect(delta(at(8, 'processor'), at(12, 'processor'))).toBeLessThan(.001);
    expect(delta(at(4, 'camera'), at(8, 'camera'))).toBeGreaterThan(.7);
    expect(delta(at(8, 'camera'), at(12, 'camera'))).toBeLessThan(.001);
    expect(delta(at(8, 'display'), at(12, 'display'))).toBeGreaterThan(2.5);
    expect(delta(at(0, 'chassis'), at(12, 'chassis'))).toBe(0);
  });

  it('updates every important frame, keeps object identities and fits both aspect ratios', () => {
    const clip = buildSmartphoneAssemblyDemo();
    const stage = new SceneProgram3D(clip.program, clip.sources, new Map(), 'technical');
    try {
      const chassis = stage.nodes.get('chassis');
      expect(chassis).toBeInstanceOf(THREE.Mesh);
      const chassisMaterial = (chassis as THREE.Mesh).material;
      expect(chassisMaterial).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect((chassisMaterial as THREE.MeshPhysicalMaterial).metalness).toBeGreaterThan(.8);
      const parts = ['chassis', 'battery', 'processor', 'camera', 'display']
        .map(id => stage.nodes.get(id)!);
      for (const t of [0, .4, 1.5, 3.8, 4, 5.4, 7.9, 8, 9, 11.8, 11.999]) {
        stage.update(t);
        for (const aspect of [9 / 16, 16 / 9]) {
          stage.frame(aspect);
          expect(stage.camera.position.toArray().every(Number.isFinite)).toBe(true);
          const bounds = stage.diagnostics().projectedBounds;
          expect(bounds.min[0]).toBeGreaterThan(-1);
          expect(bounds.max[0]).toBeLessThan(1);
          expect(bounds.min[1]).toBeGreaterThan(-1);
          expect(bounds.max[1]).toBeLessThan(1);
        }
        parts.forEach((part, i) => expect(stage.nodes.get(['chassis', 'battery', 'processor', 'camera', 'display'][i])).toBe(part));
      }
    } finally {
      stage.dispose();
    }
  });
});
