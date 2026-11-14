import * as THREE from 'three';
import { updateCharacterRig, type ToonCharacterRig } from './toon/characterRig';

export const PERFORMANCE_DURATION = 18;
export const CONTACT_TIME = 5.65;
export const TRANSFER_TIME = 13.65;
const UP = new THREE.Vector3(0, 1, 0);
const unitScale = new THREE.Vector3(1, 1, 1);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (x: number) => { const p = clamp(x); return p * p * (3 - 2 * p); };
const beat = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const mix = THREE.MathUtils.lerp;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

type Limb = ToonCharacterRig['leftArm'];
export interface PerformanceActor { rig: ToonCharacterRig; holder: THREE.Group }
export interface FootTarget { position: THREE.Vector3; planted: boolean }

/** Full 3D analytic IK: fixed bone lengths, explicit pole and parent-space rotations.
 * End offsets need not point down (the shoe has a forward offset in this rig).
 */
export function solveLimb(limb: Limb, target: THREE.Vector3, pole: THREE.Vector3) {
  const { root, elbow, hand } = limb;
  if (!elbow || !hand || !root.parent) throw new Error('A complete two-bone limb is required.');
  root.updateWorldMatrix(true, true);
  const start = root.getWorldPosition(new THREE.Vector3());
  const a = elbow.position.length(), b = hand.position.length();
  const delta = target.clone().sub(start), rawDistance = delta.length();
  const distance = clamp(rawDistance, Math.abs(a - b) + .00001, a + b - .00001);
  const axis = delta.normalize();
  if (rawDistance < .00001) axis.set(0, -1, 0);
  const bend = pole.clone().sub(start).addScaledVector(axis, -pole.clone().sub(start).dot(axis));
  if (bend.lengthSq() < .00001) bend.copy(UP).addScaledVector(axis, -axis.y);
  if (bend.lengthSq() < .00001) bend.set(1, 0, 0);
  bend.normalize();
  const along = (a * a + distance * distance - b * b) / (2 * distance);
  const height = Math.sqrt(Math.max(0, a * a - along * along));
  const joint = start.clone().addScaledVector(axis, along).addScaledVector(bend, height);
  const end = start.clone().addScaledVector(axis, distance);
  const parentRotation = root.parent.getWorldQuaternion(new THREE.Quaternion());
  const first = new THREE.Quaternion().setFromUnitVectors(elbow.position.clone().normalize(), joint.clone().sub(start).normalize());
  root.quaternion.copy(parentRotation.clone().invert().multiply(first));
  root.updateWorldMatrix(false, true);
  const second = new THREE.Quaternion().setFromUnitVectors(hand.position.clone().normalize(), end.sub(joint).normalize());
  elbow.quaternion.copy(first.clone().invert().multiply(second));
  elbow.updateWorldMatrix(false, true);
  return { reachable: Math.abs(rawDistance - distance) < .0001, error: hand.getWorldPosition(new THREE.Vector3()).distanceTo(target) };
}

/** Distance drives the gait, so pausing/root easing never makes a planted foot slide. */
export function footTarget(distance: number, side: -1 | 1, startX = -4.05): FootTarget {
  const stride = .8, phase = side === -1 ? 0 : .5;
  const q = Math.max(0, distance) / stride + phase, cycle = Math.floor(q), u = q - cycle;
  const stance = .60;
  const swing = u < stance ? 0 : (u - stance) / (1 - stance);
  return {
    position: V(startX + (cycle - phase) * stride + .22 + stride * smooth(swing), .064 + .11 * Math.sin(Math.PI * swing), .65 - side * .19),
    planted: u < stance || swing === 1,
  };
}

export function performanceFrame(time: number) {
  const t = clamp(Number.isFinite(time) ? time : 0, 0, PERFORMANCE_DURATION);
  const enter = beat(t, .4, 3.8), carry = beat(t, 7.5, 11.2);
  const distance = 2.4 * enter + 2.4 * carry;
  const crouch = beat(t, 4.05, 5.3) * (1 - beat(t, 6.15, 7.35));
  const reach = beat(t, 4.45, CONTACT_TIME);
  const present = beat(t, 11.7, 13.0);
  const receive = beat(t, 12.25, 13.35);
  const release = beat(t, 13.95, 14.75);
  const recover = beat(t, 14.2, 15.5);
  const walking = (t > .4 && t < 3.8) || (t > 7.5 && t < 11.2);
  return {
    t, distance, crouch, reach, present, receive, release, recover, walking,
    x: -4.05 + distance,
    owner: t < CONTACT_TIME ? null : t < TRANSFER_TIME ? 0 as const : 1 as const,
    contacts: [t >= CONTACT_TIME && t <= 13.95, t >= 13.35] as const,
  };
}

/** Handle sockets are separate: palms do not occupy the same space during handoff. */
export const LANTERN_GRIPS = [V(-.105, .595, 0), V(.105, .595, 0)] as const;
export const FLOOR_LANTERN = V(-1.06, .273, 1.03);
const TRANSFER_LANTERN = V(1.32, 1.10, 1.03);
const worldPosition = (node: THREE.Object3D) => node.getWorldPosition(new THREE.Vector3());

export class GroundedPerformance {
  readonly sockets: THREE.Group[];
  readonly feet: FootTarget[][] = [];
  private readonly smiles: THREE.Mesh[];
  constructor(readonly actors: PerformanceActor[], readonly prop: THREE.Group, readonly world: THREE.Group) {
    if (actors.length !== 2) throw new Error('A handoff needs two performers.');
    this.sockets = actors.map(({ rig }, i) => {
      const socket = new THREE.Group(); socket.name = `lantern-grip-${i}`;
      rig.leftArm.hand!.add(socket);
      return socket;
    });
    this.smiles = actors.map(({ rig }) => {
      const curve = new THREE.QuadraticBezierCurve3(V(-.085, -.105, .32), V(0, -.190, .34), V(.085, -.105, .32));
      const smile = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, .012, 6, false), new THREE.MeshBasicMaterial({ color: 0x381515 }));
      rig.head.add(smile); return smile;
    });
  }

  update(time: number) {
    const f = performanceFrame(time), { t } = f;
    const speed = f.walking ? Math.sin(Math.PI * ((t < 4 ? (t - .4) / 3.4 : (t - 7.5) / 3.7))) : 0;
    for (let i = 0; i < this.actors.length; i++) {
      const { rig, holder } = this.actors[i];
      holder.position.set(i ? 1.97 : f.x, 1.36 - (i ? 0 : .40 * f.crouch), .65);
      holder.rotation.set(0, 0, 0);
      const yaw = i ? -.55 * beat(t, 10.5, 12) : Math.PI / 2 - .65 * beat(t, 11.25, 12.1);
      updateCharacterRig(rig, {
        id: String(i), pose: 'idle', expression: i && t > 14 ? 'happy' : 'neutral',
        gaze: 'lookAtCamera', prop: 'none', position: { x: 0, y: 0, z: 0 }, rotationY: yaw, scale: 1,
      }, t, { breathingAmplitude: 0 });
      // Reset every channel absolutely; arbitrary seek order must be identical.
      rig.torso.position.set(0, (i ? 0 : .012 * Math.sin(f.distance / .8 * Math.PI * 4) * speed), 0);
      rig.torso.rotation.set(i ? 0 : .32 * f.crouch + .07 * speed, 0, 0);
      rig.head.rotation.set(i ? .13 * f.recover : .32 * f.crouch - .05, i ? -.22 * beat(t, 10, 12) : -.12 * (1 - f.crouch), 0);
      this.smiles[i].visible = i ? t > 14.5 : t > 15.3;
      rig.face.mouth.visible = !this.smiles[i].visible;
      const blink = [2.9, 7.2, 12.1, 16.8].reduce((amount, at) => Math.max(amount, Math.max(0, 1 - Math.abs(t - at - i * .31) / .09)), 0);
      rig.face.leftEye.scale.y *= 1 - blink * .92; rig.face.rightEye.scale.y *= 1 - blink * .92;
      for (const limb of [rig.leftArm, rig.rightArm, rig.leftLeg, rig.rightLeg]) {
        limb.root.quaternion.identity(); limb.elbow!.quaternion.identity(); limb.hand!.quaternion.identity();
      }
      const phase = f.distance / .8 * Math.PI * 2;
      rig.leftArm.root.rotation.x = i ? -.04 : .34 * Math.sin(phase) * speed;
      rig.rightArm.root.rotation.x = i ? -.04 : -.34 * Math.sin(phase) * speed;
      rig.leftArm.root.rotation.z = .09; rig.rightArm.root.rotation.z = -.09;
      rig.leftArm.elbow!.rotation.x = rig.rightArm.elbow!.rotation.x = -.16;
      holder.updateWorldMatrix(true, true);
      const targets = i
        ? [-1, 1].map((s) => ({ position: V(1.97 + s * .18, .064, .65), planted: true }))
        : ([-1, 1] as const).map((s) => footTarget(f.distance, s));
      this.feet[i] = targets;
      const forward = V(Math.sin(yaw), 0, Math.cos(yaw));
      [rig.leftLeg, rig.rightLeg].forEach((leg, j) => {
        const pole = worldPosition(leg.root).addScaledVector(forward, 1).add(V(0, -.3, 0));
        solveLimb(leg, targets[j].position, pole);
        const parentQuat = leg.hand!.parent!.getWorldQuaternion(new THREE.Quaternion());
        // Sole remains parallel to the floor; yaw follows the travel direction.
        const shoeYaw = i ? yaw * .5 : Math.PI / 2;
        leg.hand!.quaternion.copy(parentQuat.invert().multiply(new THREE.Quaternion().setFromAxisAngle(UP, shoeYaw)));
      });
      holder.updateWorldMatrix(true, true);
    }

    const giver = this.actors[0].rig, receiver = this.actors[1].rig;
    const carryRoot = V(f.x + .59, mix(FLOOR_LANTERN.y, .73, beat(t, 5.9, 7.3)), 1.03);
    const objectPosition = t < CONTACT_TIME ? FLOOR_LANTERN.clone() : carryRoot.lerp(TRANSFER_LANTERN, f.present);
    const reactionRoot = V(1.67, 1.23, 1.05);
    if (t >= TRANSFER_TIME) objectPosition.copy(TRANSFER_LANTERN).lerp(reactionRoot, f.recover);
    // A little inertial sway rotates around the handle, never detaches from it.
    const sway = f.walking && t > 7.5 ? .065 * Math.sin(f.distance / .8 * Math.PI * 2) * speed : 0;
    const objectRotation = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), sway);
    const target = (i: number) => LANTERN_GRIPS[i].clone().applyQuaternion(objectRotation).add(objectPosition);
    const giverRest = worldPosition(giver.leftArm.hand!);
    const giverTarget = giverRest.lerp(target(0), f.reach * (1 - f.release));
    // Elbows bend below/outside the wrist instead of crossing through the torso.
    solveLimb(giver.leftArm, giverTarget, V(f.x + .32, .50 - .2 * f.crouch, 1.5));
    const receiverRest = worldPosition(receiver.leftArm.hand!);
    solveLimb(receiver.leftArm, receiverRest.lerp(target(1), f.receive), V(2.5, .85, .9));
    // Free hand acknowledges the gift. It does not touch the handle.
    if (t > 14.3) {
      const rest = worldPosition(receiver.rightArm.hand!);
      solveLimb(receiver.rightArm, rest.lerp(V(2.25, 1.60, 1.0), beat(t, 14.3, 15.6)), V(2.65, 1.05, 1.15));
    }
    this.world.updateWorldMatrix(true, true);

    const parent = f.owner === null ? this.world : this.sockets[f.owner];
    // Choose the parent from the absolute timeline, then derive the local matrix.
    // Unlike incremental attach(), seeking backward cannot retain the wrong owner.
    if (this.prop.parent !== parent) parent.add(this.prop);
    const desired = new THREE.Matrix4().compose(objectPosition, objectRotation, unitScale);
    if (f.owner !== null) {
      const actualGrip = worldPosition(this.sockets[f.owner]);
      objectPosition.copy(actualGrip).sub(LANTERN_GRIPS[f.owner].clone().applyQuaternion(objectRotation));
      desired.compose(objectPosition, objectRotation, unitScale);
    }
    parent.updateWorldMatrix(true, false);
    new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(desired).decompose(this.prop.position, this.prop.quaternion, this.prop.scale);
    this.prop.updateWorldMatrix(false, true);
    return f;
  }

  diagnostics() {
    const actual = this.prop.getWorldPosition(new THREE.Vector3());
    return {
      prop: actual.toArray(),
      parent: this.prop.parent?.name || 'world',
      gripErrors: this.sockets.map((s, i) => worldPosition(s).distanceTo(this.prop.localToWorld(LANTERN_GRIPS[i].clone()))),
      feet: this.actors.map(({ rig }, i) => [rig.leftLeg, rig.rightLeg].map((leg, j) => ({
        position: worldPosition(leg.hand!).toArray(), target: this.feet[i][j].position.toArray(), planted: this.feet[i][j].planted,
      }))),
    };
  }
}

/** Aspect-safe shots driven by the event, including a real tracking shot. */
export function performanceCamera(time: number, aspect: number) {
  const f = performanceFrame(time), t = f.t;
  let look: THREE.Vector3, width: number, height: number, angle: number;
  if (t < 1.6) { look = V(-1.0, 1.35, .5); width = 7.9; height = 3.8; angle = -.10; }
  else if (t < 4.0) { look = V(f.x + .30, 1.10, .75); width = 2.35; height = 3.4; angle = .12; }
  else if (t < 7.5) { look = V(-1.30, .97, .8); width = 2.15; height = mix(3.9, 3.0, f.crouch); angle = -.18; }
  else if (t < 11.3) { look = V(f.x + .32, 1.12, .75); width = 2.5; height = 3.5; angle = -.16; }
  else if (t < 14.3) { look = V(1.35, 1.20, .8); width = 2.45; height = 3.9; angle = -.10; }
  else { look = V(2.02, 1.68, .83); width = 1.52; height = 2.65; angle = -.12; }
  const distance = Math.max(width / aspect, height) / (2 * Math.tan(THREE.MathUtils.degToRad(21))) * 1.10;
  const pos = look.clone().add(V(Math.sin(angle) * distance, distance * .12, Math.cos(angle) * distance));
  return { pos, look };
}
