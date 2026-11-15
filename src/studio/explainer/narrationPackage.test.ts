import { describe, expect, it } from 'vitest';
import { buildFallbackPlan, wordTimings } from './plan';
import { validateNarrationPackage } from './narrationPackage';

const fixture = () => ({ version: 1, script: 'A carga sobe.', clips: [{ sourceId: 's1', text: 'A carga sobe.', duration: 2, start: .2, end: 1.8, wavBase64: 'UklGRg==', timings: [{ word: 'A', start: .2, end: .4 }, { word: 'carga', start: .5, end: 1.1 }, { word: 'sobe.', start: 1.2, end: 1.8 }] }] });
describe('imported project narration', () => {
  it('uses measured word times without stretching them to the requested scene length', () => {
    const plan = buildFallbackPlan('A carga sobe.'), clip = validateNarrationPackage(fixture(), plan)[0];
    const scene = { ...plan.scenes[0], duration: 30, voice: { duration: clip.duration, start: clip.start, end: clip.end, timings: clip.timings } };
    expect(wordTimings(scene).map((w) => w.start)).toEqual([.5, .8, 1.5]);
    expect(wordTimings(scene)[2].end).toBeCloseTo(2.1);
  });
  it.each(['different-source', 'missing-clip', 'wrong-words', 'backwards', 'outside-audio'])('refuses mismatched or invalid timing before replacing imported audio: %s', (kind) => {
    const raw = fixture();
    if (kind === 'different-source') raw.script = 'Outra história.';
    if (kind === 'missing-clip') raw.clips = [];
    if (kind === 'wrong-words') raw.clips[0].timings[1].word = 'telefone';
    if (kind === 'backwards') raw.clips[0].timings[2].start = .1;
    if (kind === 'outside-audio') raw.clips[0].timings[2].end = 5;
    expect(() => validateNarrationPackage(raw, buildFallbackPlan('A carga sobe.'))).toThrow();
  });
});
