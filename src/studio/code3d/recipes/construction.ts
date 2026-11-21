import runtime from './constructionRuntime.js?raw';
import { CODE3D_MAX_CODE_CHARS } from '../contract';
import { normalizeConstructionRecipe, type ConstructionRecipe } from './constructionPlan';
export * from './constructionPlan';

/** Compiles the reusable plan into text for the existing opaque-origin sandbox. */
export function buildConstructionCode(input: ConstructionRecipe = {}): string {
  const config = normalizeConstructionRecipe(input);
  const code = runtime.replace('/*CONSTRUCTION_CONFIG*/{}/*END_CONFIG*/', JSON.stringify(config).replace(/</g, '\\u003c'));
  if (code.length > CODE3D_MAX_CODE_CHARS) throw new Error('A cena excede o limite do motor.');
  return code;
}
