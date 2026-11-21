import { describe, expect, it } from 'vitest';
import { Odometer, STRIDE, lifeAt, seedOf } from './life';

describe('actor life', () => {
  it('stands still and breathes when not moving, with each actor out of phase', () => {
    const a = lifeAt(seedOf('ana'), 1.3, 0, 0), b = lifeAt(seedOf('beto'), 1.3, 0, 0);
    expect(a.walk).toBe(0);
    expect(a.leftFoot.map(Math.abs)).toEqual([0, 0, 0]); expect(a.rightFoot.map(Math.abs)).toEqual([0, 0, 0]);
    expect(a.hipsY).not.toBe(b.hipsY);
    expect(Math.abs(a.hipsY)).toBeLessThan(.01); expect(Math.abs(a.hipsRoll)).toBeLessThan(.03);
  });
  it('walks with opposite legs and arms, lifting only the swinging foot', () => {
    const quarter = lifeAt(0, 0, STRIDE / 4, 1.2);
    expect(quarter.walk).toBe(1);
    expect(quarter.leftFoot[2]).toBeGreaterThan(.1); expect(quarter.rightFoot[2]).toBeLessThan(-.1);
    expect(quarter.leftHand[2]).toBeLessThan(-.1); expect(quarter.rightHand[2]).toBeGreaterThan(.1);
    const swing = lifeAt(0, 0, 0, 1.2);
    expect(swing.leftFoot[1] + swing.rightFoot[1]).toBeCloseTo(.15, 5); // exactly one foot is off the ground
  });
  it('is a pure function of its inputs', () => { expect(lifeAt(2, 3.3, 4.1, .9)).toEqual(lifeAt(2, 3.3, 4.1, .9)); });
  it('keeps every limb target within reach of the rig', () => {
    for (let d = 0; d < STRIDE; d += .05) {
      const l = lifeAt(1, d, d, 3);
      for (const f of [l.leftFoot, l.rightFoot]) expect(Math.hypot(1.02 + l.hipsY - (.06 + f[1]), f[2])).toBeLessThan(.985); // foot sits right under its hip
      for (const h of [l.leftHand, l.rightHand]) expect(Math.hypot(.045, .69, h[2])).toBeLessThan(.79);
    }
  });
  it('reads distance and speed from a sampled path at any time', () => {
    const odo = new Odometer(.1, Array.from({ length: 51 }, (_, i) => [i * .1, 0] as const)); // 1 m/s for 5 s
    expect(odo.distance(2.5)).toBeCloseTo(2.5, 5);
    expect(odo.speed(2.5)).toBeCloseTo(1, 3);
    expect(odo.speed(0)).toBeGreaterThanOrEqual(0);
    expect(odo.distance(99)).toBeCloseTo(5, 5);
  });
});
