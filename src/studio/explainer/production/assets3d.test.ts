import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildArticulatedAsset } from './assets3d';
import { initialState, socketWorld, type ProductionAsset } from './score';

describe('rendered mechanism rig agrees with score kinematics', () => {
  it('keeps the real hook joint at the declared world contact during combined motion', () => {
    const definition: ProductionAsset = { id: 'crane', kind: 'tower_crane', position: [2, 0, -1], yaw: .31, color: '#F4BA3F', evidence: 'guindaste', initial: {} };
    const asset = buildArticulatedAsset(definition), state = initialState(definition);
    for (const angle of [-1.2, 0, 1.5]) for (const radius of [2, 5.3, 8]) {
      state.joints.slew = angle; state.joints.trolley = radius; state.joints.hoist = 4.75;
      asset.update(state, 0); asset.root.updateMatrixWorld(true);
      const hook = asset.root.getObjectByName('hook')!.getWorldPosition(new THREE.Vector3());
      expect(hook.distanceTo(new THREE.Vector3(...socketWorld(definition, state, 'hook').position))).toBeLessThan(1e-9);
    }
  });
  it('builds finite, bounded original geometry for all machine types', () => {
    for (const kind of ['tower_crane', 'cargo', 'truck', 'lift'] as const) {
      const definition: ProductionAsset = { id: 'asset', kind, position: [0, 0, 0], yaw: 0, color: '#55A2A8', initial: {}, evidence: kind };
      const asset = buildArticulatedAsset(definition); asset.update(initialState(definition), 0);
      const bounds = new THREE.Box3().setFromObject(asset.root);
      expect(bounds.isEmpty()).toBe(false);
      expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
      expect(bounds.max.y).toBeLessThan(18);
    }
  });
});
