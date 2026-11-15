import * as THREE from 'three';
import { ProgramActor3D } from './actor3d';
import { compileSceneProgram, EFFECTORS, SceneProgramError, type SceneProgram, type ProgramSource, type ProgramGeometry, type ProgramState, type Effector } from './score';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function geometry(g: ProgramGeometry): THREE.BufferGeometry {
  const d = g.size ?? [];
  if (g.shape === 'box') return new THREE.BoxGeometry(d[0], d[1], d[2]);
  if (g.shape === 'sphere') return new THREE.SphereGeometry(d[0], 14, 10);
  if (g.shape === 'capsule') return new THREE.CapsuleGeometry(d[0], d[1], 4, 10);
  if (g.shape === 'cone') return new THREE.ConeGeometry(d[0], d[1], 12);
  if (g.shape === 'cylinder') return new THREE.CylinderGeometry(d[0], d[1], d[2], 14);
  if (g.shape === 'plane') return new THREE.PlaneGeometry(d[0], d[1]);
  if (g.shape === 'torus') return new THREE.TorusGeometry(d[0], d[1], 8, 24);
  if (g.shape === 'tube') return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(g.points!.map((p) => new THREE.Vector3(...p))), 48, d[0], 8, false);
  const mesh = new THREE.BufferGeometry(); mesh.setAttribute('position', new THREE.Float32BufferAttribute(g.vertices!, 3)); mesh.setIndex(g.indices!);
  if (g.colors) mesh.setAttribute('color', new THREE.Float32BufferAttribute(g.colors, 3)); mesh.computeVertexNormals(); return mesh;
}

/** Rendering depends exclusively on the serialized graph and absolute time.
 * No script keywords, per-topic scene function, eval, network asset or wall clock. */
export class SceneProgram3D {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(39, 9 / 16, .05, 1500);
  readonly score;
  readonly nodes = new Map<string, THREE.Object3D>();
  readonly actors = new Map<string, ProgramActor3D>();
  private states = new Map<string, ProgramState>();
  private time = 0;
  private maxContactError = 0;
  private maxIKError = 0;
  private projectedBounds = { min: [0, 0], max: [0, 0] };
  constructor(readonly program: SceneProgram, sources: ProgramSource[]) {
    this.score = compileSceneProgram(program, sources);
    this.scene.background = new THREE.Color(program.background); this.scene.fog = new THREE.Fog(program.background, 65, 220);
    this.scene.add(new THREE.HemisphereLight(0xe0f0ff, 0x777485, 2.3));
    const key = new THREE.DirectionalLight(0xffe6c3, 3.0); key.position.set(-12, 22, 18); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, far: 90 }); key.shadow.normalBias = .025; key.shadow.bias = -.0002; this.scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xb5dcff, 1.8); rim.position.set(8, 10, -12); this.scene.add(rim);
    for (const n of program.nodes) {
      let root: THREE.Object3D;
      if (n.kind === 'actor') { const actor = new ProgramActor3D(n.color); this.actors.set(n.id, actor); root = actor.root; }
      else if (n.kind === 'group') root = new THREE.Group();
      else {
        const geo = geometry(n.geometry!), material = new THREE.MeshStandardMaterial({ color: n.color, roughness: .85, flatShading: n.geometry!.shape === 'mesh', vertexColors: !!n.geometry!.colors, side: THREE.DoubleSide });
        if (n.repeat) {
          const instances = new THREE.InstancedMesh(geo, material, n.repeat.count), dummy = new THREE.Object3D(); let seed = n.repeat.seed;
          const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 - .5; };
          for (let i = 0; i < n.repeat.count; i++) { dummy.position.set(...n.repeat.step.map((v, axis) => v * i + random() * n.repeat!.jitter[axis]) as [number, number, number]); dummy.updateMatrix(); instances.setMatrixAt(i, dummy.matrix); }
          instances.instanceMatrix.needsUpdate = true; root = instances;
        } else root = new THREE.Mesh(geo, material);
        root.castShadow = true; root.receiveShadow = true;
      }
      root.name = n.id; this.nodes.set(n.id, root);
    }
    for (const n of program.nodes) {
      const parent = n.parent ? this.actors.get(n.parent)?.socket(n.socket) ?? this.nodes.get(n.parent)! : this.scene;
      parent.add(this.nodes.get(n.id)!);
    }
    this.update(0);
  }
  update(time: number) {
    this.time = Number.isFinite(time) ? Math.max(0, Math.min(this.score.duration, time)) : 0;
    this.states = this.score.sample(this.time); this.maxContactError = 0; this.maxIKError = 0;
    for (const [id, object] of this.nodes) {
      const state = this.states.get(id)!; object.position.set(...state.position); object.rotation.set(...state.rotation); object.scale.set(...state.scale);
      this.actors.get(id)?.reset(state.pose, this.time);
    }
    this.scene.updateMatrixWorld(true);
    for (const [id, actor] of this.actors) {
      const state = this.states.get(id)!;
      for (const effector of EFFECTORS) {
        const contact = this.score.contacts.filter((c) => c.actor === id && c.effector === effector && this.time >= c.start && this.time <= c.finish).pop();
        const target = contact ? this.nodes.get(contact.target)!.localToWorld(new THREE.Vector3(...contact.offset))
          : state.pose[effector] ? new THREE.Vector3(...state.pose[effector]!)
          : effector.endsWith('Foot') ? actor.root.localToWorld(V(effector.startsWith('left') ? -.17 : .17, .06, .07)) : undefined;
        if (target) { const error = actor.solve(effector, target); this.maxIKError = Math.max(this.maxIKError, error); if (contact) this.maxContactError = Math.max(this.maxContactError, error); }
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
  validateContacts() {
    const times = new Set<number>([0, this.score.duration]);
    for (const c of this.score.contacts) for (const f of [0, .25, .5, .75, 1]) times.add(c.start + (c.finish - c.start) * f);
    const samples = [...times].sort((a, b) => a - b);
    for (const time of samples.filter((_, i) => i % Math.max(1, Math.ceil(samples.length / 96)) === 0)) {
      this.update(time); if (this.maxContactError > .025) throw new SceneProgramError('Um contato do programa está fora do alcance do personagem. Ajuste a trajetória do corpo ou o ponto de apoio.');
    }
    this.update(0);
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
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
    const fit = (distance: number) => {
      this.camera.position.copy(look).addScaledVector(direction, distance); this.camera.lookAt(look); this.camera.updateMatrixWorld(true);
      return points.every((p) => { const n = p.clone().project(this.camera); return n.z > -1 && n.z < 1 && Math.abs(n.x) <= .88 && n.y >= -.63 && n.y <= .86; });
    };
    let lo = .2, hi = 1400;
    if (!fit(hi)) throw new SceneProgramError('A cena excedeu os limites de enquadramento.');
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (fit(mid)) hi = mid; else lo = mid; }
    fit(hi * shot.distance);
    const projected = points.map((p) => p.clone().project(this.camera));
    this.projectedBounds = { min: [Math.min(...projected.map((p) => p.x)), Math.min(...projected.map((p) => p.y))], max: [Math.max(...projected.map((p) => p.x)), Math.max(...projected.map((p) => p.y))] };
  }
  render(renderer: THREE.WebGLRenderer, time: number, w: number, h: number) {
    this.update(time); if (this.maxContactError > .025) throw new SceneProgramError('O contato físico saiu do alcance neste quadro. O vídeo não será exportado com essa falha.');
    this.frame(w / h); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.03; renderer.render(this.scene, this.camera);
  }
  diagnostics() {
    return { engine: 'scene-program3d', board: false, nodes: this.program.nodes.length, curves: this.program.tracks.length, contacts: this.program.contacts.length, time: this.time, maxContactError: this.maxContactError, maxIKError: this.maxIKError,
      projectedBounds: this.projectedBounds, camera: this.camera.position.toArray(), states: [...this.states].map(([id, s]) => ({ id, ...s })) };
  }
  dispose() {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.scene.traverse((node) => { if (node instanceof THREE.InstancedMesh) node.dispose(); if (node instanceof THREE.Mesh) { geometries.add(node.geometry); for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m); } if (node instanceof THREE.DirectionalLight) node.shadow.map?.dispose(); });
    geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); this.scene.clear(); this.nodes.clear(); this.actors.clear();
  }
}
