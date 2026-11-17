import type { VaultEntry } from './vault';

/** Persistence boundary. Every implementation must be failure-tolerant: a missing table or network
 * error means "no pieces", never an exception that blocks direction. */
export interface VaultStore {
  list(): Promise<VaultEntry[]>;
  put(entry: VaultEntry): Promise<void>;
  recordUse(id: string): Promise<void>;
  recordReject(id: string): Promise<void>;
}
export class MemoryVaultStore implements VaultStore {
  readonly items = new Map<string, VaultEntry>();
  async list() { return [...this.items.values()]; }
  async put(entry: VaultEntry) { if (!this.items.has(entry.id)) this.items.set(entry.id, entry); }
  async recordUse(id: string) { const e = this.items.get(id); if (e) e.uses++; }
  async recordReject(id: string) { const e = this.items.get(id); if (e) e.rejects++; }
}

/** Server-side Supabase table `scene_vault` (see drizzle/migrations/0003). Service role only. */
export function supabaseVaultStore(client: () => Promise<any>): VaultStore {
  const run = async <T>(fallback: T, job: (db: any) => Promise<T>): Promise<T> => { try { return await job(await client()); } catch { return fallback; } };
  const row = (e: VaultEntry) => ({ id: e.id, title: e.title, kind: e.kind, keywords: e.keywords, context_tokens: e.contextTokens, fragment: { root: e.root, nodes: e.nodes, tracks: e.tracks, size: e.size }, uses: e.uses, rejects: e.rejects, created_at: e.createdAt });
  return {
    list: () => run<VaultEntry[]>([], async (db) => {
      const { data, error } = await db.from('scene_vault').select('*').lt('rejects', 2).order('uses', { ascending: false }).limit(400);
      if (error || !Array.isArray(data)) return [];
      return data.map((r: any): VaultEntry => ({ id: r.id, title: r.title, kind: r.kind, keywords: r.keywords ?? [], contextTokens: r.context_tokens ?? [], root: r.fragment?.root, nodes: r.fragment?.nodes ?? [], tracks: r.fragment?.tracks ?? [], size: r.fragment?.size ?? [1, 1, 1], uses: r.uses ?? 0, rejects: r.rejects ?? 0, createdAt: r.created_at }))
        .filter((e) => e.root && Array.isArray(e.nodes) && e.nodes.length);
    }),
    put: (entry) => run(undefined, async (db) => { await db.from('scene_vault').upsert(row(entry), { onConflict: 'id', ignoreDuplicates: true }); }),
    recordUse: (id) => run(undefined, async (db) => { await db.rpc('scene_vault_bump', { p_id: id, p_field: 'uses' }); }),
    recordReject: (id) => run(undefined, async (db) => { await db.rpc('scene_vault_bump', { p_id: id, p_field: 'rejects' }); }),
  };
}
