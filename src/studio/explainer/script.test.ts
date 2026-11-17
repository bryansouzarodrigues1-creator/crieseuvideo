import { describe, expect, it } from 'vitest';
import { buildFallbackPlan, keepScriptWords, normalizePlan } from './plan';
import { directorChunks, scriptError, spokenText } from './script';

describe('complete script fidelity', () => {
  it('keeps the 41st and later sentences in local plans', () => {
    const script = Array.from({ length: 65 }, (_, i) => `Frase ${i + 1}.`).join(' ');
    const plan = buildFallbackPlan(script);
    expect(plan.scenes).toHaveLength(65);
    expect(plan.scenes.map((s) => s.text).join(' ')).toBe(script);
  });
  it('splits long AI scenes without losing a single original word', () => {
    const script = Array.from({ length: 230 }, (_, i) => `palavra${i}`).join(' ');
    const plan = normalizePlan({ scenes: [{ text: script, visual: 'money' }] }, script, '9:16');
    expect(plan.scenes.map((s) => s.text).join(' ')).toBe(script);
    expect(plan.scenes.every((s) => s.text.length <= 400 && s.text.split(' ').length <= 18)).toBe(true);
  });
  it('keeps correct scene boundaries rather than shifting words between illustrations', () => {
    const script = 'Um. Dois. Três quatro cinco seis sete oito nove dez.';
    const scenes = [{ text: 'Um.' }, { text: 'Dois.' }, { text: 'Três quatro cinco seis sete oito nove dez.' }];
    expect(keepScriptWords(scenes, script)).toEqual(scenes);
  });
  it('keeps decimals, URLs and the last word in request chunks', () => {
    const script = 'O valor é 3.50. Visite exemplo.com/pagina?x=1. A palavra final é íntegra!';
    expect(spokenText(directorChunks(script).join(' '))).toBe(script);
    expect(scriptError(script)).toBeNull();
    expect(scriptError('a'.repeat(401))).toContain('mais de 400');
  });
});
