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
  const vest = toonMaterial({ color: '#36383f' });
  const white = toonMaterial({ color: '#f3f1ec' });
  const gold = toonMaterial({ color: '#cfa367' });
  const goldLight = toonMaterial({ color: '#ead09b' });
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
  part(actor.hips, 'patrick-white-shirt', new THREE.BoxGeometry(.21, .43, .046), white, [0, .27, .215]);
  for (const side of [-1, 1]) {
    const prefix = side === -1 ? 'left' : 'right';
    part(actor.hips, `patrick-${prefix}-vest`, new THREE.BoxGeometry(.13, .38, .034), vest,
      [side * .085, .23, .248]);
    const lapel = part(actor.hips, `patrick-${prefix}-lapel`,
      new THREE.CapsuleGeometry(.048, .35, 4, 8), navyLight,
      [side * .225, .35, .245], [.86, 1, .66]);
    lapel.rotation.z = -side * .27;
    // Neck and lapels stay inside the torso group as the torso rotates.
    part(actor.hips, `patrick-${prefix}-collar`, new THREE.BoxGeometry(.105, .115, .045),
      white, [side * .085, .5, .172]);
  }
  for (let i = 0; i < 3; i++) {
    ball(actor.hips, `patrick-vest-button-${i}`, .013, ink, [.037, .29 - i * .085, .281]);
  }
  // Swept-back blond waves: identifiable from front, profile and rear.
  const locks: Array<[number, number, number, number, number, number]> = [
    [-.23,.20,.04,.145,.12,-.28], [-.12,.32,.02,.17,.13,-.14],
    [.04,.355,.03,.18,.12,.12], [.19,.29,.065,.15,.11,.25],
    [-.25,.08,-.13,.125,.14,-.35], [.25,.09,-.13,.13,.14,.35],
    [-.16,.20,-.22,.16,.15,.1], [.07,.23,-.26,.19,.13,-.1],
    [.20,.12,-.18,.14,.14,.15], [-.05,.30,.19,.16,.085,-.3],
  ];
  locks.forEach(([x,y,z,r,depth,tilt],i) => {
    const wave = ball(actor.head, `patrick-hair-wave-${i}`, r,
      i % 3 === 0 ? goldLight : gold, [x,y,z], [1,.85,depth/r]);
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
      new THREE.BoxGeometry(.247, .12, .37), brown, [0,.015,.088]);
  }
  actor.root.userData.characterPreset = 'patrick-mentalista-v1';
}
