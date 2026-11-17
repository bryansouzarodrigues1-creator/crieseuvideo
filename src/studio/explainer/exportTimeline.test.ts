import { describe, expect, it } from 'vitest';
import { buildFallbackPlan, totalDuration } from './plan';
import { audioCues, exportDuration, missingNarrationScenes, EXPORT_TAIL } from './exportTimeline';

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
