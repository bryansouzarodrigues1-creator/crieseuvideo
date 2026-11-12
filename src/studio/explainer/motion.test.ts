import { describe, it, expect } from 'vitest';
import { spring } from './render';
import { layoutDrawing } from './layout';
import { normalizeDrawing } from './drawing';

describe('spring entrance', () => {
  it('starts at 0, overshoots above 1 and settles at 1', () => {
    expect(spring(0)).toBe(0);
    expect(Math.max(...[0.2, 0.3, 0.35, 0.4].map(spring))).toBeGreaterThan(1.1);
    expect(spring(3)).toBe(1);
  });
});
describe('new props', () => {
  it('accepts polished props like phone and bust', () => {
    const d = normalizeDrawing([{ type: 'phone', x: 0, y: 0 }, { type: 'bust', x: 0, y: 240 }])!;
    expect(d.map((s) => s.type)).toEqual(['phone', 'bust']);
  });
  it('keeps a phone off the bust face', () => {
    const out = layoutDrawing(normalizeDrawing([{ type: 'bust', x: 0, y: 200 }, { type: 'phone', x: 0, y: 100, size: 0.6 }])!);
    const bust = out.find((s) => s.type === 'bust')!, phone = out.find((s) => s.type === 'phone')!;
    expect(Math.abs(bust.x - phone.x)).toBeGreaterThan(100);
  });
});
