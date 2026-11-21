/** On-screen call-outs ("200 SACOS", "SEM LUZ", "10 SACOS: 500 kg") that pop in on a named object, like the
 * reference explainers. Declared as data by the director, validated here, projected by the stage and painted by
 * the 2D overlay, so preview and export stay identical. Pure maths: no THREE, no canvas. */
export const LABEL_TONES = ['info', 'warn', 'good', 'number'] as const;
export type LabelTone = (typeof LABEL_TONES)[number];
export interface ProgramLabel { sourceId: string; node: string; text: string; begin: number; end: number; tone: LabelTone }
export const MAX_LABELS_PER_SHOT = 3, MAX_LABEL_CHARS = 28;

export const LABEL_LOOK: Record<LabelTone, { fill: string; text: string; edge: string }> = {
  info: { fill: '#FFD23F', text: '#1B1B1B', edge: '#1B1B1B' },
  warn: { fill: '#E63946', text: '#FFFFFF', edge: '#1B1B1B' },
  good: { fill: '#2BB673', text: '#FFFFFF', edge: '#1B1B1B' },
  number: { fill: '#2F80ED', text: '#FFFFFF', edge: '#1B1B1B' },
};

/** Validates the label list; `fail` throws the engine's own error type. */
export function normalizeLabels(raw: unknown, nodeIds: Set<string>, sourceIds: Set<string>, fail: (message: string) => never): ProgramLabel[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 40) return fail('A lista de rótulos é inválida ou grande demais.');
  const perShot = new Map<string, number>();
  return raw.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Um rótulo precisa ser um objeto.');
    const r = value as Record<string, unknown>;
    for (const key of Object.keys(r)) if (!['sourceId', 'node', 'text', 'begin', 'end', 'tone'].includes(key)) return fail('Um rótulo tem um campo desconhecido.');
    const text = typeof r.text === 'string' ? r.text.replace(/\s+/g, ' ').trim() : '';
    if (!text || text.length > MAX_LABEL_CHARS || /[\u0000-\u001f<>]/.test(text)) return fail(`O texto de um rótulo precisa ter de 1 a ${MAX_LABEL_CHARS} caracteres simples.`);
    if (typeof r.sourceId !== 'string' || !sourceIds.has(r.sourceId)) return fail('Um rótulo cita uma frase inexistente.');
    if (typeof r.node !== 'string' || !nodeIds.has(r.node)) return fail('Um rótulo cita um objeto inexistente.');
    const begin = r.begin === undefined ? 0.1 : Number(r.begin), end = r.end === undefined ? 0.9 : Number(r.end);
    if (!Number.isFinite(begin) || !Number.isFinite(end) || begin < 0 || end > 1 || end - begin < 0.1) return fail('A janela de um rótulo precisa estar entre 0 e 1 e durar pelo menos 10% da cena.');
    const tone = (r.tone ?? 'info') as LabelTone;
    if (!LABEL_TONES.includes(tone)) return fail('O tom de um rótulo é inválido.');
    const count = (perShot.get(r.sourceId) ?? 0) + 1; perShot.set(r.sourceId, count);
    if (count > MAX_LABELS_PER_SHOT) return fail(`Use no máximo ${MAX_LABELS_PER_SHOT} rótulos por cena.`);
    return { sourceId: r.sourceId, node: r.node, text, begin, end, tone };
  });
}

/** 0..1 visibility: springs in over `popIn` seconds after `begin`, fades over `fadeOut` seconds before `end`. */
export function labelProgress(label: Pick<ProgramLabel, 'begin' | 'end'>, phase: number, sceneSeconds: number, popIn = .32, fadeOut = .25) {
  const t = (phase - label.begin) * sceneSeconds, left = (label.end - phase) * sceneSeconds;
  if (t < 0 || left < 0) return 0;
  const k = Math.min(1, t / popIn), back = 1 + 1.70158 * Math.pow(k - 1, 3) + .70158 * Math.pow(k - 1, 2); // easeOutBack
  return Math.max(0, back) * Math.min(1, left / fadeOut);
}

export interface LabelPoint { text: string; tone: LabelTone; /** anchor in normalised device coords (-1..1, y up) */ x: number; y: number; k: number }
export interface PlacedLabel extends LabelPoint { px: number; py: number; w: number; h: number; ax: number; ay: number }

/** Places pills above their anchors inside a safe box (clear of the caption band), pushing overlapping ones apart. */
export function layoutLabels(points: LabelPoint[], width: number, height: number, measure: (text: string) => number, u: number): PlacedLabel[] {
  const padX = 30 * u, h = 88 * u, gap = 40 * u, margin = 0.06 * width, top = .07 * height, bottom = .5 * height;
  const placed: PlacedLabel[] = [];
  for (const p of points.filter((q) => q.k > 0.01).sort((a, b) => b.y - a.y)) {
    const w = measure(p.text) + 2 * padX, ax = (p.x * .5 + .5) * width, ay = (.5 - p.y * .5) * height;
    let px = Math.min(width - margin - w / 2, Math.max(margin + w / 2, ax)), py = Math.min(bottom - h / 2, Math.max(top + h / 2, ay - gap - h / 2));
    for (let guard = 0; guard < 8; guard++) {
      const hit = placed.find((o) => Math.abs(o.px - px) < (o.w + w) / 2 + 8 * u && Math.abs(o.py - py) < (o.h + h) / 2 + 8 * u);
      if (!hit) break;
      py = hit.py - hit.h - 12 * u; if (py < top + h / 2) { py = hit.py + hit.h + 12 * u; }
    }
    placed.push({ ...p, px, py, w, h, ax, ay });
  }
  return placed;
}
