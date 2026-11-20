import * as THREE from 'three';
import { toonMaterial } from './look';
import type { ProgramActor3D } from './actor3d';

/**
 * Patrick - investigative host, v1. Costume, hair and facial features are
 * built as real geometry attached to the existing articulated actor.
 * This does not import a PNG, load remote files, or create an independent rig.
 * All parts remain attached when IK moves the hands, head and body.
 */
export function decoratePatrickActor(actor: ProgramActor3D): void {
  const navy = toonMaterial({ color: '#34496d' });
  const navyLight = toonMaterial({ color: '#52698b' });
  const vest = toonMaterial({ color: '#555966' });
  const white = toonMaterial({ color: '#f3f1ec' });
  const gold = toonMaterial({ color: '#cfa367' });
  const goldLight = toonMaterial({ color: '#dbb579' });
  const stubble = toonMaterial({ color: '#b88b68' });
  const skin = toonMaterial({ color: '#f1c29d' });
  const brown = toonMaterial({ color: '#543829' });
  const blue = toonMaterial({ color: '#5b91b3' });
  const ink = toonMaterial({ color: '#23303e' });

  const part = (parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry,
    material: THREE.Material, position: [number, number, number], scale?: [number, number, number]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const ball = (parent: THREE.Object3D, name: string, radius: number,
    material: THREE.Material, p: [number, number, number], scale?: [number, number, number]) =>
    part(parent, name, new THREE.SphereGeometry(radius, 12, 10), material, p, scale);

  // A fitted blue jacket, graphite vest and open-neck white shirt.
  part(actor.hips, 'patrick-white-shirt', new THREE.BoxGeometry(.20, .44, .046), white, [0, .28, .218]);
  for (const side of [-1, 1]) {
    const prefix = side === -1 ? 'left' : 'right';
    part(actor.hips, `patrick-${prefix}-vest`, new THREE.BoxGeometry(.085, .37, .023), vest,
      [side * .133, .225, .235]);
    const lapel = part(actor.hips, `patrick-${prefix}-lapel`,
      new THREE.CapsuleGeometry(.030, .29, 4, 8), navyLight,
      [side * .237, .34, .235], [.8, 1, .55]);
    lapel.rotation.z = -side * .27;
    // Neck and lapels stay inside the torso group as the torso rotates.
    part(actor.hips, `patrick-${prefix}-collar`, new THREE.BoxGeometry(.09, .105, .04),
      white, [side * .085, .49, .172]);
  }
  for (const side of [-1, 1]) {
    const coat = part(actor.hips, side < 0 ? 'patrick-coat-left' : 'patrick-coat-right',
      new THREE.BoxGeometry(.18, .31, .13), navy, [side * .2, -.12, .05]);
    coat.rotation.z = -side * .06;
  }
  for (let i = 0; i < 3; i++) {
    ball(actor.hips, `patrick-vest-button-${i}`, .013, ink, [.037, .29 - i * .085, .281]);
  }
  // Swept-back blond waves: identifiable from front, profile and rear.
  const locks: Array<[number, number, number, number, number, number]> = [
    [-.23,.18,.02,.105,.13,-.28], [-.12,.28,.01,.125,.13,-.14],
    [.04,.32,.025,.14,.12,.12], [.19,.265,.045,.115,.11,.25],
    [-.25,.07,-.13,.095,.14,-.35], [.25,.08,-.13,.105,.13,.35],
    [-.16,.18,-.22,.12,.15,.1], [.07,.23,-.26,.14,.14,-.1],
    [.20,.12,-.18,.11,.14,.15], [-.05,.29,.19,.13,.10,-.3],
  ];
  locks.forEach(([x,y,z,r,depth,tilt],i) => {
    const wave = ball(actor.head, `patrick-hair-wave-${i}`, r,
      i % 3 === 0 ? goldLight : gold, [x,y,z], [.9,1.38,depth/r]);
    wave.rotation.z = tilt;
  });
  // Light cheek stubble; the expressive mouth is still controlled by the base rig.
  for (const side of [-1, 1]) {
    ball(actor.head, side < 0 ? 'patrick-stubble-left' : 'patrick-stubble-right',
      .093, stubble, [side * .18,-.16,.18], [.86,.45,.46]);
    ball(actor.head, side < 0 ? 'patrick-blue-eye-left' : 'patrick-blue-eye-right',
      .034, blue, [side * .115,.035,.352], [1,1,.38]);
    ball(actor.head, side < 0 ? 'patrick-pupil-left' : 'patrick-pupil-right',
      .016, ink, [side * .115,.035,.367], [1,1,.55]);
  }

  // Skin-colored, visible hands. Separate pivots are ready for finger controls.
  for (const [name, limb] of [['left', actor.limbs.leftHand], ['right', actor.limbs.rightHand]] as const) {
    ball(limb.hand, `patrick-${name}-palm`, .109, skin, [0,-.008,.027], [.81,.94,.8]);
    for (let finger = 0; finger < 4; finger++) {
      const hinge = new THREE.Group();
      hinge.name = `patrick-${name}-finger-${finger}-joint`;
      hinge.position.set((finger - 1.5) * .037, -.069, .042);
      limb.hand.add(hinge);
      part(hinge, `patrick-${name}-finger-${finger}`,
        new THREE.CapsuleGeometry(.013, .05 + (finger === 1 || finger === 2 ? .022 : 0), 3, 6),
        skin, [0,-.037,0]);
    }
    const thumb = ball(limb.hand, `patrick-${name}-thumb`, .034, skin,
      [name === 'left' ? .085 : -.085,-.052,.065], [.85,1.6,.8]);
    thumb.rotation.z = name === 'left' ? -.6 : .6;
  }
  for (const [name, foot] of [['left', actor.limbs.leftFoot], ['right', actor.limbs.rightFoot]] as const) {
    part(foot.hand, `patrick-${name}-leather-shoe`,
      new THREE.BoxGeometry(.24, .10, .34), brown, [0,.015,.078]);
  }
  actor.root.userData.characterPreset = 'patrick-mentalista-v1';
}
