import { extractKeywords, keywordsFromId, stem, tokens } from './keywords';

/** A reusable piece (object or place) saved from a validated program. It stores geometry/colour data and
 * stems only: the user's original sentence is NOT kept, so the shared vault holds no script text. */
export interface VaultNode {
  id: string; kind: 'group' | 'mesh'; parent?: string; position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number];
  color: string; geometry?: Record<string, unknown>; material?: Record<string, unknown>; repeat?: Record<string, unknown>;
}
export interface VaultTrack { node: string; channel: 'position' | 'rotation' | 'scale'; interpolation: 'linear' | 'smooth' | 'step'; keys: { phase: number; value: [number, number, number] }[] }
export interface VaultEntry {
  id: string; title: string; kind: 'object' | 'place';
  keywords: string[]; contextTokens: string[];
  root: string; nodes: VaultNode[]; tracks: VaultTrack[];
  /** Approximate size in metres (x,y,z) so a director can place and scale it without opening the nodes. */
  size: [number, number, number]; uses: number; rejects: number; createdAt: string;
}
export interface VaultMatch { entry: VaultEntry; score: number; keywordHits: string[]; contextOverlap: number }

export const MATCH = { minKeywordHits: 1, minScore: .42, keywordWeight: .65, contextWeight: .35, maxRejects: 2 };

/** Exact-keyword AND context match. A piece whose keywords do not literally appear (after stemming) in the
 * request is never returned, however similar its context looks. Pure and deterministic. */
export function scoreEntry(request: string, entry: VaultEntry): VaultMatch | null {
  if (entry.rejects >= MATCH.maxRejects) return null;
  const words = new Set(tokens(request)), hits = entry.keywords.filter((k) => words.has(stem(k)));
  if (hits.length < MATCH.minKeywordHits) return null;
  const keywordScore = Math.min(1, hits.length / 2); // one exact hit is half, two or more is full
  const entryContext = new Set(entry.contextTokens), shared = [...words].filter((w) => entryContext.has(w)).length;
  const contextOverlap = entryContext.size ? shared / Math.min(Math.max(words.size, 1), entryContext.size) : 0;
  const reliability = 1 + Math.min(entry.uses, 10) * .01 - entry.rejects * .08;
  const score = (MATCH.keywordWeight * Math.min(1, keywordScore) + MATCH.contextWeight * Math.min(1, contextOverlap)) * reliability;
  return score >= MATCH.minScore ? { entry, score, keywordHits: hits, contextOverlap } : null;
}
export function searchVault(entries: readonly VaultEntry[], request: string, limit = 3): VaultMatch[] {
  return entries.map((e) => scoreEntry(request, e)).filter((m): m is VaultMatch => !!m)
    .sort((a, b) => b.score - a.score || b.entry.uses - a.entry.uses || a.entry.id.localeCompare(b.entry.id)).slice(0, limit);
}

const SIZE_AXES: Record<string, (s: number[]) => [number, number, number]> = {
  box: (s) => [s[0], s[1], s[2]], sphere: (s) => [s[0] * 2, s[0] * 2, s[0] * 2], capsule: (s) => [s[0] * 2, s[1] + s[0] * 2, s[0] * 2],
  cone: (s) => [s[0] * 2, s[1], s[0] * 2], cylinder: (s) => [Math.max(s[0], s[1]) * 2, s[2], Math.max(s[0], s[1]) * 2], plane: (s) => [s[0], s[1], .01], torus: (s) => [(s[0] + s[1]) * 2, (s[0] + s[1]) * 2, s[1] * 2],
  terrain: (s) => [s[0], s[2], s[1]], water: (s) => [s[0], .1, s[1]], tree: (s) => [s[0] * .6, s[0], s[0] * .6], rock: (s) => [s[0] * 2, s[0] * 1.1, s[0] * 2], cloud: (s) => [s[0] * 3.6, s[0], s[0] * 1.4],
};
/** Conservative extent of a fragment from node positions and primitive sizes (ignores rotation). */
export function estimateSize(nodes: readonly VaultNode[]): [number, number, number] {
  const byId = new Map(nodes.map((n) => [n.id, n])), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const n of nodes) {
    if (n.kind !== 'mesh' || !n.geometry) continue;
    let world = [...n.position], scale = [...n.scale], at = n.parent ? byId.get(n.parent) : undefined;
    for (let depth = 0; at && depth < 20; at = at.parent ? byId.get(at.parent) : undefined, depth++) {
      world = world.map((v, i) => at!.position[i] + at!.scale[i] * v); scale = scale.map((v, i) => v * at!.scale[i]);
    }
    const shape = String(n.geometry.shape), size = Array.isArray(n.geometry.size) ? (n.geometry.size as number[]) : [];
    const extent = shape === 'mesh' || shape === 'lathe' || shape === 'tube' ? [1, 1, 1] : SIZE_AXES[shape]?.(size) ?? [1, 1, 1];
    for (let i = 0; i < 3; i++) { const half = Math.abs(extent[i] * scale[i]) / 2; lo[i] = Math.min(lo[i], world[i] - half); hi[i] = Math.max(hi[i], world[i] + half); }
  }
  return lo.every(Number.isFinite) ? [0, 1, 2].map((i) => +(hi[i] - lo[i]).toFixed(2)) as [number, number, number] : [1, 1, 1];
}

/** Keywords for a new piece: those the model supplied, the hierarchy id and the sentence it illustrates. */
export function deriveKeywords(opts: { id: string; title?: string; modelKeywords?: unknown; sentence: string }): string[] {
  const supplied = Array.isArray(opts.modelKeywords) ? opts.modelKeywords.filter((k): k is string => typeof k === 'string').slice(0, 10).flatMap((k) => tokens(k)) : [];
  const own = [...supplied, ...keywordsFromId(opts.id), ...extractKeywords(opts.title ?? '', 4)];
  const merged = [...new Set([...own, ...extractKeywords(opts.sentence, 4)])];
  return merged.slice(0, 10);
}
