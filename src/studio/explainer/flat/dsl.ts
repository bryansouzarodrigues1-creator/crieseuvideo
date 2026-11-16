/**
 * Flat vector DSL: a small, safe, data-only drawing language for the 2D Flat engine.
 *
 * Hybrid by design: the model (Gemini) is free to draw anything with paths, shapes, gradients and
 * groups, OR to call library components with `use`. Nothing here executes code: every value is clamped,
 * every path is whitelisted, and the whole tree has a node budget, so a weak or misbehaving model can
 * make an ugly drawing but never break rendering.
 *
 * Coordinates: centre-origin "stage units". The visible safe square is -500..500 in both axes
 * (sets extend past it); local object boxes use -100..100 when an object is drawn on its own.
 */
export const NODE_TYPES = ['rect', 'ellipse', 'path', 'poly', 'line', 'text', 'group', 'use'] as const;
export type NodeType = (typeof NODE_TYPES)[number];
export const NODE_ANIMS = ['none', 'pop', 'float', 'pulse', 'spin', 'shake', 'swing', 'sway', 'rise', 'fall', 'bounce', 'drive', 'grow', 'blink', 'flicker', 'wiggle'] as const;
export type NodeAnim = (typeof NODE_ANIMS)[number];

export interface Repeat { n: number; dx: number; dy: number; rot?: number; scale?: number }
export interface FlatNode {
  t: NodeType;
  x: number; y: number;
  w?: number; h?: number; r?: number;
  d?: string; pts?: [number, number][];
  fill?: string; stroke?: string; sw?: number;
  s?: number; rot?: number; op?: number; flip?: boolean;
  text?: string; size?: number;
  anim?: NodeAnim; delay?: number;
  ref?: string; params?: Record<string, string | number | boolean>;
  children?: FlatNode[]; repeat?: Repeat;
}

export const LIMITS = { stage: 900, nodes: 90, expanded: 260, depth: 4, path: 900, pathCmds: 90, pts: 24, repeat: 24, text: 16 } as const;

const num = (v: unknown, d: number, lo: number = -LIMITS.stage, hi: number = LIMITS.stage) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

/** Colors: #hex, a palette token ($ink, $sky, ...) or a gradient: lin:deg:c1:c2[:c3] / rad:c1:c2[:c3]. */
const HEX = /^#[0-9a-f]{3,8}$/i;
const TOKEN = /^\$[a-z][a-z0-9]{1,11}$/i;
export function cleanColor(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (HEX.test(s) || TOKEN.test(s)) return s;
  const g = s.match(/^(lin|rad):(.+)$/i);
  if (!g) return undefined;
  const parts = g[2]!.split(':');
  const angle = g[1]!.toLowerCase() === 'lin' ? Number(parts.shift()) : 0;
  const stops = parts.filter((p) => HEX.test(p) || TOKEN.test(p)).slice(0, 4);
  if (stops.length < 2 || !Number.isFinite(angle)) return undefined;
  return g[1]!.toLowerCase() === 'lin' ? `lin:${Math.round(angle)}:${stops.join(':')}` : `rad:${stops.join(':')}`;
}

/** Only SVG path commands and numbers; bounded length and command count. Returns undefined when unsafe or empty. */
export function cleanPath(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const d = v.trim().replace(/\s+/g, ' ');
  if (!d || d.length > LIMITS.path || !/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/.test(d)) return undefined;
  if (!/^[Mm]/.test(d)) return undefined;
  const cmds = d.match(/[A-Za-z]/g)?.filter((c) => c !== 'e' && c !== 'E') ?? [];
  if (cmds.length > LIMITS.pathCmds) return undefined;
  return d;
}

export interface NormalizeReport { dropped: string[]; clamped: number }
interface Ctx { count: number; report: NormalizeReport; allowUse: boolean }

function normNode(raw: unknown, depth: number, ctx: Ctx): FlatNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const t = NODE_TYPES.includes(o.t as NodeType) ? (o.t as NodeType) : null;
  if (!t) { ctx.report.dropped.push(`tipo inválido: ${String(o.t).slice(0, 20)}`); return null; }
  if (ctx.count >= LIMITS.nodes) { ctx.report.dropped.push('limite de nós'); return null; }
  if (t === 'use' && !ctx.allowUse) { ctx.report.dropped.push('use não permitido aqui'); return null; }
  const n: FlatNode = { t, x: num(o.x, 0), y: num(o.y, 0) };
  if (t === 'path') {
    const d = cleanPath(o.d);
    if (!d) { ctx.report.dropped.push('path inválido'); return null; }
    n.d = d;
  }
  if (t === 'poly' || t === 'line') {
    const pts = Array.isArray(o.pts) ? (o.pts as unknown[]).slice(0, LIMITS.pts).filter((p) => Array.isArray(p) && p.length >= 2).map((p: any) => [num(p[0], 0), num(p[1], 0)] as [number, number]) : [];
    if (pts.length < 2) { ctx.report.dropped.push(`${t} sem pontos`); return null; }
    n.pts = pts;
  }
  if (t === 'rect' || t === 'ellipse') { n.w = num(o.w, 100, 1, 1800); n.h = num(o.h, n.w, 1, 1800); }
  if (t === 'rect' && o.r !== undefined) n.r = num(o.r, 0, 0, 400);
  if (t === 'text') {
    const txt = typeof o.text === 'string' ? o.text.replace(/[\r\n]+/g, ' ').slice(0, LIMITS.text).trim() : '';
    if (!txt) return null;
    n.text = txt; n.size = num(o.size, 60, 12, 220);
  }
  if (t === 'use') {
    if (typeof o.ref !== 'string' || !/^[a-z0-9_:\-]{1,40}$/i.test(o.ref)) { ctx.report.dropped.push('use sem ref'); return null; }
    n.ref = o.ref;
    if (o.params && typeof o.params === 'object') {
      const p: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(o.params as Record<string, unknown>).slice(0, 8)) {
        if (!/^[a-z][a-zA-Z0-9]{0,15}$/.test(k)) continue;
        if (typeof v === 'number' && Number.isFinite(v)) p[k] = v;
        else if (typeof v === 'boolean') p[k] = v;
        else if (typeof v === 'string') p[k] = v.slice(0, 24);
      }
      n.params = p;
    }
    n.w = num(o.w, 200, 1, 1800); n.h = num(o.h, n.w, 1, 1800);
  }
  const fill = cleanColor(o.fill), stroke = cleanColor(o.stroke);
  if (fill) n.fill = fill; else if (o.fill !== undefined && o.fill !== null && o.fill !== 'none') ctx.report.clamped++;
  if (stroke) n.stroke = stroke;
  if (o.sw !== undefined) n.sw = num(o.sw, 0, 0, 60);
  if (o.s !== undefined) n.s = num(o.s, 1, 0.05, 6);
  if (o.rot !== undefined) n.rot = num(o.rot, 0, -360, 360);
  if (o.op !== undefined) n.op = num(o.op, 1, 0, 1);
  if (o.flip === true) n.flip = true;
  n.anim = NODE_ANIMS.includes(o.anim as NodeAnim) ? (o.anim as NodeAnim) : 'none';
  n.delay = num(o.delay, 0, 0, 8);
  if (o.repeat && typeof o.repeat === 'object') {
    const r = o.repeat as Record<string, unknown>;
    n.repeat = { n: Math.round(num(r.n, 1, 1, LIMITS.repeat)), dx: num(r.dx, 0), dy: num(r.dy, 0), rot: r.rot !== undefined ? num(r.rot, 0, -180, 180) : undefined, scale: r.scale !== undefined ? num(r.scale, 1, 0.5, 1.5) : undefined };
  }
  ctx.count++;
  if (t === 'group') {
    if (depth >= LIMITS.depth || !Array.isArray(o.children)) { ctx.report.dropped.push('grupo vazio ou fundo demais'); return null; }
    n.children = (o.children as unknown[]).map((c) => normNode(c, depth + 1, ctx)).filter(Boolean) as FlatNode[];
    if (!n.children.length) return null;
  }
  return n;
}

export function normalizeNodes(raw: unknown, opts: { allowUse?: boolean } = {}): { nodes: FlatNode[]; report: NormalizeReport } {
  const ctx: Ctx = { count: 0, report: { dropped: [], clamped: 0 }, allowUse: opts.allowUse ?? true };
  const nodes = Array.isArray(raw) ? (raw.map((n) => normNode(n, 0, ctx)).filter(Boolean) as FlatNode[]) : [];
  return { nodes, report: ctx.report };
}

/** Number of primitives after expanding repeats (the real draw cost). */
export function expandedCount(nodes: FlatNode[]): number {
  let total = 0;
  for (const n of nodes) {
    const inner = n.t === 'group' ? expandedCount(n.children ?? []) : 1;
    total += inner * (n.repeat?.n ?? 1);
  }
  return total;
}

/** Rough bounding box (stage units) of a node list, ignoring rotation; enough for linting and fitting. */
export interface Box { x0: number; y0: number; x1: number; y1: number }
export function nodeBox(n: FlatNode): Box {
  const s = n.s ?? 1; let b: Box;
  switch (n.t) {
    case 'rect': case 'ellipse': case 'use': b = { x0: -(n.w ?? 100) / 2, x1: (n.w ?? 100) / 2, y0: -(n.h ?? 100) / 2, y1: (n.h ?? 100) / 2 }; break;
    case 'poly': case 'line': { const p = n.pts ?? [[0, 0]]; b = { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), y0: Math.min(...p.map((q) => q[1])), y1: Math.max(...p.map((q) => q[1])) }; break; }
    case 'path': { const nums = (n.d ?? '').match(/-?\d*\.?\d+/g)?.map(Number) ?? [0]; const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1); b = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...(ys.length ? ys : [0])), y1: Math.max(...(ys.length ? ys : [0])) }; break; }
    case 'text': { const hw = ((n.text?.length ?? 3) * (n.size ?? 60) * 0.3); const hh = (n.size ?? 60) * 0.5; b = { x0: -hw, x1: hw, y0: -hh, y1: hh }; break; }
    default: { const kids = (n.children ?? []).map(nodeBox); b = kids.length ? { x0: Math.min(...kids.map((k) => k.x0)), x1: Math.max(...kids.map((k) => k.x1)), y0: Math.min(...kids.map((k) => k.y0)), y1: Math.max(...kids.map((k) => k.y1)) } : { x0: 0, x1: 0, y0: 0, y1: 0 }; }
  }
  b = { x0: n.x + b.x0 * s, x1: n.x + b.x1 * s, y0: n.y + b.y0 * s, y1: n.y + b.y1 * s };
  if (n.repeat && n.repeat.n > 1) { const k = n.repeat.n - 1; b = { x0: Math.min(b.x0, b.x0 + n.repeat.dx * k), x1: Math.max(b.x1, b.x1 + n.repeat.dx * k), y0: Math.min(b.y0, b.y0 + n.repeat.dy * k), y1: Math.max(b.y1, b.y1 + n.repeat.dy * k) }; }
  return b;
}
export function listBox(nodes: FlatNode[]): Box | null {
  if (!nodes.length) return null;
  const bs = nodes.map(nodeBox);
  return { x0: Math.min(...bs.map((b) => b.x0)), x1: Math.max(...bs.map((b) => b.x1)), y0: Math.min(...bs.map((b) => b.y0)), y1: Math.max(...bs.map((b) => b.y1)) };
}

export interface LintIssue { code: 'empty' | 'tiny' | 'huge' | 'offcenter' | 'flat_color' | 'too_few' | 'too_heavy'; message: string }
/**
 * Quality gate for a model-drawn object that must live in a -100..100 box. The messages are written
 * so they can be fed back to the model verbatim in a repair prompt.
 */
export function lintObject(nodes: FlatNode[], half = 100): LintIssue[] {
  const out: LintIssue[] = [];
  if (!nodes.length) return [{ code: 'empty', message: 'Nenhuma forma válida foi desenhada.' }];
  if (nodes.length < 3) out.push({ code: 'too_few', message: 'Desenho simples demais: use pelo menos 4 formas (corpo, detalhe, sombra/brilho).' });
  if (expandedCount(nodes) > LIMITS.expanded) out.push({ code: 'too_heavy', message: `Muitas formas após repeat (máx ${LIMITS.expanded}).` });
  const b = listBox(nodes)!;
  const w = b.x1 - b.x0, h = b.y1 - b.y0, size = Math.max(w, h);
  if (size < half * 0.9) out.push({ code: 'tiny', message: `Objeto pequeno demais (${Math.round(size)} de ${half * 2}). Aumente para ocupar a caixa -${half}..${half}.` });
  if (size > half * 2.6) out.push({ code: 'huge', message: `Objeto grande demais (${Math.round(size)}). Deve caber em -${half}..${half}.` });
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  if (Math.abs(cx) > half * 0.5 || Math.abs(cy) > half * 0.5) out.push({ code: 'offcenter', message: `Objeto descentralizado (centro ${Math.round(cx)},${Math.round(cy)}). Centralize em (0,0).` });
  const fills = new Set<string>();
  const walk = (ns: FlatNode[]) => ns.forEach((n) => { if (n.fill) fills.add(n.fill); if (n.children) walk(n.children); });
  walk(nodes);
  if (fills.size < 2) out.push({ code: 'flat_color', message: 'Use pelo menos 2 cores diferentes (base + detalhe).' });
  return out;
}
