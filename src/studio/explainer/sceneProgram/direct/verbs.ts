/**
 * Verbs: deterministic motion generators. Each one turns "the hero climbs" into the exact curves and contacts the
 * engine needs, using the engine's own body measurements (see ACTOR below, taken from actor3d.ts / stage3d.ts).
 * All four limbs are authored for the WHOLE timeline (the engine holds a pose channel after its last key), so a verb
 * always starts from the pose the previous verb left behind: the continuity the raw-number prompt never achieved.
 */
import type { ProgramContact, ProgramKey, ProgramTrack, Vec3 } from '../score';

export const ACTOR = { hips: 1.02, shoulder: 1.49, handRest: .80, handSide: .43, footSide: .17, footForward: .07, footRest: .06, stride: .56, legReach: .98 };
export type Limb = 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot';
export interface Pose { pos: Vec3; yaw: number; feet: { left: Vec3; right: Vec3 }; hands: { left: Vec3; right: Vec3 } }
export interface World { height: number; faceZ: number; wallCenter: Vec3; summit: Vec3 }
export class DirectionError extends Error { readonly code = 'invalid_semantic_plan'; constructor(message: string) { super(message); } }

const TAU = Math.PI;
export const rot = (yaw: number, x: number, z: number): [number, number] => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
export const restHand = (pos: Vec3, yaw: number, side: -1 | 1, forward = 0): Vec3 => { const [x, z] = rot(yaw, side * ACTOR.handSide, forward); return [pos[0] + x, pos[1] + ACTOR.handRest, pos[2] + z]; };
export const restFoot = (pos: Vec3, yaw: number, side: -1 | 1, forward = ACTOR.footForward): Vec3 => { const [x, z] = rot(yaw, side * ACTOR.footSide, forward); return [pos[0] + x, pos[1] + ACTOR.footRest, pos[2] + z]; };
export const restPose = (pos: Vec3, yaw: number): Pose => ({ pos: [...pos], yaw, feet: { left: restFoot(pos, yaw, -1), right: restFoot(pos, yaw, 1) }, hands: { left: restHand(pos, yaw, -1), right: restHand(pos, yaw, 1) } });
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };

export class Emitter {
  readonly tracks = new Map<string, ProgramTrack>();
  readonly contacts: ProgramContact[] = [];
  private last = new Map<string, [string, number]>();
  private span: { id: string; from: number; to: number }[] = [];
  /** A verb may cover several consecutive sentences (long sentences are split by the engine): one continuous 0..1 action is mapped onto them by duration. */
  useSpan(ids: string[], seconds: number[]) {
    const total = seconds.reduce((a, b) => a + b, 0); let at = 0;
    this.span = ids.map((id, i) => { const from = at / total; at += seconds[i]; return { id, from, to: at / total }; });
  }
  private at(u: number): [string, number] {
    const p = Math.max(0, Math.min(1, +u.toFixed(4)));
    let i = this.span.findIndex((e) => p < e.to - 1e-9); if (i < 0) i = this.span.length - 1;
    const e = this.span[i]; return [e.id, Math.max(0, Math.min(1, (p - e.from) / (e.to - e.from)))];
  }
  key(node: string, channel: ProgramTrack['channel'], _sourceId: string, u: number, value: Vec3, interpolation: ProgramTrack['interpolation'] = 'linear') {
    const [sourceId, phase] = this.at(u), p = +phase.toFixed(5), id = `${node}/${channel}`;
    let track = this.tracks.get(id); if (!track) this.tracks.set(id, track = { node, channel, interpolation, keys: [] });
    const prev = this.last.get(id), keys = track.keys;
    if (prev && prev[0] === sourceId && p <= prev[1] + 1e-5) { if (Math.abs(p - prev[1]) < 1e-5) keys[keys.length - 1] = { sourceId, phase: p, value }; else throw new DirectionError(`Chaves fora de ordem em ${id}: ${p} depois de ${prev[1]} (${sourceId}).`); }
    else keys.push({ sourceId, phase: p, value } as ProgramKey);
    this.last.set(id, [sourceId, p]);
  }
  contact(c: ProgramContact) {
    if (c.end - c.begin <= 1e-4) return;
    const [s0, p0] = this.at(c.begin), [s1, p1] = this.at(c.end - 1e-6), i0 = this.span.findIndex((e) => e.id === s0), i1 = this.span.findIndex((e) => e.id === s1);
    for (let i = i0; i <= i1; i++) {
      const begin = i === i0 ? p0 : 0, end = i === i1 ? (this.at(c.end)[0] === s1 ? this.at(c.end)[1] : 1) : 1;
      if (end - begin > 1e-4) this.contacts.push({ ...c, sourceId: this.span[i].id, begin: +begin.toFixed(5), end: +end.toFixed(5) });
    }
  }
}

export interface Ctx { out: Emitter; world: World; hero: string; sourceId: string; seconds: number; first: boolean; pose: Pose }
const body = (c: Ctx, phase: number, pose: Pose, yaw = pose.yaw) => { c.out.key(c.hero, 'position', c.sourceId, phase, [...pose.pos]); c.out.key(c.hero, 'rotation', c.sourceId, phase, [0, yaw, 0]); };
const limbs = (c: Ctx, phase: number, p: Pick<Pose, 'feet' | 'hands'>) => {
  c.out.key(c.hero, 'leftFoot', c.sourceId, phase, p.feet.left); c.out.key(c.hero, 'rightFoot', c.sourceId, phase, p.feet.right);
  c.out.key(c.hero, 'leftHand', c.sourceId, phase, p.hands.left); c.out.key(c.hero, 'rightHand', c.sourceId, phase, p.hands.right);
};
const clone = (p: Pose): Pose => ({ pos: [...p.pos], yaw: p.yaw, feet: { left: [...p.feet.left], right: [...p.feet.right] }, hands: { left: [...p.hands.left], right: [...p.hands.right] } });

/** Straight walk with a real alternating gait (foot swings, planted feet, arm counter-swing). Stride limited by leg reach. */
export function walkLeg(c: Ctx, to: Vec3, p0: number, p1: number, turnTo?: number) {
  const from = c.pose.pos, dx = to[0] - from[0], dz = to[2] - from[2], L = Math.hypot(dx, dz);
  const yaw0 = L > .05 ? Math.atan2(dx, dz) : c.pose.yaw, yaw1 = turnTo ?? yaw0;
  if (c.first && p0 === 0) { body(c, 0, { ...c.pose, yaw: yaw0 }); limbs(c, 0, c.pose); }
  if (L < .05) { body(c, p1, { ...c.pose, pos: [...to] }, yaw1); c.pose = { ...restPose(to, yaw1), feet: c.pose.feet, hands: c.pose.hands }; return; }
  const dur = (p1 - p0) * c.seconds, speed = L / dur;
  if (speed > 2.6) throw new DirectionError(`O personagem teria de andar a ${speed.toFixed(1)} m/s (${L.toFixed(1)} m em ${dur.toFixed(1)} s). Use uma frase mais longa para a caminhada ou um 'stand'.`);
  const phaseAt = (s: number) => p0 + (p1 - p0) * (s / L), turnStart = p0 + (p1 - p0) * .62;
  const yawAt = (ph: number) => yaw0 + (yaw1 - yaw0) * smooth((ph - turnStart) / (p1 - turnStart));
  const at = (s: number): Vec3 => [from[0] + dx * s / L, from[1], from[2] + dz * s / L];
  // body
  body(c, p0, { ...c.pose, yaw: yaw0 }, yaw0);
  c.out.key(c.hero, 'position', c.sourceId, p1, [...to]);
  for (const f of [.62, .7, .78, .86, 1]) c.out.key(c.hero, 'rotation', c.sourceId, p0 + (p1 - p0) * f, [0, yawAt(p0 + (p1 - p0) * f), 0]);
  // feet: windows in path distance s. R starts mid-swing; L is half a cycle later. Landing is .28 ahead of the body (hip reach limit).
  // Hip reach keeps a planted foot within ±.19 m of the body (breathing lifts the hips a little): a foot leaves when .19 behind, lands .19 ahead after a .28 m swing.
  const REL = .19, SW = .28, CYC = 2 * REL + SW, half = CYC / 2;
  const windows = (foot: 'left' | 'right') => { const w: [number, number][] = []; if (foot === 'right') w.push([0, Math.min(L, SW)]); for (let m = 0; ; m++) { const s0 = foot === 'right' ? CYC * (m + 1) : ACTOR.footForward + REL + CYC * m; if (s0 > L - .03) break; w.push([s0, Math.min(L, s0 + SW)]); } return w; };
  const side = (foot: 'left' | 'right'): -1 | 1 => foot === 'left' ? -1 : 1;
  const planted = (foot: 'left' | 'right', q: number, ph: number): Vec3 => { const b = at(Math.min(L + .3, q)), [x, z] = rot(yawAt(ph), side(foot) * ACTOR.footSide, 0); return [b[0] + x, ACTOR.footRest + from[1], b[2] + z]; };
    for (const foot of ['left', 'right'] as const) {
    let q = ACTOR.footForward;
    for (const [s0, s1] of windows(foot)) {
      const land = s1 + REL;
      c.out.key(c.hero, `${foot}Foot`, c.sourceId, phaseAt(s0), planted(foot, q, phaseAt(s0)));
      const mid = planted(foot, (q + land) / 2, phaseAt((s0 + s1) / 2)); mid[1] += .14; c.out.key(c.hero, `${foot}Foot`, c.sourceId, phaseAt((s0 + s1) / 2), mid);
      c.out.key(c.hero, `${foot}Foot`, c.sourceId, phaseAt(s1), planted(foot, land, phaseAt(s1))); q = land;
    }
    const lastPhase = Math.max(0, ...c.out.tracks.get(`${c.hero}/${foot}Foot`)!.keys.filter((k) => k.sourceId === c.sourceId).map((k) => k.phase));
    const hold = planted(foot, q, p1), rest = restFoot(to, yawAt(p1), side(foot)), liftOff = Math.max(p1 + .005, lastPhase + .001), finish = liftOff + .06;
    c.out.key(c.hero, `${foot}Foot`, c.sourceId, liftOff, hold); const mid = lerp3(hold, rest, .5); mid[1] += .1;
    c.out.key(c.hero, `${foot}Foot`, c.sourceId, (liftOff + finish) / 2, mid); c.out.key(c.hero, `${foot}Foot`, c.sourceId, finish, rest);
  }
  // hands counter-swing every half stride
  for (const hand of ['left', 'right'] as const) {
    c.out.key(c.hero, `${hand}Hand`, c.sourceId, p0, c.pose.hands[hand]);
    const n = Math.floor((L - .3) / half);
    for (let k = 1; k <= n; k++) { const s = k * half, ph = phaseAt(s); if (ph > p1 - .01) break; const sign = (k % 2 ? 1 : -1) * (hand === 'left' ? 1 : -1); c.out.key(c.hero, `${hand}Hand`, c.sourceId, ph, restHand(at(s), yawAt(ph), side(hand), .15 * sign)); }
    c.out.key(c.hero, `${hand}Hand`, c.sourceId, p1 + .065, restHand(to, yawAt(p1), side(hand)));
  }
  c.pose = restPose(to, yaw1);
  void turnStart;
}

export function stand(c: Ctx, p0 = 0, p1 = 1) { body(c, p0, c.pose); limbs(c, p0, c.pose); body(c, p1, c.pose); limbs(c, p1, c.pose); }

export interface Ladder { first: Vec3; count: number; step: number }
export interface ClimbStats { cycles: number; rise: number; cycleSeconds: number; holds: number; ladders: Record<Limb, Ladder> }
/** Four-limb ladder climb up the cliff face, then a mantle over the edge. Every hold is both a pose key AND a contact on the wall. */
export function climb(c: Ctx): ClimbStats {
  const { height: H, faceZ: fz, wallCenter } = c.world, start = c.pose.pos;
  if (start[1] > .01 || Math.abs(start[0]) > .01 || Math.abs(start[2]) > .6) throw new DirectionError('O personagem só pode começar a escalar encostado na base da parede (use "walk" antes de "climb").');
  const bEnd = H - .9, c0 = .07, c1 = .72, climbSeconds = (c1 - c0) * c.seconds;
  const K = Math.max(2, Math.round(climbSeconds / .95)), R = bEnd / K;
  if (R > .55) {
    const maxHeight = .9 + .55 * K;
    throw new DirectionError(`A parede de ${H.toFixed(1)} m não cabe em ${climbSeconds.toFixed(1)} s de escalada: cada passo teria ${(R * 100).toFixed(0)} cm (o limite natural é 55 cm). ${maxHeight >= 2.4 ? `Reduza world.height para no máximo ${maxHeight.toFixed(1)} m.` : 'A frase da escalada é curta demais para qualquer parede: use "stand" ou junte a escalada a uma frase mais longa.'}`);
  }
  const Tc = (c1 - c0) / K, w = .22, yaw = TAU, S = (i: number) => c0 + i * Tc;
  const spec: Record<Limb, { x: number; phi: number; rel: number }> = { rightHand: { x: -.47, phi: 0, rel: 1.66 }, leftFoot: { x: .19, phi: .25, rel: .58 }, leftHand: { x: .47, phi: .5, rel: 1.55 }, rightFoot: { x: -.19, phi: .75, rel: .58 } };
  const hold = (limb: Limb, k: number): Vec3 => {
    const { x, phi, rel } = spec[limb], y = rel + (k + phi + w / 2 - .5) * R, hand = limb.endsWith('Hand');
    if (hand && y > H - .05) return [x * .65, H, fz - .12];
    return [x, y, hand ? fz + .09 : fz + .22];
  };
  const wallLocal = (p: Vec3): Vec3 => [p[0] - wallCenter[0], p[1] - wallCenter[1], p[2] - wallCenter[2]];
  const same = (a: Vec3, b: Vec3) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-6;
  // body
  body(c, 0, c.pose, yaw); c.out.key(c.hero, 'position', c.sourceId, c0, [0, 0, 0]);
  c.out.key(c.hero, 'position', c.sourceId, c1, [0, bEnd, 0]);
  for (let j = 0; j <= K * 2; j++) c.out.key(c.hero, 'bodyRotation', c.sourceId, c0 + j * Tc / 2, [.14 + (j % 2) * .05, 0, (j % 2 ? .04 : -.04)], 'smooth');
  c.out.key(c.hero, 'headRotation', c.sourceId, 0, [-.1, 0, 0], 'smooth'); c.out.key(c.hero, 'headRotation', c.sourceId, c1, [-.3, 0, 0], 'smooth');
  // limbs
  const pre: Record<Limb, number> = { rightHand: .03, leftHand: .045, leftFoot: .055, rightFoot: .067 };
  let holds = 0;
  for (const limb of Object.keys(spec) as Limb[]) {
    const start0 = limb.endsWith('Hand') ? c.pose.hands[limb === 'leftHand' ? 'left' : 'right'] : c.pose.feet[limb === 'leftFoot' ? 'left' : 'right'];
    c.out.key(c.hero, limb, c.sourceId, 0, start0);
    const h0 = hold(limb, 0), first = pre[limb];
    const lift = lerp3(start0, h0, .5); lift[1] += .1; lift[2] += .05;
    c.out.key(c.hero, limb, c.sourceId, first / 2, lift); c.out.key(c.hero, limb, c.sourceId, first, h0);
    let cur = h0, since = first;
    for (let k = 0; k < K; k++) {
      const next = hold(limb, k + 1), leave = S(k + spec[limb].phi), arrive = leave + w * Tc;
      if (same(cur, next)) continue; // already on the edge: stays planted
      c.out.contact({ sourceId: c.sourceId, actor: c.hero, effector: limb, target: 'wall', offset: wallLocal(cur), begin: since, end: leave }); holds++;
      c.out.key(c.hero, limb, c.sourceId, leave, cur);
      const mid = lerp3(cur, next, .5); mid[2] += .14; mid[1] += .06; c.out.key(c.hero, limb, c.sourceId, (leave + arrive) / 2, mid);
      c.out.key(c.hero, limb, c.sourceId, arrive, next); cur = next; since = arrive;
    }
    // hold the final position as a contact until the mantle releases it
    const release = limb.endsWith('Hand') ? .855 : limb === 'rightFoot' ? .73 : .79;
    c.out.contact({ sourceId: c.sourceId, actor: c.hero, effector: limb, target: 'wall', offset: wallLocal(cur), begin: since, end: Math.max(since + .001, release) }); holds++;
    c.out.key(c.hero, limb, c.sourceId, Math.max(since + .001, release), cur);
  }
  // mantle: feet up onto the plateau, body leans over the edge, hands release and drop to rest
  const top = H + ACTOR.footRest, plateau = { right: [-.19, top, -.5] as Vec3, left: [.19, top, -.52] as Vec3 };
  const lastR = c.out.tracks.get(`${c.hero}/rightFoot`)!.keys.at(-1)!.value, lastL = c.out.tracks.get(`${c.hero}/leftFoot`)!.keys.at(-1)!.value;
  c.out.key(c.hero, 'rightFoot', c.sourceId, .765, lerp3(lastR, plateau.right, .5).map((v, i) => i === 1 ? v + .25 : v) as Vec3); c.out.key(c.hero, 'rightFoot', c.sourceId, .80, plateau.right);
  c.out.key(c.hero, 'leftFoot', c.sourceId, .82, lerp3(lastL, plateau.left, .5).map((v, i) => i === 1 ? v + .25 : v) as Vec3); c.out.key(c.hero, 'leftFoot', c.sourceId, .86, plateau.left);
  c.out.key(c.hero, 'position', c.sourceId, .73, [0, bEnd, 0]); c.out.key(c.hero, 'position', c.sourceId, .85, [0, bEnd, -.3]);
  c.out.key(c.hero, 'position', c.sourceId, .93, [0, H, -.3]); c.out.key(c.hero, 'position', c.sourceId, 1, [0, H, -.3]);
  const end = restPose([0, H, -.3], yaw);
  c.out.key(c.hero, 'leftHand', c.sourceId, .93, end.hands.left); c.out.key(c.hero, 'rightHand', c.sourceId, .93, end.hands.right);
  c.out.key(c.hero, 'bodyRotation', c.sourceId, .85, [.34, 0, 0], 'smooth'); c.out.key(c.hero, 'bodyRotation', c.sourceId, 1, [0, 0, 0], 'smooth');
  c.out.key(c.hero, 'rotation', c.sourceId, 1, [0, yaw, 0]);
  for (const limb of ['leftHand', 'rightHand', 'leftFoot', 'rightFoot'] as Limb[]) { const t = c.out.tracks.get(`${c.hero}/${limb}`)!; const lastKey = t.keys.at(-1)!; if (lastKey.phase < 1 || lastKey.sourceId !== c.sourceId) c.out.key(c.hero, limb, c.sourceId, 1, lastKey.value); }
  c.pose = { pos: [0, H, -.3], yaw, feet: { left: plateau.left, right: plateau.right }, hands: end.hands };
  const ladders = {} as Record<Limb, Ladder>;
  for (const limb of Object.keys(spec) as Limb[]) { let count = 0; while (count <= K && (limb.endsWith('Foot') || hold(limb, count)[1] < H - .05 && hold(limb, count)[2] > fz)) count++; ladders[limb] = { first: hold(limb, 0), count, step: R }; }
  return { cycles: K, rise: R, cycleSeconds: Tc * c.seconds, holds, ladders };
}

/** Walk a few steps across the summit, then plant the pole: hands grip it, drive it down, release; the flag unfurls. */
export function plant(c: Ctx, pole: string, flag: string) {
  const { height: H, summit } = c.world, to: Vec3 = [0, H, summit[2] + .45], yaw = c.pose.yaw;
  if (c.pose.pos[1] < H - .01) throw new DirectionError('Só dá para fincar a bandeira no topo: use "climb" antes de "plant".');
  walkLeg(c, to, 0, .3);
  const grip = (side: -1 | 1, raise: number): Vec3 => [summit[0] + side * -.13, H + 1.3 + raise, summit[2] + .02];
  const base = c.pose, key = (ph: number, raise: number, lean: number) => {
    c.out.key(c.hero, 'leftHand', c.sourceId, ph, grip(-1, raise)); c.out.key(c.hero, 'rightHand', c.sourceId, ph, grip(1, raise));
    c.out.key(c.hero, 'bodyRotation', c.sourceId, ph, [lean, 0, 0], 'smooth');
  };
  c.out.key(c.hero, 'bodyRotation', c.sourceId, .3, [0, 0, 0], 'smooth');
  c.out.key(pole, 'scale', c.sourceId, 0, [.01, .01, .01]); c.out.key(pole, 'scale', c.sourceId, .3, [.01, .01, .01]); c.out.key(pole, 'scale', c.sourceId, .32, [1, 1, 1]);
  c.out.key(pole, 'position', c.sourceId, 0, [summit[0], H + .45, summit[2]]); c.out.key(pole, 'position', c.sourceId, .42, [summit[0], H + .45, summit[2]]);
  c.out.key(pole, 'position', c.sourceId, .58, [summit[0], H, summit[2]]);
  key(.42, .45, .05); key(.58, 0, .2); c.out.key(c.hero, 'leftHand', c.sourceId, .6, grip(-1, 0)); c.out.key(c.hero, 'rightHand', c.sourceId, .6, grip(1, 0));
  c.out.key(c.hero, 'leftHand', c.sourceId, .72, base.hands.left); c.out.key(c.hero, 'rightHand', c.sourceId, .72, base.hands.right);
  c.out.key(c.hero, 'bodyRotation', c.sourceId, .72, [0, 0, 0], 'smooth');
  c.out.key(flag, 'scale', c.sourceId, 0, [.01, 1, 1]); c.out.key(flag, 'scale', c.sourceId, .6, [.01, 1, 1]); c.out.key(flag, 'scale', c.sourceId, .86, [1, 1, 1]);
  c.out.key(c.hero, 'headRotation', c.sourceId, .6, [0, 0, 0], 'smooth'); c.out.key(c.hero, 'headRotation', c.sourceId, .85, [-.3, .35, 0], 'smooth');
  for (const f of ['leftFoot', 'rightFoot', 'leftHand', 'rightHand'] as Limb[]) { const k = c.out.tracks.get(`${c.hero}/${f}`)!.keys.at(-1)!; c.out.key(c.hero, f, c.sourceId, 1, k.value); }
  c.out.key(c.hero, 'position', c.sourceId, 1, [...to]); c.out.key(c.hero, 'rotation', c.sourceId, 1, [0, yaw, 0]);
  c.out.key(c.hero, 'bodyRotation', c.sourceId, 1, [0, 0, 0], 'smooth');
  c.pose = { ...c.pose, hands: base.hands };
}

/** Arms up and two jumps; feet follow the body so the legs stay inside their real reach. */
export function celebrate(c: Ctx) {
  const p = c.pose, up = (side: -1 | 1, extra: number): Vec3 => { const [x, z] = rot(p.yaw, side * .45, 0); return [p.pos[0] + x, p.pos[1] + 2.12 + extra, p.pos[2] + z]; };
  const footAt = (foot: 'left' | 'right', lift: number): Vec3 => [p.feet[foot][0], p.feet[foot][1] + lift, p.feet[foot][2]];
  const times = [0, .14, .3, .42, .54, .66, .78, .9, 1], lifts = [0, 0, 0, .3, 0, .3, 0, 0, 0], bonus = [0, 0, 0, .1, 0, .1, 0, 0, 0];
  body(c, 0, p); limbs(c, 0, p);
  times.forEach((t, i) => {
    if (i === 0) return;
    const lift = lifts[i], pos: Vec3 = [p.pos[0], p.pos[1] + lift, p.pos[2]];
    c.out.key(c.hero, 'position', c.sourceId, t, pos); c.out.key(c.hero, 'rotation', c.sourceId, t, [0, p.yaw, 0]);
    c.out.key(c.hero, 'leftFoot', c.sourceId, t, footAt('left', lift)); c.out.key(c.hero, 'rightFoot', c.sourceId, t, footAt('right', lift));
    const armsUp = t >= .14 && t <= .9, up0 = armsUp ? 1 : 0;
    const handL = up0 ? up(-1, bonus[i] + lift) : p.hands.left, handR = up0 ? up(1, bonus[i] + lift) : p.hands.right;
    c.out.key(c.hero, 'leftHand', c.sourceId, t, t === 1 ? p.hands.left : handL); c.out.key(c.hero, 'rightHand', c.sourceId, t, t === 1 ? p.hands.right : handR);
    c.out.key(c.hero, 'face', c.sourceId, t, armsUp ? [.9, 0, .7] : [0, 0, 0], 'smooth');
    c.out.key(c.hero, 'bodyRotation', c.sourceId, t, [armsUp ? -.08 : 0, 0, lift > 0 ? .06 : 0], 'smooth');
  });
}
