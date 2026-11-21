import runtime from './walkwayReviewRuntime.js?raw';
import { CODE3D_MAX_CODE_CHARS } from '../contract';
/** Original contact/camera study using the fixed sandbox movement library. */
export function buildWalkwayReviewCode(): string {
  if(runtime.length>CODE3D_MAX_CODE_CHARS)throw new Error('Cena excede o limite do motor.');
  return runtime;
}
