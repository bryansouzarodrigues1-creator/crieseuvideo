import { describe, expect, it } from 'vitest';
import { buildFallbackPlan, normalizePlan } from './plan';
import { actingUnavailableMessage, illustrated3dScenes } from './actingAvailability';

describe('3D presentation fallback boundary', () => {
  it.each([
    'Ele conseguiu escalar o monte Everest mas...',
    'Ela mergulhou no oceano e encontrou um submarino.',
    'Um avião decolou e atravessou a tempestade.',
  ])('identifies an unavailable scene instead of accepting a presenter: %s', (script) => {
    const plan = buildFallbackPlan(script);
    expect(illustrated3dScenes(plan)).toEqual([1]);
    expect(actingUnavailableMessage(plan)).toContain('A cena 1 ainda não possui uma ação 3D');
  });
  it('keeps literal source positions in mixed stories', () => {
    const plan = buildFallbackPlan('Ana correu pela rua. Ela escalou uma montanha. Ela recebeu uma mensagem no celular.');
    expect(illustrated3dScenes(plan)).toEqual([2]);
    expect(plan.scenes.map((scene) => scene.text).join(' ')).toContain('Ela escalou uma montanha.');
  });
  it('detects presentation projects restored from old saved plans', () => {
    const script = 'Ele conseguiu escalar o monte Everest mas...';
    const plan = normalizePlan({ scenes: [{ text: script, visual: 'character' }] }, script, '9:16');
    expect(illustrated3dScenes(plan)).toEqual([1]);
  });
  it.each([
    'Ana correu pela rua.',
    'Lia entra, caminha, agacha-se, pega a lanterna e entrega para Caio, que sorri.',
    'O guindaste ergue a carga.',
  ])('preserves existing executable scene paths: %s', (script) => {
    expect(actingUnavailableMessage(buildFallbackPlan(script))).toBeUndefined();
  });
});
