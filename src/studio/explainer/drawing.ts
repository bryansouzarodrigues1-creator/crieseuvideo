/**
 * Free-form drawings the AI writes per scene as a small list of shapes.
 * The AI never makes pixels: it describes primitives and motions, and this code draws them,
 * so any idea in a script (fire, chair, firefighters, hose) costs only text credits.
 */
export const SHAPE_TYPES = ['circle', 'ellipse', 'rect', 'poly', 'line', 'text', 'star', 'flame', 'person', 'car', 'house', 'tree', 'cloud', 'building', 'sun', 'moon', 'heart', 'arrow', 'bubble', 'bust', 'phone', 'laptop', 'pin', 'scale', 'chart', 'coin', 'clock', 'stamp', 'xmark', 'check', 'hand', 'dog', 'cat', 'crowd', 'skyline'] as const;
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

export const DRAWING_GUIDE = `drawing: lista de formas (até ${MAX_SHAPES}) desenhando a cena em cartoon plano com contorno escuro. Coordenadas: centro (0,0), x de -420 a 420, y de -290 (cima) a 430 (baixo); acima de y=-290 fica a legenda, NUNCA desenhe lá. Composição profissional e limpa: UM elemento principal grande por cena + no máximo 3 apoios, 4 a 12 formas no total (no máximo 6 objetos; o excesso é descartado). Objetos NUNCA se sobrepõem: deixe 60+ de espaço entre eles. Nada encostado na borda. Personagem (person) nunca coberto: objetos ficam AO LADO dele (x afastado 280+), balões acima do ombro, setas apontam para o objeto e não para o rosto. Não repita o mesmo objeto/planeta/círculo sem motivo; formas soltas sem significado são proibidas. No máximo 1 text por cena, 1 a 2 palavras (até 12 letras), e nunca repita a frase da legenda. Movimentos suaves e com propósito, só 2 a 4 formas animadas por cena; o resto use pop ou none.
Tipos: circle{x,y,r} ellipse{x,y,w,h} rect{x,y,w,h} (x,y = centro) poly{points:[[x,y],...]} line{points} text{x,y,text,size} star{x,y,r} flame{x,y,size} (fogo animado) person{x,y,size,mood,color} (personagem com rosto; color = roupa).
Objetos prontos (use size 0.5 a 2.5, color = cor principal): car{x,y,size,color} (rodas giram; anim drive atravessa a tela), house{x,y,size,color}, tree{x,y,size}, cloud{x,y,size}, building{x,y,size,color}, sun{x,y,size}, moon{x,y,size}, heart{x,y,size,color}, arrow{x,y,size,color,rot}, bubble{x,y,text,size} (balão de fala).
Peças polidas (prefira-as a montar com formas; o HERÓI da cena deve ser grande, size 1.4 a 2.4, ocupando 60-70% da área): bust{x,y,size,mood} (personagem do peito para cima, sem braços, ideal para falar/reagir; coloque embaixo, y 200 a 260), phone{x,y,size,text} (celular WhatsApp, balões entram sozinhos, text = 1ª mensagem), laptop{x,y,size,text,color} (site carregando), pin{x,y,size,color} (pino de mapa cai e quica), scale{x,y,size} (balança oscilando), chart{x,y,size} (gráfico de barras subindo), coin{x,y,size} (moeda girando), clock{x,y,size} (relógio correndo), stamp{x,y,text,size,color,rot} (selo/carimbo inclinado que bate na tela), xmark/check{x,y,size} (errado/certo carimbado), hand{x,y,size,rot} (mão apontando/tocando), dog/cat{x,y,size,color}, crowd{x,y,size} (multidão), skyline{x,y,size} (cidade com carros passando).
Animações extras: drive (anda da esquerda p/ direita), bounce (quica), grow (cresce do chão), zoom (aproxima), orbit (gira em volta).
Campos comuns: color "#hex", stroke "#hex", rot (graus), anim [${SHAPE_ANIMS.join(', ')}], delay (segundos para entrar).
Use cores vivas, combine formas para montar objetos (cadeira = rects+poly, casa = rect+poly do telhado, mangueira = line grossa). O cenário (setting) já desenha chão e paredes: não redesenhe fundos.`;
