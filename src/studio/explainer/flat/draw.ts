import { LIMITS, NODE_ANIMS, type FlatNode } from './dsl';
import { token, NAMED, type Palette } from './palette';

export interface Env {
  c: CanvasRenderingContext2D;
  /** Seconds since the scene started. */
  t: number;
  pal: Palette;
  /** Pixels per stage unit. */
  u: number;
  depth?: number;
}
export type Component = (env: Env, n: FlatNode, params: Record<string, string | number | boolean>) => void;
const registry = new Map<string, Component>();
export const registerComponent = (name: string, fn: Component) => { registry.set(name, fn); };
export const hasComponent = (name: string) => registry.has(name);
export const componentNames = () => [...registry.keys()];

const spring = (x: number) => (x <= 0 ? 0 : x >= 3 ? 1 : 1 - Math.exp(-5 * x) * Math.cos(9 * x));

/** Palette-aware color; gradients are built against the node's local box. */
export function paint(env: Env, spec: string | undefined, box: { w: number; h: number }): string | CanvasGradient | undefined {
  if (!spec) return undefined;
  const one = (s: string) => (s.startsWith('$') ? token(env.pal, s.slice(1)) ?? NAMED.gray! : s);
  if (spec.startsWith('lin:') || spec.startsWith('rad:')) {
    const parts = spec.split(':'); const kind = parts.shift()!;
    const ang = kind === 'lin' ? (Number(parts.shift()) * Math.PI) / 180 : 0;
    const stops = parts.map(one), hw = box.w / 2, hh = box.h / 2;
    const g = kind === 'lin'
      ? env.c.createLinearGradient(-Math.cos(ang) * hw, -Math.sin(ang) * hh, Math.cos(ang) * hw, Math.sin(ang) * hh)
      : env.c.createRadialGradient(0, 0, 0, 0, 0, Math.max(hw, hh));
    stops.forEach((s, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), s));
    return g;
  }
  return one(spec);
}

/** Per-node motion presets. Continuous ones start at `delay`; `pop` springs in. */
function motion(anim: string, t: number, delay: number) {
  const lt = t - delay, m = { dx: 0, dy: 0, rot: 0, sc: 1, alpha: 1 };
  if (anim === 'pop') { m.sc = Math.max(0.0001, spring(lt / 0.45)); m.alpha = lt < 0 ? 0 : 1; return m; }
  if (lt < 0) { m.alpha = 0; return m; }
  switch (anim) {
    case 'float': m.dy = Math.sin(lt * 1.6) * 12; break;
    case 'pulse': m.sc = 1 + 0.06 * Math.sin(lt * 4); break;
    case 'spin': m.rot = lt * 120; break;
    case 'shake': m.dx = Math.sin(lt * 38) * 4; break;
    case 'swing': m.rot = Math.sin(lt * 2.2) * 14; break;
    case 'sway': m.rot = Math.sin(lt * 1.3) * 4; m.dx = Math.sin(lt * 1.3) * 5; break;
    case 'rise': m.dy = -Math.min(1, lt / 2.2) * 140; break;
    case 'fall': m.dy = Math.min(1, lt / 1.4) * 220; break;
    case 'bounce': m.dy = -Math.abs(Math.sin(lt * 3.2)) * 40; break;
    case 'drive': m.dx = -700 + ((lt * 240) % 1500); break;
    case 'grow': m.sc = Math.min(1, Math.max(0.01, lt / 1.1)); break;
    case 'blink': m.alpha = Math.sin(lt * 5) > 0.2 ? 1 : 0.15; break;
    case 'flicker': m.alpha = 0.72 + 0.28 * Math.sin(lt * 17); break;
    case 'wiggle': m.rot = Math.sin(lt * 12) * 5; break;
  }
  return m;
}

const hasPath2D = typeof Path2D !== 'undefined';

export function drawNodes(env: Env, nodes: FlatNode[]) {
  for (const n of nodes) drawNode(env, n);
}

export function drawNode(env: Env, n: FlatNode) {
  const c = env.c, reps = n.repeat?.n ?? 1;
  const mo = motion(n.anim && NODE_ANIMS.includes(n.anim) ? n.anim : 'none', env.t, n.delay ?? 0);
  if (mo.alpha <= 0.001) return;
  c.save();
  c.translate(n.x + mo.dx, n.y + mo.dy);
  c.rotate(((n.rot ?? 0) + mo.rot) * Math.PI / 180);
  const sc = (n.s ?? 1) * mo.sc;
  c.scale(n.flip ? -sc : sc, sc);
  c.globalAlpha *= (n.op ?? 1) * mo.alpha;
  for (let i = 0; i < reps; i++) {
    if (i > 0 && n.repeat) {
      c.translate(n.repeat.dx / sc, n.repeat.dy / sc);
      if (n.repeat.rot) c.rotate((n.repeat.rot * Math.PI) / 180);
      if (n.repeat.scale) c.scale(n.repeat.scale, n.repeat.scale);
    }
    drawBody(env, n);
  }
  c.restore();
}

function drawBody(env: Env, n: FlatNode) {
  const c = env.c;
  const w = n.w ?? 100, h = n.h ?? w;
  switch (n.t) {
    case 'rect': {
      c.beginPath();
      const r = Math.min(n.r ?? 0, w / 2, h / 2);
      if (r > 0 && c.roundRect) c.roundRect(-w / 2, -h / 2, w, h, r); else c.rect(-w / 2, -h / 2, w, h);
      return fillStroke(env, n, { w, h });
    }
    case 'ellipse': c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); return fillStroke(env, n, { w, h });
    case 'poly': case 'line': {
      const p = n.pts ?? []; if (p.length < 2) return;
      c.beginPath(); c.moveTo(p[0]![0], p[0]![1]); for (let i = 1; i < p.length; i++) c.lineTo(p[i]![0], p[i]![1]);
      if (n.t === 'poly') c.closePath();
      const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      return fillStroke(env, n.t === 'line' ? { ...n, fill: undefined, stroke: n.stroke ?? n.fill ?? '$ink', sw: n.sw || 8 } : n, { w: Math.max(...xs) - Math.min(...xs) || 1, h: Math.max(...ys) - Math.min(...ys) || 1 });
    }
    case 'path': {
      if (!hasPath2D || !n.d) return;
      const path = new Path2D(n.d);
      const nums = n.d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [0];
      const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
      const bw = (Math.max(...xs) - Math.min(...xs)) || 1, bh = (Math.max(...(ys.length ? ys : [1])) - Math.min(...(ys.length ? ys : [0]))) || 1;
      const fill = paint(env, n.fill, { w: bw, h: bh }), st = paint(env, n.stroke, { w: bw, h: bh });
      if (fill) { c.fillStyle = fill; c.fill(path); }
      if (st && (n.sw ?? 0) > 0) { c.strokeStyle = st; c.lineWidth = n.sw!; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(path); }
      return;
    }
    case 'text': {
      c.font = `800 ${n.size ?? 60}px 'Plus Jakarta Sans', 'Lilita One', sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const fill = paint(env, n.fill ?? '$ink', { w: 100, h: 100 }), st = paint(env, n.stroke, { w: 100, h: 100 });
      if (st && (n.sw ?? 0) > 0) { c.strokeStyle = st; c.lineWidth = n.sw!; c.lineJoin = 'round'; c.strokeText(n.text ?? '', 0, 0); }
      if (fill) { c.fillStyle = fill; c.fillText(n.text ?? '', 0, 0); }
      return;
    }
    case 'group': {
      for (const k of n.children ?? []) drawNode({ ...env, depth: (env.depth ?? 0) + 1 }, k);
      return;
    }
    case 'use': {
      const fn = n.ref ? registry.get(n.ref.replace(/^library:/, '')) : undefined;
      if ((env.depth ?? 0) > LIMITS.depth) return;
      if (fn) fn({ ...env, depth: (env.depth ?? 0) + 1 }, n, n.params ?? {});
      return;
    }
  }
}

function fillStroke(env: Env, n: FlatNode, box: { w: number; h: number }) {
  const c = env.c;
  const fill = paint(env, n.fill, box), st = paint(env, n.stroke, box);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (st && (n.sw ?? 0) > 0) { c.strokeStyle = st; c.lineWidth = n.sw!; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
}
