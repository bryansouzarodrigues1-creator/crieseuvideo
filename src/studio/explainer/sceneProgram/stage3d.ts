import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ProgramActor3D } from './actor3d';
import { instantiateModel, type ModelInstance, type PreparedModel } from './modelAssets';
import type { ApprovedModelId } from './modelRegistry';
import { separate, type Body, type Solid } from './separation';
import { InkOutline, skyTexture, toonMaterial } from './look';
import { isKit, kitMesh, terrainHeight, waterMesh, type KitParams, type KitShape, type MeshData } from './scenery';
import { compileSceneProgram, EFFECTORS, SceneProgramError, type SceneProgram, type ProgramSource, type ProgramGeometry, type ProgramState, type Effector } from './score';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** Motion-specific safety gate, not a fixed library of animation actions. */
const needsGroundedClimb = (text: string) => /\b(escal\w*|subi\w*|subiu|subindo|trep\w*|climb\w*)\b/.test(
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
);
const SURFACE_TOLERANCE = .36;

function kitParams(g: ProgramGeometry, color: string): KitParams {
  return { shape: g.shape as KitShape, size: g.size ?? [1], seed: g.seed ?? 1, roughness: g.roughness ?? .5, wave: g.wave ?? 0, segments: g.segments ?? 32, peakColor: g.peakColor ?? '#E8ECEF', foliage: g.foliage ?? '#3F8F4E', color };
}
/** Builds a BufferGeometry from scenery-kit data. Kit meshes carry vertex colours; faceted normals give the low-poly look. */
function kitGeometry(data: MeshData) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3)); geo.setIndex(data.indices);
  if (data.colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  const faceted = geo.toNonIndexed(); faceted.computeVertexNormals(); return faceted;
}
/** Water keeps its indexed grid so the surface can be re-displaced every frame. */
function waterGeometry(p: KitParams) {
  const data = waterMesh(p, 0), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3)); geo.setIndex(data.indices); geo.computeVertexNormals(); return geo;
}
function geometry(g: ProgramGeometry, color = '#ffffff'): THREE.BufferGeometry {
  const d = g.size ?? [];
  if (isKit(g.shape)) return kitGeometry(kitMesh(kitParams(g, color)));
  if (g.shape === 'box') return g.bevel ? new RoundedBoxGeometry(d[0], d[1], d[2], g.bevelSegments ?? 3, g.bevel) : new THREE.BoxGeometry(d[0], d[1], d[2]);
  if (g.shape === 'sphere') return new THREE.SphereGeometry(d[0], 14, 10);
  if (g.shape === 'capsule') return new THREE.CapsuleGeometry(d[0], d[1], 4, 10);
  if (g.shape === 'cone') return new THREE.ConeGeometry(d[0], d[1], 12);
  if (g.shape === 'cylinder') return new THREE.CylinderGeometry(d[0], d[1], d[2], 14);
  if (g.shape === 'plane') return new THREE.PlaneGeometry(d[0], d[1]);
  if (g.shape === 'torus') return new THREE.TorusGeometry(d[0], d[1], 8, 24);
  if (g.shape === 'tube') return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(g.points!.map((p) => new THREE.Vector3(...p))), 48, d[0], 8, false);
  if (g.shape === 'lathe') return new THREE.LatheGeometry(g.profile!.map(([radius, height]) => new THREE.Vector2(radius, height)), g.segments!);
  const mesh = new THREE.BufferGeometry(); mesh.setAttribute('position', new THREE.Float32BufferAttribute(g.vertices!, 3)); mesh.setIndex(g.indices!);
  if (g.colors) mesh.setAttribute('color', new THREE.Float32BufferAttribute(g.colors, 3));
  const faceted = mesh.toNonIndexed(); faceted.computeVertexNormals(); return faceted; // low-poly facets without relying on material flatShading
}

/** Rendering depends exclusively on the serialized graph and absolute time.
 * No script keywords, per-topic scene function, eval, network asset or wall clock. */
export class SceneProgram3D {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(39, 9 / 16, .05, 1500);
  readonly score;
  readonly nodes = new Map<string, THREE.Object3D>();
  readonly actors = new Map<string, ProgramActor3D>();
  readonly importedModels = new Map<string, ModelInstance>();
  readonly ink = new InkOutline();
  private readonly waters = new Map<string, { mesh: THREE.Mesh; params: KitParams }>();
  private states = new Map<string, ProgramState>();
  private time = 0;
  private maxContactError = 0;
  private maxIKError = 0;
  private contactProblems: unknown[] = [];
  private projectedBounds = { min: [0, 0], max: [0, 0] };
  constructor(readonly program: SceneProgram, readonly sources: ProgramSource[], loadedModels: ReadonlyMap<ApprovedModelId, PreparedModel> = new Map()) {
    this.score = compileSceneProgram(program, sources);
    const sky = skyTexture(program.background); this.scene.background = sky.texture; this.scene.fog = new THREE.Fog(sky.fog, 65, 220);
    this.scene.add(new THREE.HemisphereLight(0xe0f0ff, 0x777485, 2.3));
    const key = new THREE.DirectionalLight(0xffe6c3, 3.0); key.position.set(-12, 22, 18); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, far: 90 }); key.shadow.normalBias = .08; key.shadow.bias = -.0015; this.scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xb5dcff, 1.8); rim.position.set(8, 10, -12); this.scene.add(rim);
    for (const n of program.nodes) {
      let root: THREE.Object3D;
      if (n.kind === 'actor') { const index = this.actors.size, repeats = [...this.actors.keys()].filter((id) => this.program.nodes.find((m) => m.id === id)?.color.toLowerCase() === n.color.toLowerCase()).length;
        // Same-colour actors would be indistinguishable: vary the outfit hue and give each a different look.
        const actor = new ProgramActor3D(repeats ? '#' + new THREE.Color(n.color).offsetHSL(.17 * repeats, 0, 0).getHexString() : n.color, index); this.actors.set(n.id, actor); root = actor.root;
        const parts: THREE.Mesh[] = []; actor.root.traverse((o) => { if (o instanceof THREE.Mesh) parts.push(o); }); for (const part of parts) this.ink.attach(part, .1); }
      else if (n.kind === 'model') {
        const loaded = loadedModels.get(n.assetId!);
        if (!loaded) throw new SceneProgramError('O modelo 3D autorizado ainda não foi carregado. Aguarde a importação antes de renderizar.');
        const instance = instantiateModel(loaded);
        this.importedModels.set(n.id, instance); root = instance.root;
      }
      else if (n.kind === 'group') root = new THREE.Group();
      else {
        const opacity = n.material?.opacity ?? 1;
        const kit = isKit(n.geometry!.shape) && n.geometry!.shape !== 'water', geo = n.geometry!.shape === 'water' ? waterGeometry(kitParams(n.geometry!, n.color)) : geometry(n.geometry!, n.color), material = toonMaterial({ color: kit ? '#ffffff' : n.color, opacity, transparent: opacity < 1, depthWrite: opacity === 1,
          emissive: n.material?.emissive ?? '#000000', emissiveIntensity: n.material?.emissiveIntensity ?? 0, vertexColors: !!n.geometry!.colors || kit, side: THREE.DoubleSide, shadowSide: THREE.BackSide });
        if (n.repeat) {
          const instances = new THREE.InstancedMesh(geo, material, n.repeat.count), dummy = new THREE.Object3D(); let seed = n.repeat.seed;
          const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 - .5; };
          const terrain = n.repeat.ground ? program.nodes.find((m) => m.id === n.repeat!.ground)! : undefined;
          const here = this.score.sample(0).get(n.id)!.position, there = terrain ? this.score.sample(0).get(terrain.id)!.position : [0, 0, 0];
          for (let i = 0; i < n.repeat.count; i++) {
            const p = n.repeat.step.map((v, axis) => v * i + random() * n.repeat!.jitter[axis]) as [number, number, number];
            dummy.scale.setScalar(1);
            if (terrain) { // snap to the terrain surface (both nodes must be static); skip spots below the shoreline
              const height = terrainHeight(kitParams(terrain.geometry!, terrain.color), here[0] + p[0] - there[0], here[2] + p[2] - there[2]);
              p[1] = there[1] + height - here[1]; if (height < n.repeat.above!) dummy.scale.setScalar(0);
            }
            dummy.position.set(...p); dummy.updateMatrix(); instances.setMatrixAt(i, dummy.matrix);
          }
          instances.instanceMatrix.needsUpdate = true; root = instances;
        } else root = new THREE.Mesh(geo, material);
        if (n.geometry!.shape === 'water') this.waters.set(n.id, { mesh: root as THREE.Mesh, params: kitParams(n.geometry!, n.color) });
        root.castShadow = opacity === 1; root.receiveShadow = opacity === 1;
        // Ink line only on solid, single meshes: glows, particles and instanced swarms stay clean.
        if (opacity === 1 && !n.repeat && n.geometry!.shape !== 'plane' && !['terrain', 'water', 'cloud'].includes(n.geometry!.shape) && !(n.material?.emissiveIntensity && n.material.emissiveIntensity > .3)) this.ink.attach(root as THREE.Mesh);
      }
      root.name = n.id; this.nodes.set(n.id, root);
    }
    for (const n of program.nodes) {
      const parent = n.parent ? this.actors.get(n.parent)?.socket(n.socket) ?? this.nodes.get(n.parent)! : this.scene;
      parent.add(this.nodes.get(n.id)!);
    }
    this.update(0); this.extendGround();
  }
  /** Finite floors show a hard edge against the sky. A large, static, flat, upright slab is continued by a
   * wide matching disc just below it; fog blends the disc into the horizon. Structure-only: no keywords. */
  private extendGround() {
    const byId = new Map(this.program.nodes.map((n) => [n.id, n])), moving = new Set(this.program.tracks.filter((t) => ['position', 'rotation', 'scale'].includes(t.channel)).map((t) => t.node));
    const isStatic = (id?: string) => { for (let n = id, depth = 0; n && depth < 20; n = byId.get(n)?.parent, depth++) if (moving.has(n)) return false; return true; };
    let best: { top: number; thick: number; center: THREE.Vector3; color: string; object: THREE.Object3D } | undefined;
    for (const n of this.program.nodes) {
      const shape = n.geometry?.shape;
      if (n.kind !== 'mesh' || n.repeat || !shape || !['box', 'cylinder', 'plane'].includes(shape) || (n.material?.opacity ?? 1) < 1 || !isStatic(n.id)) continue;
      const object = this.nodes.get(n.id)!; object.updateWorldMatrix(true, false);
      const up = V(0, shape === 'plane' ? 0 : 1, shape === 'plane' ? 1 : 0).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
      if (up.y < .99) continue;
      const box = new THREE.Box3().setFromObject(object), size = box.getSize(V()), width = Math.min(size.x, size.z), thick = size.y;
      if (width < 10 || width >= 150 || thick > 1.5 || thick > width * .1) continue;
      if (!best || box.max.y < best.top - 1e-6) best = { top: box.max.y, thick, center: box.getCenter(V()), color: n.color, object };
    }
    if (!best) return;
    const line = best.object.getObjectByName('ink'); if (line instanceof THREE.Mesh) { best.object.remove(line); line.geometry.dispose(); } // an ink edge would draw a seam where the slab meets its continuation
    const disc = new THREE.Mesh(new THREE.CircleGeometry(900, 48), toonMaterial({ color: best.color }));
    disc.name = 'horizon-ground'; disc.rotation.x = -Math.PI / 2; disc.position.set(best.center.x, best.top - (best.thick > .06 ? .03 : .008), best.center.z); disc.receiveShadow = true; this.scene.add(disc);
  }
  private solidMeshes: { id: string; object: THREE.Mesh }[] | undefined;
  /** Moves top-level actors out of each other and out of solid props, before contacts are solved. */
  private validating = false;
  private bodyShift = new Map<string, [number, number]>();
  private separateBodies(): boolean {
    this.bodyShift.clear();
    if (this.validating) return false; // validation judges the authored positions, never the corrected ones
    const byId = new Map(this.program.nodes.map((n) => [n.id, n]));
    const actors = [...this.actors.keys()].filter((id) => !byId.get(id)?.parent);
    if (!actors.length) return false;
    this.solidMeshes ??= this.program.nodes.filter((n) => n.kind === 'mesh' && !n.repeat && n.geometry && ['box', 'cylinder', 'sphere', 'capsule', 'cone'].includes(n.geometry.shape) && (n.material?.opacity ?? 1) >= 1)
      .filter((n) => { for (let id: string | undefined = n.id, d = 0; id && d < 20; id = byId.get(id)?.parent, d++) if (byId.get(id)?.kind === 'actor') return false; return true; })
      .map((n) => ({ id: n.id, object: this.nodes.get(n.id) as THREE.Mesh }));
    const solids: Solid[] = [];
    for (const { id, object } of this.solidMeshes) {
      const box = new THREE.Box3().setFromObject(object, false), size = box.getSize(V());
      if (box.max.y < .45 || size.y < .35 && box.min.y < .1 || Math.max(size.x, size.z) > 60) continue; // floors, rugs and low steps are walked on
      solids.push({ id, min: box.min.toArray() as Solid['min'], max: box.max.toArray() as Solid['max'] });
    }
    const bodies: Body[] = actors.map((id) => { const p = this.nodes.get(id)!.getWorldPosition(V()); return { id, x: p.x, z: p.z, y: p.y, radius: .32 }; });
    const targets = (id: string) => new Set(this.score.contacts.filter((c) => c.actor === id).map((c) => c.target));
    const touches = new Map(actors.map((id) => [id, targets(id)]));
    const inside = (solidId: string, ancestors: Set<string>) => { for (let n: string | undefined = solidId, d = 0; n && d < 20; n = byId.get(n)?.parent, d++) if (ancestors.has(n)) return true; return false; };
    const pinned = new Set(actors.filter((id) => this.score.contacts.some((c) => c.actor === id && this.time >= c.start && this.time <= c.finish)));
    const shifts = separate(bodies, solids, {
      pinned,
      ignoreSolid: (bodyId, solidId) => inside(solidId, touches.get(bodyId)!),
      ignorePair: (a, b) => touches.get(a)!.has(b) || touches.get(b)!.has(a),
    });
    for (const [id, [dx, dz]] of shifts) { const object = this.nodes.get(id)!; object.position.x += dx; object.position.z += dz; this.bodyShift.set(id, [dx, dz]); }
    return shifts.size > 0;
  }
  /** Opt-in root adhesion. Motion tracks remain the source of horizontal
   * position and jump offset; the sampled terrain adds only support height.
   * This is not foot IK, collision or terrain navigation. */
  private groundActorsOnTerrain() {
    for (const n of this.program.nodes) {
      if (n.kind !== 'actor' || !n.groundTo) continue;
      const terrain = this.program.nodes.find(t => t.id === n.groundTo)!;
      const actorRoot = this.nodes.get(n.id)!, groundRoot = this.nodes.get(n.groundTo)!;
      const x = actorRoot.position.x - groundRoot.position.x;
      const z = actorRoot.position.z - groundRoot.position.z;
      const size = terrain.geometry!.size!;
      if (Math.abs(x) > size[0] / 2 || Math.abs(z) > size[1] / 2)
        throw new SceneProgramError('O personagem saiu do limite do terreno de apoio.', {
          actor: n.id, terrain: n.groundTo, timeSeconds: this.time, x, z,
        });
      actorRoot.position.y = this.states.get(n.id)!.position[1] + groundRoot.position.y
        + terrainHeight(kitParams(terrain.geometry!, terrain.color), x, z);
    }
  }
  update(time: number) {
    this.time = Number.isFinite(time) ? Math.max(0, Math.min(this.score.duration, time)) : 0;
    this.states = this.score.sample(this.time); this.maxContactError = 0; this.maxIKError = 0; this.contactProblems = [];
    for (const [id, object] of this.nodes) {
      const state = this.states.get(id)!; object.position.set(...state.position); object.rotation.set(...state.rotation); object.scale.set(...state.scale);
      this.actors.get(id)?.reset(state.pose, this.time);
    }
    for (const { mesh, params } of this.waters.values()) {
      const data = waterMesh(params, this.time), position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      position.array.set(data.positions); position.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
    }
    this.groundActorsOnTerrain();
    for (const imported of this.importedModels.values()) imported.setTime(this.time);
    this.scene.updateMatrixWorld(true);
    if (this.separateBodies()) { this.groundActorsOnTerrain(); this.scene.updateMatrixWorld(true); }
    for (const [id, actor] of this.actors) {
      const state = this.states.get(id)!;
      for (const effector of EFFECTORS) {
        const contact = this.score.contacts.filter((c) => c.actor === id && c.effector === effector && this.time >= c.start && this.time <= c.finish).pop();
        const target = contact ? this.nodes.get(contact.target)!.localToWorld(new THREE.Vector3(...contact.offset))
          : state.pose[effector] ? new THREE.Vector3(...state.pose[effector]!).add(V(this.bodyShift.get(id)?.[0] ?? 0, 0, this.bodyShift.get(id)?.[1] ?? 0))
          : effector.endsWith('Foot') ? actor.root.localToWorld(V(effector.startsWith('left') ? -.17 : .17, .06, .07)) : undefined;
        if (target) {
          const error = actor.solve(effector, target); this.maxIKError = Math.max(this.maxIKError, error);
          if (contact) this.maxContactError = Math.max(this.maxContactError, error);
          if (error > .025) this.contactProblems.push({ actor: id, effector, target: contact?.target ?? 'authored-target', desiredWorld: target.toArray(), actorBase: actor.root.getWorldPosition(V()).toArray(), errorMeters: error, ...(contact ? { sourceId: contact.sourceId } : {}) });
        }
        const rotation = state.pose[`${effector}Rotation` as keyof typeof state.pose];
        const end = actor.limbs[effector].hand;
        if (rotation || effector.endsWith('Foot')) {
          const desired = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rotation ?? [0, state.rotation[1], 0])));
          end.quaternion.copy(end.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired));
        }
      }
    }
    this.scene.updateMatrixWorld(true);
  }
  /** Bounded contact audit before accepting an AI-authored preview. Export also
   * checks each actual frame. This is not a semantic or artistic approval. */
  validateContacts() { this.validating = true; try { this.runValidation(); } finally { this.validating = false; } }
  private runValidation() {
    const times = new Set<number>([0, this.score.duration]);
    for (const span of this.score.spans) for (const f of [0, .25, .5, .75, 1]) times.add(span.start + span.duration * f);
    for (const track of this.program.tracks) for (const key of track.keys) { const span = this.score.spans.find((s) => s.sourceId === key.sourceId)!; times.add(span.start + key.phase * span.duration); }
    for (const c of this.score.contacts) for (const f of [0, .25, .5, .75, 1]) times.add(c.start + (c.finish - c.start) * f);
    const samples = [...times].sort((a, b) => a - b);
    for (const time of samples.filter((_, i) => i % Math.max(1, Math.ceil(samples.length / 96)) === 0)) {
      this.update(time); if (this.maxIKError > .025) throw new SceneProgramError('Um alvo de mão ou pé do programa está fora do alcance do personagem. Ajuste a trajetória do corpo ou o ponto de apoio.', { timeSeconds: time, duration: this.score.duration, problems: this.contactProblems.slice(0, 4) });
    }
    this.validateGroundedAscent();
    this.update(0);
  }

  /**
   * Physical staging QA for genuinely ascending human characters. Reaching an
   * IK target is not evidence of a planted hand/foot or a collision-free climb.
   * Examines actual Three.js world transforms, not text-keyword props.
   */
  private validateGroundedAscent() {
    for (const span of this.score.spans) {
      const source = this.sources.find((s) => s.sourceId === span.sourceId);
      if (!source || !needsGroundedClimb(source.text)) continue;
      for (const [actorId, actor] of this.actors) {
        const samples: Array<{ time: number; height: number }> = [];
        for (let i = 0; i <= 30; i++) {
          const time = span.start + span.duration * (i / 30);
          this.update(time);
          samples.push({ time, height: actor.root.getWorldPosition(V()).y });
        }
        const ascent = Math.max(...samples.map((s) => s.height)) - samples[0].height;
        if (ascent < .35) continue; // A static or already-summited character isn't climbing here.
        const contacts = this.score.contacts.filter((c) => c.actor === actorId && c.sourceId === span.sourceId);
        const hands = contacts.filter((c) => c.effector.endsWith('Hand'));
        const feet = contacts.filter((c) => c.effector.endsWith('Foot'));
        const supportSamples = samples.filter(({ time }) => contacts.some((c) => time >= c.start - 1e-5 && time <= c.finish + 1e-5));
        if (!hands.length || !feet.length || supportSamples.length < Math.ceil(samples.length * .65)) {
          throw new SceneProgramError(
            'A escalada move o corpo para cima sem apoios suficientes de mãos e pés. Programe contatos alternados com a superfície e apoios estáveis durante a subida.',
            { kind: 'missing_climb_support', sourceId: span.sourceId, actor: actorId, ascentMeters: ascent, handContacts: hands.length, footContacts: feet.length, coverage: supportSamples.length / samples.length },
          );
        }

        // IK may reach a point hidden deep inside a rock. Require declared
        // contact offsets to be near a visible boundary of their target.
        for (const contact of contacts) {
          this.update((contact.start + contact.finish) / 2);
          const object = this.nodes.get(contact.target)!;
          const bounds = new THREE.Box3().setFromObject(object);
          const point = object.localToWorld(new THREE.Vector3(...contact.offset));
          if (bounds.isEmpty()) continue;
          const surfaceDistance = Math.min(
            Math.abs(point.x - bounds.min.x), Math.abs(point.x - bounds.max.x),
            Math.abs(point.y - bounds.min.y), Math.abs(point.y - bounds.max.y),
            Math.abs(point.z - bounds.min.z), Math.abs(point.z - bounds.max.z),
          );
          const outside = bounds.distanceToPoint(point);
          if (outside > SURFACE_TOLERANCE || surfaceDistance > SURFACE_TOLERANCE) {
            throw new SceneProgramError(
              'Um apoio da escalada não toca a superfície do objeto. Posicione mãos e pés sobre pontos reais da geometria, não dentro da rocha ou no ar.',
              { kind: 'unsupported_contact_surface', sourceId: span.sourceId, actor: actorId, effector: contact.effector, target: contact.target, surfaceDistanceMeters: surfaceDistance, outsideMeters: outside },
            );
          }
        }
        for (const sample of samples) {
          this.update(sample.time);
          this.rejectSolidAscentPenetration(span.sourceId, actorId);
        }
      }
    }
  }

  /** Conservative check: a character's foot/base must not pass through the
   * interior of a substantial box platform during an explicitly grounded climb.
   * Only simple box solids are audited; detailed meshes require future physics.
   */
  private rejectSolidAscentPenetration(sourceId: string, actorId: string) {
    const actor = this.actors.get(actorId);
    if (!actor) return;
    this.scene.updateMatrixWorld(true);
    const footBase = actor.root.getWorldPosition(V());
    for (const node of this.program.nodes) {
      if (node.kind !== 'mesh' || node.geometry?.shape !== 'box' || node.material?.opacity && node.material.opacity < 1) continue;
      if (node.repeat || node.geometry.size!.some((v) => v <= .16)) continue;
      let parent = node.parent, attached = false;
      while (parent) {
        const ancestor = this.program.nodes.find((candidate) => candidate.id === parent);
        if (ancestor?.kind === 'actor') { attached = true; break; }
        parent = ancestor?.parent;
      }
      if (attached) continue;
      const object = this.nodes.get(node.id)!;
      const box = new THREE.Box3().setFromObject(object);
      const margin = .075;
      if (footBase.x > box.min.x + margin && footBase.x < box.max.x - margin &&
          footBase.y > box.min.y + margin && footBase.y < box.max.y - margin &&
          footBase.z > box.min.z + margin && footBase.z < box.max.z - margin) {
        throw new SceneProgramError(
          'O personagem atravessa uma plataforma sólida durante a escalada. Ajuste a trajetória do corpo e apoie os pés na superfície, sem atravessar o objeto.',
          { kind: 'solid_platform_penetration', sourceId, actor: actorId, target: node.id, timeSeconds: this.time, actorFootBase: footBase.toArray(), solidBounds: { min: box.min.toArray(), max: box.max.toArray() } },
        );
      }
    }
  }

  frame(aspect: number) {
    const { span, shot } = this.score.shot(this.time), box = new THREE.Box3();
    for (const id of shot.subjects) box.union(new THREE.Box3().setFromObject(this.nodes.get(id)!));
    if (box.isEmpty()) throw new SceneProgramError('A câmera não encontrou geometria para enquadrar.');
    box.expandByScalar(.13);
    const look = box.getCenter(V()), u = THREE.MathUtils.clamp((this.time - span.start) / span.duration, 0, 1);
    const angle = shot.azimuth + (shot.endAzimuth - shot.azimuth) * u;
    const direction = V(Math.sin(angle) * Math.cos(shot.elevation), Math.sin(shot.elevation), Math.cos(angle) * Math.cos(shot.elevation));
    const points: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(V(x, y, z));
    this.camera.aspect = aspect; this.camera.near = .05; this.camera.far = 1500; this.camera.updateProjectionMatrix(); // wide range while searching the distance
    const fit = (distance: number) => {
      this.camera.position.copy(look).addScaledVector(direction, distance); this.camera.lookAt(look); this.camera.updateMatrixWorld(true);
      return points.every((p) => { const n = p.clone().project(this.camera); return n.z > -1 && n.z < 1 && Math.abs(n.x) <= .88 && n.y >= -.63 && n.y <= .86; });
    };
    let lo = .2, hi = 1400;
    if (!fit(hi)) throw new SceneProgramError('A cena excedeu os limites de enquadramento.');
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (fit(mid)) hi = mid; else lo = mid; }
    fit(hi * shot.distance);
    // Depth precision follows the shot: a fixed 0.05..1500 range makes overlapping surfaces shimmer.
    const view = this.camera.matrixWorldInverse, depth = Math.min(...points.map((p) => -p.clone().applyMatrix4(view).z)), dist = this.camera.position.distanceTo(look);
    this.camera.near = THREE.MathUtils.clamp(Math.min(dist * .04, depth * .5), .05, 6); this.camera.far = Math.max(400, dist * 30); this.camera.updateProjectionMatrix();
    // Haze follows the shot: a wide landscape framed from 200 m must not be swallowed by fog that suits a 10 m room.
    if (this.scene.fog instanceof THREE.Fog) { this.scene.fog.near = Math.max(65, dist * 1.5); this.scene.fog.far = Math.max(220, dist * 6); }
    const projected = points.map((p) => p.clone().project(this.camera));
    this.projectedBounds = { min: [Math.min(...projected.map((p) => p.x)), Math.min(...projected.map((p) => p.y))], max: [Math.max(...projected.map((p) => p.x)), Math.max(...projected.map((p) => p.y))] };
  }
  render(renderer: THREE.WebGLRenderer, time: number, w: number, h: number) {
    this.update(time); if (this.maxIKError > .025) throw new SceneProgramError('Um alvo corporal saiu do alcance neste quadro. O vídeo não será exportado com essa falha.');
    const span = this.score.shot(this.time).span, source = this.sources.find((s) => s.sourceId === span.sourceId);
    if (source && needsGroundedClimb(source.text)) {
      for (const id of this.actors.keys()) this.rejectSolidAscentPenetration(span.sourceId, id);
    }
    this.frame(w / h); this.ink.resize(w, h); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.03; renderer.render(this.scene, this.camera);
  }
  diagnostics() {
    return { engine: 'scene-program3d', board: false, nodes: this.program.nodes.length, curves: this.program.tracks.length, contacts: this.program.contacts.length, verifiedMotionChecks: this.program.motionChecks?.length ?? 0, time: this.time, maxContactError: this.maxContactError, maxIKError: this.maxIKError,
      projectedBounds: this.projectedBounds, camera: this.camera.position.toArray(), states: [...this.states].map(([id, s]) => ({ id, ...s })) };
  }
  dispose() {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.scene.traverse((node) => { if (node instanceof THREE.InstancedMesh) node.dispose(); if (node instanceof THREE.Mesh) { geometries.add(node.geometry); for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m); } if (node instanceof THREE.DirectionalLight) node.shadow.map?.dispose(); });
    geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); this.scene.clear(); this.nodes.clear(); this.actors.clear(); this.importedModels.clear();
  }
}
