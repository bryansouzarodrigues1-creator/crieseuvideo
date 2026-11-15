/** Composable, bounded production score. No executable model code or remote assets. */
export const ASSET_KINDS = ['tower_crane', 'cargo', 'truck', 'lift', 'worker', 'person'] as const;
export type AssetKind = typeof ASSET_KINDS[number];
export type Vec3 = [number, number, number];
export interface ProductionAsset { id: string; kind: AssetKind; position: Vec3; yaw: number; color: string; initial: Record<string, number>; evidence: string; cargoStyle?: 'box' | 'sacks' | 'pallet' }
export interface Anchor { sourceId: string; phase: number }
export interface ProductionTrack { asset: string; channel: string; sourceId: string; begin: number; end: number; to: number; evidence: string }
export interface ProductionCoupling { child: string; parent: string | null; socket: string; childSocket: string; at: Anchor }
export interface ProductionShot { sourceId: string; subject: string; socket: string; kind: 'wide' | 'detail' | 'follow' | 'orbit' }
export interface ProductionProgram { version: 1; world: 'construction' | 'studio'; assets: ProductionAsset[]; tracks: ProductionTrack[]; couplings: ProductionCoupling[]; shots: ProductionShot[] }
export interface ProductionSource { sourceId: string; text: string; duration: number; voice?: { start: number; end: number } }
export interface AssetState { position: Vec3; yaw: number; joints: Record<string, number> }
export interface Pose { position: Vec3; yaw: number }
export const CARGO_GRIP = 1.2, TRUCK_BED = 1.25, CRANE_JIB = 12.6;
const transform = { x: [-18, 18, 0], z: [-14, 14, 0], yaw: [-Math.PI * 2, Math.PI * 2, 0] };
export const CHANNELS: Record<AssetKind, Record<string, number[]>> = {
  tower_crane: { ...transform, slew: [-2.8, 2.8, 0], trolley: [2, 8, 4], hoist: [CARGO_GRIP, 11.2, CARGO_GRIP] },
  truck: transform,
  lift: { ...transform, lift: [0, 9, 0], doors: [0, 1, 0] },
  cargo: transform,
  worker: { yaw: transform.yaw, gesture: [0, 1, 0] },
  person: { yaw: transform.yaw, pride: [0, 1, 0], laugh: [0, 1, 0], smile: [0, 1, 0], point: [0, 1, 0], talk: [0, 1, 0] },
};
export const SOCKETS: Record<AssetKind, string[]> = { tower_crane: ['origin', 'hook', 'trolley', 'jib', 'counterweight', 'cab'], cargo: ['origin', 'base', 'grip'], truck: ['origin', 'bed', 'cab'], lift: ['origin', 'platform', 'doors'], worker: ['origin', 'head'], person: ['origin', 'head'] };
export class ProductionError extends Error { constructor(public code: string, message: string) { super(message); this.name = 'ProductionError'; } }
const reject = (message: string): never => { throw new ProductionError('invalid_production', message); };
const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : reject('A direção 3D contém um objeto inválido.');
const id = (v: unknown): string => typeof v === 'string' && /^[a-zA-Z][\w-]{0,39}$/.test(v) ? v : reject('A direção 3D contém um identificador inválido.');
const number = (v: unknown, min: number, max: number): number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : reject('Uma posição ou duração 3D ultrapassa os limites do motor.');
const list = (v: unknown, max: number): any[] => Array.isArray(v) && v.length <= max ? v : reject('A direção 3D ultrapassa a quantidade de elementos permitida.');
const clean = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const add = (a: Vec3, b: Vec3): Vec3 => a.map((n, i) => n + b[i]) as Vec3;
export const subtract = (a: Vec3, b: Vec3): Vec3 => a.map((n, i) => n - b[i]) as Vec3;
export const rotate = ([x, y, z]: Vec3, yaw: number): Vec3 => [x * Math.cos(yaw) + z * Math.sin(yaw), y, -x * Math.sin(yaw) + z * Math.cos(yaw)];
export const distance = (a: Vec3, b: Vec3) => Math.hypot(...subtract(a, b));

/** Validation checks executable capabilities, bounds, references and contacts;
 * it does not demand that a model's interpretation equal a keyword recipe. */
export function normalizeProduction(raw: unknown, sources: ProductionSource[]): ProductionProgram | undefined {
  if (raw === undefined || raw === null) return;
  const r = object(raw);
  if (r.version !== 1 || !['construction', 'studio'].includes(r.world)) reject('A versão ou o cenário de produção não tem suporte.');
  const sourceMap = new Map(sources.map((s) => [s.sourceId, s]));
  const source = (v: unknown) => { const key = id(v); if (!sourceMap.has(key)) reject('A produção citou uma frase que não existe no roteiro.'); return key; };
  const evidence = (v: unknown, text: string) => typeof v === 'string' && v.trim().length >= 3 && v.length <= 400 && text.includes(v) ? v : reject('A ação 3D não tem um trecho literal do roteiro como evidência.');
  const fullText = sources.map((s) => s.text).join(' ');
  const assets = list(r.assets, 12).map((v): ProductionAsset => {
    const a = object(v), kind = a.kind as AssetKind;
    if (!(ASSET_KINDS as readonly string[]).includes(kind)) reject('A IA pediu um modelo 3D que ainda não está disponível.');
    const p = list(a.position, 3); if (p.length !== 3) reject('A posição 3D precisa de três coordenadas.');
    const initial: Record<string, number> = {};
    for (const [key, val] of Object.entries(a.initial === undefined ? {} : object(a.initial))) {
      const limits = CHANNELS[kind][key]; if (!limits || ['x', 'z', 'yaw'].includes(key)) reject('Uma articulação inicial não tem suporte.');
      initial[key] = number(val, limits[0], limits[1]);
    }
    const proof = evidence(a.evidence, fullText);
    const nouns: Partial<Record<AssetKind, RegExp>> = { tower_crane: /guindaste|grua|guincho/, truck: /caminhao|cacamba/, lift: /elevador/, cargo: /carga|caixa|palete|saco|materiais/, worker: /operari|trabalhador|operador|pedreiro/ };
    if (nouns[kind] && !nouns[kind]!.test(clean(proof))) reject('Um modelo 3D não foi mencionado no trecho indicado como evidência.');
    if (a.cargoStyle !== undefined && !['box', 'sacks', 'pallet'].includes(a.cargoStyle)) reject('A variante da carga não tem suporte.');
    const cargoStyle = kind !== 'cargo' ? undefined : a.cargoStyle ?? (/caixa/.test(clean(proof)) ? 'box' : /sacos?|cimento/.test(clean(fullText)) ? 'sacks' : /palete/.test(clean(proof)) ? 'pallet' : 'box');
    return { id: id(a.id), kind, position: [number(p[0], -18, 18), number(p[1], 0, 10), number(p[2], -14, 14)], yaw: number(a.yaw ?? 0, -Math.PI * 2, Math.PI * 2), color: typeof a.color === 'string' && /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : '#F4BA3F', initial, evidence: proof, ...(cargoStyle ? { cargoStyle } : {}) };
  });
  if (!assets.length || new Set(assets.map((a) => a.id)).size !== assets.length) reject('Os modelos 3D estão ausentes ou possuem IDs repetidos.');
  const asset = (key: unknown) => assets.find((a) => a.id === id(key)) ?? reject('Uma ação citou um modelo 3D inexistente.');
  const tracks = list(r.tracks ?? [], 100).map((v): ProductionTrack => {
    const t = object(v), a = asset(t.asset), sourceId = source(t.sourceId), channel = String(t.channel);
    const limits = CHANNELS[a.kind][channel]; if (!limits) reject('A IA pediu um movimento que este modelo não executa.');
    const begin = number(t.begin ?? .08, 0, 1), end = number(t.end ?? .92, 0, 1); if (end <= begin) reject('Um movimento termina antes de começar.');
    const text = sourceMap.get(sourceId)!.text, normalized = clean(text);
    const denied: Record<string, RegExp> = { hoist: /\b(nao|nunca|jamais)\s+(?:\w+\s+){0,2}(ergue|ergueu|eleva|elevou|abaixa|abaixou|levanta|levantou)/, slew: /\b(nao|nunca|jamais)\s+(?:\w+\s+){0,2}(gira|girou|rotacion)/, lift: /\b(nao|nunca|jamais)\s+(?:\w+\s+){0,2}(sobe|subiu|desce|desceu)/, x: /\b(nao|nunca|jamais)\s+(?:\w+\s+){0,2}(anda|andou|sai|saiu|avanca|avancou)/ };
    if (denied[channel]?.test(normalized)) reject('A direção tentou executar uma ação negada pelo roteiro.');
    return { asset: a.id, channel, sourceId, begin, end, to: number(t.to, limits[0], limits[1]), evidence: evidence(t.evidence, text) };
  });
  const couplings = list(r.couplings ?? [], 32).map((v): ProductionCoupling => {
    const c = object(v), child = asset(c.child), parent = c.parent === null ? null : asset(c.parent), at = object(c.at);
    if (child.kind !== 'cargo') reject('Somente cargas podem ser acopladas nesta versão.');
    if (parent && !(parent.kind === 'tower_crane' && c.socket === 'hook' || parent.kind === 'truck' && c.socket === 'bed' || parent.kind === 'lift' && c.socket === 'platform')) reject('Este ponto do modelo não serve para transportar cargas.');
    if (!SOCKETS[child.kind].includes(c.childSocket) || (parent && !SOCKETS[parent.kind].includes(c.socket))) reject('Um ponto de contato não existe neste modelo.');
    if (parent?.id === child.id) reject('Um objeto não pode carregar a si mesmo.');
    return { child: child.id, parent: parent?.id ?? null, socket: parent ? c.socket : 'origin', childSocket: c.childSocket, at: { sourceId: source(at.sourceId), phase: number(at.phase, 0, 1) } };
  });
  const shots = list(r.shots ?? [], 120).map((v): ProductionShot => {
    const s = object(v), a = asset(s.subject);
    if (!['wide', 'detail', 'follow', 'orbit'].includes(s.kind) || !SOCKETS[a.kind].includes(s.socket ?? 'origin')) reject('A câmera usa uma tomada ou alvo desconhecido.');
    return { sourceId: source(s.sourceId), subject: a.id, socket: s.socket ?? 'origin', kind: s.kind };
  });
  if (new Set(shots.map((s) => s.sourceId)).size !== shots.length) reject('Uma frase recebeu duas câmeras incompatíveis.');
  if (sources.some((s) => !shots.some((shot) => shot.sourceId === s.sourceId))) reject('A produção 3D não dirigiu todas as frases do roteiro.');
  const program: ProductionProgram = { version: 1, world: r.world, assets, tracks, couplings, shots };
  // Compile now: a bad contact must fail before replacing the user's preview.
  compileProduction(program, sources);
  return program;
}

export function initialState(asset: ProductionAsset): AssetState {
  const joints = Object.fromEntries(Object.entries(CHANNELS[asset.kind]).filter(([key]) => !['x', 'z', 'yaw'].includes(key)).map(([key, value]) => [key, asset.initial[key] ?? value[2]]));
  return { position: [...asset.position], yaw: asset.yaw, joints };
}
export function socketLocal(kind: AssetKind, state: AssetState, socket: string): Pose {
  const j = state.joints;
  if (kind === 'tower_crane') {
    if (socket === 'hook' || socket === 'trolley') return { position: rotate([j.trolley, socket === 'hook' ? j.hoist : CRANE_JIB, 0], j.slew), yaw: j.slew };
    if (socket === 'jib') return { position: rotate([4, CRANE_JIB, 0], j.slew), yaw: j.slew };
    if (socket === 'counterweight') return { position: rotate([-3.2, CRANE_JIB + .2, 0], j.slew), yaw: j.slew };
    if (socket === 'cab') return { position: rotate([.9, CRANE_JIB - .8, .9], j.slew), yaw: j.slew };
  }
  if (kind === 'cargo' && socket === 'grip') return { position: [0, CARGO_GRIP, 0], yaw: 0 };
  if (kind === 'truck' && socket === 'bed') return { position: [0, TRUCK_BED, 0], yaw: 0 };
  if (kind === 'truck' && socket === 'cab') return { position: [1.8, 2, 0], yaw: 0 };
  if (kind === 'lift' && ['platform', 'doors'].includes(socket)) return { position: [0, j.lift + .25 + (socket === 'doors' ? 1 : 0), 0], yaw: 0 };
  if ((kind === 'worker' || kind === 'person') && socket === 'head') return { position: [0, 1.75, 0], yaw: 0 };
  return { position: [0, 0, 0], yaw: 0 };
}
export function socketWorld(asset: ProductionAsset, state: AssetState, socket: string): Pose {
  const local = socketLocal(asset.kind, state, socket);
  return { position: add(state.position, rotate(local.position, state.yaw)), yaw: state.yaw + local.yaw };
}
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
interface CompiledTrack extends ProductionTrack { start: number; finish: number; from: number }
interface Binding { child: string; parent: string | null; socket: string; childSocket: string; time: number; yawOffset: number; frozen?: Pose; contactError: number }
export interface ProductionScore { program: ProductionProgram; duration: number; spans: { sourceId: string; start: number; duration: number }[]; tracks: CompiledTrack[]; bindings: Binding[]; sample(time: number): Map<string, AssetState>; shot(time: number): ProductionShot | undefined }

/** Random access, not frame stepping. Rewind, preview and export share the same result. */
export function compileProduction(program: ProductionProgram, sources: ProductionSource[]): ProductionScore {
  let cursor = 0;
  const spans = sources.map((s) => { const start = cursor; cursor += s.duration; return { sourceId: s.sourceId, start, duration: s.duration }; });
  const spanMap = new Map(spans.map((s) => [s.sourceId, s]));
  const time = (sourceId: string, phase: number) => { const s = spanMap.get(sourceId); if (!s) return reject('Frase ausente na linha do tempo 3D.'); return s.start + s.duration * phase; };
  const defs = new Map(program.assets.map((a) => [a.id, a]));
  const tracks: CompiledTrack[] = program.tracks.map((t) => ({ ...t, start: time(t.sourceId, t.begin), finish: time(t.sourceId, t.end), from: 0 })).sort((a, b) => a.start - b.start);
  const last = new Map<string, CompiledTrack>();
  for (const track of tracks) {
    const key = `${track.asset}.${track.channel}`, prev = last.get(key), a = defs.get(track.asset)!;
    if (prev && prev.finish > track.start + .00001) reject('Dois movimentos tentam controlar a mesma articulação ao mesmo tempo.');
    track.from = prev?.to ?? (track.channel === 'x' ? a.position[0] : track.channel === 'z' ? a.position[2] : track.channel === 'yaw' ? a.yaw : initialState(a).joints[track.channel]);
    last.set(key, track);
  }
  const bindings: Binding[] = [];
  const sample = (at: number): Map<string, AssetState> => {
    const states = new Map(program.assets.map((a) => [a.id, initialState(a)]));
    for (const t of tracks) if (at >= t.start) {
      const state = states.get(t.asset)!, val = t.from + (t.to - t.from) * smooth((at - t.start) / (t.finish - t.start));
      if (t.channel === 'x') state.position[0] = val;
      else if (t.channel === 'z') state.position[2] = val;
      else if (t.channel === 'yaw') state.yaw = val;
      else state.joints[t.channel] = val;
    }
    const current = new Map<string, Binding>();
    for (const b of bindings) if (at + 1e-8 >= b.time) current.set(b.child, b);
    const done = new Set<string>(), visiting = new Set<string>();
    const bind = (key: string) => {
      if (done.has(key)) return;
      if (visiting.has(key)) return reject('As vinculações de objetos formaram um ciclo.');
      visiting.add(key); const b = current.get(key);
      if (b) {
        const child = states.get(key)!;
        if (b.parent) {
          bind(b.parent);
          const port = socketWorld(defs.get(b.parent)!, states.get(b.parent)!, b.socket);
          child.yaw = port.yaw + b.yawOffset;
          child.position = subtract(port.position, rotate(socketLocal(defs.get(key)!.kind, child, b.childSocket).position, child.yaw));
        } else if (b.frozen) { child.position = [...b.frozen.position]; child.yaw = b.frozen.yaw; }
      }
      visiting.delete(key); done.add(key);
    };
    for (const key of states.keys()) bind(key);
    return states;
  };
  for (const event of [...program.couplings].sort((a, b) => time(a.at.sourceId, a.at.phase) - time(b.at.sourceId, b.at.phase))) {
    const at = time(event.at.sourceId, event.at.phase), before = sample(at), child = before.get(event.child)!;
    const target = event.parent ? socketWorld(defs.get(event.parent)!, before.get(event.parent)!, event.socket) : { position: child.position, yaw: child.yaw };
    const contact = socketWorld(defs.get(event.child)!, child, event.childSocket);
    const error = event.parent ? distance(contact.position, target.position) : 0;
    if (error > .005) throw new ProductionError('contact_mismatch', 'A direção tentou prender uma carga longe do ponto de contato. Nenhuma animação foi substituída.');
    bindings.push({ ...event, time: at, yawOffset: child.yaw - target.yaw, frozen: event.parent ? undefined : { position: [...child.position], yaw: child.yaw }, contactError: error });
    sample(at); // Detect cycles at the moment a binding becomes active.
  }
  return { program, duration: cursor, spans, tracks, bindings, sample, shot(at) {
    const s = spans.find((s, i) => at < s.start + s.duration || i === spans.length - 1);
    return program.shots.find((shot) => shot.sourceId === s?.sourceId) ?? program.shots[0];
  } };
}

/** Merge chunked director output without recreating/moving the same asset. */
export function mergeProduction(parts: unknown[]): unknown {
  const supplied = parts.filter((p) => p !== undefined && p !== null);
  if (!supplied.length) return;
  const definitions = new Map<string, any>();
  const result = { version: 1, world: '', assets: [] as any[], tracks: [] as any[], couplings: [] as any[], shots: [] as any[] };
  for (const part of supplied) {
    const p = object(part);
    if (p.version !== 1 || result.world && result.world !== p.world) reject('A IA mudou o cenário ou a versão entre partes do roteiro.');
    result.world = p.world;
    for (const raw of list(p.assets, 12)) {
      const a = object(raw), key = id(a.id), previous = definitions.get(key);
      const shape = (v: any) => JSON.stringify([v.kind, v.position, v.yaw ?? 0, v.color ?? '#F4BA3F', v.cargoStyle, Object.entries(v.initial ?? {}).sort(([a], [b]) => a.localeCompare(b))]);
      if (previous && shape(previous) !== shape(a)) reject('A IA mudou a identidade ou o estado inicial de um objeto entre partes do roteiro.');
      if (!previous) { definitions.set(key, a); result.assets.push(a); }
    }
    for (const key of ['tracks', 'couplings', 'shots'] as const) result[key].push(...list(p[key] ?? [], 120));
  }
  return result;
}

export const PRODUCTION_GUIDE = `Produção 3D COMBINÁVEL (opcional no topo do JSON, campo production):
{version:1,world:"construction|studio",assets:[{id,kind,position:[x,y,z],yaw:0,color:"#F4BA3F",initial:{},evidence:"trecho literal do roteiro"}],tracks:[{asset,channel,sourceId,begin:0.08,end:0.92,to,evidence:"trecho literal desta frase"}],couplings:[{child,parent,socket,childSocket,at:{sourceId,phase:0}}],shots:[{sourceId,subject,socket:"origin",kind:"wide|detail|follow|orbit"}]}.
Modelos: tower_crane (grua articulada), cargo (carga/palete), truck, lift (elevador de obra), worker, person (pessoa genérica SEM profissão inventada).
Controles: tower_crane/cargo/truck/lift permitem x[-18,18],z[-14,14],yaw[-6.28,6.28]. tower_crane: slew[-2.8,2.8] radianos, trolley[2,8] metros, hoist[1.2,11.2] ALTURA DO GANCHO; lift: lift[0,9],doors[0,1]; worker:yaw/gesture[0,1]; person:yaw e pride/laugh/smile/point/talk[0,1] combináveis. Person/worker não caminham neste programa; para caminhar use a encenação legada staging, sem production. A carga tem cargoStyle=box|sacks|pallet, conforme caixa/sacos/palete literal. Uma frase de orgulho seguida de risada pode aumentar pride e depois laugh, sem inventar esporte ou vitória. Use world=studio para atuação sem local especificado; construction somente quando houver obra/máquinas no roteiro.
Os valores iniciais vão em initial, sem x/z/yaw. As tracks mudam suavemente do valor anterior até to e preservam o estado entre frases. Não escreva from.
Sockets: tower_crane=origin/hook/trolley/jib/counterweight/cab; cargo=base/grip/origin (grip fica 1.2m acima da base); truck=bed/cab/origin (bed=1.25m); lift=platform/doors/origin (platform=lift+.25m); worker=head/origin.
Só cargo pode ser acoplada. Alinhe childSocket e socket ANTES de acoplar: distância máxima .005m. O motor preserva orientação e continuidade. Exemplo: guindaste em [0,0,0], slew0,trolley4,hoist1.2 => hook[4,1.2,0]; carga base[4,0,0] => grip[4,1.2,0]. Com carga na caçamba do caminhão, gancho deve ter altura 2.45m antes da troca para truck.bed/cargo.base.
Cada sourceId deve ser real. Nunca invente personagens, objetos, ações afirmativas para frases negadas, voos ou capacidades fora do catálogo. Use produção somente quando o roteiro pede esses elementos. Cada ação e modelo precisa evidence copiada literalmente do roteiro. A câmera pode mostrar partes e acompanhar objetos. A produção é global: IDs e posse permanecem entre todas as frases; não recrie os objetos a cada cena.`;
