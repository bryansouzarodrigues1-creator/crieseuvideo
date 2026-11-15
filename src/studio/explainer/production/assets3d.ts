import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createCharacterRig, type ToonCharacterRig } from '../toon/characterRig';
import { solveLimb } from '../grounded3d';
import { CRANE_JIB, TRUCK_BED, type ProductionAsset, type AssetState, type Vec3 } from './score';

const V = (v: Vec3) => new THREE.Vector3(...v);
const steel = 0xf2b834, ink = 0x243443, concrete = 0xb8c5c3, timber = 0xa87545;
/** Original geometry, grouped by material to keep the mobile draw-call count bounded. */
export class ModelBatch {
  private parts = new Map<number, THREE.BufferGeometry[]>();
  constructor(readonly parent: THREE.Object3D) {}
  geometry(geometry: THREE.BufferGeometry, color: number, position: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    g.applyMatrix4(new THREE.Matrix4().compose(V(position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), V(scale)));
    const list = this.parts.get(color) ?? []; list.push(g); this.parts.set(color, list);
  }
  box(size: Vec3, position: Vec3, color: number, rotation: Vec3 = [0, 0, 0]) { this.geometry(new THREE.BoxGeometry(...size), color, position, rotation); }
  rod(a: Vec3, b: Vec3, radius: number, color: number, sides = 6) {
    const start = V(a), delta = V(b).sub(start), g = new THREE.CylinderGeometry(radius, radius, delta.length(), sides);
    const matrix = new THREE.Matrix4().compose(start.addScaledVector(delta, .5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(matrix); this.geometry(g, color);
  }
  finish() {
    for (const [color, geometries] of this.parts) {
      const joined = mergeGeometries(geometries, false);
      if (!joined) throw new Error('Não foi possível preparar a geometria 3D.');
      geometries.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(joined, new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: color === ink ? .3 : .05 }));
      mesh.castShadow = true; mesh.receiveShadow = true; this.parent.add(mesh);
    }
    this.parts.clear();
  }
}
function group(parent: THREE.Object3D, name: string, position: Vec3 = [0, 0, 0]) { const g = new THREE.Group(); g.name = name; g.position.set(...position); parent.add(g); return g; }
function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: .68 })); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function mast(batch: ModelBatch, from: number, height: number, width: number, color: number, x = 0, z = 0) {
  const half = width / 2;
  for (const dx of [-half, half]) for (const dz of [-half, half]) batch.rod([x + dx, from, z + dz], [x + dx, from + height, z + dz], .065, color);
  for (let y = from; y < from + height - .01; y += 1.2) {
    const top = Math.min(y + 1.2, from + height);
    for (const s of [-1, 1]) {
      batch.rod([x - half, y, z + s * half], [x + half, top, z + s * half], .035, color);
      batch.rod([x - half, top, z + s * half], [x + half, y, z + s * half], .035, color);
      batch.rod([x + s * half, y, z - half], [x + s * half, top, z + half], .035, color);
      batch.rod([x + s * half, y, z - half], [x + s * half, y, z + half], .055, color);
      batch.rod([x - half, y, z + s * half], [x + half, y, z + s * half], .055, color);
    }
  }
}
function jib(batch: ModelBatch, left: number, right: number, color: number) {
  for (const z of [-.42, .42]) batch.rod([left, 0, z], [right, 0, z], .055, color);
  batch.rod([left, .85, 0], [right, .85, 0], .055, color);
  for (let x = left; x < right; x += .85) {
    const end = Math.min(right, x + .85);
    for (const z of [-.42, .42]) { batch.rod([x, 0, z], [end, .85, 0], .035, color); batch.rod([x, .85, 0], [end, 0, z], .035, color); }
    batch.rod([x, 0, -.42], [x, 0, .42], .035, color);
  }
}

export interface ArticulatedAsset { root: THREE.Group; definition: ProductionAsset; update(state: AssetState, time: number, speed?: number, travel?: number): void; rig?: ToonCharacterRig }
export function buildArticulatedAsset(a: ProductionAsset): ArticulatedAsset {
  const root = new THREE.Group(); root.name = a.id;
  const base = new ModelBatch(root), color = parseInt(a.color.slice(1), 16);
  let animate: (s: AssetState, t: number, speed: number, travel: number) => void = () => {};
  let rig: ToonCharacterRig | undefined;
  if (a.kind === 'tower_crane') {
    base.box([2.8, .35, 2.8], [0, .18, 0], concrete);
    for (const x of [-1.1, 1.1]) for (const z of [-1.1, 1.1]) base.box([.75, .65, .75], [x, .33, z], 0x879599);
    mast(base, .4, CRANE_JIB - 1, 1.05, steel);
    for (let y = 1; y < CRANE_JIB - .6; y += .27) base.rod([-.17, y, .12], [.17, y, .12], .017, 0x8a9396);
    base.rod([-.17, .5, .12], [-.17, CRANE_JIB - .5, .12], .022, 0xa4acad); base.rod([.17, .5, .12], [.17, CRANE_JIB - .5, .12], .022, 0xa4acad);
    base.geometry(new THREE.CylinderGeometry(.78, .78, .28, 32), ink, [0, CRANE_JIB - .22, 0]);
    const slew = group(root, 'slew', [0, CRANE_JIB, 0]), upper = new ModelBatch(slew);
    jib(upper, -.7, 9, steel); jib(upper, -4.2, -.7, steel);
    upper.box([3.7, .08, 1], [-2.3, -.02, 0], ink);
    for (let i = 0; i < 4; i++) upper.box([.55, .7, .95], [-3.7 + i * .57, .35, 0], concrete);
    upper.rod([-.45, 0, 0], [0, 3, 0], .065, steel); upper.rod([.45, 0, 0], [0, 3, 0], .065, steel);
    upper.rod([0, 3, 0], [8.7, .85, 0], .027, ink); upper.rod([0, 3, 0], [-4.1, .85, 0], .027, ink);
    upper.box([1.15, .8, 1.0], [.65, -.65, .9], 0xf0ca55);
    upper.box([.74, .48, .025], [.68, -.56, 1.414], 0x6a9bad); upper.box([.025, .48, .74], [1.237, -.56, .9], 0x6a9bad);
    upper.box([1.35, .09, 1.14], [.65, -.18, .9], ink);
    upper.box([.95, .6, .65], [-1.3, .35, 0], 0x287aaa);
    upper.geometry(new THREE.CylinderGeometry(.29, .29, .8, 16), ink, [-1.3, .25, 0], [Math.PI / 2, 0, 0]);
    upper.finish();
    const trolley = group(slew, 'trolley'), carriage = new ModelBatch(trolley);
    carriage.box([.8, .2, .85], [0, -.14, 0], 0x38546a);
    for (const x of [-.27, .27]) for (const z of [-.42, .42]) carriage.geometry(new THREE.CylinderGeometry(.11, .11, .08, 12), ink, [x, -.02, z], [Math.PI / 2, 0, 0]);
    carriage.finish();
    const hook = group(trolley, 'hook'), hookBatch = new ModelBatch(hook);
    hookBatch.box([.46, .42, .32], [0, .29, 0], steel);
    for (let i = 0; i < 3; i++) hookBatch.box([.075, .35, .01], [-.14 + i * .14, .29, .168], ink, [0, 0, -.3]);
    hookBatch.geometry(new THREE.TorusGeometry(.13, .045, 8, 16, Math.PI * 1.6), 0x454b52, [0, .09, 0], [0, 0, -.35]);
    hookBatch.finish();
    const ropes = [-.13, .13].map((z) => { const rope = mesh(trolley, new THREE.CylinderGeometry(.018, .018, 1, 6), ink); rope.position.z = z; return rope; });
    animate = (s) => {
      slew.rotation.y = s.joints.slew; trolley.position.x = s.joints.trolley;
      hook.position.y = s.joints.hoist - CRANE_JIB;
      for (const rope of ropes) { const length = CRANE_JIB - s.joints.hoist - .5; rope.scale.y = Math.max(.02, length); rope.position.y = -.5 - length / 2; }
    };
  } else if (a.kind === 'cargo') {
    for (const z of [-.48, 0, .48]) base.box([1.4, .14, .15], [0, .07, z], timber);
    for (let i = 0; i < 6; i++) base.box([.19, .07, 1.16], [-.57 + i * .23, .18, 0], 0xc49a62);
    for (let row = 0; row < 3; row++) for (let x = 0; x < 2; x++) {
      base.geometry(new THREE.SphereGeometry(1, 12, 8), row % 2 ? 0xddd9b8 : 0xe9e5c8, [x * .56 - .28, .35 + row * .22, 0], [0, row % 2 ? .1 : -.1, 0], [.31, .15, .48]);
      base.box([.035, .12, .84], [x * .56 - .28, .39 + row * .22, 0], 0xaba98c);
    }
    for (const x of [-.6, .6]) for (const z of [-.5, .5]) base.rod([x, .23, z], [0, 1.2, 0], .019, 0x3272a7);
    base.geometry(new THREE.TorusGeometry(.065, .018, 6, 12), ink, [0, 1.18, 0]);
  } else if (a.kind === 'truck') {
    base.box([4.6, .3, 1.65], [0, .65, 0], ink);
    base.box([3.1, .16, 1.8], [-.45, TRUCK_BED - .08, 0], 0x829597);
    for (const z of [-.94, .94]) { base.box([3.25, .48, .09], [-.45, TRUCK_BED + .24, z], color); for (const x of [-1.8, -.6, .6]) base.box([.09, .48, .11], [x, TRUCK_BED + .24, z], ink); }
    base.box([.1, .48, 1.85], [-2.1, TRUCK_BED + .24, 0], color);
    base.box([1.42, 1.7, 1.78], [1.65, 1.6, 0], color);
    base.box([1.18, .65, 1.81], [1.65, 1.94, 0], 0x38667b);
    base.box([1.5, .12, 1.92], [1.65, 2.5, 0], color);
    base.box([.12, .45, 1.9], [2.42, .93, 0], ink);
    for (const z of [-.64, .64]) base.box([.13, .19, .33], [2.49, 1.17, z], 0xffedb0);
    for (const z of [-.95, .95]) base.box([.08, .12, .3], [1.45, 1.63, z], ink);
    const wheels: THREE.Group[] = [];
    for (const x of [-1.4, 1.45]) for (const z of [-1, 1]) {
      const wheel = group(root, 'wheel', [x, .45, z]), b = new ModelBatch(wheel);
      b.geometry(new THREE.CylinderGeometry(.44, .44, .26, 20), 0x27323b, [0, 0, 0], [Math.PI / 2, 0, 0]);
      b.geometry(new THREE.CylinderGeometry(.22, .22, .28, 16), 0xd0d8d5, [0, 0, 0], [Math.PI / 2, 0, 0]);
      for (let n = 0; n < 5; n++) b.box([.05, .05, .29], [.14 * Math.cos(n * Math.PI * .4), .14 * Math.sin(n * Math.PI * .4), 0], ink);
      b.finish(); wheels.push(wheel);
    }
    animate = (s) => { for (const wheel of wheels) wheel.rotation.z = -(s.position[0] - a.position[0]) / .44; };
  } else if (a.kind === 'lift') {
    mast(base, 0, 11.3, .65, 0xc54c36, -.95, -.85);
    for (let y = 0; y < 11; y += 3) { base.box([3, .15, 2.8], [-.2, y, -.2], 0xa4b1ad); base.box([.18, 2.85, .18], [1.2, y + 1.5, -1.4], concrete); }
    const cage = group(root, 'platform'), moving = new ModelBatch(cage);
    moving.box([1.7, .25, 1.7], [0, .125, 0], steel);
    moving.box([1.8, .15, 1.8], [0, 2.45, 0], steel);
    for (const x of [-.8, .8]) for (const z of [-.8, .8]) moving.box([.075, 2.3, .075], [x, 1.25, z], steel);
    for (let i = 0; i <= 10; i++) for (const x of [-.8, .8]) moving.rod([x, .25, i * .16 - .8], [x, 2.4, i * .16 - .8], .012, 0x4b5860);
    for (let y = .3; y < 2.4; y += .25) { moving.rod([-.8, y, -.8], [-.8, y, .8], .012, ink); moving.rod([.8, y, -.8], [.8, y, .8], .012, ink); }
    moving.finish();
    const doors = [-1, 1].map((side) => {
      const door = group(cage, 'door', [side * .4, 1.3, .82]), b = new ModelBatch(door);
      for (const x of [-.38, .38]) b.box([.04, 2.1, .04], [x, 0, 0], steel);
      for (const y of [-1, 1]) b.box([.8, .04, .04], [0, y, 0], steel);
      for (let i = 0; i < 5; i++) b.rod([-.32 + i * .16, -1, 0], [-.32 + i * .16, 1, 0], .012, ink);
      b.finish(); return door;
    });
    animate = (s) => { cage.position.y = s.joints.lift; doors.forEach((d, i) => { d.position.x = (i ? 1 : -1) * (.4 + .75 * s.joints.doors); }); };
  } else {
    rig = createCharacterRig({ bodyColor: color, hairColor: 0x52362b });
    rig.root.position.y = 1.42; root.add(rig.root);
    // Shared body rig, with smooth materials instead of the old presentation outline.
    rig.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const material = o.material as THREE.MeshToonMaterial;
      if (material.side === THREE.BackSide) { o.visible = false; return; }
      const replacement = new THREE.MeshStandardMaterial({ color: material.color, roughness: .82 });
      o.material = replacement; material.dispose(); o.castShadow = true; o.receiveShadow = true;
    });
    if (a.kind === 'worker') {
      const cap = new ModelBatch(rig.head);
      cap.geometry(new THREE.SphereGeometry(.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), steel, [0, .12, 0]);
      cap.geometry(new THREE.CylinderGeometry(.47, .47, .065, 24), steel, [0, .13, .02]);
      cap.box([.05, .15, .65], [0, .4, 0], 0xffd260); cap.finish();
      const vest = new ModelBatch(rig.torso);
      for (const x of [-.20, .20]) vest.box([.14, .58, .03], [x, .06, .32], 0xffb12e);
      vest.box([.55, .045, .03], [0, -.16, .345], 0xe8e5c7); vest.finish();
    }
    const actor = rig;
    animate = (s, t, speed, travel) => {
      const laugh = s.joints.laugh ?? 0, pride = s.joints.pride ?? 0, smile = Math.max(laugh, s.joints.smile ?? 0), point = s.joints.point ?? s.joints.gesture ?? 0;
      const pulse = Math.sin(t * 15) * laugh, stride = Math.sin(travel / .72 * Math.PI * 2) * Math.min(1, speed * 1.5);
      actor.root.position.set(0, 1.42, 0); actor.root.rotation.set(0, 0, 0);
      actor.torso.position.set(0, .018 * Math.sin(t * 2) + Math.abs(pulse) * .025, 0);
      actor.torso.rotation.set(-.1 * pride + .14 * laugh + .035 * pulse, 0, .025 * pulse);
      actor.head.rotation.set(-.18 * pride - .08 * laugh + .045 * pulse, .03 * Math.sin(t * 1.7), .025 * laugh * Math.sin(t * 8));
      actor.leftArm.root.rotation.set(stride * .45 - .05, 0, .08 + pride * .5);
      actor.rightArm.root.rotation.set(-stride * .45 - .05 - point * .6, 0, -.08 - pride * .5 - point * .7);
      actor.leftArm.elbow!.rotation.set(-.12 - pride * 1.3 - laugh * .25, 0, 0);
      actor.rightArm.elbow!.rotation.set(-.12 - pride * 1.3 - laugh * .25, 0, 0);
      actor.face.mouth.scale.set(1 + smile * .28, .7 + laugh * (2.5 + Math.abs(Math.sin(t * 13))) + (s.joints.talk ?? 0) * Math.abs(Math.sin(t * 14)) * 2, 1);
      const blink = Math.max(0, 1 - Math.abs((t + a.id.length * .21) % 3.6 - 2.8) / .09);
      actor.face.leftEye.scale.y = actor.face.rightEye.scale.y = (1 - blink * .92) * (1 - laugh * .22);
      actor.face.leftBrow.rotation.z = -.12 * pride + .10 * smile; actor.face.rightBrow.rotation.z = .12 * pride - .10 * smile;
      root.updateWorldMatrix(true, true);
      [actor.leftLeg, actor.rightLeg].forEach((leg, i) => {
        const side = i ? 1 : -1;
        const phase = travel / .72 + (i ? .5 : 0), swing = Math.max(0, (phase - Math.floor(phase) - .6) / .4);
        const gait = Math.min(1, speed * 2);
        const local = new THREE.Vector3(side * .19, .064 + .12 * Math.sin(swing * Math.PI) * gait, .10 + .22 * Math.cos(phase * Math.PI * 2) * gait);
        const foot = root.localToWorld(local), pole = root.localToWorld(new THREE.Vector3(side * .3, .75, 1));
        solveLimb(leg, foot, pole);
        leg.hand!.quaternion.copy(leg.hand!.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(root.getWorldQuaternion(new THREE.Quaternion())));
      });
    };
  }
  base.finish();
  return { root, definition: a, rig, update(s, time, speed = 0, travel = 0) { root.position.set(...s.position); root.rotation.y = s.yaw; animate(s, time, speed, travel); } };
}

export function constructionEnvironment(world: THREE.Object3D) {
  const b = new ModelBatch(world);
  b.box([130, .2, 130], [0, -.14, 0], 0xc7b58e);
  b.box([90, .06, 6], [0, .002, 7.7], 0x6d7b83);
  for (const z of [4.5, 10.9]) b.box([90, .18, .35], [0, .06, z], 0xa3b4b6);
  for (let x = -40; x < 40; x += 3) b.box([1.3, .01, .08], [x, .041, 7.7], 0xece4ba);
  for (let i = 0; i < 24; i++) {
    const side = i < 12 ? -1 : 1, k = i % 12, x = (k - 5.5) * 5.4, z = side * (k % 2 ? 25 : 19), height = 5 + (i * 7 % 9);
    const color = [0xd2d5bc, 0x95b5ba, 0xd8b79c, 0xa7b6bd, 0xbbc9a7][i % 5];
    b.box([4.2, height, 4], [x, height / 2, z], color); b.box([4.4, .15, 4.2], [x, height + .06, z], 0xe5e5d4);
    for (let y = 1; y < height - .3; y += 1.25) for (const dx of [-1.3, 0, 1.3]) {
      b.box([.63, .8, .04], [x + dx, y, z - side * 2.03], 0xe7e5cb);
      b.box([.46, .64, .05], [x + dx, y, z - side * 2.06], 0x6b95a7);
    }
  }
  // Open building frame leaves the working area and cargo route clear.
  for (let floor = 0; floor < 4; floor++) {
    const y = floor * 2.8;
    b.box([6.2, .24, 5.2], [-7, y + .12, -5], 0xb7c4bf);
    for (const x of [-9.6, -7, -4.4]) for (const z of [-7.1, -2.9]) b.box([.27, 2.65, .27], [x, y + 1.52, z], concrete);
    if (floor < 3) {
      b.box([2.5, 1.3, .18], [-8.4, y + .88, -7.1], 0xbc7761);
      for (let row = 0; row < 7; row++) b.box([2.5, .025, .195], [-8.4, y + .3 + row * .18, -7.1], 0xd4b29a);
    }
  }
  for (let x = -13; x < 13; x += 2) {
    b.box([1.95, 1.0, .08], [x, .58, -11], 0x88a4a8); b.rod([x - 1, 0, -11], [x - 1, 1.25, -11], .04, ink);
  }
  for (const x of [-12, 11]) for (const z of [-4, 13]) {
    b.geometry(new THREE.CylinderGeometry(.09, .12, 1.5, 8), 0x887052, [x, .75, z]);
    for (let i = 0; i < 3; i++) b.geometry(new THREE.IcosahedronGeometry(1, 1), [0x6e9b75, 0x87a87b, 0x9cb385][i], [x + (i - 1) * .35, 2 + i * .25, z], [0, i, 0], [1.05, .9, .9]);
  }
  for (let i = 0; i < 6; i++) {
    const x = 8.5 + i % 3 * .8, z = -4 + Math.floor(i / 3) * .8;
    b.geometry(new THREE.ConeGeometry(.18, .55, 12), 0xe5813a, [x, .28, z]); b.box([.4, .05, .4], [x, .03, z], ink);
  }
  b.finish();
  const clouds = new ModelBatch(world);
  for (let i = 0; i < 9; i++) for (let n = 0; n < 3; n++) clouds.geometry(new THREE.SphereGeometry(1, 12, 8), 0xf0f2e8, [i * 9 - 34 + n * 1.6, 20 + i % 3, -26 - i % 2 * 15], [0, 0, 0], [2.4, 1.05, 1.35]);
  clouds.finish();
}
