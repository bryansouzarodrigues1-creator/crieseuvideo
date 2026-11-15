import { CARGO_GRIP, TRUCK_BED, normalizeProduction, rotate, type ProductionSource, type ProductionProgram, type ProductionAsset, type ProductionTrack, type ProductionShot } from './score';

const clean = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const quote = (text: string, re: RegExp) => text.match(re)?.[0];
const negated = (s: string) => /\b(nao|nunca|jamais|caso)\b|^\s*se\b/.test(s);
const liftUp = /\b(ergue|ergueu|eleva|elevou|levanta|levantou|sobe|subiu|icou|ica)\b/;
const liftDown = /\b(abaixa|abaixou|baixa|baixou|desce|desceu|coloca|colocou|deposita|depositou)\b/;

/** Conservative offline compiler for the same public score the AI can compose.
 * This is an available subset, not a claim of unrestricted natural-language understanding. */
export function localProduction(sources: ProductionSource[]): ProductionProgram | undefined {
  const text = sources.map((s) => s.text).join(' '), full = clean(text);
  const crane = quote(text, /guindaste|grua|guincho/i), elevator = quote(text, /elevador/i), truck = quote(text, /caminh[aã]o|ca[cç]amba/i);
  const cargo = quote(text, /carga|caixa|palete|sacos? de cimento|materiais/i);
  const laugh = /haha|hehe|kkk|\b(riu|rindo|risada|gargalh\w*)\b/.test(full);
  const pride = /\b(orgulh\w*|exibiu|confiante)\b|\b(eu sou|ele e|ela e)\b.{0,25}\b(melhor|maior)\b/.test(full);
  const smile = /\b(sorri\w*|sorriso|feliz)\b/.test(full);
  const personal = !crane && !elevator && !truck && (laugh || pride || smile) && !/\b(leao|gato|cachorro|animal|boneca|robo|computador|grafico|coracao)\b/.test(full);
  if (!crane && !elevator && !truck && !personal) return;
  if (sources.some((s) => negated(clean(s.text)))) return;
  const assets: ProductionAsset[] = [], tracks: ProductionTrack[] = [], shots: ProductionShot[] = [], couplings: ProductionProgram['couplings'] = [];
  const asset = (id: string, kind: ProductionAsset['kind'], position: ProductionAsset['position'], evidence: string, initial: Record<string, number> = {}, color = '#F4BA3F'): ProductionAsset => {
    const a = { id, kind, position, yaw: 0, evidence, initial, color }; assets.push(a); return a;
  };
  const track = (source: ProductionSource, asset: string, channel: string, to: number, begin = .08, end = .92) => tracks.push({ asset, channel, to, begin, end, sourceId: source.sourceId, evidence: source.text });
  const amount = (line: string, fallback: number) => {
    const match = clean(line).match(/(?:ate|a)\s+(\d+(?:[,.]\d+)?)\s*(?:metros?\b|m\b)/);
    return match ? Number(match[1].replace(',', '.')) : fallback;
  };
  if (personal) {
    asset('actor', 'person', [0, 0, 0], sources[0].text, {}, '#407FA3');
    for (const source of sources) {
      const t = clean(source.text);
      if (/\b(orgulh\w*|melhor|maior|exibiu|confiante)\b/.test(t)) track(source, 'actor', 'pride', .85, .04, .35);
      if (/haha|hehe|kkk|\b(riu|rindo|risada|gargalh\w*)\b/.test(t)) track(source, 'actor', 'laugh', .9, .48, .7);
      if (/\b(sorri\w*|sorriso|feliz)\b/.test(t)) track(source, 'actor', 'smile', .9, .18, .65);
      shots.push({ sourceId: source.sourceId, subject: 'actor', socket: 'origin', kind: sources.length > 1 && source !== sources[0] ? 'detail' : 'wide' });
    }
  } else if (crane) {
    const firstMotion = sources.find((s) => liftUp.test(clean(s.text)) || liftDown.test(clean(s.text)));
    const initialHeight = firstMotion && liftDown.test(clean(firstMotion.text)) ? 6 : CARGO_GRIP;
    asset('crane', 'tower_crane', [0, 0, 0], crane, { hoist: initialHeight });
    if (cargo) {
      asset('cargo', 'cargo', [4, initialHeight - CARGO_GRIP, 0], cargo);
      couplings.push({ child: 'cargo', parent: 'crane', socket: 'hook', childSocket: 'grip', at: { sourceId: sources[0].sourceId, phase: 0 } });
    }
    let trolley = 4, slew = 0, placed = false;
    for (const source of sources) {
      const t = clean(source.text);
      let socket = /contrapeso/.test(t) ? 'counterweight' : /motor|cabine|operador/.test(t) ? 'cab' : /lanca|triangulo|estrutura/.test(t) ? 'jib' : 'hook';
      let shot: ProductionShot['kind'] = source === sources[0] ? 'wide' : /lanca|torre|gira|girou/.test(t) ? 'orbit' : 'follow';
      if (liftUp.test(t)) { const height = amount(t, 5.8); if (height < CARGO_GRIP || height > 11.2) return; track(source, 'crane', 'hoist', height); }
      if (/\bcarrinho\b/.test(t) && /\b(leva|levou|desloca|deslocou|avanca|avancou|ponta|aproxima|aproximou|volta|recolhe)\b/.test(t)) { trolley = /aproxima|volta|recolhe/.test(t) ? 3 : amount(t, 7); if (trolley < 2 || trolley > 8) return; track(source, 'crane', 'trolley', trolley); socket = 'trolley'; }
      if (/\b(gira|girou|giram|rotaciona|rotacionou)\b/.test(t)) {
        const degrees = t.match(/(\d+(?:[,.]\d+)?)\s*graus/)?.[1];
        slew = (degrees ? Number(degrees.replace(',', '.')) * Math.PI / 180 : Math.PI / 3) * (/esquerda|anti/.test(t) ? 1 : -1);
        if (Math.abs(slew) > 2.8) return; track(source, 'crane', 'slew', slew);
      }
      if (liftDown.test(t)) {
        const toTruck = cargo && truck && /caminhao|cacamba/.test(t);
        const height = toTruck ? TRUCK_BED + CARGO_GRIP : amount(t, CARGO_GRIP);
        if (height < CARGO_GRIP || height > 11.2) return;
        track(source, 'crane', 'hoist', height, .08, .84);
        if (toTruck) { couplings.push({ child: 'cargo', parent: 'truck', socket: 'bed', childSocket: 'base', at: { sourceId: source.sourceId, phase: .91 } }); placed = true; }
      }
      if (placed && /caminhao/.test(t) && /\b(sai|saiu|parte|partiu|avanca|avancou|segue|seguiu)\b/.test(t)) { track(source, 'truck', 'x', 13); socket = 'origin'; shots.push({ sourceId: source.sourceId, subject: 'truck', socket, kind: 'follow' }); }
      else shots.push({ sourceId: source.sourceId, subject: 'crane', socket, kind: shot });
    }
    if (truck) {
      const p = rotate([trolley, 0, 0], slew);
      asset('truck', 'truck', p, truck, {}, '#327B9A');
    }
  } else if (elevator) {
    const firstMotion = sources.find((s) => liftUp.test(clean(s.text)) || liftDown.test(clean(s.text)));
    const initial = firstMotion && liftDown.test(clean(firstMotion.text)) ? 6 : 0;
    asset('lift', 'lift', [0, 0, 0], elevator, { lift: initial });
    if (cargo) { asset('cargo', 'cargo', [0, initial + .25, 0], cargo); couplings.push({ child: 'cargo', parent: 'lift', socket: 'platform', childSocket: 'base', at: { sourceId: sources[0].sourceId, phase: 0 } }); }
    for (const source of sources) {
      const t = clean(source.text);
      if (liftUp.test(t)) { const h = amount(t, 6); if (h < 0 || h > 9) return; track(source, 'lift', 'lift', h); }
      if (liftDown.test(t)) track(source, 'lift', 'lift', 0);
      if (/porta/.test(t) && /abre|abrem|abriu|abertas/.test(t)) track(source, 'lift', 'doors', 1);
      if (/porta/.test(t) && /fecha|fecham|fechou|fechadas/.test(t)) track(source, 'lift', 'doors', 0);
      shots.push({ sourceId: source.sourceId, subject: 'lift', socket: /porta/.test(t) ? 'doors' : 'platform', kind: source === sources[0] ? 'wide' : 'follow' });
    }
  } else if (truck) {
    asset('truck', 'truck', [-5, 0, 7.5], truck, {}, '#327B9A');
    if (cargo) { asset('cargo', 'cargo', [-5, TRUCK_BED, 7.5], cargo); couplings.push({ child: 'cargo', parent: 'truck', socket: 'bed', childSocket: 'base', at: { sourceId: sources[0].sourceId, phase: 0 } }); }
    for (const source of sources) {
      if (/\b(sai|saiu|parte|partiu|avanca|avancou|segue|seguiu|anda|andou)\b/.test(clean(source.text))) track(source, 'truck', 'x', 10);
      shots.push({ sourceId: source.sourceId, subject: 'truck', socket: 'origin', kind: 'follow' });
    }
  }
  if (!assets.length) return;
  try { return normalizeProduction({ version: 1, world: personal ? 'studio' : 'construction', assets, tracks, couplings, shots }, sources); }
  catch { return; } // Do not invent/repair an offline choreography whose contact is infeasible.
}
