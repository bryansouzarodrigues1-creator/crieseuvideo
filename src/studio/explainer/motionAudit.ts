/** A small transparent audit of the Gemini-authored Motion 2D direction.
 * Tracks that declare keys but never change the pose do NOT count as animation.
 */
import type { ExplainerPlan } from './plan';
import type { ShapeMotionKey } from './shapeMotion';

export function hasDirectedMotion(motion: ShapeMotionKey[] | undefined): boolean {
  if(!motion || motion.length<2)return false;
  const first=motion[0]!;
  return motion.some(key=>
    key.dx!==first.dx || key.dy!==first.dy ||
    key.rotation!==first.rotation || key.scale!==first.scale ||
    key.opacity!==first.opacity);
}

export function motionAudit(plan: ExplainerPlan) {
  let directedScenes=0,directedObjects=0,allObjects=0;
  for(const scene of plan.scenes){
    const objects=scene.drawing||[];
    allObjects+=objects.length;
    const animated=objects.filter(s=>hasDirectedMotion(s.motion)||scene.groups?.some(g=>g.id===s.group&&hasDirectedMotion(g.motion))).length;
    directedObjects+=animated;
    if(animated>0)directedScenes++;
  }
  return {
    totalScenes:plan.scenes.length,
    directedScenes,
    directedObjects,
    allObjects,
    coverage:plan.scenes.length ? directedScenes/plan.scenes.length : 0,
  };
}
