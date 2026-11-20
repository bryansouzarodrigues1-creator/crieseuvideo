// Shared syntax validation. Parses model/imported code as data; never executes it.
import { parse } from 'acorn';
import { CODE3D_MAX_CODE_CHARS } from './contract';

export type CodeCheck =
  | { ok: true; warnings: string[] }
  | { ok: false; failure: 'syntax_error' | 'contract_error' | 'too_large'; detail: string };

export function checkGeneratedCode(code: string): CodeCheck {
  if (code.length > CODE3D_MAX_CODE_CHARS) return { ok: false, failure: 'too_large', detail: `${code.length} caracteres` };
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  } catch {
    // Parser messages can quote arbitrary generated text. Return a stable diagnostic.
    return { ok: false, failure: 'syntax_error', detail: 'JavaScript incompleto ou inválido.' };
  }
  let hasCreateScene = false;
  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration' || node.type.startsWith('Export'))
      return { ok: false, failure: 'contract_error', detail: 'import/export não são permitidos.' };
    if (node.type === 'FunctionDeclaration' && node.id?.name === 'createScene') hasCreateScene = true;
    if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) {
        if (d.id.type === 'Identifier' && d.id.name === 'createScene' &&
            (d.init?.type === 'FunctionExpression' || d.init?.type === 'ArrowFunctionExpression')) hasCreateScene = true;
      }
    }
  }
  if (!hasCreateScene) return { ok: false, failure: 'contract_error', detail: 'Declare a função createScene no nível superior.' };
  const warnings: string[] = [];
  if (/\b(Date\.now|performance\.now|new Date)\b/.test(code)) warnings.push('usa relógio do sistema (pode quebrar o replay por tempo)');
  if (/\brequestAnimationFrame\b|\bsetTimeout\b|\bsetInterval\b/.test(code)) warnings.push('usa temporizadores (o tempo deve vir de renderAt)');
  if (/\bMath\.random\b/.test(code)) warnings.push('usa Math.random (replay verificado no navegador)');
  if (/\b(fetch|XMLHttpRequest|WebSocket|import\s*\()/.test(code)) warnings.push('tenta acessar rede/módulos (bloqueado pela caixa isolada)');
  return { ok: true, warnings };
}
