import type { SceneProgram } from '../score';
import { deriveKeywords, estimateSize, type VaultEntry, type VaultNode, type VaultTrack } from './vault';
import { tokens } from './keywords';

/** Raw (pre-validation) program fields used by the vault. They are stripped before the program is validated,
 * so the renderer and the existing contract never see them. */
export interface RawAssetMarker { name?: unknown; keywords?: unknown }
export interface RawUse { vault: string; id?: string; sourceId?: string; position?: [number, number, number]; scale?: number; rotationY?: number }

const MAX_FRAGMENT_NODES = 60;
const slug = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28);
const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };

/** Pieces worth keeping: a root-level group of meshes. Actors, imported models and anything the program
 * contacts or constrains stay scene-specific. Marked groups win; unmarked ones qualify by size. */
export function candidateRoots(raw: { nodes?: any[] }): { id: string; marker?: RawAssetMarker }[] {
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  return nodes.filter((n) => n && n.kind === 'group' && !n.parent && typeof n.id === 'string')
    .map((n) => ({ id: n.id as string, marker: n.asset && typeof n.asset === 'object' ? n.asset as RawAssetMarker : undefined }));
}

/** Builds a vault entry from an already VALIDATED program, or null when the subtree is not reusable. */
export function extractEntry(program: SceneProgram, rootId: string, marker?: RawAssetMarker): VaultEntry | null {
  const root = program.nodes.find((n) => n.id === rootId);
  if (!root || root.kind !== 'group' || root.parent) return null;
  const subtree = new Set([rootId]);
  for (let grew = true; grew;) { grew = false; for (const n of program.nodes) if (n.parent && subtree.has(n.parent) && !subtree.has(n.id)) { subtree.add(n.id); grew = true; } }
  const members = program.nodes.filter((n) => subtree.has(n.id));
  if (members.length < 3 || members.length > MAX_FRAGMENT_NODES || members.some((n) => n.kind !== 'group' && n.kind !== 'mesh')) return null;
  if (members.filter((n) => n.kind === 'mesh').length < 2) return null;
  if (program.contacts.some((c) => subtree.has(c.target) || subtree.has(c.actor))) return null;
  const mine = program.tracks.filter((t) => subtree.has(t.node));
  const sources = new Set(mine.flatMap((t) => t.keys.map((k) => k.sourceId)));
  const animated = mine.length > 0 && sources.size === 1 && mine.every((t) => ['position', 'rotation', 'scale'].includes(t.channel));
  const nodes: VaultNode[] = members.map((n) => ({ id: n.id, kind: n.kind as 'group' | 'mesh', ...(n.parent ? { parent: n.parent } : {}), position: n.position, rotation: n.rotation, scale: n.scale, color: n.color,
    ...(n.geometry ? { geometry: n.geometry as unknown as Record<string, unknown> } : {}), ...(n.material ? { material: n.material as unknown as Record<string, unknown> } : {}), ...(n.repeat ? { repeat: n.repeat as unknown as Record<string, unknown> } : {}) }));
  const tracks: VaultTrack[] = animated ? mine.map((t) => ({ node: t.node, channel: t.channel as VaultTrack['channel'], interpolation: t.interpolation, keys: t.keys.map((k) => ({ phase: k.phase, value: k.value })) })) : [];
  const sentence = String(root.evidence ?? ''); // the literal source sentence the model tied this group to (kept only as stems)
  const name = typeof marker?.name === 'string' && marker.name.trim() ? marker.name.trim().slice(0, 60) : rootId.replace(/[-_]+/g, ' ');
  const keywords = deriveKeywords({ id: rootId, title: name, modelKeywords: marker?.keywords, sentence });
  if (!keywords.length) return null;
  const contextTokens = [...new Set([...tokens(sentence), ...tokens(name)])].slice(0, 24);
  const id = `${slug(name) || 'peca'}-${hash(JSON.stringify([nodes, tracks]))}`;
  return { id, title: name, kind: members.filter((n) => n.kind === 'mesh').length >= 12 || estimateSize(nodes)[0] > 25 ? 'place' : 'object', keywords, contextTokens, root: rootId, nodes, tracks, size: estimateSize(nodes), uses: 0, rejects: 0, createdAt: new Date().toISOString() };
}

/** Writes a stored piece into a raw program as a fresh group. Ids are prefixed, so one piece can appear
 * several times, and evidence is rebound to the sentence being illustrated (the original is never reused). */
export function instantiate(entry: VaultEntry, use: Required<Pick<RawUse, 'id' | 'sourceId'>> & RawUse) {
  const order = new Map(entry.nodes.map((n, i) => [n.id, i])), rename = (id: string) => id === entry.root ? use.id : `${use.id}-${order.get(id)}`; // short ids keep the 40-char identifier limit
  const nodes = entry.nodes.map((n) => ({ ...n, id: rename(n.id), ...(n.parent ? { parent: rename(n.parent) } : {}), contextSourceId: use.sourceId,
    ...(n.id === entry.root ? { position: use.position ?? n.position, rotation: [n.rotation[0], use.rotationY ?? n.rotation[1], n.rotation[2]], scale: n.scale.map((v) => v * (use.scale ?? 1)) } : {}) }));
  const tracks = entry.tracks.map((t) => ({ node: rename(t.node), channel: t.channel, interpolation: t.interpolation, keys: t.keys.map((k) => ({ sourceId: use.sourceId, phase: k.phase, value: k.value })) }));
  return { nodes, tracks };
}
