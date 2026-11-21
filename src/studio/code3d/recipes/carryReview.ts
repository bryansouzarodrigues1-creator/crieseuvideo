import runtime from './carryReviewRuntime.js?raw';
import { CODE3D_MAX_CODE_CHARS } from '../contract';
/** Original pickup, curved carry and measured placement study. */
export function buildCarryReviewCode(): string {
  if (runtime.length > CODE3D_MAX_CODE_CHARS) throw new Error('Cena excede o limite do motor.');
  return runtime;
}
