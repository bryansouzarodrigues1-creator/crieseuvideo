import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { compileSceneProgram, normalizeSceneProgram, type ProgramSource } from './score';
import { SceneProgram3D } from './stage3d';
import { mechanicalDemoProgram, mechanicalDemoScript } from './mechanicalDemo';

const sources: ProgramSource[] = [{ sourceId:'s1', text:mechanicalDemoScript, duration:8 }];
const plan = () => normalizeSceneProgram(mechanicalDemoProgram(), sources);

describe('3D assembly without predefined animation categories', () => {
  it('validates a scene with machinery and without human characters or catalogue scene IDs', () => {
    const parsed = plan();
    expect(parsed.nodes.filter((n) => n.kind === 'actor')).toHaveLength(0);
    expect(parsed.nodes.some((n) => n.geometry?.shape === 'lathe')).toBe(true);
    expect(parsed.tracks.map((t) => t.node)).toEqual(['jar-assembly','blade-rotor','jar-assembly']);
    expect(parsed.shots).toHaveLength(1);
  });

  it('lowers the jar onto the base before turning the blades', () => {
    const timeline = compileSceneProgram(plan(),sources);
    const begin=timeline.sample(0), after=timeline.sample(4.5), end=timeline.sample(8);
    expect(begin.get('jar-assembly')!.position[1]).toBeCloseTo(2.75);
    expect(after.get('jar-assembly')!.position[1]).toBeCloseTo(1.01);
    expect(end.get('jar-assembly')!.position[1]).toBeCloseTo(1.01);
    expect(begin.get('blade-rotor')!.rotation[1]).toBe(0);
    expect(timeline.sample(3).get('blade-rotor')!.rotation[1]).toBe(0);
    expect(end.get('blade-rotor')!.rotation[1]).toBeCloseTo(6.1);
    expect(timeline.duration).toBe(8);
  });

  it('moves the lid, blades and glass as attached 3D geometry, never free-floating assets', () => {
    const stage=new SceneProgram3D(plan(),sources);
    try {
      const jar=stage.nodes.get('jar-assembly')!, lid=stage.nodes.get('lid')!;
      const rotor=stage.nodes.get('blade-rotor')!, glass=stage.nodes.get('glass-jar') as THREE.Mesh;
      expect(lid.parent).toBe(jar);
      expect(rotor.parent).toBe(jar);
      expect(glass.geometry).toBeInstanceOf(THREE.LatheGeometry);
      stage.update(0);
      jar.updateWorldMatrix(true,true);
      const jarStart=jar.getWorldPosition(new THREE.Vector3());
      const lidStart=lid.getWorldPosition(new THREE.Vector3());
      stage.update(8);
      jar.updateWorldMatrix(true,true);
      const jarEnd=jar.getWorldPosition(new THREE.Vector3());
      const lidEnd=lid.getWorldPosition(new THREE.Vector3());
      expect(jarStart.y-jarEnd.y).toBeCloseTo(1.74);
      expect(lidStart.y-lidEnd.y).toBeCloseTo(1.74);
      expect(lidEnd.y-jarEnd.y).toBeCloseTo(1.40);
      expect(rotor.rotation.y).toBeCloseTo(6.1);
      stage.validateContacts();
    } finally {stage.dispose();}
  });

  it('is deterministic after seeking backward and forward', () => {
    const stage=new SceneProgram3D(plan(),sources);
    try {
      stage.update(6.4);
      const first={
        position:stage.nodes.get('jar-assembly')!.position.toArray(),
        rotor:stage.nodes.get('blade-rotor')!.rotation.toArray(),
      };
      stage.update(0);stage.update(8);stage.update(6.4);
      expect({
        position:stage.nodes.get('jar-assembly')!.position.toArray(),
        rotor:stage.nodes.get('blade-rotor')!.rotation.toArray(),
      }).toEqual(first);
    } finally {stage.dispose();}
  });
});
