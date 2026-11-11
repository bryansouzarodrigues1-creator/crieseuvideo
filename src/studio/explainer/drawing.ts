/**
 * Free-form drawings the AI writes per scene as a small list of shapes.
 * The AI never makes pixels: it describes primitives and motions, and this code draws them,
 * so any idea in a script (fire, chair, firefighters, hose) costs only text credits.
 */
export const SHAPE_TYPES = ['circle', 'ellipse', 'rect', 'poly', 'line', 'text', 'star', 'flame', 'person', 'car', 'house', 'tree', 'cloud', 'building', 'sun', 'moon', 'heart', 'arrow', 'bubble'] as const;
export const SHAPE_ANIMS = ['none', 'pop', 'float', 'flicker', 'spin', 'shake', 'rise', 'fall', 'pulse', 'swing', 'walk', 'rock', 'drive', 'bounce', 'grow', 'zoom', 'orbit'] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];
export type ShapeAnim = (typeof SHAPE_ANIMS)[number];
export interface Shape {
  type: ShapeType;
  x: number; y: number;
  w?: number; h?: number; r?: number;
  points?: [number, number][];
  color?: string; stroke?: string;
  rot?: number; text?: string; size?: number;
  mood?: string; anim: ShapeAnim; delay: number;
}
export const MAX_SHAPES = 40;
const LIMIT = 560;
const num = (v: unknown, d: number, lo = -LIMIT, hi = LIMIT) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const color = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : undefined);

export function normalizeDrawing(raw: unknown): Shape[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Shape[] = [];
  for (const s of raw.slice(0, MAX_SHAPES)) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    const type = SHAPE_TYPES.includes(o.type as ShapeType) ? (o.type as ShapeType) : null;
    if (!type) continue;
    const pts = Array.isArray(o.points)
      ? (o.points as unknown[]).slice(0, 16).filter((p) => Array.isArray(p) && p.length >= 2).map((p: any) => [num(p[0], 0), num(p[1], 0)] as [number, number])
      : undefined;
    if ((type === 'poly' || type === 'line') && (!pts || pts.length < 2)) continue;
    out.push({
      type, x: num(o.x, 0), y: num(o.y, 0),
      w: num(o.w, 120, 1, 1100), h: num(o.h, 120, 1, 1100), r: num(o.r, 60, 1, 600),
      points: pts, color: color(o.color), stroke: color(o.stroke),
      rot: num(o.rot, 0, -360, 360), size: num(o.size, 1, 0.2, 3),
      text: typeof o.text === 'string' ? o.text.slice(0, 40) : undefined,
      mood: typeof o.mood === 'string' ? o.mood : undefined,
      anim: SHAPE_ANIMS.includes(o.anim as ShapeAnim) ? (o.anim as ShapeAnim) : 'pop',
      delay: num(o.delay, 0, 0, 6),
    });
  }
  return out.length ? out : undefined;
}

export const DRAWING_GUIDE = `drawing: lista de formas (até ${MAX_SHAPES}) desenhando a cena em cartoon plano com contorno escuro. Coordenadas: centro (0,0), x de -450 a 450, y de -450 (cima) a 450 (baixo). Desenhe em camadas do fundo para a frente, com 12 a 30 formas por cena: chão, objetos com detalhes (janelas, portas, pernas de móveis), vários fogos espalhados quando há incêndio, personagens grandes (size 1.2 a 2) agindo na cena. Preencha a tela, nada de cena vazia.
Tipos: circle{x,y,r} ellipse{x,y,w,h} rect{x,y,w,h} (x,y = centro) poly{points:[[x,y],...]} line{points} text{x,y,text,size} star{x,y,r} flame{x,y,size} (fogo animado) person{x,y,size,mood,color} (personagem com rosto; color = roupa).
Objetos prontos (use size 0.5 a 2.5, color = cor principal): car{x,y,size,color} (rodas giram; anim drive atravessa a tela), house{x,y,size,color}, tree{x,y,size}, cloud{x,y,size}, building{x,y,size,color}, sun{x,y,size}, moon{x,y,size}, heart{x,y,size,color}, arrow{x,y,size,color,rot}, bubble{x,y,text,size} (balão de fala).
Animações extras: drive (anda da esquerda p/ direita), bounce (quica), grow (cresce do chão), zoom (aproxima), orbit (gira em volta).
Campos comuns: color "#hex", stroke "#hex", rot (graus), anim [${SHAPE_ANIMS.join(', ')}], delay (segundos para entrar).
Use cores vivas, combine formas para montar objetos (cadeira = rects+poly, casa = rect+poly do telhado, mangueira = line grossa).`;
