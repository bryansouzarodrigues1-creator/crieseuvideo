import { describe, it, expect } from 'vitest';
import { layoutDrawing, shapeBox, SAFE } from './layout';
import type { Shape } from './drawing';
const S = (o: Partial<Shape>): Shape => ({ type: 'circle', x: 0, y: 0, anim: 'pop', delay: 0, ...o } as Shape);

describe('drawing layout', () => {
  it('pulls off-screen objects back inside the frame', () => {
    const [p] = layoutDrawing([S({ type: 'person', x: 430, y: 200, size: 1.5 })]);
    const b = shapeBox(p!);
    expect(b.x1).toBeLessThanOrEqual(SAFE.right + 0.01);
  });
  it('keeps shapes out of the caption zone', () => {
    const [s] = layoutDrawing([S({ type: 'circle', x: 0, y: -440, r: 60 })]);
    expect(shapeBox(s!).y0).toBeGreaterThanOrEqual(SAFE.top - 0.01);
  });
  it('moves an object off a character face', () => {
    const out = layoutDrawing([S({ type: 'person', x: 0, y: 150, size: 1.2 }), S({ type: 'car', x: 0, y: 40 })]);
    const p = out.find((s) => s.type === 'person')!, car = out.find((s) => s.type === 'car')!;
    const pb = shapeBox(p), cb = shapeBox(car);
    expect(cb.x0 >= pb.x1 - 31 || cb.x1 <= pb.x0 + 31).toBe(true);
  });
  it('draws text and balloons last', () => {
    const out = layoutDrawing([S({ type: 'text', text: 'OI' }), S({ type: 'circle', x: 0, y: 200 })]);
    expect(out[out.length - 1]!.type).toBe('text');
  });
});
