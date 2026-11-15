import type { ExplainerPlan } from './plan';

/** Detects presentation fallbacks, not semantic completeness or visual quality.
 * A supported reaction can still fail to demonstrate another event in the text. */
export function illustrated3dScenes(plan: ExplainerPlan): number[] {
  if (plan.production || plan.sceneProgram) return [];
  return plan.scenes.flatMap((scene, index) => scene.story || scene.staging ? [] : [index + 1]);
}

export function actingUnavailableMessage(plan: ExplainerPlan): string | undefined {
  const scenes = illustrated3dScenes(plan);
  if (!scenes.length) return;
  const listed = scenes.slice(0, 6).join(', ') + (scenes.length > 6 ? '…' : '');
  return `${scenes.length === 1 ? 'A cena' : 'As cenas'} ${listed} ainda não ${scenes.length === 1 ? 'possui' : 'possuem'} uma ação 3D disponível neste motor. O laboratório não substituirá essa ação por um apresentador com quadro. Seu roteiro foi preservado.`;
}
