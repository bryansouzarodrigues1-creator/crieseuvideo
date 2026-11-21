/** Procedural "life" for actors: breathing, weight shift, head drift and a walk cycle driven by the distance
 * the actor really travelled. Pure maths (no THREE) so it is deterministic by time and unit-testable.
 * Authored curves always win: the stage only uses this for limbs that have no pose and no contact. */

const TAU = Math.PI * 2;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Metres of ground covered by one full gait cycle (left + right step). */
export const STRIDE = 1.25;
/** Below this speed (m/s) an actor is standing; above `WALK_FULL` the gait is complete. */
export const WALK_START = 0.12, WALK_FULL = 0.5;

/** Stable 0..2π phase from an id, so two actors never breathe in unison. */
export function seedOf(id: string) {
  let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 6283) / 1000;
}

export interface Life {
  /** 0 standing .. 1 full walk */ walk: number;
  hipsY: number; hipsRoll: number; hipsPitch: number;
  headYaw: number; headPitch: number; headRoll: number;
  /** foot offsets in the actor's own frame: [x, lift, z] */
  leftFoot: [number, number, number]; rightFoot: [number, number, number];
  /** hand offsets in the hips frame: [x, y, z] relative to the hanging rest pose */
  leftHand: [number, number, number]; rightHand: [number, number, number];
}

/** `distance` = metres walked so far (monotonic), `speed` = current ground speed in m/s. */
export function lifeAt(seed: number, time: number, distance: number, speed: number): Life {
  const walk = smooth(WALK_START, WALK_FULL, speed);
  const phase = TAU * distance / STRIDE;
  const s = Math.sin(phase), c = Math.cos(phase);
  const breath = Math.sin(time * 1.9 + seed), shift = Math.sin(time * 0.85 + seed * 1.7), drift = Math.sin(time * 0.55 + seed * 2.3);
  const amp = Math.min(.15, .09 + speed * .06);
  const swing = walk * amp, lift = walk * .15;
  const idleArm = (1 - walk) * .025 * Math.sin(time * 1.3 + seed);
  return {
    walk,
    // highest when the legs pass each other, back to rest when they are spread (so a planted foot never overstretches the leg)
    hipsY: breath * .007 * (1 - walk) + (1 - Math.abs(s)) * .02 * walk,
    hipsRoll: shift * .02 * (1 - walk) + s * .035 * walk,
    hipsPitch: -.05 * walk + breath * .006 * (1 - walk),
    headYaw: drift * .12 * (1 - walk) - s * .03 * walk,
    headPitch: Math.sin(time * 0.8 + seed * 2) * .035 * (1 - walk) + .03 * walk,
    headRoll: -shift * .025 * (1 - walk),
    leftFoot: [0, Math.max(0, c) * lift, s * swing],
    rightFoot: [0, Math.max(0, -c) * lift, -s * swing],
    leftHand: [0, 0, -s * swing * .9 + idleArm],
    rightHand: [0, 0, s * swing * .9 - idleArm],
  };
}

/** Cumulative horizontal distance sampled on a fixed step, so the gait phase can be read at any time (seek-safe). */
export class Odometer {
  private readonly total: Float64Array;
  constructor(readonly step: number, positions: ReadonlyArray<readonly [number, number]>) {
    this.total = new Float64Array(positions.length);
    for (let i = 1; i < positions.length; i++) this.total[i] = this.total[i - 1]! + Math.hypot(positions[i]![0] - positions[i - 1]![0], positions[i]![1] - positions[i - 1]![1]);
  }
  distance(time: number) {
    const f = Math.max(0, time) / this.step, i = Math.min(this.total.length - 1, Math.floor(f)), j = Math.min(this.total.length - 1, i + 1);
    return this.total[i]! + (this.total[j]! - this.total[i]!) * (f - i);
  }
  /** m/s, averaged over ±`window` seconds so one noisy key never makes an actor jitter. */
  speed(time: number, window = .12) { return Math.max(0, (this.distance(time + window) - this.distance(time - window)) / (2 * window)); }
}
