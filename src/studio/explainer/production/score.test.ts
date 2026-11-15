import { describe, expect, it } from 'vitest';
import { buildFallbackPlan, normalizePlan, productionSources, refreshProduction } from '../plan';
import { withTargetDuration } from '../duration';
import { compileProduction, normalizeProduction, socketWorld, distance, mergeProduction, type ProductionProgram } from './score';

const craneScript = 'No canteiro, o guindaste ergue a carga. O carrinho leva a carga até a ponta da lança. A lança gira para a direita. O guindaste abaixa a carga na caçamba do caminhão. O caminhão sai levando a carga.';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const specimen = () => {
  const plan = withTargetDuration(buildFallbackPlan(craneScript), 40);
  expect(plan.production).toBeDefined();
  return { plan, program: plan.production!, sources: productionSources(plan.scenes) };
};
describe('composable production score', () => {
  it('ordinary input composes hoist, trolley, slew, transfer and transport instead of a board', () => {
    const { plan, program } = specimen();
    expect(program.assets.map((a) => a.kind)).toEqual(['tower_crane', 'cargo', 'truck']);
    expect(program.tracks.map((t) => t.channel)).toEqual(['hoist', 'trolley', 'slew', 'hoist', 'x']);
    expect(program.couplings.map((c) => c.parent)).toEqual(['crane', 'truck']);
    expect(plan.scenes.map((s) => s.text).join(' ')).toBe(craneScript);
    expect(plan.scenes.every((s) => s.productionBeat)).toBe(true);
  });
  it('keeps exact physical contact and orientation throughout lifting, turning and transfer', () => {
    const { program, sources } = specimen(), score = compileProduction(program, sources);
    const cargo = program.assets.find((a) => a.id === 'cargo')!, crane = program.assets.find((a) => a.id === 'crane')!, truck = program.assets.find((a) => a.id === 'truck')!;
    const transfer = score.bindings[1].time;
    for (let i = 0; i <= 300; i++) {
      const at = score.duration * i / 300, states = score.sample(at), held = at < transfer;
      const parent = held ? crane : truck;
      expect(distance(socketWorld(cargo, states.get('cargo')!, held ? 'grip' : 'base').position, socketWorld(parent, states.get(parent.id)!, held ? 'hook' : 'bed').position)).toBeLessThan(1e-9);
    }
    const before = score.sample(transfer - .000001).get('cargo')!, after = score.sample(transfer + .000001).get('cargo')!;
    expect(distance(before.position, after.position)).toBeLessThan(.0001); expect(Math.abs(before.yaw - after.yaw)).toBeLessThan(.0001);
    expect(score.sample(score.duration).get('cargo')!.position[0]).toBeCloseTo(13);
  });
  it('replays identically after reverse/random seeking and retiming', () => {
    const { plan, program, sources } = specimen(), score = compileProduction(program, sources);
    const expected = [...score.sample(19.271)]; score.sample(40); score.sample(.02); score.sample(28);
    expect([...score.sample(19.271)]).toEqual(expected);
    for (const seconds of [30, 60, 90]) {
      const retimed = withTargetDuration(plan, seconds), other = compileProduction(program, productionSources(retimed.scenes));
      expect(other.duration).toBeCloseTo(seconds); expect(other.sample(seconds).get('cargo')!.position[0]).toBeCloseTo(13);
      expect(other.bindings.every((b) => b.contactError < 1e-9)).toBe(true);
    }
  });
  it('uses the same timeline and attachment system for an elevator and cargo', () => {
    const plan = withTargetDuration(buildFallbackPlan('O elevador sobe com uma caixa até 6 metros. As portas se abrem no andar de cima. As portas se fecham. O elevador desce.'), 30);
    expect(plan.production?.assets.map((a) => a.kind)).toEqual(['lift', 'cargo']);
    const score = compileProduction(plan.production!, productionSources(plan.scenes));
    for (const at of [0, 5, 12, 18, 25, 30]) {
      const states = score.sample(at), parent = plan.production!.assets[0], child = plan.production!.assets[1];
      expect(distance(socketWorld(parent, states.get(parent.id)!, 'platform').position, socketWorld(child, states.get(child.id)!, 'base').position)).toBeLessThan(1e-9);
    }
    expect(score.sample(30).get('lift')!.joints.lift).toBe(0);
  });
  it('acts pride followed by laughter without inventing a sport, victory or construction site', () => {
    const text = 'Eu sou o maior jogador do mundo hahahaha', plan = buildFallbackPlan(text);
    expect(plan.production?.world).toBe('studio');
    expect(plan.production?.assets.map((a) => a.kind)).toEqual(['person']);
    expect(plan.production?.tracks.map((t) => t.channel)).toEqual(['pride', 'laugh']);
    expect(plan.scenes[0].text).toBe(text);
    expect(buildFallbackPlan('Esse foi o maior esquema de corrupção.').production).toBeUndefined();
  });
  it('preserves grounded handoff performance when its source also mentions a smile', () => {
    const plan = buildFallbackPlan('Lia entra, caminha, agacha-se, pega a lanterna e entrega para Caio, que segura o objeto e sorri.');
    expect(plan.production).toBeUndefined();
    expect(plan.scenes.some((s) => s.story?.performance === 'grounded-v1')).toBe(true);
  });
  it('binds motor rotation to hoisting rather than mistakenly rotating the whole crane', () => {
    const plan = buildFallbackPlan('No guindaste, o motor gira para erguer a carga.');
    expect(plan.production?.tracks.map((t) => t.channel)).toEqual(['hoist']);
    expect(plan.production?.shots[0].socket).toBe('winch');
    expect(buildFallbackPlan('No guindaste, o motor gira sem elevar a carga.').production).toBeUndefined();
  });
  it('lets validated model direction combine controls in an order not present in the offline compiler', () => {
    const { program, sources } = specimen(), raw = clone(program);
    raw.tracks = raw.tracks.filter((t) => t.channel !== 'trolley');
    raw.tracks.push({ asset: 'crane', channel: 'trolley', sourceId: 's1', begin: .12, end: .75, to: 5, evidence: sources[0].text });
    raw.couplings = raw.couplings.slice(0, 1); raw.tracks = raw.tracks.filter((t) => t.asset !== 'truck');
    const parsed = normalizeProduction(raw, sources)!;
    expect(parsed.tracks.find((t) => t.channel === 'trolley')?.sourceId).toBe('s1');
    expect(compileProduction(parsed, sources).sample(6).get('crane')!.joints.trolley).toBeGreaterThan(4.1);
  });
  it.each(['unknown-model', 'unknown-joint', 'out-of-range', 'missing-source', 'remote-asset', 'overlap', 'gap-at-transfer', 'missing-camera'])('rejects invalid or physically impossible model output before applying it: %s', (scenario) => {
    const { program, sources } = specimen(), raw = clone(program) as any;
    if (scenario === 'unknown-model') raw.assets[0].kind = 'dragon';
    if (scenario === 'unknown-joint') raw.tracks[0].channel = 'fly';
    if (scenario === 'out-of-range') raw.tracks[0].to = 1e9;
    if (scenario === 'missing-source') raw.tracks[0].sourceId = 's999';
    if (scenario === 'remote-asset') { raw.assets[0].kind = 'https://example.com/asset.glb'; }
    if (scenario === 'overlap') raw.tracks.push(clone(raw.tracks[0]));
    if (scenario === 'gap-at-transfer') raw.assets.find((a: any) => a.id === 'truck').position[0] += 2;
    if (scenario === 'missing-camera') raw.shots.pop();
    expect(() => normalizeProduction(raw, sources)).toThrow();
  });
  it('rejects a model invented without a matching entity in its evidence', () => {
    const { program, sources } = specimen(), raw = clone(program);
    raw.assets[0].evidence = 'O caminhão';
    expect(() => normalizeProduction(raw, sources)).toThrow(/mencionado/);
  });
  it('rejects actions that contradict explicit negation and invalidates acting after a source edit', () => {
    const { program, sources, plan } = specimen();
    const next = clone(sources); next[0].text = 'O guindaste não ergue a carga.';
    const raw = clone(program); raw.tracks[0].evidence = next[0].text;
    expect(() => normalizeProduction(raw, next)).toThrow(/negada/);
    const edited = refreshProduction({ ...plan, scenes: plan.scenes.map((s, i) => i ? s : { ...s, text: 'O guindaste não ergue a carga.' }) });
    expect(edited.production).toBeUndefined();
  });
  it('preserves a saved production and refuses inconsistent identities from director chunks', () => {
    const { plan, program, sources } = specimen();
    expect(normalizePlan(plan, craneScript, '9:16').production).toEqual(program);
    const left: ProductionProgram = clone(program), right: ProductionProgram = clone(program);
    left.tracks = left.tracks.filter((t) => ['s1', 's2'].includes(t.sourceId)); left.shots = left.shots.slice(0, 2); left.couplings = left.couplings.slice(0, 1);
    right.tracks = right.tracks.filter((t) => !['s1', 's2'].includes(t.sourceId)); right.shots = right.shots.slice(2); right.couplings = right.couplings.slice(1);
    expect(normalizeProduction(mergeProduction([left, right]), sources)).toEqual(program);
    right.assets[0].position[0] += 1;
    expect(() => mergeProduction([left, right])).toThrow(/identidade/);
  });
});
