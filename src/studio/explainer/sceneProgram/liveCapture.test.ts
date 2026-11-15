import { describe, expect, it } from 'vitest';
import second from '../../../../scripts/live/everest-attempt-2.project.json';
import third from '../../../../scripts/live/everest-attempt-3.project.json';
import { normalizePlan, productionSources } from '../plan';
import { withTargetDuration } from '../duration';
import { SceneProgram3D } from './stage3d';

/** Captured normalized programs from authorized real calls, not expected model
 * fixtures and not an invocation of Google. No animation values are edited. */
describe('captured live Gemini programs', () => {
  it('rejects unreachable authored effectors even without explicit contact intervals', () => {
    const plan = withTargetDuration(normalizePlan(second.plan, second.script, '9:16'), 15), stage = new SceneProgram3D(plan.sceneProgram!, productionSources(plan.scenes));
    try { expect(plan.sceneProgram!.contacts).toHaveLength(0); expect(() => stage.validateContacts()).toThrow(/fora do alcance/); }
    finally { stage.dispose(); }
  });
  it('accepts the corrected third program and checks every frame without altering it', () => {
    const plan = withTargetDuration(normalizePlan(third.plan, third.script, '9:16'), 15), stage = new SceneProgram3D(plan.sceneProgram!, productionSources(plan.scenes));
    const original = JSON.stringify(third.plan.sceneProgram);
    try {
      stage.validateContacts();
      for (let frame = 0; frame < 450; frame++) { stage.update(frame / 30); expect(stage.diagnostics().maxIKError).toBeLessThan(.025); }
      expect(JSON.stringify(third.plan.sceneProgram)).toBe(original);
      expect(plan.scenes.map((s) => s.text).join(' ')).toBe(third.script);
    } finally { stage.dispose(); }
  });
});
