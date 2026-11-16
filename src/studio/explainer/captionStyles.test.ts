import { describe, it, expect } from 'vitest';
import { CAPTION_STYLE_IDS, LOOKS, normalizeCaptionStyle, pageAt, pagesOf } from './captionStyles';
import { drawExplainerFrame, drawOverlay } from './render';
import { normalizePlan, wordTimings, type ExplainerPlan } from './plan';

describe('caption pages', () => {
  it('single_word shows exactly one word per page', () => {
    const p = pagesOf(['a', 'b', 'c'], 1);
    expect(p).toEqual([{ from: 0, to: 0 }, { from: 1, to: 1 }, { from: 2, to: 2 }]);
  });
  it('groups up to N words and ends a page at punctuation', () => {
    expect(pagesOf(['ele', 'foi', 'embora.', 'depois', 'voltou'], 3)).toEqual([{ from: 0, to: 2 }, { from: 3, to: 4 }]);
    expect(pagesOf(['um,', 'dois', 'tres', 'quatro'], 3)).toEqual([{ from: 0, to: 0 }, { from: 1, to: 3 }]);
  });
  it('covers every word exactly once, in order', () => {
    const w = Array.from({ length: 11 }, (_, i) => `w${i}${i % 4 === 3 ? '.' : ''}`);
    const flat = pagesOf(w, 3).flatMap((p) => Array.from({ length: p.to - p.from + 1 }, (_, k) => p.from + k));
    expect(flat).toEqual(w.map((_, i) => i));
  });
  it('pageAt finds the page of the active word and clamps past the end', () => {
    const pages = pagesOf(['a', 'b', 'c', 'd'], 2);
    expect(pageAt(pages, 2)).toEqual({ from: 2, to: 3 });
    expect(pageAt(pages, 99)).toEqual({ from: 2, to: 3 });
    expect(pageAt([], 0)).toBeNull();
  });
  it('rejects unknown styles and defaults to line', () => {
    expect(normalizeCaptionStyle('neon')).toBe('line');
    expect(normalizeCaptionStyle(undefined)).toBe('line');
    for (const id of CAPTION_STYLE_IDS) expect(normalizeCaptionStyle(id)).toBe(id);
  });
  it('normalizePlan keeps a valid captionStyle and drops an invalid one', () => {
    const base = { scenes: [{ text: 'Oi mundo' }] };
    expect(normalizePlan({ ...base, captionStyle: 'single_word' }, 'Oi mundo', '9:16').captionStyle).toBe('single_word');
    expect(normalizePlan({ ...base, captionStyle: 'neon' }, 'Oi mundo', '9:16').captionStyle).toBe('line');
    expect(normalizePlan(base, 'Oi mundo', '9:16').captionStyle).toBeUndefined();
  });
});

/** Canvas falso: registra o texto desenhado, sem precisar de DOM. */
function fakeCtx(w: number, h: number) {
  const texts: { txt: string; x: number; y: number; fill: string; size: number }[] = [];
  const state: Record<string, any> = { fillStyle: '#000', font: '40px x' };
  const ctx: any = new Proxy({ canvas: { width: w, height: h } }, {
    get(t: any, k: string) {
      if (k === 'canvas') return t.canvas;
      if (k === 'measureText') return (s: string) => ({ width: s.length * (parseInt(state.font) || 40) * 0.5 });
      if (k === 'fillText') return (txt: string, x: number, y: number) => texts.push({ txt, x, y, fill: state.fillStyle, size: parseInt(state.font) });
      if (k in state) return state[k];
      return () => ({ addColorStop() {} });
    },
    set(_t, k: string, v) { state[k] = v; return true; },
  });
  return { ctx: ctx as CanvasRenderingContext2D, texts };
}
const plan = (style?: ExplainerPlan['captionStyle']): ExplainerPlan => ({
  title: 't', aspect: '9:16', captionStyle: style,
  scenes: [{ text: 'A vida muda rápido', visual: 'character', mood: 'neutral', palette: 'teal', highlight: ['vida'] }],
});

describe('drawOverlay with caption styles', () => {
  const at = (p: ExplainerPlan, wordIndex: number) => wordTimings(p.scenes[0]!)[wordIndex]!.start + 0.01;
  it('single_word draws one uppercase word, white, with the emphasis word in yellow, mid-screen', () => {
    const p = plan('single_word');
    const a = fakeCtx(720, 1280); drawOverlay(a.ctx, p, at(p, 0));
    expect(a.texts.map((t) => t.txt)).toEqual(['A']);
    const b = fakeCtx(720, 1280); drawOverlay(b.ctx, p, at(p, 1));
    expect(b.texts).toHaveLength(1);
    expect(b.texts[0]!.txt).toBe('VIDA');
    expect(b.texts[0]!.fill).toBe(LOOKS.single_word.emphasis);
    expect(b.texts[0]!.y).toBeCloseTo(1280 * LOOKS.single_word.yFrac, 0);
  });
  it('subtitle_yellow keeps lowercase and shows up to three words in the yellow look', () => {
    const p = plan('subtitle_yellow');
    const a = fakeCtx(720, 1280); drawOverlay(a.ctx, p, at(p, 0));
    expect(a.texts.map((t) => t.txt)).toEqual(['A', 'vida', 'muda']);
    expect(a.texts[0]!.fill).toBe(LOOKS.subtitle_yellow.fill);
  });
  it('line (default) keeps the original bottom-band caption', () => {
    const p = plan();
    const a = fakeCtx(720, 1280); drawOverlay(a.ctx, p, at(p, 0));
    expect(a.texts.length).toBeGreaterThan(0);
    expect(a.texts.every((t) => t.y > 1280 * 0.7)).toBe(true);
  });
  it('words stay inside the frame width for a very long word', () => {
    const p: ExplainerPlan = { ...plan('single_word'), scenes: [{ text: 'Inconstitucionalissimamente', visual: 'character', mood: 'neutral', palette: 'teal' }] };
    const a = fakeCtx(720, 1280); drawOverlay(a.ctx, p, wordTimings(p.scenes[0]!)[0]!.start + 0.01);
    const t = a.texts[0]!, width = t.txt.length * t.size * 0.5;
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.x + width).toBeLessThanOrEqual(720);
  });
});

describe('2D engine honors the caption style too', () => {
  it('drawExplainerFrame uses single_word in the 2D path', () => {
    const p = plan('single_word');
    const a = fakeCtx(720, 1280); drawExplainerFrame(a.ctx, p, wordTimings(p.scenes[0]!)[0]!.start + 0.01);
    const caps = a.texts.filter((t) => t.txt === 'A');
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.some((t) => Math.abs(t.y - 1280 * LOOKS.single_word.yFrac) < 1)).toBe(true);
  });
});
