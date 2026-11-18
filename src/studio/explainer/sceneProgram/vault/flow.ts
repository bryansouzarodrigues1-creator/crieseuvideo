import { searchVault, type VaultEntry, type VaultMatch } from './vault';
import { candidateRoots, extractEntry, instantiate, type RawUse } from './fragment';
import type { SceneProgram } from '../score';

const MAX_NODES = 160, ID = /^[a-z][a-z0-9_-]{0,15}$/;
export interface Beat { sourceId: string; text: string }

/** Best stored pieces for the script, searched per sentence by exact keyword + context. */
export function offerFor(entries: readonly VaultEntry[], beats: readonly Beat[], limit = 4): VaultMatch[] {
  const best = new Map<string, VaultMatch>();
  for (const b of beats) for (const m of searchVault(entries, b.text, 2)) if (!best.has(m.entry.id) || best.get(m.entry.id)!.score < m.score) best.set(m.entry.id, m);
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
/** Prompt block (data, not instructions) listing pieces the model may reuse instead of rebuilding. */
export function offerPrompt(matches: readonly VaultMatch[]): string {
  if (!matches.length) return '';
  const rows = matches.map((m) => ({ vault: m.entry.id, titulo: m.entry.title, tipo: m.entry.kind, palavrasChave: m.entry.keywords.slice(0, 6), tamanhoMetros: m.entry.size, origem: 'centro da base, +Y para cima', animada: m.entry.tracks.length > 0 }));
  return `\nCOFRE DE PEÇAS JÁ PRONTAS (dados). Se a frase pede exatamente uma destas peças, reutilize-a em vez de recriar: acrescente em sceneProgram.uses objetos {vault:"id do cofre",id:"identificador curto novo",sourceId:"frase",position:[x,y,z],scale?:número,rotationY?:radianos}. A peça entra como um grupo com o id escolhido e pode ser alvo de shots, tracks e contacts por esse id. Se não for exatamente o pedido, ignore o cofre e crie normalmente.\n${JSON.stringify(rows)}\n`;
}

/** Expands validated-shaped `uses` into raw nodes/tracks and removes every vault-only field.
 * Invalid or unaffordable uses are skipped; the rest of the program is untouched. */
export function applyUses(rawProgram: any, available: readonly VaultEntry[], beats: readonly Beat[]) {
  const used: string[] = [], usedIds: string[] = [], skipped: string[] = [];
  const uses: unknown[] = Array.isArray(rawProgram?.uses) ? rawProgram.uses : [];
  if (rawProgram && typeof rawProgram === 'object') delete rawProgram.uses;
  if (!rawProgram || !Array.isArray(rawProgram.nodes)) return { used, usedIds, skipped };
  const entries = new Map(available.map((e) => [e.id, e])), ids = new Set<string>(rawProgram.nodes.map((n: any) => n?.id));
  for (const value of uses.slice(0, 8)) {
    const u = value as RawUse;
    const entry = u && typeof u.vault === 'string' ? entries.get(u.vault) : undefined;
    if (!entry || typeof u.id !== 'string' || !ID.test(u.id) || ids.has(u.id) || !beats.some((b) => b.sourceId === u.sourceId)) { skipped.push(String((u as any)?.vault ?? '?')); continue; }
    if (rawProgram.nodes.length + entry.nodes.length > MAX_NODES) { skipped.push(entry.id); continue; }
    const finite = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
    const position = Array.isArray(u.position) && u.position.length === 3 && u.position.every((v) => finite(v, -200, 200)) ? u.position : undefined;
    const part = instantiate(entry, { ...u, id: u.id, sourceId: u.sourceId!, ...(position ? { position } : { position: undefined }), scale: finite(u.scale, .05, 40) ? u.scale : 1, rotationY: finite(u.rotationY, -6.283, 6.283) ? u.rotationY : undefined });
    if (part.nodes.some((n) => ids.has(n.id))) { skipped.push(entry.id); continue; }
    part.nodes.forEach((n) => ids.add(n.id)); rawProgram.nodes.push(...part.nodes);
    if (Array.isArray(rawProgram.tracks)) rawProgram.tracks.push(...part.tracks);
    used.push(entry.id); usedIds.push(u.id);
  }
  return { used, usedIds, skipped };
}

/** New reusable pieces from a program that already passed validation. `roots` come from candidateRoots() taken
 * BEFORE the model's optional `asset` markers are stripped; pieces that came from the vault are skipped. */
export function harvest(program: SceneProgram, roots: ReturnType<typeof candidateRoots>, skip: ReadonlySet<string> = new Set()): VaultEntry[] {
  const out: VaultEntry[] = [];
  for (const { id, marker } of roots) { if (skip.has(id)) continue; const entry = extractEntry(program, id, marker); if (entry) out.push(entry); }
  return out;
}
export const stripAssetMarkers = (rawProgram: any) => { if (Array.isArray(rawProgram?.nodes)) for (const n of rawProgram.nodes) if (n && typeof n === 'object') delete n.asset; };
export { candidateRoots };
