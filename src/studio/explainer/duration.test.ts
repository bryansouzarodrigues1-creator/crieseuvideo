import { expect, it } from 'vitest';
import { buildFallbackPlan, totalDuration, wordTimings, sceneDuration, type ExplainerPlan } from './plan';
import { withTargetDuration, normalizeTargetDuration, durationNotice } from './duration';
import { exportDuration } from './exportTimeline';

it('lets an ordinary script select 15, 30, 60, 90 or custom seconds without changing its words', () => {
  const text = 'Ele recebeu uma mensagem no celular. Ele correu pela rua. No escritório, o gráfico subia.';
  const plan = buildFallbackPlan(text);
  for (const seconds of [15, 30, 60, 90, 47]) {
    const out = withTargetDuration(plan, seconds);
    expect(totalDuration(out)).toBeCloseTo(seconds, 8);
    expect(out.scenes.map((s) => s.text).join(' ')).toBe(text);
    expect(out.scenes.every((s) => wordTimings(s).at(-1)!.end <= sceneDuration(s))).toBe(true);
  }
});
it('never shortens recorded speech or a physical handoff to force a time request', () => {
  const plan = buildFallbackPlan('Lia pega a lanterna e entrega para Caio.');
  const long = { ...plan, scenes: plan.scenes.map((s) => ({ ...s, voice: { duration: 24, start: .1, end: 23.8 } })) };
  const result = withTargetDuration(long, 10);
  expect(totalDuration(result)).toBeGreaterThanOrEqual(24.65);
  expect(durationNotice(result)).toMatch(/preservar a fala/);
  expect(result.scenes[0].voice).toEqual(long.scenes[0].voice);
});
it('preserves an uploaded track and restores automatic timing without retaining stretched scene times', () => {
  const plan: ExplainerPlan = { ...buildFallbackPlan('Uma mensagem chegou. Ele ficou parado.'), track: 40 };
  expect(totalDuration(withTargetDuration(plan, 15))).toBeCloseTo(40);
  const original = buildFallbackPlan('Um celular tocou.');
  const stretched = withTargetDuration(original, 60);
  expect(totalDuration(withTargetDuration(stretched, 'auto'))).toBe(totalDuration(original));
});
it('validates duration before any request and stays stable through repeated changes', () => {
  for (const bad of [0, -1, 601, Infinity, 'x']) expect(() => normalizeTargetDuration(bad)).toThrow();
  let plan = buildFallbackPlan('Ele correu. Ele abriu o computador.');
  for (const seconds of [60, 15, 30, 90, 30]) plan = withTargetDuration(plan, seconds);
  expect(totalDuration(plan)).toBeCloseTo(30);
  expect(exportDuration(plan, [])).toBeCloseTo(30);
});

it('respects an eight-second target for two short Gemini 3D program beats', () => {
  const script = 'A turbina recebe vento. Suas pás começam a girar.';
  const prepared = buildFallbackPlan(script);
  expect(prepared.scenes).toHaveLength(2);
  const program = { ...prepared, scenes: prepared.scenes.map(s => ({ ...s, programBeat: true })) };
  // Auto timing keeps 5 seconds minimum per 3D beat for easy reading.
  expect(totalDuration(withTargetDuration(program, 'auto'))).toBe(10);
  const timed = withTargetDuration(program, 8);
  expect(timed.targetDuration).toBe(8);
  expect(timed.scenes.every(s => sceneDuration(s) >= 2.8)).toBe(true);
  expect(totalDuration(timed)).toBeCloseTo(8, 8);
  expect(exportDuration(timed, [])).toBeCloseTo(8, 8);
  expect(timed.scenes.map(s => s.text).join(' ')).toBe(script);
  expect(durationNotice(timed)).not.toContain('A duração ficou');
});

it('preserves a safe minimum for many 3D beats and keeps recorded audio intact', () => {
  const many = buildFallbackPlan('Primeiro surge um eixo. Depois ele gira. Em seguida ele para.');
  expect(many.scenes).toHaveLength(3);
  const program = { ...many, scenes: many.scenes.map(s => ({ ...s, programBeat: true })) };
  const short = withTargetDuration(program, 5);
  expect(totalDuration(short)).toBeCloseTo(8.4, 8);
  expect(durationNotice(short)).toContain('duração ficou');
  expect(short.scenes.every(s => sceneDuration(s) >= 2.8)).toBe(true);
  const voiced = {
    ...program,
    scenes: program.scenes.map((s, i) => i === 0 ? { ...s, voice: { duration: 5.2, start: 0, end: 5.2 } } : s),
  };
  const withVoice = withTargetDuration(voiced, 8);
  expect(totalDuration(withVoice)).toBeGreaterThan(10.8);
  expect(withVoice.scenes[0].voice?.duration).toBe(5.2);
});

it('does not lose requested timing when repeatedly switching the 3D program between 8 and 10 seconds', () => {
  const p = buildFallbackPlan('O vento chega. A turbina gira.');
  let program = { ...p, scenes: p.scenes.map(s => ({ ...s, programBeat: true })) };
  for (const n of [8, 10, 8]) program = withTargetDuration(program, n);
  expect(totalDuration(program)).toBeCloseTo(8, 8);
  expect(program.scenes.map(s => s.duration)).toEqual([4, 4]);
});
