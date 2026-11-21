import { describe, expect, it } from 'vitest';
import { alignWords, syllables } from './wordAlign';

const SR = 16000;
/** Synthetic "speech": a loud tone burst per word, a short dip between words, a real pause where asked. */
function speech(parts: { word: string; dur: number; pauseAfter?: number }[], lead = .2) {
  const total = lead + parts.reduce((t, p) => t + p.dur + (p.pauseAfter ?? .03), 0) + .2, x = new Float32Array(Math.round(total * SR)), truth: { start: number; end: number }[] = [];
  let t = lead;
  for (const p of parts) {
    truth.push({ start: t, end: t + p.dur });
    for (let i = Math.round(t * SR); i < Math.round((t + p.dur) * SR); i++) { const env = Math.min(1, (i / SR - t) / .02, (t + p.dur - i / SR) / .02); x[i] = .6 * Math.max(0, env) * Math.sin(2 * Math.PI * 180 * i / SR) * (.8 + .2 * Math.sin(2 * Math.PI * 4 * i / SR)); }
    t += p.dur + (p.pauseAfter ?? .03);
  }
  return { x, truth };
}

describe('alignWords', () => {
  it('counts Portuguese syllables roughly', () => {
    expect(syllables('casa')).toBe(2); expect(syllables('Titanic')).toBe(3); expect(syllables('operários')).toBeGreaterThanOrEqual(3); expect(syllables('1909')).toBeGreaterThanOrEqual(1); expect(syllables('—')).toBe(1);
  });
  it('anchors the words around a real pause and keeps the whole phrase inside the speech', () => {
    const parts = [{ word: 'Em', dur: .12 }, { word: 'março', dur: .42 }, { word: 'de', dur: .1 }, { word: 'mil', dur: .2 }, { word: 'novecentos', dur: .7 }, { word: 'e', dur: .09 }, { word: 'nove,', dur: .3, pauseAfter: .3 }, { word: 'começou.', dur: .5 }];
    const { x, truth } = speech(parts), got = alignWords(x, SR, parts.map((p) => p.word));
    expect(got.map((g) => g.word)).toEqual(parts.map((p) => p.word));
    expect(Math.abs(got[6]!.end - truth[6]!.end)).toBeLessThan(.05); // the word before the comma stops where the silence starts
    expect(Math.abs(got[7]!.start - truth[7]!.start)).toBeLessThan(.05); // the next one starts where the voice returns
    expect(got[7]!.start - got[6]!.end).toBeGreaterThan(.2); // and the pause between them is kept
    expect(Math.abs(got[0]!.start - truth[0]!.start)).toBeLessThan(.05); expect(Math.abs(got[7]!.end - truth[7]!.end)).toBeLessThan(.08);
  });
  it('beats an even spread, and keeps the words in order with no overlap', () => {
    const parts = [{ word: 'a', dur: .08 }, { word: 'extraordinariamente', dur: 1.1 }, { word: 'si', dur: .1 }];
    const { x, truth } = speech(parts), got = alignWords(x, SR, parts.map((p) => p.word));
    const even = (i: number) => truth[0]!.start + (truth[2]!.end - truth[0]!.start) * i / 3;
    expect(Math.abs(got[1]!.start - truth[1]!.start)).toBeLessThan(Math.abs(even(1) - truth[1]!.start));
    for (let i = 1; i < got.length; i++) expect(got[i]!.start).toBeGreaterThanOrEqual(got[i - 1]!.end - 1e-9);
    for (const g of got) expect(g.end).toBeGreaterThan(g.start);
  });
  it('handles silence, one word and empty input without throwing', () => {
    expect(alignWords(new Float32Array(SR), SR, ['oi', 'tchau']).length).toBe(2);
    expect(alignWords(new Float32Array(SR), SR, [])).toEqual([]);
    const { x } = speech([{ word: 'oi', dur: .4 }]); const [one] = alignWords(x, SR, ['oi']); expect(one!.start).toBeGreaterThan(.1); expect(one!.end).toBeLessThan(.7);
  });
});
