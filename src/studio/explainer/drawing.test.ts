import { describe, it, expect } from 'vitest';
import { normalizeDrawing, MAX_SHAPES } from './drawing';
import { normalizePlan } from './plan';

describe('free AI drawings', () => {
  it('keeps valid shapes, clamps coordinates and drops unknown types', () => {
    const d = normalizeDrawing([{ type: 'flame', x: 9999, y: 0, anim: 'flicker' }, { type: 'laser', x: 0, y: 0 }, { type: 'poly', points: [[0, 0]] }])!;
    expect(d).toHaveLength(1);
    expect(d[0]!.x).toBe(560);
    expect(d[0]!.anim).toBe('flicker');
  });
  it('caps the number of shapes', () => {
    expect(normalizeDrawing(Array.from({ length: 90 }, () => ({ type: 'circle', x: 0, y: 0 })))!).toHaveLength(MAX_SHAPES);
  });
  it('custom scene without a drawing falls back to a ready visual', () => {
    const p = normalizePlan({ scenes: [{ text: 'O relógio corria.', visual: 'custom' }] }, 'x', '9:16');
    expect(p.scenes[0]!.visual).not.toBe('custom');
  });
});
