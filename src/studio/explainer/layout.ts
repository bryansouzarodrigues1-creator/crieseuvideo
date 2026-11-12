/**
 * Composition pass for AI drawings: keeps every shape inside the hero zone (never under the caption
 * or off-screen), pushes objects off the characters' faces and draws text/balloons last.
 * Runs at render time so old saved projects and gallery drawings are fixed too.
 */
import type { Shape } from './drawing';

export const SAFE = { left: -420, right: 420, top: -290, bottom: 430 };
type Box = { x0: number; y0: number; x1: number; y1: number };

/** Approximate extents of a shape in drawing units (centre-relative). */
export function shapeBox(s: Shape): Box {
  const z = s.size ?? 1, at = (hw: number, up: number, down: number) => ({ x0: s.x - hw * z, x1: s.x + hw * z, y0: s.y - up * z, y1: s.y + down * z });
  switch (s.type) {
    case 'circle': case 'star': { const r = s.r ?? 60; return { x0: s.x - r, x1: s.x + r, y0: s.y - r, y1: s.y + r }; }
    case 'rect': case 'ellipse': { const w = (s.w ?? 120) / 2, h = (s.h ?? 120) / 2; return { x0: s.x - w, x1: s.x + w, y0: s.y - h, y1: s.y + h }; }
    case 'poly': case 'line': { const p = s.points ?? [[s.x, s.y]]; return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), y0: Math.min(...p.map((q) => q[1])), y1: Math.max(...p.map((q) => q[1])) }; }
    case 'text': { const hw = (s.text?.length ?? 4) * 19; return at(hw, 36, 36); }
    case 'person': return at(140, 150, 195);
    case 'bust': return at(200, 175, 280);
    case 'phone': return at(150, 270, 270);
    case 'laptop': return at(335, 200, 190);
    case 'pin': return at(80, 115, 70);
    case 'scale': return at(320, 170, 160);
    case 'chart': return at(240, 190, 170);
    case 'clock': return at(145, 145, 145);
    case 'xmark': case 'check': return at(115, 115, 115);
    case 'stamp': { const hw = Math.max(80, (s.text?.length ?? 2) * 22 + 40); return at(hw, 60, 60); }
    case 'hand': return at(65, 145, 135);
    case 'dog': case 'cat': return at(190, 160, 125);
    case 'crowd': return at(350, 60, 125);
    case 'skyline': return at(385, 330, 160);
    case 'flame': return at(70, 130, 60);
    case 'car': return at(170, 90, 72);
    case 'house': return at(160, 200, 100);
    case 'tree': return at(135, 220, 100);
    case 'building': return at(90, 320, 100);
    case 'sun': return at(140, 140, 140);
    case 'bubble': { const hw = Math.max(60, (s.text?.length ?? 3) * 13 + 30); return at(hw, 60, 80); }
    case 'arrow': return at(130, 65, 65);
    default: return at(90, 80, 80);
  }
}
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const isBackdrop = (s: Shape) => (s.type === 'rect' || s.type === 'ellipse' || s.type === 'poly') && (() => { const b = shapeBox(s); return b.x1 - b.x0 >= 600; })();

function move(s: Shape, dx: number, dy: number): Shape {
  return { ...s, x: s.x + dx, y: s.y + dy, points: s.points?.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
}
function scaleAbout(s: Shape, k: number, cx: number, cy: number): Shape {
  const P = (x: number, y: number) => [cx + (x - cx) * k, cy + (y - cy) * k] as [number, number];
  const [x, y] = P(s.x, s.y);
  return { ...s, x, y, w: s.w && s.w * k, h: s.h && s.h * k, r: s.r && s.r * k, size: s.type === 'line' ? s.size : (s.size ?? 1) * k, points: s.points?.map(([a, b]) => P(a, b)) };
}
/** Shift a shape so its box stays inside the safe zone (shrinking it if it is bigger than the zone). */
function contain(s: Shape): Shape {
  let b = shapeBox(s);
  const W = SAFE.right - SAFE.left, H = SAFE.bottom - SAFE.top;
  const k = Math.min(1, W / (b.x1 - b.x0 || 1), H / (b.y1 - b.y0 || 1));
  if (k < 1) { s = scaleAbout(s, k, s.x, s.y); b = shapeBox(s); }
  const dx = s.anim === 'drive' ? 0 : b.x0 < SAFE.left ? SAFE.left - b.x0 : b.x1 > SAFE.right ? SAFE.right - b.x1 : 0;
  const dy = b.y0 < SAFE.top ? SAFE.top - b.y0 : b.y1 > SAFE.bottom ? SAFE.bottom - b.y1 : 0;
  return dx || dy ? move(s, dx, dy) : s;
}

export function layoutDrawing(input: Shape[]): Shape[] {
  // backdrops (floors, walls, desks) only must not climb under the caption
  let shapes = input.map((s) => {
    if (s.type === 'text') { const max = 820 / Math.max(1, (s.text?.length ?? 1) * 38); return { ...s, size: Math.min(s.size ?? 1, max, 1.6) }; }
    return s;
  });
  shapes = shapes.map((s) => {
    if (!isBackdrop(s)) return contain(s);
    const b = shapeBox(s); return b.y0 < SAFE.top ? move(s, 0, SAFE.top - b.y0) : s;
  });
  // keep faces clear: anything overlapping a character's head slides sideways
  const headOf = (p: Shape): Box => { const pb = shapeBox(p); return { x0: pb.x0 + 30, x1: pb.x1 - 30, y0: pb.y0, y1: pb.y0 + (pb.y1 - pb.y0) * 0.5 }; };
  for (let i = 0; i < shapes.length; i++) {
    let s = shapes[i]!;
    if (s.type === 'person' || s.type === 'bust' || isBackdrop(s) || s.anim === 'drive') continue;
    for (let j = 0; j < shapes.length; j++) {
      const p = shapes[j]!;
      if (p.type !== 'person' && p.type !== 'bust') continue;
      let head = headOf(p), b = shapeBox(s);
      if (overlap(head, b) <= 0) continue;
      const side = p.x <= 0 ? 1 : -1;
      s = contain(move(s, side > 0 ? head.x1 - b.x0 + 20 : head.x0 - b.x1 - 20, s.type === 'bubble' ? head.y0 - b.y1 + 40 : 0));
      b = shapeBox(s);
      // not enough room beside: the character steps the other way
      const left = side > 0 ? head.x1 - b.x0 + 20 : head.x0 - b.x1 - 20;
      if (overlap(head, b) > 0 && Math.abs(left) > 0) { shapes[j] = contain(move(p, -left, 0)); head = headOf(shapes[j]!); if (overlap(head, b) > 0) s = contain(scaleAbout(s, 0.7, s.x, s.y)); }
    }
    shapes[i] = s;
  }
  // two characters never stand inside each other
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    const a = shapes[i]!, b = shapes[j]!;
    if (a.type !== 'person' || b.type !== 'person') continue;
    const A = shapeBox(a), B = shapeBox(b), ov = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
    if (ov > 40) { const d = (ov - 20) / 2, sgn = a.x <= b.x ? 1 : -1; shapes[i] = contain(move(a, -sgn * d, 0)); shapes[j] = contain(move(b, sgn * d, 0)); }
  }
  // labels and speech balloons read on top of everything
  const front = (s: Shape) => s.type === 'text' || s.type === 'bubble';
  return [...shapes.filter((s) => !front(s)), ...shapes.filter(front)];
}

const cache = new WeakMap<Shape[], Shape[]>();
export const laidOut = (shapes: Shape[]) => { let v = cache.get(shapes); if (!v) { v = layoutDrawing(shapes); cache.set(shapes, v); } return v; };
