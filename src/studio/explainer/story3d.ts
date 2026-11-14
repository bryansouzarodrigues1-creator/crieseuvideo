import * as THREE from 'three';
import { createCharacterRig, updateCharacterRig, type ToonCharacterRig } from './toon/characterRig';
import type { ToonCharacter, CharacterPose } from './toon/types';
import { storyFrame, type StoryScene, type StoryProp } from './storyAction';

type Performer = { rig: ToonCharacterRig; holder: THREE.Group; name: THREE.Sprite; texture: THREE.CanvasTexture };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

function mesh(geometry: THREE.BufferGeometry, color: number): THREE.Mesh {
  const m = new THREE.Mesh(geometry, new THREE.MeshToonMaterial({ color }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function add(g: THREE.Group, geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) {
  const m = mesh(geometry, color); m.position.set(x, y, z); g.add(m); return m;
}
function objectModel(kind: StoryProp): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'lantern') {
    add(g, new THREE.CylinderGeometry(.19, .22, .45, 12), 0xf9b232, 0, 0, 0);
    add(g, new THREE.CylinderGeometry(.17, .17, .29, 12), 0xffee9b, 0, 0.02, .02);
    add(g, new THREE.CylinderGeometry(.23, .23, .07, 12), 0x263750, 0, .26, 0);
    const ring = mesh(new THREE.TorusGeometry(.15, .028, 7, 14, Math.PI), 0x263750);
    ring.rotation.z = Math.PI; ring.position.y = .32; g.add(ring);
    const light = new THREE.PointLight(0xffdf7e, .7, 2.5); light.position.y = .05; g.add(light);
  } else if (kind === 'hat') {
    add(g, new THREE.CylinderGeometry(.33, .37, .30, 16), 0x6378e5, 0, .14, 0);
    add(g, new THREE.CylinderGeometry(.58, .58, .06, 20), 0x657ce5, 0, -.03, 0);
    add(g, new THREE.CylinderGeometry(.37, .37, .08, 16), 0xf9d379, 0, .03, 0);
  } else if (kind === 'ball') {
    add(g, new THREE.SphereGeometry(.30, 20, 16), 0xf36e74, 0, 0, 0);
    add(g, new THREE.SphereGeometry(.08, 8, 8), 0xfffcf2, -.11, .14, .21);
  } else if (kind === 'box') {
    add(g, new THREE.BoxGeometry(.55, .5, .5), 0xc79565, 0, 0, 0);
    add(g, new THREE.BoxGeometry(.60, .08, .55), 0xf0c78a, 0, .28, 0);
  } else if (kind === 'key') {
    const ring = mesh(new THREE.TorusGeometry(.19, .045, 7, 16), 0xffd462);
    ring.position.set(-.19, .16, 0); g.add(ring);
    add(g, new THREE.BoxGeometry(.09, .5, .08), 0xffd462, .12, -.10, 0).rotation.z = -.6;
    add(g, new THREE.BoxGeometry(.16, .08, .08), 0xffd462, .31, -.29, 0);
  }
  return g;
}

function nameTag(label: string) {
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 90;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#14273b'; c.beginPath(); c.roundRect(8, 6, 304, 78, 24); c.fill();
  c.strokeStyle = '#f5e5b6'; c.lineWidth = 4; c.stroke();
  c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#ffffff'; c.fillText(label, 160, 45, 270);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.18, .34, 1);
  return { sprite, texture };
}

/** Reach a world-space object using the rig's two articulated arm segments. */
function aimHand(
  rig: ToonCharacterRig,
  holder: THREE.Group,
  side: 'left' | 'right',
  target: THREE.Vector3,
) {
  const arm = side === 'left' ? rig.leftArm : rig.rightArm;
  // The arm's two segments rotate in the horizontal screen plane (local Z).
  const localTarget = holder.worldToLocal(target.clone());
  const dx = localTarget.x - (side === 'left' ? -.36 : .36);
  const dy = localTarget.y - .3;
  const upper = .42, lower = .43;
  const dist = clamp(Math.hypot(dx, dy), .05, upper + lower - .001);
  const elbow = Math.acos(clamp((dist * dist - upper * upper - lower * lower) / (2 * upper * lower), -1, 1));
  const direction = Math.atan2(dx, -dy);
  const correction = Math.atan2(lower * Math.sin(elbow), upper + lower * Math.cos(elbow));
  arm.root.rotation.set(0, 0, direction - correction);
  arm.elbow?.rotation.set(0, 0, elbow);
}

/**
 * True 3D story stage — separate characters and physical prop in world space.
 * Shared timeline controls body movement, arm contacts and change of ownership.
 */
export class ToonStory3D {
  readonly performers: Performer[] = [];
  readonly prop: THREE.Group;
  private readonly sparks: THREE.Mesh[] = [];
  constructor(readonly story: StoryScene, world: THREE.Group) {
    for (let i = 0; i < story.actors.length; i++) {
      const actor = story.actors[i]!;
      const rig = createCharacterRig({ bodyColor: parseInt(actor.color.slice(1), 16), scale: 1 }, 'none');
      const holder = new THREE.Group();
      holder.add(rig.root);
      const tag = nameTag(actor.name);
      tag.sprite.position.set(0, 1.45, .10); holder.add(tag.sprite);
      world.add(holder);
      this.performers.push({ rig, holder, name: tag.sprite, texture: tag.texture });
    }
    this.prop = objectModel(story.prop);
    world.add(this.prop);
    for (let i = 0; i < 5; i++) {
      const spark = mesh(new THREE.IcosahedronGeometry(.06, 0), 0xffd765);
      spark.visible = false; world.add(spark); this.sparks.push(spark);
    }
  }

  update(local: number, duration: number) {
    const frame = storyFrame(this.story, local, duration);
    const p = clamp(local / Math.max(.1, duration), 0, 1);
    const propPosition = new THREE.Vector3(frame.prop.x / 160, 1.10 - (frame.prop.y + 12) * .0045, .75);
    this.prop.position.copy(propPosition);
    this.prop.rotation.set(0, 0, frame.prop.rotation);
    this.performers.forEach(({ rig, holder }, i) => {
      const actor = frame.actors[i]!;
      holder.position.set(actor.x / 160, 1.44, .65);
      const pose: CharacterPose = actor.moving ? 'running' : actor.reach ? 'holding_prop' : 'idle';
      const info: ToonCharacter = {
        id: this.story.actors[i]!.name,
        pose,
        expression: i === 1 ? 'happy' : 'neutral',
        gaze: actor.reach ? 'lookAtProp' : 'lookAtCamera',
        prop: 'none',
        position: { x: 0, y: 0, z: 0 },
        rotationY: i ? -.08 : .08,
        scale: 1,
      };
      updateCharacterRig(rig, info, local);
      holder.updateWorldMatrix(true, true);
      if (actor.reach) aimHand(rig, holder, actor.reach.side, propPosition);
    });
    const transfer = this.story.action === 'handoff' && p > .50 && p < .73;
    this.sparks.forEach((spark, i) => {
      spark.visible = transfer;
      if (transfer) {
        const phase = (p - .50) / .23, a = i * (Math.PI * 2 / this.sparks.length);
        spark.position.set(
          propPosition.x + Math.cos(a) * (.12 + phase * .4),
          propPosition.y + Math.sin(a) * (.15 + phase * .3),
          .85,
        );
      }
    });
  }

  dispose() {
    for (const actor of this.performers) {
      actor.texture.dispose();
      (actor.name.material as THREE.Material).dispose();
      actor.rig.dispose();
    }
  }
}
