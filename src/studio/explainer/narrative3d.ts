import * as THREE from 'three';
import { createCharacterRig, updateCharacterRig, type ToonCharacterRig } from './toon/characterRig';
import { solveLimb, smooth } from './grounded3d';
import type { ExplainerScene } from './plan';
import type { NarrativeStaging } from './staging';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const beat = (t: number, a: number, b: number) => smooth((t - a) / Math.max(.001, b - a));
const pos = (o: THREE.Object3D) => o.getWorldPosition(V());
type Actor = { rig: ToonCharacterRig; holder: THREE.Group };

function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, new THREE.MeshToonMaterial({ color }));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function phoneModel() {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(.30, .52, .045), 0x202d43);
  part(g, new THREE.BoxGeometry(.26, .44, .008), 0xe4faf4, 0, .01, .027);
  part(g, new THREE.BoxGeometry(.26, .065, .009), 0x239f83, 0, .195, .033);
  for (let i = 0; i < 3; i++) part(g, new THREE.BoxGeometry(.17 - i * .025, .018, .01), 0x6bbfb1, -.015, .095 - i * .055, .035);
  return g;
}
function envelope(parent: THREE.Object3D, color = 0xf3cf83) {
  const g = new THREE.Group(); parent.add(g);
  part(g, new THREE.BoxGeometry(.36, .24, .055), color);
  const flap = new THREE.Shape(); flap.moveTo(-.18, .12); flap.lineTo(0, -.015); flap.lineTo(.18, .12); flap.closePath();
  part(g, new THREE.ExtrudeGeometry(flap, { depth: .012, bevelEnabled: false }), 0xe5ad50, 0, 0, .035);
  return g;
}
function heart(parent: THREE.Object3D) {
  const s = new THREE.Shape(); s.moveTo(0, -.20); s.bezierCurveTo(-.34, .02, -.20, .31, 0, .14); s.bezierCurveTo(.20, .31, .34, .02, 0, -.20);
  return part(parent, new THREE.ExtrudeGeometry(s, { depth: .08, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .025, bevelThickness: .025 }), 0xef5665);
}

export function narrativeFrame(staging: NarrativeStaging, local: number, duration: number) {
  const t = Math.max(0, Math.min(duration, Number.isFinite(local) ? local : 0));
  const p = clamp(t / Math.max(.1, duration));
  const moving = staging.action === 'run' || staging.action === 'walk';
  const speed = staging.action === 'run' ? 1.65 : .72;
  const travelTime = Math.max(.8, duration * (staging.friends ? .76 : .94) - .4);
  const travel = Math.min(travelTime, Math.max(0, t - .4));
  // Integrate a short acceleration/deceleration envelope analytically.
  const ramp = Math.min(.35, travelTime / 3);
  const integral = (u: number) => u < ramp ? u * u / (2 * ramp)
    : u > travelTime - ramp ? travelTime - ramp - (travelTime - u) ** 2 / (2 * ramp) : u - ramp / 2;
  const distance = moving ? Math.max(0, integral(travel)) * speed : 0;
  const totalDistance = moving ? (travelTime - ramp) * speed : 0;
  const startX = moving ? (staging.friends ? 1.0 : totalDistance / 2) - totalDistance : 0;
  return { t, p, x: moving ? startX + distance : 0, startX, distance, moving: moving && travel > 0 && travel < travelTime,
    arrival: beat(t, travelTime + .4, Math.min(duration, travelTime + 1.5)) };
}

/** World-space support interval; a supporting sole does not move as the root travels. */
export function narrativeFoot(distance: number, side: -1 | 1, startX: number, running = false) {
  const stride = running ? 1.12 : .8, offset = side === -1 ? 0 : .5;
  const q = distance / stride + offset, cycle = Math.floor(q), phase = q - cycle;
  const stance = running ? .43 : .60, swing = phase < stance ? 0 : (phase - stance) / (1 - stance);
  return { position: V(startX + (cycle - offset) * stride + .22 + stride * smooth(swing), .064 + (running ? .20 : .11) * Math.sin(Math.PI * swing), .65 - side * .19), planted: phase < stance };
}

/** Normal story renderer: selected from the words of ANY ordinary input, not a demo button. */
export class Narrative3D {
  readonly actors: Actor[] = [];
  readonly objects = new THREE.Group();
  private phone?: THREE.Group;
  private message?: THREE.Group;
  private heart?: THREE.Mesh;
  private bars: THREE.Mesh[] = [];
  private packets: THREE.Group[] = [];
  private routes: THREE.CatmullRomCurve3[] = [];
  private question?: THREE.Group;
  private clockHands: THREE.Mesh[] = [];
  private lastTime = 0;
  private lastDuration = 1;
  private contactErrors: number[] = [];

  constructor(readonly scene: ExplainerScene, readonly world: THREE.Group) {
    const staging = scene.staging!;
    world.add(this.objects);
    if (!['money_flow', 'growth', 'time'].includes(staging.action)) {
      for (let i = 0; i <= staging.friends; i++) {
        const rig = createCharacterRig({ bodyColor: i ? [0x58bfae, 0xb88bce][i - 1] : parseInt(staging.actor.color.slice(1), 16), hairColor: i ? 0x5c3234 : 0x352820, hairStyle: i === 2 ? 'tied' : 'wavy' });
        rig.root.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
        const holder = new THREE.Group(); holder.add(rig.root); world.add(holder); this.actors.push({ rig, holder });
      }
    }
    if (staging.action === 'run' || staging.action === 'walk') {
      // A continuous street, not a moving image behind a running presenter.
      part(this.objects, new THREE.BoxGeometry(2400, .10, 5.8), 0x536177, 0, -.065, .3);
      for (let i = 0; i < 25; i++) {
        const g = new THREE.Group(); g.name = 'street-block'; this.objects.add(g);
        const h = 2.0 + (i % 4) * .65;
        part(g, new THREE.BoxGeometry(1.8, h, 1.5), [0xc59a89, 0x9bafc6, 0xc3bb9b][i % 3], 0, h / 2, -3.2);
        for (const x of [-.45, .45]) for (let y = .65; y < h - .2; y += .65) part(g, new THREE.BoxGeometry(.32, .34, .02), 0xc9e8f7, x, y, -2.43);
        part(g, new THREE.BoxGeometry(.85, .01, .04), 0xf5e3ab, 0, .003, 2.0);
      }
    }
    if (staging.action === 'phone') {
      this.phone = phoneModel(); this.objects.add(this.phone);
      this.message = envelope(this.objects, 0xa7f2d8);
    }
    if (staging.action === 'heartbeat') this.heart = heart(this.objects);
    if (staging.action === 'work') {
      part(this.objects, new THREE.BoxGeometry(2.1, .12, 1.2), 0xae7953, 0, 1.16, .55);
      for (const x of [-.85, .85]) for (const z of [.12, 1.0]) part(this.objects, new THREE.CylinderGeometry(.045, .045, 1.1, 8), 0x4a4757, x, .55, z);
      part(this.objects, new THREE.BoxGeometry(.95, .05, .58), 0x344358, 0, 1.25, .54);
      const screen = new THREE.Group(); screen.position.set(0, 1.28, .80); screen.rotation.x = -.13; this.objects.add(screen);
      part(screen, new THREE.BoxGeometry(.95, .63, .04), 0x26374e, 0, .30, 0);
      part(screen, new THREE.BoxGeometry(.83, .50, .012), 0xc8f0ec, 0, .30, -.028);
      for (let i = 0; i < 5; i++) part(screen, new THREE.BoxGeometry(.55 - (i % 2) * .18, .035, .012), 0x5ab1ac, -.06, .46 - i * .08, -.037);
    }
    if (staging.action === 'growth') {
      part(this.objects, new THREE.BoxGeometry(3.0, .09, .9), 0x33455b, 0, 1.02, .3);
      for (const x of [-1.2, 1.2]) part(this.objects, new THREE.CylinderGeometry(.045, .045, 1, 8), 0x33455b, x, .5, .3);
      for (let i = 0; i < 5; i++) this.bars.push(part(this.objects, new THREE.BoxGeometry(.32, 1, .45), [0x65cbb3, 0x75d3b2, 0xe8bc61][i % 3], -.95 + i * .47, .3, .3));
    }
    if (staging.action === 'money_flow') {
      const points = [V(-.65, 2.2, 0), V(.70, 1.32, .12), V(-.65, .45, .08)];
      points.forEach((p, i) => {
        const group = new THREE.Group(); group.position.copy(p); this.objects.add(group);
        part(group, new THREE.BoxGeometry(.90, .10, .65), 0x33475e);
        for (let k = 0; k < 4; k++) part(group, new THREE.BoxGeometry(.55, .025, .38), 0xf7edd2, -.13, .10 + k * .03, 0);
        for (let k = 0; k < 5; k++) part(group, new THREE.CylinderGeometry(.11, .11, .035, 16), 0xf3c55c, .25, .10 + k * .04, .15);
        const to = points[(i + 1) % points.length];
        const mid = p.clone().lerp(to, .5).add(V(i === 2 ? -.48 : .35, 0, .25));
        const route = new THREE.CatmullRomCurve3([p.clone().add(V(0, .25, .25)), mid, to.clone().add(V(0, .25, .25))]); this.routes.push(route);
        const tube = part(this.objects, new THREE.TubeGeometry(route, 28, .018, 6, false), 0x8dbab4); tube.castShadow = false;
        const packet = envelope(this.objects); packet.scale.setScalar(.72); this.packets.push(packet);
      });
    }
    if (staging.action === 'question') {
      this.question = new THREE.Group(); this.objects.add(this.question);
      const path = new THREE.CatmullRomCurve3([V(-.12, .22), V(-.08, .39), V(.17, .38), V(.23, .22), V(.07, .08), V(.06, -.02)]);
      part(this.question, new THREE.TubeGeometry(path, 24, .035, 8, false), 0xf4c75b);
      part(this.question, new THREE.SphereGeometry(.045, 12, 8), 0xf4c75b, .06, -.16);
    }
    if (staging.action === 'time') {
      const dial = part(this.objects, new THREE.CylinderGeometry(.85, .85, .12, 48), 0xf9efd2, 0, 1.5, 0); dial.rotation.x = Math.PI / 2;
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const tick = part(this.objects, new THREE.BoxGeometry(.035, .11, .02), 0x33455b, Math.sin(a) * .70, 1.5 + Math.cos(a) * .70, .08); tick.rotation.z = -a; }
      for (const length of [.48, .30]) { const hand = part(this.objects, new THREE.BoxGeometry(.045, length, .04).translate(0, length / 2, 0), 0x33455b, 0, 1.5, .1); this.clockHands.push(hand); }
    }
  }

  update(local: number, duration: number) {
    this.lastTime = local; this.lastDuration = duration; this.contactErrors = [];
    const staging = this.scene.staging!, f = narrativeFrame(staging, local, duration), t = f.t;
    const moving = staging.action === 'run' || staging.action === 'walk';
    for (let i = 0; i < this.actors.length; i++) {
      const { rig, holder } = this.actors[i];
      const x = i ? 2.45 + (i - 1) * .68 : f.x, z = i ? .10 : staging.action === 'work' ? -.15 : .65;
      const yaw = i ? -.55 : moving ? Math.PI / 2 * (1 - f.arrival * .5) : -.10;
      const running = staging.action === 'run', stride = running ? 1.12 : .8;
      const phase = f.distance / stride * Math.PI * 2;
      holder.position.set(x, i || !moving ? 1.42 : 1.34 + (running && f.moving ? .035 * Math.abs(Math.sin(phase)) : 0), z);
      updateCharacterRig(rig, { id: i ? 'friend' + i : staging.actor.id, pose: 'idle', expression: staging.action === 'question' ? 'confused' : i && f.arrival > .2 ? 'happy' : 'neutral', gaze: 'lookAtCamera', prop: 'none', position: { x: 0, y: 0, z: 0 }, rotationY: yaw, scale: 1 }, t, { breathingAmplitude: 0 });
      rig.torso.position.set(0, .006 * Math.sin(t * 2.1 + i), 0);
      rig.torso.rotation.set(moving && !i && f.moving ? (running ? .18 : .06) : 0, 0, 0);
      rig.head.rotation.set(staging.action === 'phone' ? .38 : staging.action === 'work' ? .16 : .008 * Math.sin(t * 1.8), i ? -.22 : staging.action === 'phone' ? -.40 : -.08, .008 * Math.sin(t * 1.2 + i));
      for (const limb of [rig.leftArm, rig.rightArm, rig.leftLeg, rig.rightLeg]) { limb.root.quaternion.identity(); limb.elbow!.quaternion.identity(); limb.hand!.quaternion.identity(); }
      rig.leftArm.root.rotation.set(!i && f.moving ? .55 * Math.sin(phase) : -.06, 0, .09);
      rig.rightArm.root.rotation.set(!i && f.moving ? -.55 * Math.sin(phase) : -.06, 0, -.09);
      rig.leftArm.elbow!.rotation.x = rig.rightArm.elbow!.rotation.x = running && f.moving ? -.8 : -.16;
      const blink = Math.max(0, 1 - Math.abs((t + i * .43) % 3.7 - 2.8) / .09);
      rig.face.leftEye.scale.y *= 1 - blink * .9; rig.face.rightEye.scale.y *= 1 - blink * .9;
      holder.updateWorldMatrix(true, true);
      [rig.leftLeg, rig.rightLeg].forEach((leg, j) => {
        const side = j ? 1 : -1;
        const target = moving && !i ? narrativeFoot(f.distance, side, f.startX, running).position : V(x + side * .19, .064, z + .10);
        solveLimb(leg, target, V(x + (moving && !i ? 1 : side * .18), .7, z + 1));
        leg.hand!.quaternion.copy(leg.hand!.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1), moving && !i ? Math.PI / 2 : yaw)));
      });
      if (i && f.arrival > 0) {
        const hand = pos(rig.rightArm.hand!).lerp(V(x - .10, 1.95, .8), f.arrival);
        solveLimb(rig.rightArm, hand, V(x + .7, 1.1, 1));
      }
    }
    const actor = this.actors[0];
    if (actor) {
      const { rig } = actor;
      const reach = (side: 'left' | 'right', target: THREE.Vector3, amount: number, pole = V(side === 'left' ? -.8 : .8, .9, 1.4)) => {
        const arm = side === 'left' ? rig.leftArm : rig.rightArm;
        const aimed = pos(arm.hand!).lerp(target, clamp(amount));
        const result = solveLimb(arm, aimed, pole); this.contactErrors.push(result.error);
      };
      if (this.phone) {
        reach('left', V(-.30, 1.42, 1.1), beat(t, .15, Math.min(1.1, duration * .3)));
        const hand = rig.leftArm.hand!; if (this.phone.parent !== hand) hand.add(this.phone);
        const handPosition = pos(hand), grip = V(0, -.18, -.03);
        const rotation = new THREE.Quaternion(); let objectPosition = handPosition.clone().add(V(0, .18, 0));
        // Orient the display toward the reader, keeping the local top upright.
        // Iteration accounts for the off-centre grip without moving the hand.
        for (let k = 0; k < 3; k++) {
          const normal = pos(rig.head).sub(objectPosition).normalize();
          rotation.setFromRotationMatrix(new THREE.Matrix4().lookAt(normal, V(), V(0, 1, 0)));
          objectPosition = handPosition.clone().sub(grip.clone().applyQuaternion(rotation));
        }
        const matrix = new THREE.Matrix4().compose(objectPosition, rotation, V(1, 1, 1)); hand.updateWorldMatrix(true, false);
        new THREE.Matrix4().copy(hand.matrixWorld).invert().multiply(matrix).decompose(this.phone.position, this.phone.quaternion, this.phone.scale); this.phone.updateWorldMatrix(false, true);
        if (t > 1.1) reach('right', this.phone.localToWorld(V(.08, .01 + .025 * Math.sin(t * 5), .065)), beat(t, 1.1, 1.8) * .92);
        const incoming = 1 - beat(t, .25, 1.5); this.message!.position.copy(objectPosition).add(V(.45 * incoming, .4 * incoming, .12)); this.message!.scale.setScalar(.22 + .55 * incoming); this.message!.visible = t < 1.6;
      }
      if (this.heart) { this.heart.position.set(.14, 1.68, 1.01); this.heart.scale.setScalar(.9 + .18 * Math.max(0, Math.sin(t * 12))); reach('right', V(.06, 1.60, 1.14), beat(t, .15, .8)); }
      if (staging.action === 'work') {
        reach('left', V(-.18, 1.30 + .018 * Math.sin(t * 12), .42), beat(t, .1, .8));
        reach('right', V(.18, 1.30 - .018 * Math.sin(t * 12), .42), beat(t, .1, .8));
      }
      if (this.question) { this.question.position.set(.65, 2.15 + .035 * Math.sin(t * 2), .7); this.question.scale.setScalar(.7 + .3 * beat(t, .1, .7)); reach('right', V(.22, 1.93, 1.04), beat(t, .1, 1.2)); }
    }
    this.bars.forEach((bar, i) => { const h = .20 + (i + 1) * .34 * clamp(t / Math.max(.1, duration)); bar.scale.y = h; bar.position.y = 1.06 + h / 2; });
    this.packets.forEach((packet, i) => { const q = (t * .23 + i / 3) % 1; packet.position.copy(this.routes[i].getPoint(q)); packet.rotation.set(.10, .08 * Math.sin(t + i), -.12 + .08 * Math.sin(t * 2 + i)); });
    this.clockHands.forEach((hand, i) => { hand.rotation.z = -t * (i ? .38 : 2.4); });
    let blockIndex = 0;
    for (const o of this.objects.children) if (o.name === 'street-block') { o.position.x = f.startX - 4 + blockIndex++ * Math.max(2.8, (Math.abs(f.startX) + 20) / 25); }
    this.world.updateWorldMatrix(true, true);
  }

  camera(aspect: number) {
    const staging = this.scene.staging!, f = narrativeFrame(staging, this.lastTime, this.lastDuration);
    const locomotion = staging.action === 'run' || staging.action === 'walk';
    const abstract = ['money_flow', 'growth', 'time'].includes(staging.action);
    const close = !abstract && !locomotion && f.p > .58;
    if (this.phone && f.p > .18 && f.p < .65) {
      // Over the reader's shoulder: the screen faces the character, and this
      // view makes the same screen visible to the audience without cheating its orientation.
      const look = pos(this.phone).add(V(0, .06, 0));
      const d = Math.max(1.25 / aspect, 1.7) / (2 * Math.tan(THREE.MathUtils.degToRad(21))) * 1.08;
      return { look, pos: look.clone().add(V(-d * .32, d * .85, -d * .65)) };
    }
    const look = V(locomotion ? f.x + .20 + f.arrival * .45 : this.question ? .18 : abstract ? 0 : -.02, close ? 1.80 : abstract ? 1.48 : 1.16, .55);
    const width = locomotion && f.arrival > 0 ? 3.9 : close ? this.question ? 1.95 : 1.7 : staging.action === 'money_flow' ? 2.05 : abstract ? 2.55 : 2.35;
    const height = close ? 2.55 : staging.action === 'money_flow' ? 3.5 : 4.0;
    const distance = Math.max(width / aspect, height) / (2 * Math.tan(THREE.MathUtils.degToRad(21))) * 1.12;
    const angle = locomotion ? -.14 : staging.action === 'work' ? .28 : abstract ? .12 : -.13;
    return { pos: look.clone().add(V(Math.sin(angle) * distance, distance * .11, Math.cos(angle) * distance)), look };
  }
  diagnostics() {
    const phoneFacingReader = this.phone && this.actors[0] ? this.phone.getWorldDirection(V()).dot(pos(this.actors[0].rig.head).sub(pos(this.phone)).normalize()) > .1 : undefined;
    return { action: this.scene.staging!.action, actors: this.actors.length, board: false, phoneFacingReader,
      barHeights: this.bars.map((bar) => bar.scale.y), maxContactError: Math.max(0, ...this.contactErrors), positions: this.actors.map((a) => pos(a.rig.root).toArray()) };
  }
  questionBounds() { return this.question ? new THREE.Box3().setFromObject(this.question) : null; }
  dispose() { for (const actor of this.actors) actor.rig.dispose(); }
}
