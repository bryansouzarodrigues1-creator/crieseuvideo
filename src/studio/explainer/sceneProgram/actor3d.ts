import * as THREE from 'three';
import { toonMaterial } from './look';
import type { Effector, ProgramChannel, Vec3 } from './score';
import type { Life } from './life';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const ACTOR_LOOKS = [{ hair: 0x243549, skin: 0xe5ad83 }, { hair: 0x4b2e1e, skin: 0xc68642 }, { hair: 0x16161a, skin: 0x8d5524 }, { hair: 0xc9a24d, skin: 0xf1c27d }, { hair: 0x7a3b1d, skin: 0xffdbac }];
type Limb = { root: THREE.Group; elbow: THREE.Group; hand: THREE.Group };
function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: Vec3 = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material); m.position.set(...position); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

/** A neutral jacket rig, without the old presenter costume or scripted actions.
 * Scene curves author its body; effectors are solved in parent space so scale,
 * hierarchy and arbitrary timeline seeks do not change bone lengths. */
export class ProgramActor3D {
  readonly root = new THREE.Group();
  readonly hips = new THREE.Group();
  readonly head = new THREE.Group();
  readonly limbs: Record<Effector, Limb>;
  private eyes: THREE.Group[] = [];
  private brows: THREE.Mesh[] = [];
  private mouth: THREE.Mesh;
  /** `variant` gives each actor in a scene its own hair and skin tone (0 keeps the original look). */
  constructor(color: string, variant = 0) {
    const mat = (c: string | number) => toonMaterial({ color: c });
    const look = ACTOR_LOOKS[variant % ACTOR_LOOKS.length];
    const cloth = mat(color), dark = mat(0x243549), hairMat = mat(look.hair), skin = mat(look.skin), glove = mat(0x334253), white = mat(0xfaf8ed), black = mat(0x172530);
    this.root.add(this.hips); this.hips.position.y = 1.02;
    const chest = mesh(this.hips, new THREE.CapsuleGeometry(.28, .26, 4, 10), cloth, [0, .25, 0]); chest.scale.set(1.15, 1, .73);
    mesh(this.hips, new THREE.BoxGeometry(.035, .48, .025), dark, [0, .26, .216]);
    mesh(this.hips, new THREE.CylinderGeometry(.11, .12, .16, 10), skin, [0, .59, 0]);
    this.hips.add(this.head); this.head.position.y = .88;
    const skull = mesh(this.head, new THREE.SphereGeometry(.33, 18, 12), skin); skull.scale.set(.95, 1, .9);
    const hair = mesh(this.head, new THREE.SphereGeometry(.334, 16, 10, 0, Math.PI * 2, 0, 1.22), hairMat, [0, .04, -.015]); hair.scale.set(.98, 1, .92);
    for (const side of [-1, 1]) {
      const eye = new THREE.Group(); eye.position.set(side * .115, .035, .272); this.head.add(eye);
      mesh(eye, new THREE.SphereGeometry(.078, 12, 8), white).scale.set(1, 1.15, .48);
      mesh(eye, new THREE.SphereGeometry(.041, 10, 8), black, [0, 0, .036]);
      mesh(eye, new THREE.SphereGeometry(.012, 6, 6), white, [-.01, .012, .071]); this.eyes.push(eye);
      const brow = mesh(this.head, new THREE.CapsuleGeometry(.017, .12, 3, 6), dark, [side * .115, .15, .285]); brow.rotation.z = Math.PI / 2; this.brows.push(brow);
      mesh(this.head, new THREE.SphereGeometry(.055, 10, 8), skin, [side * .31, -.01, 0]);
    }
    mesh(this.head, new THREE.SphereGeometry(.047, 10, 8), skin, [0, -.04, .3]);
    this.mouth = mesh(this.head, new THREE.SphereGeometry(.065, 12, 8), dark, [0, -.16, .274]); this.mouth.scale.set(1.1, .17, .3);
    const limb = (side: number, leg: boolean): Limb => {
      const root = new THREE.Group(), elbow = new THREE.Group(), hand = new THREE.Group();
      root.position.set(side * (leg ? .17 : .385), leg ? 0 : .47, 0); this.hips.add(root);
      const a = leg ? .50 : .42, b = leg ? .48 : .38;
      const material = leg ? dark : cloth;
      mesh(root, new THREE.CapsuleGeometry(leg ? .115 : .10, a - .17, 4, 8), material, [0, -a / 2, 0]);
      elbow.position.y = -a; root.add(elbow);
      mesh(elbow, new THREE.CapsuleGeometry(leg ? .09 : .08, b - .14, 4, 8), material, [0, -b / 2, 0]);
      hand.position.y = -b; elbow.add(hand);
      if (leg) mesh(hand, new THREE.BoxGeometry(.23, .14, .35), glove, [0, .01, .085]);
      else mesh(hand, new THREE.SphereGeometry(.105, 10, 8), glove).scale.set(.8, 1.05, .72);
      return { root, elbow, hand };
    };
    this.limbs = { leftHand: limb(-1, false), rightHand: limb(1, false), leftFoot: limb(-1, true), rightFoot: limb(1, true) };
  }
  socket(name: string) { return name === 'root' ? this.root : name === 'head' ? this.head : this.limbs[name as Effector]?.hand ?? this.root; }
  reset(pose: Partial<Record<ProgramChannel, Vec3>>, time: number) {
    this.hips.position.set(0, 1.02, 0); this.hips.rotation.set(...(pose.bodyRotation ?? [0, 0, 0]));
    this.head.rotation.set(...(pose.headRotation ?? [0, 0, 0]));
    for (const limb of Object.values(this.limbs)) { limb.root.quaternion.identity(); limb.elbow.quaternion.identity(); limb.hand.quaternion.identity(); }
    const face = pose.face ?? [0, 0, 0];
    const cycle = ((time + .4) % 3.7), blink = Math.max(face[1], cycle < .13 ? Math.sin(Math.PI * cycle / .13) : 0);
    this.eyes.forEach((eye) => eye.scale.y = Math.max(.05, 1 - blink * .95));
    this.brows.forEach((brow, i) => brow.rotation.z = Math.PI / 2 + (i ? 1 : -1) * face[0] * .13);
    this.mouth.scale.set(1.1 + Math.max(0, face[0]) * .4, .17 + Math.max(0, face[2]) * .8, .3);
    this.root.updateWorldMatrix(true, true);
  }
  /** Breathing, weight shift and gait sway on top of the authored pose (call right after `reset`). */
  live(l: Life) {
    this.hips.position.y += l.hipsY; this.hips.rotation.x += l.hipsPitch; this.hips.rotation.z += l.hipsRoll;
    this.head.rotation.x += l.headPitch; this.head.rotation.y += l.headYaw; this.head.rotation.z += l.headRoll;
  }
  solve(effector: Effector, target: THREE.Vector3, pole?: THREE.Vector3) {
    const limb = this.limbs[effector], parent = limb.root.parent!;
    parent.updateWorldMatrix(true, true);
    const start = limb.root.position.clone(), end = parent.worldToLocal(target.clone());
    const defaultPole = V(effector.endsWith('Foot') ? 0 : effector.startsWith('left') ? -.8 : .8, -.1, 1.4);
    const poleLocal = pole ? parent.worldToLocal(pole.clone()) : defaultPole;
    const delta = end.clone().sub(start), raw = delta.length(), a = limb.elbow.position.length(), b = limb.hand.position.length();
    const d = THREE.MathUtils.clamp(raw, Math.abs(a - b) + .00001, a + b - .00001), axis = raw > .000001 ? delta.normalize() : V(0, -1, 0);
    const bend = poleLocal.sub(start); bend.addScaledVector(axis, -bend.dot(axis));
    if (bend.lengthSq() < .000001) bend.copy(V(0, 0, 1)).addScaledVector(axis, -axis.z);
    if (bend.lengthSq() < .000001) bend.set(1, 0, 0); bend.normalize();
    const along = (a * a + d * d - b * b) / (2 * d), h = Math.sqrt(Math.max(0, a * a - along * along));
    const joint = start.clone().addScaledVector(axis, along).addScaledVector(bend, h);
    const first = new THREE.Quaternion().setFromUnitVectors(limb.elbow.position.clone().normalize(), joint.clone().sub(start).normalize());
    const second = new THREE.Quaternion().setFromUnitVectors(limb.hand.position.clone().normalize(), start.clone().addScaledVector(axis, d).sub(joint).normalize());
    limb.root.quaternion.copy(first); limb.elbow.quaternion.copy(first.clone().invert().multiply(second));
    limb.hand.updateWorldMatrix(true, false);
    return limb.hand.getWorldPosition(V()).distanceTo(target);
  }
}
