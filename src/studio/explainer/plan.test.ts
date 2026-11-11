import { describe, it, expect } from 'vitest';
import { buildFallbackPlan, normalizePlan, sceneAt, sceneDuration, wordAt, MIN_SCENE } from './plan';

describe('explainer plan', () => {
  it('one scene per sentence, with visual chosen by meaning', () => {
    const p = buildFallbackPlan('Mandei mensagem no WhatsApp. Três meses depois nada. Ninguém respondeu.');
    expect(p.scenes).toHaveLength(3);
    expect(p.scenes[0].visual).toBe('phone_chat');
    expect(p.scenes[1].visual).toBe('clock');
    expect(p.scenes[2].mood).toBe('sad');
  });
  it('short scenes last at least the minimum', () => {
    expect(sceneDuration({ text: 'Oi', visual: 'character', mood: 'happy', palette: 'orange' })).toBe(MIN_SCENE);
  });
  it('captions advance word by word', () => {
    const s = { text: 'um dois tres', visual: 'character' as const, mood: 'neutral' as const, palette: 'teal' as const };
    expect(wordAt(s, 0.31)?.word).toBe('um');
    expect(wordAt(s, 0.31 + 0.36)?.word).toBe('dois');
  });
  it('finds the scene for a timestamp', () => {
    const p = buildFallbackPlan('Primeira frase aqui. Segunda.');
    expect(sceneAt(p, sceneDuration(p.scenes[0]) + 0.1)?.index).toBe(1);
  });
  it('replaces invalid AI choices instead of breaking', () => {
    const p = normalizePlan({ scenes: [{ text: 'Abri o site', visual: 'dragon', mood: 'x' }] }, 'Abri o site', '9:16');
    expect(p.scenes[0].visual).toBe('laptop');
    expect(p.scenes[0].mood).toBe('neutral');
  });
  it('scene lasts exactly as long as its narration clip plus lead and tail', () => {
    const s = { text: 'Vendeu na primeira conversa.', visual: 'character' as const, mood: 'happy' as const, palette: 'teal' as const, voice: { duration: 2.0, start: 0.1, end: 1.9 } };
    expect(sceneDuration(s)).toBeCloseTo(0.3 + 2.0 + 0.35);
  });
  it('captions follow the spoken part of the narration', () => {
    const s = { text: 'um dois', visual: 'character' as const, mood: 'neutral' as const, palette: 'teal' as const, voice: { duration: 2, start: 0.5, end: 1.5 } };
    expect(wordAt(s, 0.9)?.word).toBe('um');
    expect(wordAt(s, 1.75)?.word).toBe('dois');
  });
});

import { fitToTrack, totalDuration as td, buildFallbackPlan as bfp } from './plan';
test('uploaded narration sets the video length to the audio length', () => {
  const p = fitToTrack(bfp('Primeira frase bem longa aqui agora. Segunda frase.', '9:16'), 20);
  expect(Math.abs(td(p) - 20)).toBeLessThan(0.5);
});

import { normalizePlan as np2 } from './plan';
import { it as it2, expect as ex2 } from 'vitest';
it2('keeps a known scenario and drops an unknown one', () => {
  const p = np2({ scenes: [{ text: 'meu carro na estrada', setting: 'road' }, { text: 'outra cena', setting: 'mars' }, { text: 'de noite na praia', setting: 'mars' }] }, 'x', '9:16');
  ex2(p.scenes[0]!.setting).toBe('road');
  ex2(p.scenes[1]!.setting).toBeUndefined();
  ex2(p.scenes[2]!.setting).toBe('beach');
});
