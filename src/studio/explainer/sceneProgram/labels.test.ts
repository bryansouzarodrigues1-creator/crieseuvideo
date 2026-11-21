import { describe, expect, it } from 'vitest';
import { labelProgress, layoutLabels, normalizeLabels } from './labels';

const fail = (m: string): never => { throw new Error(m); };
const nodes = new Set(['saco', 'motor']), sources = new Set(['s1', 's2']);

describe('labels', () => {
  it('normalises valid labels and fills defaults', () => {
    const [l] = normalizeLabels([{ sourceId: 's1', node: 'saco', text: '  200   SACOS ' }], nodes, sources, fail);
    expect(l).toEqual({ sourceId: 's1', node: 'saco', text: '200 SACOS', begin: .1, end: .9, tone: 'info' });
    expect(normalizeLabels(undefined, nodes, sources, fail)).toEqual([]);
  });
  it('rejects unknown nodes, phrases, tones, fields, markup and too many per shot', () => {
    const base = { sourceId: 's1', node: 'saco', text: 'ok' };
    for (const bad of [{ ...base, node: 'x' }, { ...base, sourceId: 's9' }, { ...base, tone: 'neon' }, { ...base, extra: 1 }, { ...base, text: '<b>oi</b>' }, { ...base, text: '' }, { ...base, text: 'x'.repeat(29) }, { ...base, begin: .5, end: .55 }, { ...base, end: 1.2 }])
      expect(() => normalizeLabels([bad], nodes, sources, fail), JSON.stringify(bad)).toThrow();
    expect(() => normalizeLabels(Array.from({ length: 4 }, () => base), nodes, sources, fail)).toThrow(/no máximo 3/);
  });
  it('pops in with a spring, holds, then fades out before the end', () => {
    const l = { begin: .2, end: .8 };
    expect(labelProgress(l, .1, 4)).toBe(0); expect(labelProgress(l, .9, 4)).toBe(0);
    expect(labelProgress(l, .2 + .16 / 4, 4)).toBeGreaterThan(.5); // 0.16 s in
    expect(labelProgress(l, .5, 4)).toBeCloseTo(1, 5);
    expect(labelProgress(l, .8 - .1 / 4, 4)).toBeLessThan(.5);
  });
  it('keeps pills inside the frame, above the caption band, and apart from each other', () => {
    const measure = (t: string) => t.length * 20, W = 1080, H = 1920;
    const placed = layoutLabels([{ text: 'UM', tone: 'info', x: 0, y: .3, k: 1 }, { text: 'DOIS', tone: 'warn', x: .02, y: .3, k: 1 }, { text: 'LONGE', tone: 'good', x: 1.4, y: -.9, k: 1 }, { text: 'OFF', tone: 'info', x: 0, y: 0, k: 0 }], W, H, measure, 1);
    expect(placed).toHaveLength(3);
    for (const p of placed) { expect(p.px - p.w / 2).toBeGreaterThanOrEqual(0); expect(p.px + p.w / 2).toBeLessThanOrEqual(W); expect(p.py + p.h / 2).toBeLessThanOrEqual(H * .5 + 1); expect(p.py - p.h / 2).toBeGreaterThanOrEqual(0); }
    const [a, b] = placed; expect(Math.abs(a!.py - b!.py)).toBeGreaterThanOrEqual(a!.h);
  });
});
