import { sceneDuration, words, SCENE_LEAD, VOICE_TAIL, type ExplainerPlan, type ExplainerScene } from './plan';

export const DURATION_PRESETS = [15, 30, 60, 90] as const;
export const MAX_TARGET_DURATION = 600;
export function normalizeTargetDuration(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '' || value === 'auto') return;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 5 || n > MAX_TARGET_DURATION) throw new Error('Escolha uma duração entre 5 e 600 segundos.');
  return Math.round(n * 30) / 30;
}
export function minimumSceneDuration(scene: ExplainerScene): number {
  const movement = scene.story?.performance ? 18 : scene.staging ? 2.5 : 1.6;
  return Math.max(movement, scene.voice ? SCENE_LEAD + scene.voice.duration + VOICE_TAIL : 0);
}
/** Retime the shared score, never truncate words or change recorded audio speed.
 * The minimum readable action/speech length wins when a requested time is too short.
 */
export function withTargetDuration(plan: ExplainerPlan, value: unknown): ExplainerPlan {
  const requested = normalizeTargetDuration(value);
  const clean = plan.scenes.map(({ duration: _d, ...scene }) => scene);
  if (requested === undefined) return { ...plan, targetDuration: undefined, scenes: clean };
  if (!clean.length) return { ...plan, targetDuration: requested, scenes: clean };
  const mins = clean.map(minimumSceneDuration);
  const audioFloor = Math.max(0, plan.track ?? 0);
  const floor = Math.max(audioFloor, mins.reduce((a, b) => a + b, 0));
  const actual = Math.max(requested, floor);
  const weights = clean.map((s) => Math.max(1, words(s.text).length, sceneDuration(s) / 2));
  const weight = weights.reduce((a, b) => a + b, 0);
  let spent = 0;
  const scenes = clean.map((scene, i) => {
    const duration = i === clean.length - 1 ? actual - spent : mins[i] + (actual - mins.reduce((a, b) => a + b, 0)) * weights[i] / weight;
    spent += duration; return { ...scene, duration };
  });
  return { ...plan, targetDuration: requested, scenes };
}
export function durationNotice(plan: ExplainerPlan): string {
  const actual = plan.scenes.reduce((sum, s) => sum + sceneDuration(s), 0), requested = plan.targetDuration;
  if (requested && actual > requested + .05) return `A duração ficou em ${actual.toFixed(1)} s para preservar a fala e as ações completas; o pedido era ${requested} s.`;
  const count = plan.scenes.reduce((sum, s) => sum + words(s.text).length, 0);
  if (requested && count / requested < .8) return 'O roteiro é curto para esse tempo. As ações e pausas ocuparão a duração escolhida; nenhuma fala nova será inventada.';
  return '';
}
