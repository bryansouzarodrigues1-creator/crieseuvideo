// 3D Toon engine (style "E Se?" / Ninco): cel-shaded meshes with ink outlines, real light/shadow and a cinematic camera.
// Renders one scene at a time into its own WebGL canvas; the studio composites captions on top so export stays the same.
import { createCharacterRig, updateCharacterRig, type ToonCharacterRig } from './toon/characterRig';
import type { ToonCharacter, FacialExpression, CharacterPose } from './toon/types';
import * as THREE from 'three';
import { sceneAt, wordAt, type ExplainerPlan, type ExplainerScene, type Mood } from './plan';
import { spring } from './render';

const INK = 0x1c1824;
const HOODIE: Record<string, number> = { orange: 0xf28c28, purple: 0x7b5cd6, teal: 0x23a59a, pink: 0xe5578f, night: 0x3b4a7a };
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x); };

let GRAD: THREE.DataTexture | null = null;
function gradient() {
  if (GRAD) return GRAD;
  GRAD = new THREE.DataTexture(new Uint8Array([70, 150, 230, 255]), 4, 1, THREE.RedFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true; return GRAD;
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
/** Toon mesh with an inverted-hull ink outline. */
function toon(geo: THREE.BufferGeometry, color: number, opts: { outline?: number; emissive?: number; map?: THREE.Texture } = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color, gradientMap: gradient(), emissive: opts.emissive ?? 0, map: opts.map ?? null }));
  m.castShadow = true; m.receiveShadow = true; g.add(m);
  if (opts.outline !== 0) { const o = new THREE.Mesh(geo, OUTLINE); o.scale.setScalar(1 + (opts.outline ?? 0.045)); g.add(o); }
  return g;
}
function textTexture(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, r); }
const FONT = (px: number, wt = 800) => `${wt} ${px}px 'Plus Jakarta Sans', sans-serif`;
function wrap(c: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = []; let line = '';
  for (const wd of text.split(/\s+/)) { const t = line ? `${line} ${wd}` : wd; if (c.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t; }
  if (line) lines.push(line); return lines.slice(0, 5);
}

// ---------- character ----------
interface Rig { root: THREE.Group; head: THREE.Group; mouth: THREE.Mesh; smile: THREE.Mesh; browL: THREE.Mesh; browR: THREE.Mesh; armL: THREE.Group; armR: THREE.Group; sweat: THREE.Group; body: THREE.Group }
function character(hoodie: number): Rig {
  const root = new THREE.Group(), SKIN = 0xf2c9a0;
  [-0.18, 0.18].forEach((x) => { const leg = toon(new THREE.CapsuleGeometry(0.13, 0.5, 6, 12), 0x2c3550); leg.position.set(x, 0.38, 0); root.add(leg);
    const shoe = toon(new THREE.SphereGeometry(0.17, 16, 12), 0xf4f1ea); shoe.scale.set(1, 0.6, 1.5); shoe.position.set(x, 0.07, 0.06); root.add(shoe); });
  const body = toon(new THREE.CapsuleGeometry(0.42, 0.55, 8, 20), hoodie); body.position.y = 1.15; root.add(body);
  const pocket = toon(new THREE.BoxGeometry(0.5, 0.18, 0.05), new THREE.Color(hoodie).multiplyScalar(0.8).getHex(), { outline: 0.03 }); pocket.position.set(0, 0.98, 0.4); root.add(pocket);
  const arm = (side: number) => { const a = new THREE.Group(); a.position.set(side * 0.5, 1.45, 0);
    const up = toon(new THREE.CapsuleGeometry(0.11, 0.5, 6, 12), hoodie); up.position.y = -0.3; a.add(up);
    const hand = toon(new THREE.SphereGeometry(0.13, 16, 12), SKIN); hand.position.y = -0.65; a.add(hand); root.add(a); return a; };
  const armL = arm(-1), armR = arm(1);
  const head = new THREE.Group(); head.position.y = 2.05; root.add(head);
  head.add(toon(new THREE.SphereGeometry(0.62, 40, 32), SKIN, { outline: 0.035 }));
  const hair = toon(new THREE.SphereGeometry(0.64, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.42), 0x5a3a22, { outline: 0.03 }); hair.rotation.x = -0.25; head.add(hair);
  [-1, 1].forEach((s) => { const ear = toon(new THREE.SphereGeometry(0.13, 12, 10), SKIN, { outline: 0.06 }); ear.position.set(s * 0.6, -0.02, 0); ear.scale.z = 0.6; head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); eye.position.set(s * 0.22, 0.08, 0.53); eye.scale.z = 0.5; head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), new THREE.MeshBasicMaterial({ color: INK })); pupil.position.set(s * 0.22, 0.07, 0.6); head.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); glint.position.set(s * 0.22 + 0.025, 0.1, 0.66); head.add(glint); });
  const browGeo = new THREE.BoxGeometry(0.2, 0.045, 0.04), ink = new THREE.MeshBasicMaterial({ color: INK });
  const browL = new THREE.Mesh(browGeo, ink), browR = new THREE.Mesh(browGeo, ink); browL.position.set(-0.22, 0.27, 0.56); browR.position.set(0.22, 0.27, 0.56); head.add(browL, browR);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12), new THREE.MeshBasicMaterial({ color: 0x5b1a24 })); mouth.position.set(0, -0.22, 0.56); head.add(mouth);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 8, 24, Math.PI), ink); smile.position.set(0, -0.17, 0.57); head.add(smile);
  const cheek = new THREE.MeshBasicMaterial({ color: 0xf19a8c, transparent: true, opacity: 0.55 });
  [-1, 1].forEach((s) => { const ch = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), cheek); ch.position.set(s * 0.38, -0.1, 0.5); ch.lookAt(s * 2, -0.5, 3); head.add(ch); });
  const sweat = toon(new THREE.SphereGeometry(0.07, 12, 10), 0x7fd3ff, { outline: 0.08 }); sweat.scale.y = 1.5; sweat.position.set(0.5, 0.3, 0.35); head.add(sweat);
  return { root, head, mouth, smile, browL, browR, armL, armR, sweat, body };
}
function poseRig(r: Rig, mood: Mood, t: number, talk: number, local: number) {
  r.root.position.y = Math.abs(Math.sin(t * 2)) * 0.02;
  r.body.scale.set(1 + Math.sin(t * 2) * 0.012, 1 - Math.sin(t * 2) * 0.012, 1);
  r.head.rotation.set(Math.sin(t * 1.3) * 0.05 + talk * 0.05, Math.sin(t * 0.7) * 0.18, Math.sin(t * 0.9) * 0.05);
  r.mouth.scale.set(1.3 - talk * 0.3, 0.15 + talk * 1.1, 0.5); r.mouth.visible = talk > 0.05;
  const up = mood === 'happy';
  r.smile.visible = !r.mouth.visible; r.smile.rotation.z = up || mood === 'neutral' ? Math.PI : 0; r.smile.position.y = up || mood === 'neutral' ? -0.17 : -0.27;
  r.smile.scale.x = mood === 'neutral' ? 0.6 : 1;
  const tilt = mood === 'angry' ? 0.35 : mood === 'sad' || mood === 'worried' ? -0.3 : up ? -0.08 : 0;
  r.browL.rotation.z = -tilt; r.browR.rotation.z = tilt; r.browL.position.y = r.browR.position.y = 0.27 + (up ? 0.04 : 0) + talk * 0.02;
  r.sweat.visible = mood === 'worried' || mood === 'sad'; r.sweat.position.y = 0.3 - ((t * 0.4) % 0.3);
  const enter = spring(local / 0.5);
  const wave = up ? -2.4 + Math.sin(t * 8) * 0.3 : mood === 'angry' ? -0.6 + Math.sin(t * 12) * 0.15 : -0.2 - talk * 0.5;
  r.armR.rotation.z = (up ? 1 : 0.15) * enter * (up ? -wave * 0.5 : 0.15) + 0.12; r.armR.rotation.x = up ? 0 : -talk * 0.6 - Math.sin(t * 3) * 0.05;
  r.armL.rotation.z = -0.12 - (mood === 'worried' ? 0.4 : 0); r.armL.rotation.x = mood === 'worried' ? -1.6 : Math.sin(t * 1.7) * 0.05;
  if (up) r.armR.rotation.z = 2.3 + Math.sin(t * 8) * 0.25;
}

// ---------- sets ----------
function sky(setting: string) {
  return setting === 'night' || setting === 'space' ? 0x1b2140 : setting === 'sunset' ? 0xf6a56b : setting === 'rain' ? 0x8796a8 : 0xa9dcf6;
}
function buildSet(scene: ExplainerScene, world: THREE.Group, night: boolean, seed: number) {
  const s = scene.setting || (scene.visual === 'city_night' ? 'night' : 'office');
  let rnd = seed * 9301 + 49297; const R = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
  const indoor = s === 'office' || s === 'room' || s === 'sunburst' || !scene.setting;
  if (indoor) {
    const wallC = s === 'room' ? 0xf3d9b1 : 0xe6ecef;
    const floor = toon(new THREE.BoxGeometry(14, 0.2, 10), s === 'room' ? 0xb7825a : 0xc99b6d, { outline: 0 }); floor.position.set(0, -0.1, 0); world.add(floor);
    const back = toon(new THREE.BoxGeometry(14, 7, 0.2), wallC, { outline: 0 }); back.position.set(0, 3.4, -3); world.add(back);
    const side = toon(new THREE.BoxGeometry(0.2, 7, 10), new THREE.Color(wallC).multiplyScalar(0.9).getHex(), { outline: 0 }); side.position.set(-5.5, 3.4, 1); world.add(side);
    // window with blinds and real light coming through
    const frame = toon(new THREE.BoxGeometry(2.6, 2, 0.15), 0xffffff, { outline: 0.02 }); frame.position.set(-2.3, 3, -2.88); world.add(frame);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.7), new THREE.MeshBasicMaterial({ color: night ? 0x2d3a6b : 0xbfe9ff })); pane.position.set(-2.3, 3, -2.79); world.add(pane);
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 0.04), new THREE.MeshToonMaterial({ color: 0xf2f2f2, gradientMap: gradient() })); b.position.set(-2.3, 3.75 - i * 0.18, -2.75); world.add(b); }
    if (s === 'room') {
      const bed = toon(new THREE.BoxGeometry(3, 0.6, 2), 0x6c8fd6); bed.position.set(2.6, 0.3, -1.6); world.add(bed);
      const pillow = toon(new THREE.BoxGeometry(0.9, 0.25, 0.6), 0xffffff); pillow.position.set(3.6, 0.72, -1.6); world.add(pillow);
      const poster = toon(new THREE.BoxGeometry(1.2, 1.6, 0.05), 0xe5578f, { outline: 0.02 }); poster.position.set(1.3, 3.4, -2.88); world.add(poster);
    } else {
      const desk = toon(new THREE.BoxGeometry(2.6, 0.12, 1.2), 0x8d5a3b); desk.position.set(2.2, 1.05, -1.2); world.add(desk);
      [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]].forEach(([x, z]) => { const l = toon(new THREE.BoxGeometry(0.1, 1, 0.1), 0x5b3a26, { outline: 0.02 }); l.position.set(2.2 + x, 0.5, -1.2 + z); world.add(l); });
      const mon = toon(new THREE.BoxGeometry(1.3, 0.8, 0.08), 0x2a2a35); mon.position.set(2.3, 1.75, -1.55); world.add(mon);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.68), new THREE.MeshBasicMaterial({ color: 0x5fc6ff })); scr.position.set(2.3, 1.75, -1.5); world.add(scr);
      const mug = toon(new THREE.CylinderGeometry(0.1, 0.09, 0.22, 16), 0xe63946); mug.position.set(1.4, 1.22, -1); world.add(mug);
      const pot = toon(new THREE.CylinderGeometry(0.16, 0.12, 0.25, 12), 0xd17a3a); pot.position.set(3.2, 1.24, -1); world.add(pot);
      const cactus = toon(new THREE.CapsuleGeometry(0.09, 0.3, 4, 10), 0x3aa35b); cactus.position.set(3.2, 1.55, -1); world.add(cactus);
      const cal = toon(new THREE.BoxGeometry(0.8, 1, 0.04), 0xffffff, { outline: 0.02 }); cal.position.set(0.6, 3.3, -2.88); world.add(cal);
      const calTop = toon(new THREE.BoxGeometry(0.8, 0.22, 0.05), 0xe63946, { outline: 0 }); calTop.position.set(0.6, 3.72, -2.86); world.add(calTop);
    }
    return { indoor: true };
  }
  const groundC = s === 'beach' ? 0xf2d59b : s === 'forest' || s === 'sky_day' ? 0x7cc46a : s === 'space' ? 0x6a6f86 : s === 'sunset' ? 0x9bbf6a : 0x8a8f99;
  const ground = toon(new THREE.CircleGeometry(30, 48), groundC, { outline: 0 }); ground.rotation.x = -Math.PI / 2; world.add(ground);
  if (s === 'city_day' || s === 'night' || s === 'road' || s === 'rain') {
    const road = toon(new THREE.BoxGeometry(40, 0.02, 2.4), 0x3d4048, { outline: 0 }); road.position.set(0, 0.01, 2.6); world.add(road);
    for (let i = 0; i < 14; i++) {
      const h = 2 + R() * 5, bw = 1.4 + R(), x = -12 + i * 1.9, col = [0xe9c46a, 0x8ab6d6, 0xe76f51, 0xb7b7d1, 0x9fd8cb][i % 5];
      const b = toon(new THREE.BoxGeometry(bw, h, 1.6), night ? new THREE.Color(col).multiplyScalar(0.45).getHex() : col, { outline: 0.015 }); b.position.set(x, h / 2, -4 - R() * 2); world.add(b);
      for (let k = 0; k < Math.floor(h / 0.7); k++) { const win = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: night ? (R() > 0.4 ? 0xffe17a : 0x2b2f55) : 0xd6f0ff })); win.position.set(x + (R() > 0.5 ? 0.3 : -0.3), 0.6 + k * 0.7, b.position.z + 0.81); world.add(win); }
    }
  } else {
    for (let i = 0; i < (s === 'forest' ? 16 : 7); i++) {
      const x = (R() - 0.5) * 18, z = -3 - R() * 6;
      const trunk = toon(new THREE.CylinderGeometry(0.12, 0.16, 1, 8), 0x7a4b2a, { outline: 0.03 }); trunk.position.set(x, 0.5, z); world.add(trunk);
      const top = s === 'beach' ? toon(new THREE.ConeGeometry(0.9, 0.3, 7), 0x3aa35b) : toon(new THREE.SphereGeometry(0.8 + R() * 0.4, 14, 12), 0x3c9a4f); top.position.set(x, 1.5, z); world.add(top);
    }
  }
  if (s !== 'night' && s !== 'space' && s !== 'rain') { const sun = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 16), new THREE.MeshBasicMaterial({ color: s === 'sunset' ? 0xff7a45 : 0xffe066 })); sun.position.set(6, 8, -14); world.add(sun); }
  for (let i = 0; i < 4; i++) { const cl = new THREE.Group(); [0, 0.7, -0.7].forEach((dx, k) => { const p = toon(new THREE.SphereGeometry(0.7 - k * 0.1, 14, 10), s === 'rain' ? 0x7c8696 : 0xffffff, { outline: 0.02 }); p.position.x = dx; cl.add(p); }); cl.position.set(-8 + i * 5, 6 + R() * 2, -10); cl.userData.drift = 0.2 + R() * 0.3; world.add(cl); }
  return { indoor: false };
}

// ---------- hero props ----------
function screenTex(scene: ExplainerScene, kind: 'chat' | 'profile' | 'site') {
  return textTexture(360, 720, (c) => {
    c.fillStyle = '#F4F1EA'; c.fillRect(0, 0, 360, 720);
    if (kind === 'profile') {
      const g = c.createLinearGradient(0, 0, 360, 200); g.addColorStop(0, '#F58529'); g.addColorStop(1, '#DD2A7B'); c.fillStyle = g; c.fillRect(0, 0, 360, 190);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(180, 190, 70, 0, Math.PI * 2); c.fill(); c.fillStyle = '#F2C9A0'; c.beginPath(); c.arc(180, 190, 58, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#222'; c.font = FONT(30); c.textAlign = 'center'; c.fillText(scene.label || '@seuperfil', 180, 300);
      c.font = FONT(20, 600); c.fillStyle = '#555'; c.fillText('1.240 posts · 98 mil seguidores', 180, 338);
      rrect(c, 40, 370, 280, 64, 18); c.fillStyle = '#2F80ED'; c.fill(); c.fillStyle = '#fff'; c.font = FONT(28); c.fillText('Seguir', 180, 412);
      rrect(c, 30, 460, 300, 70, 18); c.fillStyle = '#FFE066'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#1C1824'; c.stroke(); c.fillStyle = '#1C1824'; c.font = FONT(26); c.fillText('🔗 LINK NA BIO', 180, 505);
      for (let i = 0; i < 6; i++) { c.fillStyle = ['#8ab6d6', '#e9c46a', '#e76f51'][i % 3]; c.fillRect(12 + (i % 3) * 114, 560 + Math.floor(i / 3) * 80, 108, 74); }
    } else if (kind === 'chat') {
      c.fillStyle = '#1F7A57'; c.fillRect(0, 0, 360, 110); c.fillStyle = '#fff'; c.font = FONT(28); c.textAlign = 'left'; c.fillText(scene.label || 'Conversa', 90, 68);
      c.beginPath(); c.arc(50, 58, 26, 0, Math.PI * 2); c.fillStyle = '#ddd'; c.fill();
      c.font = FONT(24, 700); const lines = wrap(c, scene.chat || scene.text, 270);
      rrect(c, 24, 150, 312, lines.length * 34 + 30, 18); c.fillStyle = '#D7F7C4'; c.fill(); c.fillStyle = '#1C1824'; lines.forEach((l, i) => c.fillText(l, 42, 188 + i * 34));
    } else {
      c.fillStyle = '#2F80ED'; c.fillRect(0, 0, 360, 80); c.fillStyle = '#fff'; c.font = FONT(26); c.textAlign = 'center'; c.fillText(scene.label || 'Meu site', 180, 52);
      c.fillStyle = '#FFE066'; c.fillRect(30, 120, 300, 180); c.fillStyle = '#1C1824'; c.font = FONT(30); c.fillText('OFERTA', 180, 220);
      [340, 420, 500].forEach((y) => { c.fillStyle = '#cfd6e4'; c.fillRect(30, y, 300, 50); });
      rrect(c, 80, 600, 200, 64, 20); c.fillStyle = '#1F7A57'; c.fill(); c.fillStyle = '#fff'; c.font = FONT(26); c.fillText('Comprar', 180, 642);
    }
  });
}
function sign(text: string) {
  const tex = textTexture(1024, 256, (c) => { rrect(c, 8, 8, 1008, 240, 60); c.fillStyle = '#FFFFFF'; c.fill(); c.lineWidth = 14; c.strokeStyle = '#1C1824'; c.stroke(); c.fillStyle = '#1C1824'; c.font = FONT(110, 900); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text.toUpperCase().slice(0, 18), 512, 132); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); return m;
}
function heroProp(scene: ExplainerScene): THREE.Group | null {
  const g = new THREE.Group(), v = scene.visual;
  if (v === 'phone_chat' || v === 'profile') {
    g.add(toon(new THREE.BoxGeometry(0.9, 1.75, 0.1), 0x1c1824));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), new THREE.MeshBasicMaterial({ map: screenTex(scene, v === 'profile' ? 'profile' : 'chat') })); scr.position.z = 0.056; g.add(scr);
  } else if (v === 'laptop') {
    const base = toon(new THREE.BoxGeometry(1.8, 0.08, 1.2), 0x9aa3b5); g.add(base);
    const lid = new THREE.Group(); lid.position.set(0, 0.04, -0.6); lid.rotation.x = -0.25; g.add(lid);
    const shell = toon(new THREE.BoxGeometry(1.8, 1.15, 0.06), 0x2a2a35); shell.position.y = 0.58; lid.add(shell);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 1.02), new THREE.MeshBasicMaterial({ map: screenTex(scene, 'site') })); scr.position.set(0, 0.58, 0.035); lid.add(scr);
    g.rotation.x = 0.35;
  } else if (v === 'money') {
    for (let i = 0; i < 7; i++) { const coin = toon(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 28), 0xf5c242, { outline: 0.06 }); coin.position.set((i % 3 - 1) * 0.7, Math.floor(i / 3) * 0.5, 0); coin.rotation.x = Math.PI / 2; coin.userData.spin = 1 + i * 0.3; g.add(coin); }
  } else if (v === 'chart_up') {
    [0.5, 0.9, 1.4, 2.1].forEach((h, i) => { const b = toon(new THREE.BoxGeometry(0.35, h, 0.35), [0x23a59a, 0x2f80ed, 0xf28c28, 0x3aa35b][i]); b.position.set(-0.75 + i * 0.5, h / 2, 0); b.userData.grow = h; g.add(b); });
    const arrow = toon(new THREE.ConeGeometry(0.22, 0.45, 4), 0xe63946); arrow.position.set(1.05, 2.4, 0); arrow.rotation.z = -0.6; g.add(arrow);
  } else if (v === 'clock') {
    const face = toon(new THREE.CylinderGeometry(0.85, 0.85, 0.15, 40), 0xffffff); face.rotation.x = Math.PI / 2; g.add(face);
    const hm = toon(new THREE.BoxGeometry(0.06, 0.5, 0.05), 0x1c1824, { outline: 0 }), mm = toon(new THREE.BoxGeometry(0.04, 0.7, 0.05), 0xe63946, { outline: 0 });
    hm.position.z = mm.position.z = 0.1; hm.userData.hand = 0.2; mm.userData.hand = 2.4; g.add(hm, mm);
  } else if (v === 'map_pins') {
    const map = toon(new THREE.BoxGeometry(2.4, 0.05, 1.6), 0x9fd8cb); g.add(map);
    [[-0.6, 0.2], [0.4, -0.3], [0.8, 0.4]].forEach(([x, z], i) => { const pin = new THREE.Group(); const head = toon(new THREE.SphereGeometry(0.16, 16, 12), 0xe63946); head.position.y = 0.45; pin.add(head); const tip = toon(new THREE.ConeGeometry(0.1, 0.35, 12), 0xe63946); tip.rotation.x = Math.PI; tip.position.y = 0.2; pin.add(tip); pin.position.set(x, 0, z); pin.userData.drop = i * 0.3; g.add(pin); });
    g.rotation.x = 0.5;
  } else if (v === 'scale') {
    g.add(toon(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 10), 0x6b7280)); const beam = new THREE.Group(); beam.position.y = 0.7; beam.userData.swing = 1; g.add(beam);
    beam.add(toon(new THREE.BoxGeometry(2, 0.06, 0.06), 0x6b7280)); [-1, 1].forEach((s) => { const pan = toon(new THREE.CylinderGeometry(0.4, 0.3, 0.08, 20), s < 0 ? 0xf5c242 : 0x8ab6d6); pan.position.set(s * 0.95, -0.4, 0); beam.add(pan); });
  } else if (v === 'eye') {
    const eye = toon(new THREE.SphereGeometry(0.8, 32, 24), 0xffffff); g.add(eye); const iris = toon(new THREE.SphereGeometry(0.38, 24, 16), 0x2f80ed, { outline: 0 }); iris.position.z = 0.55; iris.scale.z = 0.5; g.add(iris);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), new THREE.MeshBasicMaterial({ color: INK })); pup.position.z = 0.72; g.add(pup);
  } else return null;
  return g;
}

// ---------- engine ----------
type Shot = { pos: THREE.Vector3; look: THREE.Vector3 };
export class Toon3D {
  canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 9 / 16, 0.1, 100);
  private world = new THREE.Group();
  private key = '';
  private rig: ToonCharacterRig | null = null;
  private rigPos = { x: 0, y: 0, z: 0 };
  private prop: THREE.Group | null = null;
  private labelSign: THREE.Mesh | null = null;
  private shot: { from: Shot; to: Shot } | null = null;
  constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(this.world);
  }
  private build(scene: ExplainerScene, index: number, portrait: boolean) {
    this.world.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material & { map?: THREE.Texture }; if (mat && mat !== OUTLINE) { mat.map?.dispose(); mat.dispose?.(); } });
    this.world.clear();
    const night = scene.palette === 'night' || scene.setting === 'night' || scene.setting === 'space' || scene.visual === 'city_night';
    this.scene.background = new THREE.Color(sky(scene.setting || (night ? 'night' : 'sky_day')));
    this.scene.fog = new THREE.Fog(this.scene.background, 14, 34);
    this.world.add(new THREE.HemisphereLight(night ? 0x8090ff : 0xffffff, 0x705848, night ? 0.9 : 1.4));
    const sun = new THREE.DirectionalLight(night ? 0xaab8ff : 0xfff1d6, night ? 1.4 : 2.4); sun.position.set(-4, 8, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); sun.shadow.bias = -0.0005; this.world.add(sun);
    const rim = new THREE.DirectionalLight(night ? 0xff8ad8 : 0xbfe3ff, 1.1); rim.position.set(5, 4, -5); this.world.add(rim);
    const set = buildSet(scene, this.world, night, index + 1);
    this.rig?.dispose(); this.rig = createCharacterRig({ bodyColor: 0x22325a }); this.rigPos = { x: 0, y: 0, z: 0 }; const holder = new THREE.Group(); holder.position.y = 1.62; holder.scale.setScalar(1.15); holder.add(this.rig.root); this.world.add(holder);
    this.prop = heroProp(scene);
    // alternate cinematic shots so consecutive scenes never share framing
    const kind = this.prop ? (index % 2 ? 'prop_close' : 'two_shot') : (['medium', 'close', 'wide'] as const)[index % 3];
    const back = portrait ? 1.45 : 1;
    if (this.prop) {
      this.prop.position.set(kind === 'prop_close' ? 0 : 1.25, 1.6, kind === 'prop_close' ? 1.4 : 0.6); this.world.add(this.prop);
      if (kind === 'prop_close') this.rigPos = { x: -1.3, y: 0, z: -0.8 };
    }
    const look = kind === 'prop_close' ? new THREE.Vector3(0, 1.7, 1.4) : kind === 'two_shot' ? new THREE.Vector3(0.6, 1.6, 0) : kind === 'close' ? new THREE.Vector3(0, 2, 0) : new THREE.Vector3(0, 1.4, 0);
    const dist = (kind === 'close' ? 2.6 : kind === 'prop_close' ? 3 : kind === 'wide' ? 8 : 5) * back;
    const ang = kind === 'wide' ? 0.55 : index % 2 ? 0.25 : -0.25, hgt = kind === 'wide' ? 2.6 : 0.3;
    const to = { pos: new THREE.Vector3(look.x + Math.sin(ang) * dist, look.y + hgt, look.z + Math.cos(ang) * dist), look };
    const from = { pos: to.pos.clone().multiplyScalar(1).add(new THREE.Vector3(-Math.sin(ang) * 1.2, 0.4, 1.2)), look: look.clone() };
    this.shot = { from, to };
    this.labelSign = scene.label ? sign(scene.label) : null;
    if (this.labelSign) { this.labelSign.position.set(look.x, look.y + (kind === 'close' ? 1.05 : 1.9), look.z + 0.3); this.world.add(this.labelSign); }
    void set;
  }
  render(plan: ExplainerPlan, t: number, w: number, h: number) {
    if (this.canvas.width !== w || this.canvas.height !== h) { this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    const at = sceneAt(plan, t);
    if (!at) { this.scene.background = new THREE.Color(0x7b5cd6); this.renderer.render(this.scene, this.camera); return; }
    const { scene, local, index } = at, portrait = h > w;
    const key = `${index}|${scene.text}|${scene.visual}|${scene.setting}|${scene.palette}|${scene.label}|${portrait}`;
    if (key !== this.key) { this.key = key; this.build(scene, index, portrait); }
    const wd = wordAt(scene, local);
    const talk = wd?.speaking ? 0.35 + 0.65 * Math.abs(Math.sin(wd.since * 17 + wd.index)) : 0;
    if (this.rig) {
      const expression: FacialExpression = scene.mood === 'happy' ? 'smirk_patrick' : scene.mood === 'angry' ? 'angry' : scene.mood === 'sad' || scene.mood === 'worried' ? 'confused' : 'neutral';
      const pose: CharacterPose = scene.mood === 'worried' && local < 1.2 ? 'shocked' : this.prop ? (local < 1.6 ? 'pointing' : 'talking') : talk > 0 ? 'talking' : 'idle';
      const ch: ToonCharacter = { id: 'host', pose, expression, gaze: this.prop ? 'lookAtProp' : 'lookAtCamera', prop: 'none', position: this.rigPos, rotationY: this.prop ? 0.25 : 0, scale: 1 };
      updateCharacterRig(this.rig, ch, t);
    }
    // glance at the hero prop but keep the face toward camera
    if (this.rig && this.prop) this.rig.head.rotation.y += clamp(Math.atan2(this.prop.position.x - this.rig.root.position.x, 3), -0.35, 0.35) * (0.5 + 0.5 * Math.sin(t * 0.8));
    if (this.prop) {
      const s = spring((local - 0.15) / 0.55); this.prop.scale.setScalar(Math.max(0.001, s));
      this.prop.rotation.y = Math.sin(t * 1.2) * 0.25; this.prop.position.y = 1.6 + Math.sin(t * 1.8) * 0.05;
      this.prop.children.forEach((ch) => {
        const d = ch.userData;
        if (d.spin) ch.rotation.z = t * d.spin * 2;
        if (d.grow) { const k = clamp(spring((local - 0.3) / 0.8)); ch.scale.y = Math.max(0.01, k); ch.position.y = (d.grow * k) / 2; }
        if (d.hand) ch.rotation.z = -t * d.hand;
        if (d.drop !== undefined) ch.position.y = Math.max(0, 1.5 * (1 - spring((local - 0.3 - d.drop) / 0.5)));
        if (d.swing) ch.rotation.z = Math.sin(t * 2.4) * 0.18;
      });
    }
    if (this.labelSign) { const s = spring((local - 0.45) / 0.45); this.labelSign.scale.setScalar(Math.max(0.001, s)); this.labelSign.rotation.z = -0.05 + Math.sin(t * 2) * 0.03; this.labelSign.lookAt(this.camera.position); }
    this.world.children.forEach((o) => { if (o.userData.drift) o.position.x += 0.004 * o.userData.drift; });
    if (this.shot) {
      const k = ease(local / 0.9), push = Math.min(local, 8) * 0.03;
      const pos = this.shot.from.pos.clone().lerp(this.shot.to.pos, k);
      const dir = this.shot.to.look.clone().sub(pos).normalize(); pos.addScaledVector(dir, push);
      const kick = Math.max(0, 1 - local / 0.3);
      pos.x += Math.sin(local * 60) * 0.03 * kick; pos.y += Math.cos(local * 50) * 0.03 * kick;
      this.camera.position.copy(pos); this.camera.lookAt(this.shot.to.look);
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this.renderer.dispose(); }
}
