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
