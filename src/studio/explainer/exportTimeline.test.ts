import { describe, expect, it } from 'vitest';
import { audioCues, exportDuration, hasNarration, missingNarrationScenes, EXPORT_TAIL, type MixSource } from './exportTimeline';
import { buildFallbackPlan, SCENE_LEAD, sceneStart, totalDuration } from './plan';

const buffer = (duration: number) => ({ duration }) as AudioBuffer;
function source(): MixSource {
  const plan = buildFallbackPlan('Primeira cena. Segunda cena. Terceira cena.');
  for (const s of plan.scenes) s.voice = { duration: 2, start: 0, end: 2 };
  return { plan, voiceKey: 'Algieba', buffers: new Map(), track: null };
}

describe('narration export', () => {
  it('preserves the first and last clips when the middle scene has no audio', () => {
    const s = source();
    const first = buffer(2), last = buffer(2);
    s.buffers.set('Algieba|Primeira cena.', first);
    s.buffers.set('Algieba|Terceira cena.', last);
    expect(hasNarration(s)).toBe(false);
    expect(audioCues(s)).toEqual([
      { buffer: first, at: SCENE_LEAD },
      { buffer: last, at: sceneStart(s.plan, 2) + SCENE_LEAD },
    ]);
    expect(exportDuration(s.plan, audioCues(s))).toBeGreaterThan(totalDuration(s.plan));
  });

  it('does not mistake saved narration timing for decoded audio after reopening', () => {
    const s = source();
    expect(hasNarration(s)).toBe(false);
    expect(audioCues(s)).toEqual([]);
    for (const scene of s.plan.scenes) s.buffers.set(`Algieba|${scene.text}`, buffer(2));
    expect(hasNarration(s)).toBe(true);
  });

  it('requires clips for the selected voice and current scene text', () => {
    const s = source();
    for (const scene of s.plan.scenes) s.buffers.set(`Algieba|${scene.text}`, buffer(2));
    expect(hasNarration({ ...s, voiceKey: 'eleven:other' })).toBe(false);
    s.plan.scenes[0]!.text = 'Texto editado.';
    expect(hasNarration(s)).toBe(false);
    expect(audioCues(s)).toHaveLength(2);
  });

  it('uses the uploaded narration alone and keeps its full duration', () => {
    const s = source();
    s.plan.track = 20;
    s.track = buffer(20);
    s.buffers.set('Algieba|Primeira cena.', buffer(2));
    expect(hasNarration(s)).toBe(true);
    expect(audioCues(s)).toEqual([{ buffer: s.track, at: 0 }]);
    expect(exportDuration(s.plan, audioCues(s))).toBeCloseTo(20.35);
  });

  it('never substitutes old TTS clips for a missing uploaded track', () => {
    const s = source();
    s.plan.track = 20;
    s.buffers.set('Algieba|Primeira cena.', buffer(2));
    expect(hasNarration(s)).toBe(false);
    expect(audioCues(s)).toEqual([]);
  });

  it('allows an intentionally silent project without claiming narration is ready', () => {
    const s = source();
    s.plan.scenes = s.plan.scenes.map(({ voice: _voice, ...scene }) => scene);
    expect(hasNarration(s)).toBe(false);
    expect(audioCues(s)).toEqual([]);
    expect(hasNarration({ ...s, plan: { ...s.plan, scenes: [] } })).toBe(false);
  });
});

describe('explainer export audio safety', () => {
  const key = 'Algieba';

  it('detects missing buffers even when persisted scenes claim to be narrated', () => {
    const plan = buildFallbackPlan('Primeira frase. Segunda frase.', '9:16');
    expect(plan.scenes).toHaveLength(2);
    plan.scenes.forEach((scene) => { scene.voice = { duration: 1, start: 0, end: 1 }; });
    const buffers = new Map<string, AudioBuffer>();
    expect(missingNarrationScenes({ plan, voiceKey: key, buffers })).toEqual([1, 2]);

    buffers.set(`${key}|${plan.scenes[0].text}`, { duration: 1 } as AudioBuffer);
    expect(missingNarrationScenes({ plan, voiceKey: key, buffers })).toEqual([2]);
  });

  it('does not treat scene timing metadata as a playable audio clip', () => {
    const plan = buildFallbackPlan('Minha cena narrada.', '9:16');
    plan.scenes[0].voice = { duration: 3, start: 0, end: 3 };
    const cues = audioCues({ plan, voiceKey: key, buffers: new Map(), track: null });
    expect(cues).toHaveLength(0);
    expect(missingNarrationScenes({ plan, voiceKey: key, buffers: new Map() })).toEqual([1]);
  });

  it('keeps the video running through the end of long narration plus tail', () => {
    const plan = buildFallbackPlan('Primeira frase.', '9:16');
    plan.scenes[0].voice = { duration: 1, start: 0, end: 1 };
    const buffer = { duration: 20 } as AudioBuffer;
    const buffers = new Map([[ `${key}|${plan.scenes[0].text}`, buffer ]]);
    const cues = audioCues({ plan, voiceKey: key, buffers, track: null });
    expect(cues).toHaveLength(1);
    const duration = exportDuration(plan, cues);
    expect(duration).toBeGreaterThan(totalDuration(plan));
    expect(duration).toBeCloseTo(cues[0].at + buffer.duration + EXPORT_TAIL);
  });
});
