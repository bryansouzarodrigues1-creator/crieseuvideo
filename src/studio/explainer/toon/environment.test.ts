import { expect, it } from 'vitest';
import { Group } from 'three';
import { updateEnvironment } from './environment';

it('repeating, seeking and exporting the same time cannot accumulate cloud movement', () => {
  const world = new Group(), cloud = new Group(), fixed = new Group();
  cloud.position.x = -8; cloud.userData = { drift: 0.5, driftOriginX: -8 };
  fixed.position.x = 2; world.add(cloud, fixed);
  updateEnvironment(world, 3); const expected = cloud.position.x;
  for (const time of [10, 1, 3, 3, 0, 8, 3]) updateEnvironment(world, time);
  expect(cloud.position.x).toBe(expected);
  expect(fixed.position.x).toBe(2);
  updateEnvironment(world, 0); expect(cloud.position.x).toBe(-8);
});
