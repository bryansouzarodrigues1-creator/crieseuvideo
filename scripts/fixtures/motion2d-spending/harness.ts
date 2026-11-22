/**
 * A read-only demo of the ACTUAL Motion 2D engine on main.
 * Nothing in this file draws an alternative animation engine.
 * The original Motion 2D draws the illustrations and animated word captions.
 */
import { drawExplainerFrame } from '../../../src/studio/explainer/render';
import { totalDuration, type ExplainerPlan } from '../../../src/studio/explainer/plan';
import { encodeFixedFrame3DClip } from '../../../src/studio/utils/deterministic3dExport';
import brief from './brief.json';

const canvas = document.querySelector<HTMLCanvasElement>('#screen')!;
const ctx = canvas.getContext('2d')!;
const plan: ExplainerPlan = {
  title: brief.title,
  aspect: '9:16',
  engine: '2d',
  // Exactly 5.00 seconds per scene = SCENE_LEAD .3 + audio 4.35 + tail .35.
  scenes: brief.scenes.map((scene) => ({
    ...scene,
    voice: { duration: 4.35, start: 0, end: 4.35 },
  })) as ExplainerPlan['scenes'],
};
if (Math.abs(totalDuration(plan) - 40) > 0.00001) throw Error('Motion 2D scene timing is not forty seconds');
function renderAt(t: number): void {
  ctx.clearRect(0, 0, 720, 1280);
  drawExplainerFrame(ctx, plan, Math.min(39.999, Math.max(0, t)));
}
const api = {
  info: { engine: 'Motion 2D', source: 'src/studio/explainer/render.ts', duration: 40, scenes: plan.scenes.length },
  frame(t: number): string {
    renderAt(t);
    return canvas.toDataURL('image/png').split(',')[1];
  },
  async exportPart(start: number): Promise<{ frames: number; fps: number }> {
    if (start !== 0 && start !== 20) throw Error('Expected a twenty-second source segment at 0 or 20.');
    const output = await encodeFixedFrame3DClip({
      canvas,
      durationSeconds: 20, // The unmodified native fixed-frame encoder enforces a 30s maximum.
      fps: 30,
      renderFrame: t => renderAt(start + t),
    });
    if (output.filenameExtension !== 'mp4' || output.frames !== 600) {
      throw Error('Native encoder did not produce the required 600-frame MP4.');
    }
    const url = URL.createObjectURL(output.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `motion2d-native-${String(start).padStart(2, '0')}s.mp4`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { frames: output.frames, fps: output.fps };
  }
};
(window as Window & { motion2d?: typeof api }).motion2d = api;
renderAt(0);
document.body.dataset.ready = 'true';
