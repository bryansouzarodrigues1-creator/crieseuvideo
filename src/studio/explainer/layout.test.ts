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
  it('never leaves two objects stacked on each other', () => {
    const messy = [
      S({ type: 'laptop', x: 0, y: 40, size: 1.6 }), S({ type: 'bust', x: -40, y: 220, size: 1.2 }),
      S({ type: 'text', x: 0, y: 60, text: 'Design Texto' }), S({ type: 'stamp', x: 30, y: -40, text: 'REC' }),
      S({ type: 'chart', x: 60, y: 0, size: 1.2 }), S({ type: 'coin', x: -60, y: 30 }), S({ type: 'phone', x: 10, y: 10, size: 1.3 }),
    ];
    const out = layoutDrawing(messy);
    expect(out[0]!.type).toBe('laptop'); // the hero (listed first) always stays
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const A = shapeBox(out[i]!), B = shapeBox(out[j]!);
      const ov = Math.max(0, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)) * Math.max(0, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0));
      const small = Math.min((A.x1 - A.x0) * (A.y1 - A.y0), (B.x1 - B.x0) * (B.y1 - B.y0));
      expect(ov).toBeLessThanOrEqual(small * 0.25);
    }
  });
  it('keeps at most one short word label per scene', () => {
    const out = layoutDrawing([S({ type: 'text', x: -200, y: 0, text: 'um dois tres quatro' }), S({ type: 'text', x: 200, y: 200, text: 'outro' })]);
    const texts = out.filter((s) => s.type === 'text');
    expect(texts.length).toBe(1);
    expect(texts[0]!.text!.split(' ').length).toBeLessThanOrEqual(3);
  });
  it('caps a scene at 6 foreground objects', () => {
    const many = Array.from({ length: 10 }, (_, i) => S({ type: 'circle', x: -380 + i * 85, y: 0, r: 30 }));
    expect(layoutDrawing(many).length).toBe(6);
  });
});
