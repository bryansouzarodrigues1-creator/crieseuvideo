import type { Group } from 'three';

/** Seeking, repeated frames and exports must use the same position at the same scene time. */
export function updateEnvironment(world: Group, sceneTime: number) {
  for (const object of world.children) {
    const { drift, driftOriginX } = object.userData;
    if (typeof drift === 'number' && typeof driftOriginX === 'number') {
      object.position.x = driftOriginX + Math.max(0, sceneTime) * 0.24 * drift;
    }
  }
}
