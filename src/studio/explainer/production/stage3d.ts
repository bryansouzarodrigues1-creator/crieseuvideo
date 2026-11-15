import * as THREE from 'three';
import { buildArticulatedAsset, constructionEnvironment, ModelBatch, type ArticulatedAsset } from './assets3d';
import { compileProduction, socketWorld, type ProductionProgram, type ProductionSource, type AssetState } from './score';

/** Full-world production stage: assets and state persist across narration beats. */
export class Production3D {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 9 / 16, .08, 260);
  readonly score;
  readonly assets = new Map<string, ArticulatedAsset>();
  private time = 0;
  private states = new Map<string, AssetState>();
  private frameBounds = new THREE.Box3();
  constructor(readonly program: ProductionProgram, readonly sources: ProductionSource[]) {
    this.score = compileProduction(program, sources);
    const studio = program.world === 'studio';
    this.scene.background = new THREE.Color(studio ? 0xe5e7dc : 0x9ccde1);
    this.scene.fog = new THREE.Fog(this.scene.background, studio ? 18 : 48, studio ? 55 : 155);
    this.scene.add(new THREE.HemisphereLight(0xe9f6ff, studio ? 0xa69c89 : 0xb7a77c, 2.1));
    const sun = new THREE.DirectionalLight(0xffeed3, 3.3); sun.position.set(-10, 24, 18); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
    sun.shadow.bias = -.0002; sun.shadow.normalBias = .025; sun.shadow.radius = 3; this.scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0xb9ddf0, 1.2); fill.position.set(10, 10, -13); this.scene.add(fill);
    if (studio) {
      const set = new ModelBatch(this.scene); set.box([120, .15, 120], [0, -.10, 0], 0xd7ddcf); set.finish();
    } else constructionEnvironment(this.scene);
    for (const definition of program.assets) { const asset = buildArticulatedAsset(definition); this.assets.set(definition.id, asset); this.scene.add(asset.root); }
    this.update(0);
  }
  update(time: number) {
    this.time = Math.max(0, Math.min(this.score.duration, Number.isFinite(time) ? time : 0));
    this.states = this.score.sample(this.time);
    for (const [id, asset] of this.assets) {
      const state = this.states.get(id)!;
      if (asset.definition.kind === 'person' && !this.score.tracks.some((t) => t.asset === id && t.channel === 'talk')) {
        const span = this.score.spans.find((s, i) => this.time < s.start + s.duration || i === this.score.spans.length - 1), voice = this.sources.find((s) => s.sourceId === span?.sourceId)?.voice;
        const local = this.time - (span?.start ?? 0);
        state.joints.talk = voice && local >= voice.start && local <= voice.end ? .5 : 0;
      }
      let vx = 0, vz = 0, travel = 0;
      for (const track of this.score.tracks) if (track.asset === id && ['x', 'z'].includes(track.channel)) {
        const phase = Math.max(0, Math.min(1, (this.time - track.start) / (track.finish - track.start)));
        const smooth = phase ** 3 * (phase * (phase * 6 - 15) + 10);
        const speed = (track.to - track.from) / (track.finish - track.start) * 30 * phase ** 2 * (phase - 1) ** 2;
        if (track.channel === 'x') vx += speed; else vz += speed;
        travel += Math.abs(track.to - track.from) * smooth;
      }
      const speed = Math.hypot(vx, vz);
      asset.update(state, this.time, speed, travel);
      if (asset.rig && speed > .001) asset.root.rotation.y = Math.atan2(vx, vz);
    }
    this.scene.updateMatrixWorld(true);
  }
  private frame(aspect: number) {
    const shot = this.score.shot(this.time), subject = shot ? this.assets.get(shot.subject) : this.assets.values().next().value;
    if (!subject) return;
    const state = this.states.get(subject.definition.id)!;
    const span = this.score.spans.find((s, i) => this.time < s.start + s.duration || i === this.score.spans.length - 1)!;
    const progress = Math.max(0, Math.min(1, (this.time - span.start) / span.duration));
    const port = socketWorld(subject.definition, state, shot?.socket ?? 'origin');
    const box = new THREE.Box3();
    const fitBoxes: THREE.Box3[] = [];
    if (shot?.kind === 'detail' || shot?.kind === 'follow') {
      const human = !!subject.rig;
      const center = new THREE.Vector3(...port.position);
      const size = human ? new THREE.Vector3(1.65, 2.3, 1.3) : new THREE.Vector3(3.8, 3.4, 3.4);
      if (human && shot.socket === 'origin') center.y += 1.4;
      else if (human) center.y -= .3;
      else if (shot.socket === 'hook') center.y -= .50;
      else if (subject.definition.kind === 'lift' && shot.socket === 'platform') center.y += 1;
      box.setFromCenterAndSize(center, size);
      if (subject.definition.kind === 'truck') {
        box.setFromObject(subject.root);
        for (const b of this.score.bindings) if (b.parent === subject.definition.id && b.time <= this.time) box.union(new THREE.Box3().setFromObject(this.assets.get(b.child)!.root));
        box.expandByScalar(.25);
      }
      if (subject.definition.kind === 'tower_crane' && shot.socket === 'trolley') {
        const hook = socketWorld(subject.definition, state, 'hook');
        box.expandByPoint(new THREE.Vector3(...hook.position).add(new THREE.Vector3(0, -1.4, 0)));
      }
    } else {
      box.setFromObject(subject.root);
      // Contextual wide views include the cargo and transport, never the huge sky/floor.
      fitBoxes.push(new THREE.Box3().setFromObject(subject.root).expandByScalar(.25));
      if (subject.definition.kind === 'tower_crane') for (const asset of this.assets.values()) if (asset !== subject && asset.definition.kind !== 'worker') {
        const part = new THREE.Box3().setFromObject(asset.root).expandByScalar(.25); box.union(part); fitBoxes.push(part);
      }
      box.expandByScalar(.25);
    }
    this.frameBounds.copy(box);
    const size = box.getSize(new THREE.Vector3()), look = box.getCenter(new THREE.Vector3());
    look.y -= size.y * .10;
    const human = !!subject.rig;
    const angle = human ? state.yaw + .12 + .08 * progress : shot?.kind === 'orbit' ? .68 + progress * .42 : .55 - progress * .06;
    const direction = new THREE.Vector3(Math.sin(angle), human ? .08 : .30, Math.cos(angle)).normalize();
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
    const corners: THREE.Vector3[] = [];
    for (const bounds of fitBoxes.length ? fitBoxes : [box]) for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
    const fits = (distance: number) => {
      this.camera.position.copy(look).addScaledVector(direction, distance); this.camera.lookAt(look); this.camera.updateMatrixWorld(true);
      return corners.every((corner) => { const p = corner.clone().project(this.camera); return p.z > -1 && p.z < 1 && Math.abs(p.x) < .88 && p.y > -.62 && p.y < .91; });
    };
    let lo = .4, hi = 180;
    for (let i = 0; i < 17; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    fits(hi * 1.012);
  }
  render(renderer: THREE.WebGLRenderer, time: number, width: number, height: number) {
    this.update(time); this.frame(width / height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.render(this.scene, this.camera);
  }
  diagnostics() {
    return { engine: 'production3d', world: this.program.world, assets: this.program.assets.map((a) => ({ id: a.id, kind: a.kind, ...this.states.get(a.id) })),
      tracks: this.score.tracks.length, couplings: this.score.bindings.length, shots: this.program.shots.length,
      maxContactError: Math.max(0, ...this.score.bindings.map((b) => b.contactError)),
      frameBounds: { min: this.frameBounds.min.toArray(), max: this.frameBounds.max.toArray() },
      camera: { position: this.camera.position.toArray(), look: this.camera.getWorldDirection(new THREE.Vector3()).toArray() },
      board: false };
  }
  dispose() {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.scene.traverse((object) => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); } });
    geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
    for (const light of this.scene.children) if (light instanceof THREE.DirectionalLight) light.shadow.map?.dispose();
    this.scene.clear(); this.assets.clear();
  }
}
