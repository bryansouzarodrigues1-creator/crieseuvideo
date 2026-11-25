import type { Vec3 } from '../score';

/** Hand targets are given in the ACTOR's local frame (x right, y up, z forward) and turned into world space. */
export const POSE_NAMES = ['rest', 'surprised', 'head', 'shrug'] as const;
export type PoseName = (typeof POSE_NAMES)[number];
const LOCAL: Record<PoseName, { l: Vec3; r: Vec3 }> = {
  rest: { l: [-.4, .74, .05], r: [.4, .74, .05] },
  surprised: { l: [-.62, 1.85, .2], r: [.62, 1.85, .2] },
  head: { l: [-.2, 2.0, .06], r: [.2, 2.0, .06] },
  shrug: { l: [-.7, 1.35, .38], r: [.7, 1.35, .38] },
};

/** Face channel = [brow (-1 sad … +1 raised), blink, mouth open]. */
export const EMOTIONS = ['neutral', 'calm', 'surprised', 'worried', 'puzzled', 'sad', 'crushed'] as const;
export type Emotion = (typeof EMOTIONS)[number];
const FACE: Record<Emotion, Vec3> = {
  neutral: [0, 0, 0], calm: [0, 0, .1], surprised: [.9, 0, .9], worried: [-.6, 0, .25],
  puzzled: [.45, 0, .6], sad: [-.8, 0, .1], crushed: [-.9, 0, 0],
};
export const faceFor = (emotion: Emotion): Vec3 => [...FACE[emotion]];

export function handTargets(pose: PoseName, position: Vec3, yaw: number): { left: Vec3; right: Vec3 } {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const world = ([x, y, z]: Vec3): Vec3 => [position[0] + x * c + z * s, position[1] + y, position[2] - x * s + z * c];
  return { left: world(LOCAL[pose].l), right: world(LOCAL[pose].r) };
}
