/** Shared text limits: reject oversize input before any billable request; never slice spoken words. */
export const MAX_SCRIPT_CHARS = 6000;
export const MAX_SCENE_CHARS = 400;
export const MAX_SCENE_WORDS = 18;

export const scriptWords = (text: string) => text.match(/\S+/g) ?? [];
export const spokenText = (text: string) => scriptWords(text).join(' ');

export function scriptError(script: string): string | null {
  if (script.trim().length < 4) return 'Escreva um roteiro um pouco maior.';
  if (script.length > MAX_SCRIPT_CHARS) return `O roteiro tem ${script.length} caracteres. O limite é ${MAX_SCRIPT_CHARS}; divida-o antes de criar. Nenhum trecho foi cortado.`;
  if (scriptWords(script).some((word) => word.length > MAX_SCENE_CHARS)) return `Há uma palavra ou endereço com mais de ${MAX_SCENE_CHARS} caracteres. Encurte esse trecho antes de criar.`;
  return null;
}

/** Keep punctuation and word order, including decimals and URLs. Split only between words. */
export function splitSceneText(text: string): string[] {
  const result: string[] = [];
  let line: string[] = [];
  for (const word of scriptWords(text)) {
    if (line.length && (line.length >= MAX_SCENE_WORDS || [...line, word].join(' ').length > MAX_SCENE_CHARS)) {
      result.push(line.join(' ')); line = [];
    }
    line.push(word);
  }
  if (line.length) result.push(line.join(' '));
  return result;
}

export function scriptScenes(script: string): string[] {
  return script.split(/(?<=[.!?…])\s+|\n+/).flatMap(splitSceneText);
}

/** A bounded queue receives substantial chunks instead of one request per short sentence. */
export function directorChunks(script: string): string[] {
  const chunks: string[] = [];
  let chunk = '';
  for (const scene of scriptScenes(script)) {
    if (chunk && chunk.length + scene.length + 1 > 1200) { chunks.push(chunk); chunk = ''; }
    chunk += (chunk ? ' ' : '') + scene;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
