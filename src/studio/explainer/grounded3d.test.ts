import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCharacterRig } from './toon/characterRig';
import { GroundedPerformance, CONTACT_TIME, TRANSFER_TIME, footTarget, performanceFrame, solveLimb } from './grounded3d';
import { normalizePlan, sceneDuration } from './plan';
import { normalizeStory } from './storyAction';

function stage() {
  const world = new THREE.Group();
  const actors = [0, 1].map(() => {
    const rig = createCharacterRig(); const holder = new THREE.Group(); holder.add(rig.root); world.add(holder);
    return { rig, holder };
  });
  const prop = new THREE.Group(); world.add(prop);
  return new GroundedPerformance(actors, prop, world);
}
const maximum = (values: number[]) => Math.max(...values);

describe('grounded full-body performance on the actual Three.js rig', () => {
  it('solves a rotated arm in all three world axes without changing bone lengths', () => {
    const rig = createCharacterRig(); rig.root.position.set(2, 1.4, -.8); rig.root.rotation.y = .83;
    const shoulder = rig.rightArm.root.getWorldPosition(new THREE.Vector3());
    const target = shoulder.clone().add(new THREE.Vector3(.4, -.3, .35));
    expect(solveLimb(rig.rightArm, target, shoulder.clone().add(new THREE.Vector3(1, -1, 0))).error).toBeLessThan(1e-7);
    expect(rig.rightArm.elbow!.position.length()).toBeCloseTo(.42, 10);
    expect(rig.rightArm.hand!.position.length()).toBeCloseTo(.43, 10);
    rig.dispose();
  });

  it('maintains active grip contacts and planted foot targets for every 60fps frame', () => {
    const s = stage(); let maxGripError = 0, maxFootError = 0;
    for (let frame = 0; frame <= 18 * 60; frame++) {
      const f = s.update(frame / 60), d = s.diagnostics();
      f.contacts.forEach((contact, i) => { if (contact) maxGripError = Math.max(maxGripError, d.gripErrors[i]); });
      for (const feet of d.feet) for (const foot of feet) {
        maxFootError = Math.max(maxFootError, new THREE.Vector3(...foot.position).distanceTo(new THREE.Vector3(...foot.target)));
        expect(foot.position[1]).toBeGreaterThanOrEqual(.0639);
      }
    }
    expect(maxGripError).toBeLessThan(.001);
    expect(maxFootError).toBeLessThan(.001);
    s.actors.forEach((a) => a.rig.dispose());
  });

  it('binds the lantern to the owner hand and changes parent without a position jump', () => {
    const s = stage();
    for (const t of [CONTACT_TIME, TRANSFER_TIME]) {
      s.update(t - .00001); const before = s.prop.getWorldPosition(new THREE.Vector3());
      s.update(t + .00001); const after = s.prop.getWorldPosition(new THREE.Vector3());
      expect(before.distanceTo(after)).toBeLessThan(.0001);
    }
    s.update(10); expect(s.prop.parent).toBe(s.sockets[0]);
    s.update(17); expect(s.prop.parent).toBe(s.sockets[1]);
    s.update(1); expect(s.prop.parent).toBe(s.world);
    s.actors.forEach((a) => a.rig.dispose());
  });

  it('gives the exact same transforms after backward seeking, replay and a fresh stage', () => {
    const s = stage(), fresh = stage();
    const snapshot = (p: GroundedPerformance) => {
      p.world.updateWorldMatrix(true, true);
      return [p.prop, ...p.actors.flatMap(({ rig }) => [rig.head, rig.rightArm.hand!, rig.leftArm.hand!, rig.leftLeg.hand!, rig.rightLeg.hand!])].flatMap((o) => o.matrixWorld.elements);
    };
    for (const t of [0, 4.9, 5.7, 9.4, 13.64, 13.66, 17.9]) {
      fresh.update(t); const expected = snapshot(fresh);
      s.update(17.98); s.update(.01); s.update(t);
      expect(maximum(snapshot(s).map((x, i) => Math.abs(x - expected[i])))).toBeLessThan(1e-9);
    }
    [s, fresh].forEach((p) => p.actors.forEach((a) => a.rig.dispose()));
  });

  it('locks each supporting foot in world space while the pelvis travels', () => {
    for (const side of [-1, 1] as const) for (let d = 0; d < 4.79; d += .005) {
      const a = footTarget(d, side), b = footTarget(d + .001, side);
      if (a.planted && b.planted) expect(a.position.distanceTo(b.position)).toBeLessThan(1e-8);
    }
    expect(performanceFrame(4).distance).toBe(performanceFrame(7.4).distance);
  });
});

describe('validated, reusable performance plans', () => {
  it('uses the same capability for new names and literal role order, preserving all words', () => {
    for (const [giver, receiver] of [['Lia', 'Caio'], ['Nina', 'Rui'], ['Caio', 'Lia']]) {
      const text = `${giver} caminha, agacha-se, pega a lanterna e entrega para ${receiver}, que segura e sorri.`;
      const raw = { action: 'handoff', prop: 'lantern', performance: 'grounded-v1', actors: [{ name: giver }, { name: receiver }] };
      const plan = normalizePlan({ scenes: [{ text, story: raw }] }, text, '9:16');
      expect(plan.scenes).toHaveLength(1);
      expect(plan.scenes[0].text).toBe(text);
      expect(plan.scenes[0].story?.performance).toBe('grounded-v1');
      expect(sceneDuration(plan.scenes[0])).toBe(18);
      expect(normalizeStory({ ...raw, actors: [...raw.actors].reverse() }, text)).toBeUndefined();
    }
  });
  it('does not claim the performance can fly, chase or pick up unsupported props', () => {
    const raw = { action: 'handoff', prop: 'hat', performance: 'grounded-v1', actors: [{ name: 'Nina' }, { name: 'Rui' }] };
    expect(normalizeStory(raw, 'Nina pega o chapéu e entrega para Rui.')?.performance).toBeUndefined();
    expect(normalizeStory({ ...raw, action: 'fly' }, 'Nina voa até Rui.')).toBeUndefined();
    expect(normalizeStory({ ...raw, prop: 'lantern' }, 'Nina não pega a lanterna nem entrega para Rui.')).toBeUndefined();
  });
});
