/** Parametric scenery generators (terrain, water, tree, rock, cloud). Pure and deterministic: the same numbers
 * always produce the same mesh, with no randomness source other than the explicit seed. The model describes a
 * place in a few parameters instead of listing thousands of vertices. */
export interface MeshData { positions: number[]; indices: number[]; colors?: number[] }
export const KIT_SHAPES = ['terrain', 'water', 'tree', 'rock', 'cloud'] as const;
export type KitShape = typeof KIT_SHAPES[number];
export const isKit = (shape: string): shape is KitShape => (KIT_SHAPES as readonly string[]).includes(shape);

export interface KitParams { shape: KitShape; size: number[]; seed: number; roughness: number; wave: number; segments: number; peakColor: string; foliage: string; color: string }

const srgbToLinear = (c: number) => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
export function linear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16); return [srgbToLinear((n >> 16 & 255) / 255), srgbToLinear((n >> 8 & 255) / 255), srgbToLinear((n & 255) / 255)];
}
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Integer lattice hash in [0, 1). */
function hash(ix: number, iz: number, seed: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed + 1, 2147483647); h = Math.imul(h ^ h >>> 13, 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function valueNoise(x: number, z: number, seed: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, z: number, seed: number, octaves = 4) {
  let sum = 0, amp = .5, norm = 0;
  for (let o = 0; o < octaves; o++) { sum += valueNoise(x, z, seed + o * 17) * amp; norm += amp; x *= 2.03; z *= 2.03; amp *= .5; }
  return sum / norm;
}

/** Island mask: 1 inland, 0 at the coast. The distance from the centre is warped by noise so the coast is irregular
 * instead of a rectangle, and the land never reaches the border of its square. */
function coast(p: Pick<KitParams, 'seed'>, u: number, v: number) {
  const r = Math.hypot(u - .5, v - .5) * 2 * (1 + .45 * (fbm(u * 3.1 + 7, v * 3.1 + 3, p.seed + 5, 3) - .5));
  return { land: 1 - smoothstep(.5, .92, r), sink: smoothstep(.8, 1.05, r) };
}
/** Land height above the terrain base at local (x, z); 0 at the coast so it blends into the water around it. */
export function terrainHeight(p: Pick<KitParams, 'size' | 'seed' | 'roughness'>, x: number, z: number): number {
  const [width, depth, height] = p.size, u = x / width + .5, v = z / depth + .5;
  const n = fbm(u * (3 + p.roughness * 5), v * (3 + p.roughness * 5), p.seed), bump = Math.max(0, 1 - Math.hypot(u - .5, v - .5) * 1.7);
  return Math.min(1, Math.max(0, ((.3 + .7 * p.roughness) * n * 1.25 + (1 - .6 * p.roughness) * bump * .75) * .78)) * coast(p, u, v).land * height;
}
export function terrainMesh(p: KitParams): MeshData {
  const [width, depth, height] = p.size, n = p.segments, low = linear(p.color), high = linear(p.peakColor), positions: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = (i / n - .5) * width, z = (j / n - .5) * depth, h = terrainHeight(p, x, z), t = smoothstep(.55, .82, h / Math.max(height, 1e-6)), y = h - coast(p, x / width + .5, z / depth + .5).sink * height * .35; // the seabed sinks past the coast
    const tint = .92 + hash(i, j, p.seed + 91) * .16; positions.push(x, y, z); colors.push(...mix(low, high, t).map((c) => Math.min(1, c * tint)));
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; indices.push(a, c, b, b, c, d); }
  return { positions, indices, colors };
}
/** Wave height at local (x, z) and time t (seconds). Wavelengths are in metres, independent of the body size. */
export function waterHeight(p: Pick<KitParams, 'wave' | 'seed'>, x: number, z: number, t: number): number {
  const s = p.seed * .37;
  return p.wave * (Math.sin(x * .62 + t * 1.1 + s) + .7 * Math.sin(z * .83 - t * .9 + s * 2) + .5 * Math.sin((x + z) * .41 + t * 1.6)) / 2.2;
}
export function waterMesh(p: KitParams, t: number): MeshData {
  const [width, depth] = p.size, n = p.segments, positions: number[] = [], indices: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const x = (i / n - .5) * width, z = (j / n - .5) * depth; positions.push(x, waterHeight(p, x, z, t), z); }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; indices.push(a, c, b, b, c, d); }
  return { positions, indices };
}

class Builder {
  positions: number[] = []; indices: number[] = []; colors: number[] = [];
  /** Low-poly ellipsoid (rings x sides) centred at c with optional per-vertex radial jitter. */
  blob(c: [number, number, number], r: [number, number, number], rings: number, sides: number, rgb: number[], jitter = 0, seed = 0, flatBottom = false) {
    const base = this.positions.length / 3;
    for (let a = 0; a <= rings; a++) for (let b = 0; b < sides; b++) {
      const phi = Math.PI * a / rings, theta = 2 * Math.PI * b / sides, k = 1 + (hash(a, b, seed) - .5) * jitter * (a === 0 || a === rings ? 0 : 1);
      let y = Math.cos(phi) * r[1] * k; if (flatBottom && y < -r[1] * .35) y = -r[1] * .35;
      this.positions.push(c[0] + Math.sin(phi) * Math.cos(theta) * r[0] * k, c[1] + y, c[2] + Math.sin(phi) * Math.sin(theta) * r[2] * k);
      const shade = .88 + .24 * Math.max(0, Math.cos(phi) * .6 + .4); this.colors.push(...rgb.map((v) => Math.min(1, v * shade)));
    }
    for (let a = 0; a < rings; a++) for (let b = 0; b < sides; b++) { const p = base + a * sides + b, q = base + a * sides + (b + 1) % sides, s = p + sides, t = q + sides; this.indices.push(p, q, s, q, t, s); }
  }
  /** Cone or cylinder frustum along +Y from y0 to y1, closed at the top and bottom. */
  frustum(c: [number, number], y0: number, y1: number, r0: number, r1: number, sides: number, rgb: number[]) {
    const base = this.positions.length / 3;
    for (let i = 0; i < sides; i++) { const th = 2 * Math.PI * i / sides; this.positions.push(c[0] + Math.cos(th) * r0, y0, c[1] + Math.sin(th) * r0, c[0] + Math.cos(th) * r1, y1, c[1] + Math.sin(th) * r1); this.colors.push(...rgb, ...rgb); }
    for (let i = 0; i < sides; i++) { const a = base + i * 2, b = base + (i + 1) % sides * 2; this.indices.push(a, b, a + 1, b, b + 1, a + 1); }
    const bottom = this.positions.length / 3; this.positions.push(c[0], y0, c[1], c[0], y1, c[1]); this.colors.push(...rgb, ...rgb);
    for (let i = 0; i < sides; i++) { const a = base + i * 2, b = base + (i + 1) % sides * 2; this.indices.push(bottom, b, a, bottom + 1, a + 1, b + 1); }
  }
  data(): MeshData { return { positions: this.positions, indices: this.indices, colors: this.colors }; }
}
export function treeMesh(p: KitParams): MeshData {
  const h = p.size[0], b = new Builder(), trunk = linear(p.color), leaf = linear(p.foliage), lean = (hash(1, 1, p.seed) - .5) * .08 * h;
  b.frustum([0, 0], 0, h * .34, h * .055, h * .04, 6, trunk);
  [[.22, .42, .3], [.4, .34, .24], [.58, .26, .19]].forEach(([y, r, ht], i) => b.frustum([lean * (i + 1), 0], h * y, h * (y + ht + .22), h * r, h * .012, 8, leaf.map((v, k) => v * (.9 + i * .08 + k * 0))));
  return b.data();
}
export function rockMesh(p: KitParams): MeshData {
  const r = p.size[0], b = new Builder();
  b.blob([0, r * .5, 0], [r, r * .72, r * .9], 4, 7, linear(p.color), .55, p.seed, true);
  return b.data();
}
export function cloudMesh(p: KitParams): MeshData {
  const r = p.size[0], b = new Builder(), rgb = linear(p.color), puffs = 5 + Math.floor(hash(2, 3, p.seed) * 3);
  for (let i = 0; i < puffs; i++) {
    const t = puffs === 1 ? 0 : i / (puffs - 1) - .5, size = r * (.5 + .35 * Math.cos(t * Math.PI) + hash(i, 7, p.seed) * .12);
    b.blob([t * r * 1.8, size * .22 * hash(i, 9, p.seed), (hash(i, 5, p.seed) - .5) * r * .5], [size, size * .72, size * .8], 4, 8, rgb, .1, p.seed + i, true);
  }
  return b.data();
}
export function kitMesh(p: KitParams, t = 0): MeshData {
  return p.shape === 'terrain' ? terrainMesh(p) : p.shape === 'water' ? waterMesh(p, t) : p.shape === 'tree' ? treeMesh(p) : p.shape === 'rock' ? rockMesh(p) : cloudMesh(p);
}
/** Estimated vertex count, used for the scene's geometry budget. */
export function kitVertexCount(shape: KitShape, segments: number) { return shape === 'terrain' || shape === 'water' ? (segments + 1) ** 2 : shape === 'tree' ? 90 : shape === 'rock' ? 40 : 320; }
