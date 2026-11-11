import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { StickmanScene } from '../types/stickman';

class ImportedModelStage {
  private renderer?: THREE.WebGLRenderer;
  private world?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private model?: THREE.Group;
  private mixer?: THREE.AnimationMixer;
  private clips: THREE.AnimationClip[] = [];
  private url = '';
  private animation = '';
  private error = '';
  private generation = 0;
  private loader = new GLTFLoader();

  private disposeModel(model: THREE.Object3D) {
    const textures = new Set<THREE.Texture>();
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
    });
    textures.forEach(texture => texture.dispose());
  }

  private load(url: string) {
    this.url = url;
    this.error = '';
    this.animation = '';
    const generation = ++this.generation;
    this.mixer?.stopAllAction();
    if (this.model) {
      this.world?.remove(this.model);
      this.disposeModel(this.model);
      this.model = undefined;
    }
    this.loader.load(url, (gltf: GLTF) => {
      if (generation !== this.generation) { this.disposeModel(gltf.scene); return; }
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 3 / Math.max(size.x, size.y, size.z, 0.001);
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      const root = new THREE.Group();
      root.add(model);
      this.model = root;
      this.clips = gltf.animations;
      this.mixer = new THREE.AnimationMixer(model);
      this.world?.add(root);
    }, undefined, () => { if (generation === this.generation) this.error = 'Não foi possível abrir este modelo.'; });
  }

  render(ctx: CanvasRenderingContext2D, scene: StickmanScene, time: number) {
    const asset = scene.importedModel;
    if (!asset) return false;
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(1);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.world = new THREE.Scene();
      this.world.background = new THREE.Color('#d6e4e1');
      this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 100);
      this.world.add(new THREE.HemisphereLight('#ffffff', '#6a7f78', 0.8));
      const key = new THREE.DirectionalLight('#fff1db', 1.8);
      key.position.set(4, 7, 5);
      this.world.add(key);
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.world.environment = pmrem.fromScene(room).texture;
      room.dispose();
      pmrem.dispose();
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = '#bdceca'; g.fillRect(0, 0, 128, 128);
        g.strokeStyle = '#a3bbb4'; g.strokeRect(0, 0, 128, 128);
      }
      const texture = new THREE.CanvasTexture(c);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(30, 30);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.01;
      this.world.add(ground);
    }
    const renderer = this.renderer, world = this.world, camera = this.camera;
    if (!world || !camera) return false;
    if (this.url !== asset.url) this.load(asset.url);
    renderer.setSize(ctx.canvas.width, ctx.canvas.height, false);
    camera.aspect = ctx.canvas.width / ctx.canvas.height;
    camera.position.set(0, 2.3, camera.aspect < 1 ? 12 : 8);
    camera.lookAt(0, 1.5, 0);
    camera.updateProjectionMatrix();
    if (this.model) {
      this.model.rotation.y = asset.rotation * Math.PI / 180;
      this.model.scale.setScalar(asset.scale);
      if (this.animation !== asset.animation) {
        this.mixer?.stopAllAction();
        const clip = this.clips.find(c => c.name === asset.animation);
        if (clip) this.mixer?.clipAction(clip).play();
        this.animation = asset.animation;
      }
      this.mixer?.setTime(time);
    }
    renderer.render(world, camera);
    ctx.drawImage(renderer.domElement, 0, 0);
    if (!this.model) {
      ctx.fillStyle = '#223d37'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(this.error || 'Carregando modelo…', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
    return Boolean(this.model);
  }
}

export const importedModelStage = new ImportedModelStage();