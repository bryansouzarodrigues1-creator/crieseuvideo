/** Deterministic, offline text normalisation for the 3D vault (Portuguese-first).
 * No model call: keywords and context tokens come from plain string processing. */
const STOP = new Set(`a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre entre ate ao aos que se e ou mas nem como mais menos muito muita muitos muitas ja ainda so apenas ele ela eles elas seu sua seus suas dele dela deles delas isso isto esse essa esses essas este esta estes estas aquele aquela quando onde enquanto depois antes entao porque pois ser foi era sao esta estao estava tem tinha ha havia vai vao fez faz fazer pode podem the and of to in on with for`.split(/\s+/));
export const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Light Portuguese stemmer: plurals and the commonest diminutive/adverb endings only, so
 * "arcas"/"arca" and "barcos"/"barco" match, while unrelated words stay apart. */
export function stem(word: string): string {
  let w = fold(word).replace(/[^a-z0-9]/g, '');
  if (w.length <= 3) return w;
  if (w.endsWith('oes') || w.endsWith('aes') || w.endsWith('aos')) w = w.slice(0, -3) + 'ao';
  else if (w.endsWith('res') || w.endsWith('zes')) w = w.slice(0, -2);
  else if (w.endsWith('ns')) w = w.slice(0, -2) + 'm';
  else if (w.endsWith('is') && w.length > 4) w = w.slice(0, -2) + 'l';
  else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 6 && (w.endsWith('zinho') || w.endsWith('zinha'))) w = w.slice(0, -5);
  else if (w.length > 6 && (w.endsWith('inho') || w.endsWith('inha'))) w = w.slice(0, -4);
  return w;
}
export function tokens(text: string): string[] {
  return fold(text).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t)).map(stem).filter((t) => t.length >= 3);
}
/** Most informative distinct stems first (frequency, then length, then order). */
export function extractKeywords(text: string, limit = 8): string[] {
  const count = new Map<string, number>(), first = new Map<string, number>();
  tokens(text).forEach((t, i) => { count.set(t, (count.get(t) ?? 0) + 1); if (!first.has(t)) first.set(t, i); });
  return [...count.keys()].sort((a, b) => count.get(b)! - count.get(a)! || b.length - a.length || first.get(a)! - first.get(b)!).slice(0, limit);
}
/** Keywords from a hierarchy id such as "arca-de-noe" or "casa_do_ferreiro". */
export const keywordsFromId = (id: string) => extractKeywords(id.replace(/[-_]+/g, ' '), 6);
