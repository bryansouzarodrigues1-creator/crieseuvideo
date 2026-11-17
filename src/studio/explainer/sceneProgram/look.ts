import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Shared "toon" look for SceneProgram scenes: cel-shaded surfaces, constant-width
 * ink outline, sky gradient and atmospheric fog. Purely visual: nothing here reads
 * the script or changes the validated program, timing or contacts. */
export const INK = 0x1b1722;

let ramp: THREE.DataTexture | null = null;
/** Four-step light ramp (shadow, mid, light, highlight). */
export function toonRamp() {
  if (ramp) return ramp;
  ramp = new THREE.DataTexture(new Uint8Array([84, 148, 214, 255]), 4, 1, THREE.RedFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true; return ramp;
}
export function toonMaterial(params: THREE.MeshToonMaterialParameters) {
  return new THREE.MeshToonMaterial({ ...params, gradientMap: toonRamp() });
}

/** Vertical sky: deeper at the top, lighter and slightly hazier at the horizon.
 * Dark (night/space) backgrounds keep their mood and only gain a subtle glow. */
export function skyStops(hex: string) {
  const base = new THREE.Color(hex), hsl = { h: 0, s: 0, l: 0 }; base.getHSL(hsl, THREE.SRGBColorSpace);
  const dark = hsl.l < .28;
  const top = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.08), dark ? hsl.l * .72 : hsl.l * .84, THREE.SRGBColorSpace);
  const bottom = new THREE.Color().setHSL(hsl.h, hsl.s * (dark ? 1 : .82), dark ? Math.min(.5, hsl.l + .07) : hsl.l + (1 - hsl.l) * .38, THREE.SRGBColorSpace);
  return { top, bottom };
}
export function skyTexture(hex: string) {
  const { top, bottom } = skyStops(hex), rows = 64, data = new Uint8Array(rows * 4), c = new THREE.Color();
  for (let y = 0; y < rows; y++) {
    const t = y / (rows - 1); c.copy(bottom).lerp(top, t * t * (3 - 2 * t)); // row 0 = bottom of the screen
    const s = c.clone().convertLinearToSRGB(); data.set([Math.round(s.r * 255), Math.round(s.g * 255), Math.round(s.b * 255), 255], y * 4);
  }
  const texture = new THREE.DataTexture(data, 1, rows, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return { texture, fog: bottom.clone() };
}

/** Inverted hull that is extruded in screen space, so the ink line keeps the same
 * pixel width at any distance or export resolution. */
export class InkOutline {
  readonly material = new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false,
    uniforms: { uInk: { value: new THREE.Color(INK) }, uThickness: { value: .006 }, uAspect: { value: 9 / 16 } },
    vertexShader: `uniform float uThickness; uniform float uAspect;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 vn = normalize(normalMatrix * normal);
        vec2 cn = (projectionMatrix * vec4(vn, 0.0)).xy;
        vec2 d = normalize(vec2(cn.x * uAspect, cn.y) + vec2(1e-6));
        clip.xy += vec2(d.x / uAspect, d.y) * uThickness * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: `uniform vec3 uInk;
      void main() { gl_FragColor = vec4(uInk, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  /** Pixel width of the line for an output of w x h pixels. */
  resize(w: number, h: number) {
    const px = Math.max(1.6, Math.min(w, h) / 250);
    this.material.uniforms.uThickness.value = px * 2 / h; this.material.uniforms.uAspect.value = w / h;
  }
  /** Smooth-normal copy of the geometry (hard edges welded), so corners stay closed. */
  hull(geometry: THREE.BufferGeometry) {
    const copy = geometry.clone(); for (const name of ['normal', 'uv', 'uv1', 'color']) copy.deleteAttribute(name);
    const welded = mergeVertices(copy, 1e-4); welded.computeVertexNormals(); return new THREE.Mesh(welded, this.material);
  }
  /** Adds an outline child to a mesh. Ignores tiny parts, which would turn into blobs. */
  attach(mesh: THREE.Mesh, minRadius = 0) {
    mesh.geometry.computeBoundingSphere();
    const scale = mesh.getWorldScale(new THREE.Vector3()), r = (mesh.geometry.boundingSphere?.radius ?? 0) * Math.max(scale.x, scale.y, scale.z);
    if (r < minRadius) return;
    const hull = this.hull(mesh.geometry); hull.name = 'ink'; hull.castShadow = false; hull.receiveShadow = false; mesh.add(hull);
  }
}
