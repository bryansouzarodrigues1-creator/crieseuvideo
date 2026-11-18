import { describe, expect, it } from 'vitest';
import { separate, type Body, type Solid } from './separation';

const body = (id: string, x: number, z: number, y = 0): Body => ({ id, x, z, y, radius: .32 });
const crate: Solid = { id: 'crate', min: [2, 0, -.5], max: [3, .8, .5] };

describe('body separation', () => {
  it('pushes overlapping actors apart to the minimum distance', () => {
    const shift = separate([body('a', 0, 0), body('b', .2, 0)], []);
    const a = shift.get('a')!, b = shift.get('b')!, gap = Math.hypot(.2 + b[0] - a[0], b[1] - a[1]);
    expect(gap).toBeGreaterThanOrEqual(.69); expect(a[0]).toBeLessThan(0); expect(b[0]).toBeGreaterThan(0);
  });
  it('handles actors at exactly the same spot', () => { expect(separate([body('a', 1, 1), body('b', 1, 1)], []).size).toBe(2); });
  it('leaves actors that are already apart alone', () => { expect(separate([body('a', 0, 0), body('b', 1.2, 0)], [crate]).size).toBe(0); });
  it('moves an actor standing inside a solid out through the nearest face', () => {
    const shift = separate([body('a', 2.2, 0)], [crate]);
    expect(shift.get('a')![0]).toBeLessThan(0); expect(2.2 + shift.get('a')![0]).toBeLessThanOrEqual(2 - .32 + 1e-6);
  });
  it('does not push an actor standing on top of the solid or one passing entirely beneath it', () => {
    expect(separate([body('a', 2.5, 0, .8)], [crate]).size).toBe(0);
    expect(separate([body('a', 2.5, 0, -3)], [{ ...crate, min: [2, 0, -.5], max: [3, .8, .5] }], { bodyHeight: 1.7 }).size).toBe(0);
  });
  it('respects exemptions for deliberate contact', () => {
    expect(separate([body('a', 2.2, 0)], [crate], { ignoreSolid: () => true }).size).toBe(0);
    expect(separate([body('a', 0, 0), body('b', .2, 0)], [], { ignorePair: () => true }).size).toBe(0);
  });
});

describe('pinned bodies', () => {
  it('lets the free actor yield completely to one that is mid-contact', () => {
    const shift = separate([body('a', 0, 0), body('b', .2, 0)], [], { pinned: new Set(['a']) });
    expect(shift.has('a')).toBe(false); expect(.2 + shift.get('b')![0]).toBeGreaterThanOrEqual(.69);
    expect(separate([body('a', 0, 0), body('b', .2, 0)], [], { pinned: new Set(['a', 'b']) }).size).toBe(0);
    expect(separate([body('a', 2.2, 0)], [crate], { pinned: new Set(['a']) }).size).toBe(0);
  });
});
