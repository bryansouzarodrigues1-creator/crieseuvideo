import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ProgramActor3D } from './actor3d';
import { patrickPilotScene } from './patrickPilot';
import { normalizeSceneProgram } from './score';
import { SceneProgram3D } from './stage3d';

describe('Patrick 3D pilot', () => {
  it('uses the same articulated IK skeleton as every other scene actor', () => {
    const actor = new ProgramActor3D('#34496d', 0, 'patrick-mentalista-v1');
    expect(actor.root.userData.characterPreset).toBe('patrick-mentalista-v1');
    for (const name of [
      'patrick-white-shirt', 'patrick-left-vest', 'patrick-right-vest',
      'patrick-hair-wave-0', 'patrick-pupil-left',
      'patrick-left-leather-shoe', 'patrick-right-leather-shoe',
      'patrick-right-finger-0-joint',
    ]) expect(actor.root.getObjectByName(name)).toBeDefined();
    const hinge = actor.root.getObjectByName('patrick-right-finger-0-joint')!;
    hinge.rotation.x = .65; expect(hinge.rotation.x).toBeCloseTo(.65);
    actor.reset({}, 0);
    expect(actor.limbs.leftHand.hand.parent).toBe(actor.limbs.leftHand.elbow);
    expect(actor.limbs.rightHand.hand.parent).toBe(actor.limbs.rightHand.elbow);
    expect(actor.head.parent).toBe(actor.hips);
  });

  it('accepts the reviewed local preset and rejects arbitrary presets and non-actor placement', () => {
    const { program, sources } = patrickPilotScene();
    expect(program.nodes.find((node) => node.id === 'patrick')?.actorPreset).toBe('patrick-mentalista-v1');
    const badActor = { ...program, nodes: program.nodes.map((n) =>
      n.id === 'patrick' ? { ...n, actorPreset: 'remote-character-url' } : n) };
    expect(() => normalizeSceneProgram(badActor, sources)).toThrow(/identidade visual/);
    const badProp = { ...program, nodes: program.nodes.map((n) =>
      n.id === 'book' ? { ...n, actorPreset: 'patrick-mentalista-v1' } : n) };
    expect(() => normalizeSceneProgram(badProp, sources)).toThrow(/identidade visual/);
  });

  it('frames the workbench and preserves hand contact and replay at arbitrary timestamps', () => {
    const { program, sources } = patrickPilotScene();
    const stage = new SceneProgram3D(program, sources);
    try {
      const actor = stage.actors.get('patrick')!;
      expect(actor.root.getObjectByName('patrick-white-shirt')).toBeDefined();
      stage.validateContacts();
      for (const t of [0, 3.5, 5.6, 8, 1.5, 5.6]) {
        stage.update(t);
        expect(stage.diagnostics().maxIKError).toBeLessThan(.025);
        stage.frame(9 / 16);
        expect(stage.camera.position.length()).toBeGreaterThan(.1);
      }
      stage.update(4.2);
      const book = stage.nodes.get('book')!;
      const target = book.localToWorld(new THREE.Vector3(0, .05, 0));
      const hand = actor.limbs.rightHand.hand.getWorldPosition(new THREE.Vector3());
      expect(hand.distanceTo(target)).toBeLessThan(.025);
      const first = actor.limbs.rightHand.hand.matrixWorld.elements.slice();
      stage.update(8); stage.update(4.2);
      expect(actor.limbs.rightHand.hand.matrixWorld.elements).toEqual(first);
    } finally {
      stage.dispose();
    }
  });
});
