import source from './carryReviewRuntime.js?raw';
import { CODE3D_MAX_CODE_CHARS } from '../contract';
/** The same scene and hand geometry, shown slowly at the important contact stages. */
export function buildHandReviewCode(): string {
  const code = source.replace('function createScene(', 'function createCarryScene(') + `
function createScene(THREE,canvas,width,height,tools){
 const s=createCarryScene(THREE,canvas,width,height,tools);
 const originalTime=t=>t<3?.90+t*(1.30/3):t<4.5?3.60+(t-3)*2:9.30+(t-4.5)*(1.25/3.5);
 return {duration:8,renderAt(t){s.renderHandDetailAt(originalTime(Math.max(0,Math.min(7.999,t))));},dispose(){s.dispose();}};
}`;
  if (code.length > CODE3D_MAX_CODE_CHARS) throw new Error('Cena excede o limite do motor.');
  return code;
}
