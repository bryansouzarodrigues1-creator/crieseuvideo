import { parse } from 'acorn';
import { DIRECTION_MARKER, normalizeDirection, type NarrationTiming } from '../code3d/direction';

/** Reads JSON and an AST only. Generated programs remain confined to the iframe. */
export function prepareDirectedProgram(source: string, script: string, timing?: NarrationTiming) {
  const match = new RegExp(`^/\\*${DIRECTION_MARKER}\\s*([\\s\\S]*?)\\*/\\s*`).exec(source);
  if (!match || match[1].length > 20_000) throw new Error('A resposta não trouxe uma partitura completa.');
  const direction = normalizeDirection(JSON.parse(match[1]), script, timing);
  const body = source.slice(match[0].length);
  const ast = parse(body, { ecmaVersion: 'latest', sourceType: 'module' });
  let readsScore = false;
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id?.name === 'DIRECTOR_SCORE' || node.type === 'FunctionDeclaration' && node.id?.name === 'DIRECTOR_SCORE')
      throw new Error('O código tentou substituir a partitura validada.');
    if (node.type === 'MemberExpression' && node.object?.type === 'Identifier' && node.object.name === 'DIRECTOR_SCORE' &&
      (!node.computed && node.property?.name === 'shots' || node.computed && node.property?.value === 'shots')) readsScore = true;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast);
  if (!readsScore) throw new Error('O código ignorou a linha do tempo da partitura.');
  const safe = JSON.stringify(direction).replace(/</g, '\\u003c');
  return { direction, code: `${match[0]}const DIRECTOR_SCORE = ${safe};\n${body}` };
}
