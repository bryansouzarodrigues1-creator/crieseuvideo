/*
Adapted from artemnovitckii/claude-animation-skills, Minecraft template.
MIT License

Copyright (c) 2026 Artem Novitckii

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

CrieSeuVideo adaptation: original dragon/golem story, articulated actors,
physical destruction, End scenes and Portuguese captions. The village asset
is adapted from the MIT reference; no new Gemini response or external asset.
*/
function createScene(THREE, canvas, width, height) {



const W = width, H = height, DUR = 4.0;
// ------------------------------------------------------------ seeded random (init only)
let seed = 23;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, x) => a + (b - a) * x;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (x) => { x = clamp(x, 0, 1); return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
const D2R = Math.PI / 180;
// stateless hash + value noise (for terrain / clouds)
function hash2(i, j, s) { let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ------------------------------------------------------------ renderer / scene
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const SKY_TOP = new THREE.Color(0x5b93f0), SKY_HOR = new THREE.Color(0xb9d3f8);
scene.background = SKY_HOR.clone();
scene.fog = new THREE.Fog(SKY_HOR.clone(), 90, 420);
const camera = new THREE.PerspectiveCamera(45, W / H, 0.3, 1400);

const hemi = new THREE.HemisphereLight(0xf4f8ff, 0x8d9a78, 2.05); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3df, 1.45);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 120 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2.5;
sun.position.set(-22, 46, 30); sun.target.position.set(0, 4, 0);
scene.add(sun, sun.target);

// ------------------------------------------------------------ 16x16 procedural textures
const C = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const pick = (arr, w) => { if (!w) return arr[Math.floor(rnd() * arr.length)]; let s = 0; for (const x of w) s += x; let r = rnd() * s; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; };
const mul = (c, k) => [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)];
function makeTex(draw, { mip = true, wrap = false } = {}) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 16;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const p = draw(x, y), k = (y * 16 + x) * 4;
    img.data[k] = p[0]; img.data[k + 1] = p[1]; img.data[k + 2] = p[2]; img.data[k + 3] = p.length > 3 ? p[3] : 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter; t.generateMipmaps = mip;
  t.anisotropy = 8;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const GREENS = ['#5c9b3b', '#65a443', '#6fad4b', '#558f37', '#79b655', '#4c8631'].map(C), GW = [3, 3, 2, 2, 1, 1];
const DIRT = ['#866043', '#7a573c', '#96704d', '#6b4a31', '#8d6849', '#5f432c'].map(C);
const texGrassTop = makeTex(() => pick(GREENS, GW));
const dripD = Array.from({ length: 16 }, () => 3 + (rnd() < .55 ? 1 : 0) + (rnd() < .22 ? 1 : 0));
const texGrassSide = makeTex((x, y) => y < dripD[x] ? mul(pick(GREENS, GW), .92) : (rnd() < .05 ? C('#7d7a76') : pick(DIRT)));
const texDirt = makeTex(() => rnd() < .04 ? C('#7d7a76') : pick(DIRT));
// cobblestone: jittered voronoi stones with dark mortar
const cobPts = Array.from({ length: 10 }, () => [rnd() * 16, rnd() * 16, .78 + rnd() * .4]);
const texCobble = makeTex((x, y) => {
  let d1 = 99, d2 = 99, k1 = 0;
  for (let i = 0; i < cobPts.length; i++) for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
    const d = Math.hypot(x + .5 - cobPts[i][0] - ox, y + .5 - cobPts[i][1] - oy);
    if (d < d1) { d2 = d1; d1 = d; k1 = i; } else if (d < d2) d2 = d;
  }
  if (d2 - d1 < 1.15) return mul(C('#4e4e4e'), .9 + rnd() * .2);
  return mul(C('#8b8b8b'), cobPts[k1][2] * (.9 + rnd() * .2) * (d1 < 1.6 ? 1.08 : 1));
});
function planks(pal, seam, seed0) {
  const offs = [3 + Math.floor(rnd() * 4), 9 + Math.floor(rnd() * 4), 1 + Math.floor(rnd() * 4), 7 + Math.floor(rnd() * 5)];
  const tone = Array.from({ length: 4 * 8 }, () => .9 + rnd() * .2);
  return makeTex((x, y) => {
    const b = Math.floor(y / 4);
    if (y % 4 === 3) return mul(C(seam), .95 + rnd() * .1);
    if (x === offs[b]) return mul(C(seam), 1.1);
    const c = pick(pal);
    return mul(c, tone[b * 8 + (x >> 1)] * (.95 + rnd() * .08));
  });
}
const texPlank = planks(['#b48c56', '#a7814d', '#bd975e', '#9e7848'].map(C), '#6f5333');
const texRoof = planks(['#7a4a2e', '#6d4128', '#855236', '#633a23'].map(C), '#3f2414');
const barkTone = Array.from({ length: 16 }, () => pick(['#6a5032', '#5c4429', '#4d3820', '#76593a']));
const texLogSide = makeTex((x, y) => rnd() < .16 ? mul(C(barkTone[x]), .72) : mul(C(barkTone[x]), .92 + rnd() * .16));
const texLogTop = makeTex((x, y) => {
  const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
  if (d > 6.5) return mul(C(barkTone[(x + y) & 15]), .95);
  return mul(C(Math.floor(d) % 2 ? '#b2915b' : '#987745'), .94 + rnd() * .1);
});
const LEAF = ['#3c7b28', '#468b2f', '#306b21', '#295d1b', '#549a3b'].map(C);
const texLeaves = makeTex(() => rnd() < .13 ? [0, 0, 0, 0] : pick(LEAF), { mip: false });
const texLeavesFar = makeTex(() => mul(pick(LEAF), .92));
const texGlass = makeTex((x, y) => {
  if (x === 0 || x === 15 || y === 0 || y === 15) return [222, 240, 248, 255];
  if ((x - y === 3 && x > 4 && x < 10) || (x - y === 6 && x > 8 && x < 12) || (x - y === -5 && x > 2 && x < 6)) return [255, 255, 255, 200];
  return [196, 228, 242, 46];
}, { mip: false });
const texLantern = makeTex((x, y) => {
  if (y < 3) return (x > 4 && x < 11) ? C('#3b3b44') : [0, 0, 0, 0];
  if (x < 2 || x > 13) return [0, 0, 0, 0];
  if (x < 4 || x > 11 || y < 5 || y > 13) return mul(C('#3d3d46'), .9 + rnd() * .2);
  return pick(['#ffd66e', '#ffbe48', '#ffe7a0', '#ffc95a'].map(C));
}, { mip: false });
const tuftTex = makeTex((x, y) => [0, 0, 0, 0], { mip: true });
{ // draw grass tuft blades
  const cv = tuftTex.image, ctx = cv.getContext('2d'), img = ctx.getImageData(0, 0, 16, 16);
  for (let x = 0; x < 16; x++) {
    if (rnd() < .3) continue;
    const h = 4 + Math.floor(rnd() * 10);
    for (let k = 0; k < h; k++) { const y = 15 - k, c = mul(pick(GREENS, GW), .8 + .3 * (k / h)), q = (y * 16 + x) * 4; img.data[q] = c[0]; img.data[q + 1] = c[1]; img.data[q + 2] = c[2]; img.data[q + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0); tuftTex.needsUpdate = true;
}
function flowerTex(petal, center) {
  return makeTex((x, y) => {
    const stem = (x === 7 || x === 8) && y >= 8;
    const leaf = (y === 11 && (x === 5 || x === 6)) || (y === 12 && (x === 9 || x === 10));
    if (y >= 3 && y <= 7 && x >= 5 && x <= 10 && !((y === 3 || y === 7) && (x === 5 || x === 10))) return (y === 5 && (x === 7 || x === 8)) ? C(center) : mul(C(petal), .85 + rnd() * .25);
    if (stem || leaf) return mul(C('#3f8a2c'), .9 + rnd() * .2);
    return [0, 0, 0, 0];
  }, { mip: true });
}
const texPoppy = flowerTex('#d1202c', '#2b1b12'), texDand = flowerTex('#f2d22b', '#d48a10'), texBlue = flowerTex('#4b7bea', '#e8e2a0');
// soft warm glow sprite
const glowTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,214,130,1)'); gr.addColorStop(.35, 'rgba(255,170,70,.55)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

const lam = (map, o = {}) => new THREE.MeshLambertMaterial({ map, ...o });
const mGrassTop = lam(texGrassTop), mGrassSide = lam(texGrassSide), mDirt = lam(texDirt);
const MAT_GRASS = [mGrassSide, mGrassSide, mGrassTop, mDirt, mGrassSide, mGrassSide];
const MAT_DIRT = lam(texDirt);
const mLogSide = lam(texLogSide), mLogTop = lam(texLogTop);
const MAT_LOG = [mLogSide, mLogSide, mLogTop, mLogTop, mLogSide, mLogSide];
const MAT_LEAF = lam(texLeaves, { alphaTest: .5 });
const MAT_LEAF_FAR = lam(texLeavesFar);
const MAT_COBBLE = lam(texCobble), MAT_PLANK = lam(texPlank), MAT_ROOF = lam(texRoof);
const MAT_GLASS = lam(texGlass, { transparent: true, depthWrite: false, emissive: new THREE.Color(0xffa63c), emissiveMap: texGlass, emissiveIntensity: 0 });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3(), e4 = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function staticInst(geo, mat, list, { cast = true, receive = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach(([x, y, z, s = 1, ry = 0], i) => { q4.setFromEuler(e4.set(0, ry, 0)); im.setMatrixAt(i, m4.compose(v4.set(x, y, z), q4, s4.set(s, s, s))); });
  if (!list.length) im.setMatrixAt(0, ZERO);
  im.castShadow = cast; im.receiveShadow = receive; scene.add(im); return im;
}

// ------------------------------------------------------------ sky dome
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: SKY_TOP }, hor: { value: SKY_HOR } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = normalize(vP).y; float k = smoothstep(-0.01, 0.55, h); gl_FragColor = vec4(mix(hor, top, pow(k, 0.75)), 1.0);\n#include <colorspace_fragment>\n}'
}));
sky.renderOrder = -10; scene.add(sky);

// ------------------------------------------------------------ terrain: a terraced grassy hill in a field
const Y0 = 3;                                         // plateau top = cottage floor
const R = 34;
function heightAt(i, j) {
  if (i >= -10 && i <= 10 && j >= -6 && j <= 16) return 3;      // flat pad for the cottage + tree
  const d = Math.hypot((i + 1.5) / 1.25, j / .92) + (vnoise(i * .31, j * .31, 3) - .5) * 2.2;
  if (d < 8.3) return 3;
  if (d < 10.8) return 2;
  if (d < 13.4) return 1;
  if (d > 15.5 && vnoise(i * .23 + 40, j * .23, 7) > .7) return 1;
  return 0;
}
const HT = new Map();
const hAt = (i, j) => { const k = i * 1000 + j; if (!HT.has(k)) HT.set(k, (Math.abs(i) > R || Math.abs(j) > R) ? 0 : heightAt(i, j)); return HT.get(k); };
const grassCells = [], dirtCells = [];
for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
  const h = hAt(i, j); if (h < 1) continue;
  grassCells.push([i, h - .5, j]);
  const mn = Math.min(hAt(i + 1, j), hAt(i - 1, j), hAt(i, j + 1), hAt(i, j - 1));
  for (let k = h - 1; k >= 1; k--) if (mn < k) dirtCells.push([i, k - .5, j]);
}
staticInst(boxGeo, MAT_GRASS, grassCells);
staticInst(boxGeo, MAT_DIRT, dirtCells);
const farTex = texGrassTop.clone(); farTex.wrapS = farTex.wrapT = THREE.RepeatWrapping; farTex.repeat.set(2400, 2400); farTex.needsUpdate = true;
const field = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), lam(farTex));
field.rotation.x = -Math.PI / 2; field.receiveShadow = true; scene.add(field);

// ------------------------------------------------------------ trees
const trunks = [], leaves = [], farTrunks = [], farLeaves = [];
function oak(x, z, base, h, tl, ll, far = false) {
  for (let k = 0; k < h; k++) tl.push([x, base + k + .5, z]);
  const top = base + h, occ = new Set();
  const put = (a, y, b) => { const key = a + ',' + y + ',' + b; if (occ.has(key)) return; occ.add(key); ll.push([a, y + .5, b]); };
  for (let y = top - 2; y <= top - 1; y++) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    if (a === 0 && b === 0) continue;
    if (Math.abs(a) === 2 && Math.abs(b) === 2 && rnd() < .6) continue;
    put(x + a, y, z + b);
  }
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { if (a === 0 && b === 0) continue; if (Math.abs(a) + Math.abs(b) === 2 && rnd() < .35) continue; put(x + a, top, z + b); }
  put(x, top, z);
  put(x, top + 1, z); put(x + 1, top + 1, z); put(x - 1, top + 1, z); put(x, top + 1, z + 1); put(x, top + 1, z - 1);
}
oak(-8, -1, Y0, 5, trunks, leaves);
oak(9, -6, hAt(9, -6), 4, trunks, leaves);
for (let n = 0; n < 24; n++) {
  const a = rnd() * Math.PI * 2, r = 46 + rnd() * 110;
  const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
  oak(x, z, 0, 4 + Math.floor(rnd() * 3), farTrunks, farLeaves, true);
}
// a few bush blocks dotted on the field
const bushes = [];
for (let n = 0; n < 26; n++) { const a = rnd() * Math.PI * 2, r = 17 + rnd() * 26; const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r); bushes.push([x, hAt(x, z) + .5, z]); }
staticInst(boxGeo, MAT_LOG, trunks);
staticInst(boxGeo, MAT_LEAF, leaves.concat(bushes));
staticInst(boxGeo, MAT_LOG, farTrunks, { cast: false });
staticInst(boxGeo, MAT_LEAF_FAR, farLeaves, { cast: false });

// ------------------------------------------------------------ grass tufts + flowers (crossed quads, lit like tops)
function crossGeo(sz) {
  const g1 = new THREE.PlaneGeometry(sz, sz); g1.rotateY(Math.PI / 4); g1.translate(0, sz / 2, 0);
  const g2 = new THREE.PlaneGeometry(sz, sz); g2.rotateY(-Math.PI / 4); g2.translate(0, sz / 2, 0);
  const pos = [], uv = [], nor = [], idx = [];
  [g1, g2].forEach((g, gi) => { const p = g.attributes.position.array, u = g.attributes.uv.array; for (let i = 0; i < p.length / 3; i++) { pos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); uv.push(u[i * 2], u[i * 2 + 1]); nor.push(0, 1, 0); } g.index.array.forEach((x) => idx.push(x + gi * 4)); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}
const inHouse = (x, z) => x > -4.8 && x < 4.8 && z > -3.8 && z < 3.8;
const nearTree = (x, z) => Math.hypot(x + 8, z + 1) < 1 || Math.hypot(x - 9, z + 6) < 1;
const tufts = [];
for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
  if (rnd() > .42) continue;
  const x = i + (rnd() - .5) * .7, z = j + (rnd() - .5) * .7;
  if (inHouse(x, z) || nearTree(x, z) || (x > -1 && x < 1 && z > 2 && z < 6.5)) continue;
  tufts.push([x, hAt(i, j), z, .75 + rnd() * .45, rnd() * Math.PI]);
}
for (let n = 0; n < 600; n++) { const a = rnd() * Math.PI * 2, r = R + rnd() * 30; tufts.push([Math.cos(a) * r, 0, Math.sin(a) * r, .8 + rnd() * .5, rnd() * Math.PI]); }
const crossG = crossGeo(1);
const tuftMat = lam(tuftTex, { alphaTest: .35, side: THREE.DoubleSide });
staticInst(crossG, tuftMat, tufts, { cast: false });
const flowers = [[], [], []];
for (let n = 0; n < 60; n++) {
  const x = Math.round(-12 + rnd() * 22), z = Math.round(-6 + rnd() * 17);
  if (inHouse(x, z) || nearTree(x, z) || (x === 0 && z >= 3 && z <= 6)) continue;
  flowers[n % 3].push([x + (rnd() - .5) * .3, hAt(x, z), z + (rnd() - .5) * .3, .62 + rnd() * .18, rnd() * Math.PI]);
}
[texPoppy, texDand, texBlue].forEach((tx, k) => staticInst(crossG, lam(tx, { alphaTest: .35, side: THREE.DoubleSide }), flowers[k], { cast: false }));

// ------------------------------------------------------------ clouds: flat blocky slabs drifting
const CLOUD = 7, CY = 54, cloudCells = [];
for (let a = -82; a <= 82; a++) for (let b = -82; b <= 82; b++) {
  const n = vnoise(a * .19, b * .19, 21) * .75 + hash2(a, b, 5) * .25;
  if (n > .63) cloudCells.push([a * CLOUD, CY, b * CLOUD]);
}
const cloudGeo = new THREE.BoxGeometry(CLOUD, 3, CLOUD);
{ const cols = []; const shade = [.95, .95, 1, .86, .97, .93]; for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) cols.push(shade[f], shade[f], shade[f]); cloudGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); }
const clouds = new THREE.InstancedMesh(cloudGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), cloudCells.length);
{
  const white = new THREE.Color(1, 1, 1), cc = new THREE.Color();
  cloudCells.forEach(([x, y, z], i) => {
    clouds.setMatrixAt(i, m4.makeTranslation(x, y, z));
    const f = smooth(260, 580, Math.hypot(x, z)) * .8;
    clouds.setColorAt(i, cc.copy(white).lerp(SKY_HOR, f));
  });
}
clouds.frustumCulled = false; scene.add(clouds);

// ------------------------------------------------------------ the cottage build list
// local block coords: x (-4..4), L (layer above the plateau, 0 = foundation), z (-3..3, +z faces camera)
const blocks = [];
const add = (type, x, L, z) => { const b = { type, x, L, z, T: 0, D: .2, h0: 2.4, sq: .22, spin: (rnd() - .5) * .9 }; blocks.push(b); return b; };
const sched = (list, t0, t1) => list.forEach((b, i) => { b.T = t0 + (t1 - t0) * (list.length < 2 ? 0 : i / (list.length - 1)) + (rnd() - .5) * .01; });
const ringXZ = []; for (let x = -3; x <= 3; x++) for (let z = -2; z <= 2; z++) if (Math.abs(x) === 3 || Math.abs(z) === 2) ringXZ.push([x, z]);
const byAngle = (a0) => ringXZ.slice().sort((p, q) => (((Math.atan2(p[1], p[0]) - a0) % 6.2832 + 6.2832) % 6.2832) - (((Math.atan2(q[1], q[0]) - a0) % 6.2832 + 6.2832) % 6.2832));
const DOOR = (x, L, z) => x === 0 && z === 2 && (L === 1 || L === 2);
const GLASS = (x, L, z) => L === 2 && ((z === 2 && Math.abs(x) === 2) || (Math.abs(x) === 3 && z === 0));
// 0: stone foundation ring + plank floor
sched(byAngle(2.55).map(([x, z]) => add('cobble', x, 0, z)), .10, .50);
const floorL = []; for (let z = 1; z >= -1; z--) for (let x = -2; x <= 2; x++) floorL.push([x, z]);
sched(floorL.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1])).map(([x, z]) => add('plank', x, 0, z)), .40, .66);
// 1-3: walls with log corners, glass windows and a door gap
[[1, .62, .98, 2.55], [2, .94, 1.30, 2.55 + 1.2], [3, 1.26, 1.58, 2.55 + 2.4]].forEach(([L, t0, t1, a0]) => {
  const list = [];
  for (const [x, z] of byAngle(a0)) {
    if (DOOR(x, L, z)) continue;
    const corner = Math.abs(x) === 3 && Math.abs(z) === 2;
    list.push(add(corner ? 'log' : GLASS(x, L, z) ? 'glass' : 'plank', x, L, z));
  }
  sched(list, t0, t1);
});
// 3-6: stepped gable roof (rows snake left/right), gable infill, chimney on the ridge
const CH_X = 2;
const roofRow = (k, t0, t1, extra = []) => {
  const zs = k < 3 ? [3 - k, -(3 - k)] : [0], L = 3 + k, list = [];
  const xs = []; for (let x = -4; x <= 4; x++) xs.push(x); if (k % 2) xs.reverse();
  for (const x of xs) for (const z of zs) list.push(add(k === 3 && x === CH_X ? 'cobble' : 'roof', x, L, z));
  const all = []; // interleave gable infill blocks at the matching moment of the sweep
  list.forEach((b) => { all.push(b); for (const e of extra) if (e.x === b.x && !e._in) { e._in = 1; all.push(e); } });
  extra.forEach((e) => { if (!e._in) all.push(e); });
  // same-x pairs land together
  let i = 0; const groups = []; all.forEach((b) => { if (groups.length && groups[groups.length - 1][0].x === b.x) groups[groups.length - 1].push(b); else groups.push([b]); });
  groups.forEach((g, gi) => g.forEach((b, bi) => { b.T = t0 + (t1 - t0) * gi / Math.max(1, groups.length - 1) + bi * .012; }));
};
const gable = (L, zs) => { const l = []; for (const x of [-3, 3]) for (const z of zs) l.push(add('plank', x, L, z)); return l; };
roofRow(0, 1.54, 1.80);
roofRow(1, 1.78, 2.04, gable(4, [-1, 0, 1]));
roofRow(2, 2.02, 2.26, gable(5, [0]));
roofRow(3, 2.24, 2.42);
const chimMid = add('cobble', CH_X, 7, 0); chimMid.T = 2.50;
const T_SLAM = 2.70;                                  // frame 81: the last block slams in
const chimTop = add('cobble', CH_X, 8, 0); Object.assign(chimTop, { T: T_SLAM, D: .23, h0: 5.5, sq: .4, spin: 0 });
const CHIM_TOP_Y = Y0 + 9;

const TYPES = { cobble: MAT_COBBLE, plank: MAT_PLANK, log: MAT_LOG, glass: MAT_GLASS, roof: MAT_ROOF };
const build = {};
for (const [k, mat] of Object.entries(TYPES)) {
  const list = blocks.filter((b) => b.type === k); list.forEach((b, i) => { b.i = i; });
  const im = new THREE.InstancedMesh(boxGeo, mat, list.length);
  im.castShadow = k !== 'glass'; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  build[k] = im;
}
function blockMatrix(b, t) {
  const u = t - (b.T - b.D);
  if (u < 0) return ZERO;
  let yOff, sy, sxz, rot = 0;
  if (t < b.T) { const p = u / b.D; yOff = b.h0 * (1 - p * p); const sc = .5 + .5 * p; sy = sxz = sc; rot = (1 - p) * (1 - p) * b.spin; }
  else {
    const v = t - b.T;
    yOff = v < .16 ? (b.sq > .3 ? .06 : .2) * Math.sin(Math.PI * v / .16) : 0;
    const sq = b.sq * Math.exp(-v * 15) * Math.cos(v * 36);
    sy = 1 - sq; sxz = 1 + sq * .45;
  }
  const baseY = Y0 + b.L + yOff;
  q4.setFromEuler(e4.set(rot * .4, rot, 0));
  return m4.compose(v4.set(b.x, baseY + .5 * sy, b.z), q4, s4.set(sxz, sy, sxz));
}

// ------------------------------------------------------------ interior: dark shell, lanterns, torch, glow
const shellTex = texPlank.clone(); shellTex.wrapS = shellTex.wrapT = THREE.RepeatWrapping; shellTex.needsUpdate = true;
const shellMat = lam(shellTex, { emissive: new THREE.Color(0xff9a3a), emissiveMap: shellTex, emissiveIntensity: 0 });
const shell = new THREE.Group(); scene.add(shell);
function shellFace(w, h, px, py, pz, rx, ry) {
  const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  const m = new THREE.Mesh(g, shellMat); m.position.set(px, py, pz); m.rotation.set(rx, ry, 0); m.receiveShadow = true; shell.add(m);
}
const IN = .012, yb = Y0 + 1, yt = Y0 + 4;
shellFace(5, 3, 0, yb, 0, -Math.PI / 2, 0); shell.children[0].position.y = yb + IN;                 // floor
shellFace(5, 3, 0, yt - IN, 0, Math.PI / 2, 0);                                                     // ceiling
shellFace(5, 3, 0, (yb + yt) / 2, -1.5 + IN, 0, 0);                                                 // back wall (faces +z)
shellFace(5, 3, 0, (yb + yt) / 2, 1.5 - IN, 0, Math.PI);                                            // front wall (faces -z)
shellFace(3, 3, -2.5 + IN, (yb + yt) / 2, 0, 0, Math.PI / 2);                                       // left
shellFace(3, 3, 2.5 - IN, (yb + yt) / 2, 0, 0, -Math.PI / 2);                                       // right
const lanternMat = lam(texLantern, { alphaTest: .5, emissive: new THREE.Color(0xffc060), emissiveMap: texLantern, emissiveIntensity: 0 });
const chainMat = new THREE.MeshLambertMaterial({ color: 0x3a3a42 });
const lanterns = [];
for (const lx of [-2, 2]) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(boxGeo, lanternMat); body.scale.set(.36, .42, .36); body.position.y = 0;
  const chain = new THREE.Mesh(boxGeo, chainMat); chain.scale.set(.06, 1.25, .06); chain.position.y = .21 + .62;
  g.add(body, chain); g.position.set(lx, Y0 + 2.45, 1.05); scene.add(g); lanterns.push(g);
}
const torch = new THREE.Group();
{ const stick = new THREE.Mesh(boxGeo, lam(texLogSide)); stick.scale.set(.11, .46, .11);
  const flame = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x5a3a20 })); flame.scale.set(.13, .13, .13); flame.position.y = .28;
  torch.add(stick, flame); torch.userData.flame = flame; torch.position.set(0, Y0 + 2.05, -1.32); torch.rotation.x = .38; scene.add(torch); }
const lamp = new THREE.PointLight(0xffa748, 0, 6.5, 1.2); lamp.position.set(0, Y0 + 2.4, .4); scene.add(lamp);
const halos = [[-2, Y0 + 2.5, 2.62, 2.3], [2, Y0 + 2.5, 2.62, 2.3], [0, Y0 + 2.0, 2.62, 2.6], [-3.62, Y0 + 2.5, 0, 1.9], [3.62, Y0 + 2.5, 0, 1.9]].map(([x, y, z, s]) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sp.position.set(x, y, z); sp.scale.set(s, s, 1); scene.add(sp); return sp;
});

// ------------------------------------------------------------ dust puff + chimney smoke (cube particles)
const NDUST = 36, dust = [];
for (let i = 0; i < NDUST; i++) dust.push({ a: i / NDUST * Math.PI * 2 + (rnd() - .5) * .5, r0: .45 + rnd() * .3, y0: rnd() * .5, v: 2.0 + rnd() * 3.6, u: (rnd() < .3 ? -.6 : .6) + rnd() * 2.6, s: .2 + rnd() * .2, life: .5 + rnd() * .35, spin: (rnd() - .5) * 8 });
const dustMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), NDUST);
{ const cc = new THREE.Color(); dust.forEach((d, i) => dustMesh.setColorAt(i, cc.set(pick(['#d9d6d0', '#bdb8b0', '#efece6', '#a8a39b'])))); }
dustMesh.frustumCulled = false; dustMesh.castShadow = false; scene.add(dustMesh);
const NSMOKE = 12, smoke = [];
for (let i = 0; i < NSMOKE; i++) {
  const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xcccccc, transparent: true, opacity: 0, depthWrite: false }));
  m.userData = { s0: 2.84 + i * .11, ph: rnd() * 6.28, sz: .3 + rnd() * .12, rx: rnd() * 3, ry: rnd() * 3 }; scene.add(m); smoke.push(m);
}
const SMOKE_A = new THREE.Color(0x8e8e8e), SMOKE_B = new THREE.Color(0xeeeeee);


// Original story staging, procedural actors, destruction and captions.
const SHOT=typeof STORY_SHOT==='number'?STORY_SHOT:0;
const V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const up3=V3(0,1,0),down3=V3(0,-1,0);
const G=(p=scene)=>{const g=new THREE.Group();p.add(g);return g;};
const LM=(c,o={})=>new THREE.MeshLambertMaterial({color:c,...o});
const BM=(c,o={})=>new THREE.MeshBasicMaterial({color:c,...o});
const cub=(p,m,x,y,z,sx,sy,sz)=>{const o=new THREE.Mesh(boxGeo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;};
const hashS=(i,j=0)=>hash2(i*17+23,j+43,91);

// Retain the earlier cottage and world as one independently visible scene.
const village=G();
for(const o of [...scene.children])if(o!==village&&!o.isLight&&o!==sun.target)village.add(o);
for(const m of smoke)m.visible=false;dustMesh.visible=false;
sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30});sun.shadow.camera.updateProjectionMatrix();
for(const b of blocks)build[b.type].setMatrixAt(b.i,blockMatrix(b,4));
for(const mesh of Object.values(build))mesh.instanceMatrix.needsUpdate=true;

const debris=blocks.map((b,i)=>{
 const move=b.L>=2||(b.L===1&&hashS(i)>.58);
 const y0=Y0+b.L+.5,vx=b.x*.72+(hashS(i,1)-.5)*3,vz=b.z*.85+(hashS(i,2)-.5)*3,vy=3.5+b.L*.48+hashS(i,3)*2;
 let land=(vy+Math.sqrt(vy*vy+24*Math.max(0,y0-Y0-.5)))/12,ground=Y0;
 for(let k=0;k<3;k++){ground=hAt(Math.round(b.x+vx*land),Math.round(b.z+vz*land));land=(vy+Math.sqrt(vy*vy+24*Math.max(0,y0-ground-.5)))/12;}
 return {b,i,move,y0,vx,vz,vy,land,ground,time:4.7+Math.hypot(b.x,b.z)*.025+hashS(i,4)*.11,rx:(hashS(i,5)-.5)*3,rz:(hashS(i,6)-.5)*3};
});
function houseAt(t){
 for(const d of debris){
  const {b}=d,a=t-d.time;
  if(!d.move||a<0){build[b.type].setMatrixAt(b.i,blockMatrix(b,4));continue;}
  const flying=Math.min(a,d.land),after=Math.max(0,a-d.land),slip=.13*(1-Math.exp(-after*5));
  const x=b.x+d.vx*(flying+slip),z=b.z+d.vz*(flying+slip);
  const y=a<d.land?d.y0+d.vy*a-6*a*a:d.ground+.58+.08*Math.abs(Math.sin(after*18))*Math.exp(-after*6);
  const rot=flying+.08*(1-Math.exp(-after*5));
  q4.setFromEuler(e4.set(d.rx*rot,d.rz*rot,d.rx*.5*rot));
  build[b.type].setMatrixAt(b.i,m4.compose(v4.set(x,y,z),q4,s4.set(.91,.91,.91)));
 }
 for(const mesh of Object.values(build))mesh.instanceMatrix.needsUpdate=true;
 const intact=t<4.9;shell.visible=intact;torch.visible=intact;lanterns.forEach(g=>g.visible=intact);
 shellMat.color.setScalar(.6);shellMat.emissiveIntensity=intact?.25:0;
 MAT_GLASS.emissiveIntensity=intact?.32:0;lanternMat.emissiveIntensity=intact?1:0;lamp.intensity=intact?2.2:0;
 halos.forEach(h=>h.material.opacity=intact?.2:0);
}

// A full articulated iron guardian, with face, nose, plate seams and vines.
const ironTex=makeTex(()=>{const c=pick(['#d7d5c7','#d1cfbd','#c6c5b6','#e4e2d6'].map(C));return rnd()<.07?mul(c,.72):c;});
const ironMat=new THREE.MeshLambertMaterial({map:ironTex}),jointMat=LM(0x7d8178),vineMat=LM(0x477343),vineLight=LM(0x6c874a),eyeRed=BM(0x952c2e),darkFace=LM(0x41443c);
function makeGolem(index){
 const root=G(),parts={};
 cub(root,ironMat,0,1.33,0,1.05,.5,.66);
 cub(root,ironMat,0,1.99,0,1.55,1.05,.84);
 cub(root,jointMat,0,2.3,.425,1.26,.055,.025);
 cub(root,jointMat,.32,1.72,.426,.035,.44,.025);
 const head=G(root);head.position.y=2.65;
 cub(head,ironMat,0,.08,0,.84,.81,.79);
 cub(head,ironMat,0,-.09,.49,.23,.43,.27);
 cub(head,darkFace,0,.31,.401,.67,.08,.025);
 for(const side of [-1,1]){cub(head,darkFace,side*.205,.17,.406,.21,.13,.025);cub(head,eyeRed,side*.205,.16,.424,.11,.075,.023);}
 const vx=index%2?-.42:.47;
 cub(root,vineMat,vx,2.0,.436,.085,.94,.025);
 for(let k=0;k<5;k++)cub(root,k%2?vineMat:vineLight,vx+(k%2?.09:-.08),1.65+k*.17,.45,.21,.12,.035);
 cub(root,LM(0xc9b95d),vx+.08,2.25,.47,.085,.085,.03);
 const arms=[];
 for(const side of [-1,1]){
  const pivot=G(root);pivot.position.set(side*.98,2.35,0);
  cub(pivot,jointMat,0,-.04,0,.44,.27,.53);
  cub(pivot,ironMat,0,-.55,0,.49,1.10,.54);
  const elbow=G(pivot);elbow.position.y=-1.10;cub(elbow,jointMat,0,0,0,.47,.17,.51);
  cub(elbow,ironMat,0,-.49,.025,.53,.98,.59);cub(elbow,ironMat,0,-1.03,.04,.56,.21,.63);
  if(side<0){cub(pivot,vineMat,.25,-.58,.16,.025,.72,.12);cub(elbow,vineMat,.265,-.32,.13,.024,.42,.11);}
  arms.push({pivot,elbow,side,L1:1.1,L2:1.06});
 }
 const legs=[];
 for(const side of [-1,1]){
  const hip=G(root);hip.position.set(side*.36,1.32,0);
  cub(hip,ironMat,0,-.315,0,.51,.63,.57);
  const knee=G(hip);knee.position.y=-.63;cub(knee,jointMat,0,0,0,.48,.16,.53);
  cub(knee,ironMat,0,-.315,0,.48,.63,.55);
  const foot=G(knee);foot.position.y=-.63;cub(foot,ironMat,0,-.01,.1,.54,.24,.83);
  legs.push({hip,knee,foot,side});
 }
 return {root,head,arms,legs,index};
}
const golems=Array.from({length:6},(_,i)=>makeGolem(i));
function legIK(leg,z,y,bodyBob){
 const dy=1.32+bodyBob-y,d=clamp(Math.hypot(dy,z),.001,1.259),a=Math.acos(clamp(d/(2*.63),-1,1));
 const hip=-Math.atan2(z,dy)-a,bend=Math.PI-Math.acos(clamp((2*.63*.63-d*d)/(2*.63*.63),-1,1));
 leg.hip.rotation.set(hip,0,0);leg.knee.rotation.set(bend,0,0);leg.foot.rotation.set(-hip-bend,0,0);
}
function poseGolem(g,{x,z,floor=Y0,yaw=0,travel=0,walk=0,time=0,guard=0,raise=0,drop=0}){
 const phase=travel/1.3,bob=.025*(1-Math.cos(phase*Math.PI*4))*walk;
 g.root.position.set(x,floor+bob+drop,z);g.root.rotation.set(0,yaw,0);g.root.scale.setScalar(1);g.root.visible=true;
 for(const leg of g.legs){
  const p=((phase+(leg.side<0?.5:0))%1+1)%1;let fz,fy;
  if(p<.58){fz=1.3*(.29-p);fy=.13;}else{const q=(p-.58)/.42;fz=lerp(-.377,.377,smooth(0,1,q));fy=.13+.23*Math.sin(q*Math.PI);}
  legIK(leg,fz*walk,lerp(.13,fy,walk),bob);
 }
 g.head.rotation.set(guard*.1,0,0);
 for(const arm of g.arms){
  arm.pivot.rotation.set(-2.4*guard-1.8*raise+.27*Math.sin(phase*Math.PI*2+arm.side*Math.PI)*walk,0,arm.side*(.06+.12*guard));
  arm.elbow.rotation.set(-.3*guard-.35*raise,0,0);
 }
}
function walkTo(g,start,end,t,t0,t1,extra={}){
 const u=smooth(t0,t1,t),dx=end[0]-start[0],dz=end[1]-start[1],dist=Math.hypot(dx,dz),moving=smooth(t0,t0+.25,t)*(1-smooth(t1-.35,t1,t));
 const heading=Math.atan2(dx,dz),turn=smooth(t1-.45,t1,t);
 poseGolem(g,{x:lerp(start[0],end[0],u),z:lerp(start[1],end[1],u),yaw:lerp(heading,extra.finalYaw??0,turn),travel:dist*u,walk:moving,time:t,...extra});
}
function armTo(g,arm,targetWorld){
 g.root.updateMatrixWorld(true);const s=arm.pivot.position.clone(),target=g.root.worldToLocal(targetWorld.clone()),dvec=target.sub(s),d=clamp(dvec.length(),.001,arm.L1+arm.L2-.001),dir=dvec.normalize();
 let pole=V3(arm.side*.6,-1,.2);pole.addScaledVector(dir,-pole.dot(dir));if(pole.lengthSq()<.00001)pole=V3(1,0,0).cross(dir);pole.normalize();
 const along=(arm.L1*arm.L1+d*d-arm.L2*arm.L2)/(2*d),height=Math.sqrt(Math.max(0,arm.L1*arm.L1-along*along));
 const e=s.clone().addScaledVector(dir,along).addScaledVector(pole,height),tip=s.clone().addScaledVector(dir,d);
 arm.pivot.quaternion.setFromUnitVectors(down3,e.clone().sub(s).normalize());
 const fore=tip.clone().sub(e).applyQuaternion(arm.pivot.quaternion.clone().invert()).normalize();arm.elbow.quaternion.setFromUnitVectors(down3,fore);
}

// Voxel dragon: independently jointed wings, elbows, neck, jaw, legs and tail.
const dragonSkin=LM(0x181520),dragonBone=LM(0x4b414f),dragonWing=LM(0x241d32,{side:THREE.DoubleSide}),purpleEye=BM(0xe771ff);
function membrane(parent,vertices){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,dragonWing);m.castShadow=true;parent.add(m);return m;}
function linkBlock(parent,a,b,thickness,material){const delta=b.clone().sub(a),o=new THREE.Mesh(new THREE.BoxGeometry(thickness,delta.length(),thickness),material);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(up3,delta.normalize());o.castShadow=true;parent.add(o);return o;}
function makeDragon(){
 const root=G();cub(root,dragonSkin,0,0,-.4,1.9,1.25,4.8);cub(root,dragonBone,0,.69,-.4,.6,.14,4.5);
 const neck=G(root);neck.position.set(0,.05,2.0);cub(neck,dragonSkin,0,0,1,.9,.75,2.2);
 const head=G(neck);head.position.z=2.15;cub(head,dragonSkin,0,.05,.65,1.45,.86,1.9);
 const jaw=G(head);jaw.position.set(0,-.3,-.05);cub(jaw,dragonSkin,0,-.06,.9,1.42,.25,1.8);
 for(const side of [-1,1]){cub(head,purpleEye,side*.737,.17,.54,.035,.15,.52);cub(head,dragonBone,side*.48,.65,-.1,.25,.65,.3);cub(head,dragonBone,side*.4,-.02,1.63,.25,.12,.05);}
 const mouth=G(head);mouth.position.set(0,-.2,1.73);
 const wings=[];
 for(const side of [-1,1]){
  const joint=G(root);joint.position.set(side*.8,.45,.7);
  linkBlock(joint,V3(),V3(side*3.25,0,-.5),.19,dragonBone);
  membrane(joint,[0,0,0,side*3.25,0,-.5,side*.65,0,-3.1,side*3.25,0,-.5,side*3.0,0,-2.9,side*.65,0,-3.1]);
  const outer=G(joint);outer.position.set(side*3.25,0,-.5);
  linkBlock(outer,V3(),V3(side*3.7,0,-.8),.13,dragonBone);
  membrane(outer,[0,0,0,side*3.7,0,-.8,side*2.5,0,-2.1,0,0,0,side*2.5,0,-2.1,side*1.4,0,-2.9,0,0,0,side*1.4,0,-2.9,side*-.3,0,-2.4]);
  linkBlock(outer,V3(),V3(side*2.5,0,-2.1),.065,dragonBone);linkBlock(outer,V3(),V3(side*1.4,0,-2.9),.055,dragonBone);
  wings.push({joint,outer,side});
  for(const zz of [-1.4,1.35]){const leg=G(root);leg.position.set(side*.85,-.4,zz);cub(leg,dragonSkin,0,-.55,0,.48,1.1,.57);cub(leg,dragonBone,0,-1.12,.25,.58,.24,.95);}
 }
 const tail=[];let parent=root;
 for(let i=0;i<7;i++){const joint=G(parent);joint.position.set(0,0,i===0?-2.7:-1.05);const size=.72-i*.07;cub(joint,dragonSkin,0,0,-.48,size,size,1.25);cub(joint,dragonBone,0,size*.65,-.3,.13,.3,.3);tail.push(joint);parent=joint;}
 return {root,neck,head,jaw,mouth,wings,tail};
}
const dragon=makeDragon();
function flapDragon(t,power=1){for(const w of dragon.wings){w.joint.rotation.z=w.side*(.15+Math.sin(t*3.9)*.55*power);w.outer.rotation.z=w.side*(.05+Math.sin(t*3.9-.65)*.24*power);}dragon.tail.forEach((j,i)=>{j.rotation.y=Math.sin(t*2.5-i*.65)*.16;j.rotation.x=Math.sin(t*1.6-i*.6)*.055;});dragon.neck.rotation.set(.02*Math.sin(t*2),.04*Math.sin(t*1.3),0);dragon.jaw.rotation.x=.06;}
function aimDragon(position,target,t,bank=0){dragon.root.position.copy(position);const d=target.clone().sub(position);dragon.root.rotation.set(-Math.atan2(d.y,Math.hypot(d.x,d.z)),Math.atan2(d.x,d.z),bank);flapDragon(t);dragon.root.updateMatrixWorld(true);}
function attackDragonAt(t){
 let p,target;
 if(t<3.65){const q=smooth(0,3.65,t);p=V3(lerp(-16,-3,q),lerp(15,13,q),lerp(-13,-4,q));target=V3(1,9,0);}
 else if(t<5.8){p=V3(-3,13+.18*Math.sin(t*4),-4);target=V3(0,7.3,0);}
 else{const q=smooth(5.8,10,t);p=V3(lerp(-3,19,q),lerp(13,20,q),lerp(-4,-18,q));target=p.clone().add(V3(10,2,-8));}
 aimDragon(p,target,t,t>5.8?-.18:0);dragon.jaw.rotation.x=.05+.38*smooth(3.3,3.9,t)*(1-smooth(5.5,5.8,t));dragon.root.visible=true;
}

const breathRoot=G(),breathMat=BM(0xb53bff,{transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false});
const breathCore=new THREE.Mesh(new THREE.CylinderGeometry(.26,.45,1,8),breathMat);breathRoot.add(breathCore);
const breathBits=[];
for(let i=0;i<34;i++){const m=cub(breathRoot,BM(i%3?0xa12edd:0xec8fff,{transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}),0,0,0,.25,.25,.25);m.castShadow=false;breathBits.push(m);}
function breathAt(t){
 const on=t>=3.85&&t<=5.65;breathRoot.visible=on;if(!on)return;
 dragon.root.updateMatrixWorld(true);const origin=dragon.mouth.getWorldPosition(V3()),target=V3(0,7.2,0),end=origin.clone().lerp(target,smooth(3.85,4.68,t)),d=end.clone().sub(origin);
 breathCore.position.copy(origin).add(end).multiplyScalar(.5);breathCore.scale.y=d.length();breathCore.quaternion.setFromUnitVectors(up3,d.clone().normalize());
 breathBits.forEach((b,i)=>{const q=((t-3.85)*1.45+i*.071)%1,p=origin.clone().lerp(end,q);p.x+=Math.sin(i*5+t*8)*q*.48;p.y+=Math.cos(i*7+t*6)*q*.4;b.position.copy(p);b.rotation.set(t*3+i,t+i,0);b.scale.setScalar(.22+q*.32);});
}

// Fire, smoke and impact dust remain attached to the ruined village.
const fireRoot=G(village),fire=[];
for(let i=0;i<15;i++){const m=cub(fireRoot,BM(i%2?0xfca230:0xe96a2c,{transparent:true,opacity:.7}),0,0,0,.5,1,.5);m.castShadow=false;fire.push(m);}
const soot=[];for(let i=0;i<20;i++){const m=cub(fireRoot,LM(0x565258,{transparent:true,opacity:.5,depthWrite:false}),0,0,0,1,1,1);m.castShadow=false;soot.push(m);}
const impactDust=[];for(let i=0;i<35;i++){const m=cub(village,LM(i%2?0xa89e88:0xb5aaa1,{transparent:true,opacity:.75}),0,0,0,.5,.5,.5);m.castShadow=false;impactDust.push(m);}
function ruinFX(t){
 fireRoot.visible=t>5;const life=Math.max(0,t-5);
 fire.forEach((m,i)=>{m.position.set((hashS(i,14)-.5)*5,Y0+.45+Math.abs(Math.sin(t*6+i))*.4,(hashS(i,15)-.5)*4);m.scale.set(.35,.6+Math.abs(Math.sin(t*7+i))*.9,.35);m.material.opacity=.4+.25*Math.sin(t*8+i)**2;});
  soot.forEach((m,i)=>{const a=(life+i*.19)%3.2;m.position.set((hashS(i,16)-.5)*4+a*.25,Y0+1.4+a*2.2,(hashS(i,17)-.5)*3);m.scale.setScalar(.45+a*.35);m.material.opacity=(1-a/3.2)*.42*smooth(5,6,t);});
 impactDust.forEach((m,i)=>{const a=t-4.78,dur=.85+hashS(i,18)*.6;m.visible=a>0&&a<dur;if(m.visible){const q=a/dur,ang=i/35*Math.PI*2;m.position.set(Math.cos(ang)*(1+q*5),Y0+4+hashS(i,19)*2+2*a-5*a*a,Math.sin(ang)*(1+q*4));m.scale.setScalar(.4+q*.7);m.material.opacity=(1-q)*.7;}});
}

// A horizontal End portal, not an upright Nether gate.
const portal=G(village);portal.position.set(0,Y0,13);
const portalFrame=LM(0x608975),portalRim=LM(0xa8bf8d),portalEye=BM(0x438a8a),portalPupil=BM(0x102f39);
for(const [xx,zz] of Array.from({length:3},(_,i)=>i-1).flatMap(k=>[[k,-2],[k,2],[-2,k],[2,k]])){
 cub(portal,portalFrame,xx,.22,zz,.98,.45,.98);cub(portal,portalRim,xx,.47,zz,.93,.12,.93);cub(portal,portalEye,xx,.56,zz,.5,.12,.5);cub(portal,portalPupil,xx,.635,zz,.16,.05,.3);
}
const portalMaterial=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{clock:{value:0},power:{value:1}},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 p;uniform float clock;uniform float power;float h(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}void main(){vec2 q=p*34.;vec2 cell=floor(q);float star=step(.965,h(cell))*pow(max(0.,1.-length(fract(q)-.5)*3.),3.);float waves=.5+.5*sin(length(p-.5)*38.-clock*3.);vec3 col=vec3(.009,.025,.045)+vec3(.08,.11,.19)*waves*.4+star*vec3(.55,.8,.85);gl_FragColor=vec4(col*power,1.);}`});
const portalSurface=new THREE.Mesh(new THREE.PlaneGeometry(3,3),portalMaterial);portalSurface.rotation.x=-Math.PI/2;portalSurface.position.y=.35;portal.add(portalSurface);
const portalSpark=[];for(let i=0;i<26;i++){const m=cub(portal,BM(0x8be7d7,{transparent:true,opacity:.6,blending:THREE.AdditiveBlending}),0,0,0,.07,.07,.07);m.castShadow=false;portalSpark.push(m);}
function portalAt(t,active){portal.visible=active>0;portalSurface.visible=active>.45;portalMaterial.uniforms.clock.value=t;portalMaterial.uniforms.power.value=active;portalSpark.forEach((p,i)=>{const a=t*.7+i*2.4;p.position.set(Math.sin(a)*1.7,.5+((t*.7+i*.19)%2.7),Math.cos(a)*1.7);p.material.opacity=active*.6;});}

// End island, obsidian towers, crystals and a star field, all procedural.
const endWorld=G(),endStoneTex=makeTex(()=>pick(['#d9dda1','#d0d49a','#e5e4b1','#bfc589'].map(C))),obsidianTex=makeTex(()=>pick(['#151321','#241d32','#2d243c','#1d1829'].map(C)));
const endStone=new THREE.MeshLambertMaterial({map:endStoneTex}),obsidian=new THREE.MeshLambertMaterial({map:obsidianTex});
function instanceBlocks(parent,material,list){const im=new THREE.InstancedMesh(boxGeo,material,list.length);const ob=new THREE.Object3D();list.forEach((v,i)=>{ob.position.set(v[0],v[1],v[2]);ob.scale.set(v[3]||1,v[4]||1,v[5]||1);ob.updateMatrix();im.setMatrixAt(i,ob.matrix);});im.castShadow=true;im.receiveShadow=true;parent.add(im);return im;}
const endBlocks=[];
for(let x=-24;x<=24;x++)for(let z=-26;z<=22;z++)if(Math.hypot(x/1.1,z)<24){endBlocks.push([x,-.5,z]);if(Math.hypot(x/1.1,z)>22)for(let y=-1;y>=-3;y--)endBlocks.push([x,y-.5,z]);}
instanceBlocks(endWorld,endStone,endBlocks);cub(endWorld,obsidian,0,-.09,8.7,5.8,.2,5.5);
const towerBlocks=[],crystals=[];
for(const [x,z,h] of [[-13,-13,19],[-5,-20,23],[7,-20,21],[15,-11,17],[-19,0,14],[19,1,17]]){
 for(let y=0;y<h;y++)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)towerBlocks.push([x+dx,y+.5,z+dz]);
 const c=G(endWorld);c.position.set(x,h+1.3,z);
 const core=cub(c,BM(0xe665df),0,0,0,1.2,1.2,1.2);core.rotation.set(.75,.4,.75);
 const glow=cub(c,BM(0xffc8fa,{transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false}),0,0,0,1.65,1.65,1.65);glow.rotation.set(.75,.4,.75);glow.castShadow=false;crystals.push(c);
}
instanceBlocks(endWorld,obsidian,towerBlocks);
const starPositions=[];for(let i=0;i<850;i++){const az=hashS(i,21)*Math.PI*2,el=hashS(i,22)*1.2+.05;starPositions.push(Math.sin(az)*Math.cos(el)*150,Math.sin(el)*150,Math.cos(az)*Math.cos(el)*150);}
const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));endWorld.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xc3aedc,size:.35,fog:false,transparent:true,opacity:.8})));
const arrivalBits=[];for(let i=0;i<30;i++){const p=cub(endWorld,BM(0x9975ee,{transparent:true,opacity:.6,blending:THREE.AdditiveBlending}),0,0,0,.12,.12,.12);p.castShadow=false;arrivalBits.push(p);}

// Timed screen captions are drawn into the same canvas and exported by the motor.
const captionPlans=[
 [[0,3.2,'O dragão surgiu sobre a vila.'],[3.2,5.3,'O alvo era o lar dos golems.'],[5.3,8,'Tudo virou ruínas.'],[8,10,'Mas eles sobreviveram.']],
 [[0,3.2,'Os golems ouviram o chamado.'],[3.2,6.6,'Ninguém lutaria sozinho.'],[6.6,10,'O destino era um só: o End.']],
 [[0,3,'Um por um, cruzaram o portal.'],[3,6.2,'O medo ficou para trás.'],[6.2,10,'O exército de ferro chegou ao End.']],
 [[0,3.6,'Diante do dragão, eles avançaram.'],[3.6,6.6,'O primeiro golpe foi dado.'],[6.6,10,'A batalha pelo lar tinha começado.']]
];
scene.add(camera);const captionGroup=G(camera);
function textCard(text){
 const cv=document.createElement('canvas');cv.width=864;cv.height=192;const ctx=cv.getContext('2d');
 const gradient=ctx.createLinearGradient(0,0,0,192);gradient.addColorStop(0,'rgba(2,4,12,0)');gradient.addColorStop(.35,'rgba(2,4,12,.55)');gradient.addColorStop(1,'rgba(2,4,12,.8)');ctx.fillStyle=gradient;ctx.fillRect(0,0,864,192);
 ctx.font='bold 43px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=8;ctx.strokeStyle='#0b1014';ctx.fillStyle='#ffffff';
 const words=text.split(' ');const lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>800&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
 lines.forEach((l,i)=>{const yy=108+(i-(lines.length-1)/2)*53;ctx.strokeText(l,432,yy);ctx.fillText(l,432,yy);});
 const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;
 const m=new THREE.Mesh(new THREE.PlaneGeometry(1.78,.395),new THREE.MeshBasicMaterial({map:tx,transparent:true,depthTest:false,depthWrite:false,fog:false,toneMapped:false}));m.position.set(0,-1.03,-4);m.renderOrder=2000;m.frustumCulled=false;captionGroup.add(m);return m;
}
const captionMeshes=captionPlans[SHOT].map(p=>({plan:p,mesh:textCard(p[2])}));
const starts=[[-5,5],[-8,7],[8,6.5],[-7,3.5],[7.5,3.4],[0,3.8]];
const formation=[[0,9.9],[-2.3,7.7],[2.3,7.7],[-2.2,5.5],[2.2,5.5],[0,3.8]];
const endFormation=[[1.0,6.5],[-1.4,7.8],[3.1,8.1],[-2.8,10],[1.2,10.3],[3.8,10.5]];
function cameraAt(pos,target){camera.position.set(...pos);camera.lookAt(...target);camera.updateMatrixWorld();sky.position.copy(camera.position);}
function endDragonAt(t){
 const land=smooth(.2,3.8,t),recoil=smooth(5.4,6.1,t),lift=smooth(6.5,9.5,t);
 dragon.root.position.set(Math.sin(t*.6)*.15,lerp(8,3.0,land)+recoil*.5+lift*4.2,lerp(-15,-5.2,land)-recoil*1.5-lift*4.5);
 dragon.root.rotation.set(-.03,0,.04*Math.sin(t));flapDragon(t,t<4.2?1:.22+lift*.8);dragon.jaw.rotation.x=.05+.18*recoil;dragon.root.visible=true;dragon.root.updateMatrixWorld(true);
}
endDragonAt(5.4);const punchContact=dragon.mouth.getWorldPosition(V3());
function renderAt(seconds){
 const t=clamp(Number(seconds)||0,0,9.999),globalT=SHOT*10+t,isEnd=SHOT===3||(SHOT===2&&t>=6.2);
 village.visible=!isEnd;endWorld.visible=isEnd;breathRoot.visible=false;
 scene.background=isEnd?new THREE.Color(0x130c27):SKY_HOR.clone();scene.fog=isEnd?new THREE.Fog(0x1a102d,65,190):new THREE.Fog(SKY_HOR.clone(),90,420);
 hemi.color.set(isEnd?0x9f8cce:0xf4f8ff);hemi.groundColor.set(isEnd?0x45405a:0x8d9a78);hemi.intensity=isEnd?1.6:2.05;sun.color.set(isEnd?0xc3b3e7:0xfff3df);sun.intensity=isEnd?1.4:1.45;
 clouds.position.x=globalT*1.15;crystals.forEach((c,i)=>{c.rotation.y=globalT*.5+i;c.rotation.z=.1*Math.sin(globalT+i);});
 for(const a of golems)a.root.visible=false;
 if(SHOT===0){
  houseAt(t);ruinFX(t);portalAt(t,0);attackDragonAt(t);breathAt(t);
  const panic=smooth(4.4,4.85,t)*(1-smooth(7,8.7,t));
  poseGolem(golems[0],{x:-4.8-panic*.35,z:4.4,floor:Y0,yaw:.1,guard:panic,time:t});
  poseGolem(golems[1],{x:5+panic*.35,z:4.6,floor:Y0,yaw:-.2,guard:panic,time:t});
  const q=smooth(0,3.4,t),out=smooth(6,10,t);cameraAt([lerp(21,18,q)+out*2,lerp(20,16,q)+out*2,lerp(32,28,q)],[0,7.5,1]);
 }else if(SHOT===1){
  houseAt(10);ruinFX(t+10);dragon.root.visible=false;portalAt(globalT,smooth(6.4,7.6,t));
  for(let i=0;i<6;i++){
   walkTo(golems[i],starts[i],formation[i],t,.1+i*.13,3.2+i*.13,{raise:i===0?smooth(3.7,4.3,t)*(1-smooth(6.8,7.5,t)):0});
   if(t>4&&i!==0)golems[i].head.rotation.y=clamp(-formation[i][0]*.13,-.45,.45);
  }
  const q=smooth(5.6,9,t);cameraAt([lerp(15,13,q),lerp(13,19,q),lerp(25,27,q)],[0,lerp(5.0,3.5,q),lerp(6.5,9,q)]);
 }else if(SHOT===2){
  houseAt(10);ruinFX(t+20);portalAt(globalT,1);
  if(!isEnd){
   dragon.root.visible=false;
   for(let i=0;i<6;i++){
    const entry=2.0+i*.66,drop=-6*smooth(entry,entry+.58,t);
    walkTo(golems[i],formation[i],[0,13],t,.1+i*.12,entry,{drop});golems[i].root.visible=t<entry+.65;
   }
   const q=smooth(0,6,t);cameraAt([lerp(11,6,q),lerp(20,16,q),lerp(27,23,q)],[0,3.1,11.5]);
  }else{
   const a=t-6.2;
   for(let i=0;i<6;i++){
    const p=endFormation[i],fall=5*(1-smooth(i*.07,.7+i*.07,a)),land=smooth(.65+i*.07,.85+i*.07,a)*(1-smooth(1.0+i*.07,1.3+i*.07,a));
    poseGolem(golems[i],{x:p[0],z:p[1],floor:0,yaw:Math.PI,drop:fall-.09*land,guard:.12*land,time:t});
   }
   aimDragon(V3(0,10,-18),V3(0,7,0),t+20);cameraAt([16,11,26],[0,3,2]);
   arrivalBits.forEach((p,i)=>{const a2=a+i*.11;p.visible=a<2.9;p.position.set(Math.sin(i*2.1)*3,.7+(a2%2.0)*2,8.5+Math.cos(i*2.1)*2);p.material.opacity=(1-smooth(1.4,2.9,a))*.65;});
  }
 }else{
  endDragonAt(t);arrivalBits.forEach(p=>p.visible=false);
  for(let i=0;i<6;i++){
   const initial=endFormation[i],end=[i===0?1.0:initial[0],i===0?2.65:initial[1]-4.3];
   walkTo(golems[i],initial,end,t,0,4.1+i*.1,{floor:0,finalYaw:Math.PI,raise:i!==0?.25*smooth(4,5,t):0});
  }
  const leader=golems[0],arm=leader.arms[1],p=smooth(4.7,5.4,t)*(1-smooth(5.65,6.4,t));
  if(t>=4.1){
   const ready=V3(-.15,2.25,2.15),target=ready.clone().lerp(punchContact,p);armTo(leader,arm,target);
  }
  const q=smooth(3.6,5.1,t),back=smooth(6.5,9.6,t);cameraAt([lerp(15,9,q)+back*4,lerp(10,7,q)+back*4,lerp(22,15,q)+back*5],[0,lerp(4,3.2,q)+back*2,lerp(-.5,0,q)]);
 }
 captionMeshes.forEach(({plan,mesh})=>mesh.visible=t>=plan[0]&&t<plan[1]);
 renderer.render(scene,camera);
}
return {duration:10,renderAt,dispose(){
 const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{
  if(o.geometry)geometries.add(o.geometry);for(const m of (o.material?(Array.isArray(o.material)?o.material:[o.material]):[])){materials.add(m);for(const value of Object.values(m))if(value&&value.isTexture)textures.add(value);}
  if(o.isInstancedMesh)o.dispose();
 });textures.forEach(x=>x.dispose());geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());renderer.dispose();
}};
}
