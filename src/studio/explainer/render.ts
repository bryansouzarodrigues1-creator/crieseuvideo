// Code-drawn 2D explainer renderer (flat cartoon, sunburst backgrounds, word-by-word captions).
import { ExplainerPlan, ExplainerScene, sceneAt, wordAt, words, Mood } from './plan';

const PAL: Record<string, [string, string]> = {
  orange: ['#F08A3C', '#E46F2A'], purple: ['#8B6FD6', '#6E52C2'], teal: ['#2FA8A8', '#22898C'],
  pink: ['#E46A92', '#CF4F7A'], night: ['#3A3350', '#24203A'],
};
const INK = '#2A2230', SKIN = '#F2C49B', HAIR = '#3B2A22', GREEN = '#1F7A57', PAPER = '#F4F1EA';
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const outBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const pop = (t: number, delay = 0, len = 0.4) => outBack(clamp((t - delay) / len));
const FONT = (px: number) => `${Math.round(px)}px 'Lilita One', 'Plus Jakarta Sans', sans-serif`;
const BODY = (px: number, w = 700) => `${w} ${Math.round(px)}px 'Plus Jakarta Sans', sans-serif`;

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
}
function shape(c: CanvasRenderingContext2D, fill: string, lw: number, stroke = INK) {
  c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = stroke; c.stroke();
}
function withPop(c: CanvasRenderingContext2D, x: number, y: number, s: number, fn: () => void) {
  if (s <= 0.001) return; c.save(); c.translate(x, y); c.scale(s, s); fn(); c.restore();
}

function sunburst(c: CanvasRenderingContext2D, w: number, h: number, pal: [string, string], t: number) {
  c.fillStyle = pal[1]; c.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.42, R = Math.hypot(w, h), n = 22;
  c.save(); c.translate(cx, cy); c.rotate(t * 0.05); c.fillStyle = pal[0];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a, a + Math.PI / n); c.closePath(); c.fill();
  }
  c.restore();
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6);
  g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}

function caption(c: CanvasRenderingContext2D, scene: ExplainerScene, local: number, w: number, y: number, u: number) {
  const wd = wordAt(scene, local); if (!wd) return;
  const clean = wd.word.replace(/[^\p{L}\d$%,!?"]/gu, '').toUpperCase();
  const hl = (scene.highlight || []).some((h) => h.toLowerCase().replace(/[^\p{L}\d]/gu, '') === wd.word.toLowerCase().replace(/[^\p{L}\d]/gu, ''));
  let size = 120 * u; c.font = FONT(size);
  while (c.measureText(clean).width > w * 0.86 && size > 30) { size -= 6; c.font = FONT(size); }
  const s = 0.75 + 0.25 * pop(wd.since, 0, 0.18);
  c.save(); c.translate(w / 2, y); c.scale(s, s); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = 14 * u; c.strokeStyle = INK; c.strokeText(clean, 0, 0);
  c.fillStyle = hl ? '#FFD23F' : '#FFFFFF'; c.fillText(clean, 0, 0); c.restore();
}

function badge(c: CanvasRenderingContext2D, text: string, x: number, y: number, u: number, s: number, rot = -0.05, fill = '#FFFFFF', color = INK) {
  withPop(c, x, y, s, () => {
    c.rotate(rot); c.font = FONT(64 * u); const tw = c.measureText(text).width + 70 * u, th = 100 * u;
    c.fillStyle = 'rgba(0,0,0,0.2)'; rr(c, -tw / 2 + 6 * u, -th / 2 + 8 * u, tw, th, th / 2); c.fill();
    rr(c, -tw / 2, -th / 2, tw, th, th / 2); shape(c, fill, 6 * u);
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 0, 2 * u);
  });
}

export function drawCharacter(c: CanvasRenderingContext2D, x: number, y: number, u: number, mood: Mood, t: number) {
  const bob = Math.sin(t * 3) * 6 * u, lw = 7 * u;
  c.save(); c.translate(x, y + bob);
  // body
  c.beginPath(); c.moveTo(-170 * u, 330 * u); c.quadraticCurveTo(-160 * u, 170 * u, 0, 165 * u); c.quadraticCurveTo(160 * u, 170 * u, 170 * u, 330 * u); c.closePath(); shape(c, '#9AA3B5', lw);
  c.beginPath(); c.moveTo(-30 * u, 190 * u); c.lineTo(-30 * u, 240 * u); c.moveTo(30 * u, 190 * u); c.lineTo(30 * u, 240 * u); c.lineWidth = 5 * u; c.stroke();
  // ears + head
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 128 * u, 10 * u, 26 * u, 36 * u, 0, 0, Math.PI * 2); shape(c, SKIN, lw); }
  c.beginPath(); c.ellipse(0, 0, 128 * u, 150 * u, 0, 0, Math.PI * 2); shape(c, SKIN, lw);
  // hair
  c.beginPath(); c.moveTo(-130 * u, -10 * u); c.bezierCurveTo(-150 * u, -170 * u, 130 * u, -200 * u, 132 * u, -20 * u);
  c.bezierCurveTo(90 * u, -90 * u, -20 * u, -60 * u, -60 * u, -110 * u); c.bezierCurveTo(-80 * u, -60 * u, -110 * u, -40 * u, -130 * u, -10 * u); shape(c, HAIR, lw);
  // eyes
  const blink = (t % 3.2) > 3.05 ? 0.1 : 1, look = Math.sin(t * 0.9) * 6 * u;
  for (const s of [-1, 1]) {
    c.beginPath(); c.ellipse(s * 48 * u, 10 * u, 30 * u, 32 * u * blink, 0, 0, Math.PI * 2); shape(c, '#FFFFFF', 6 * u);
    if (blink > 0.5) { c.beginPath(); c.arc(s * 48 * u + look, 14 * u, 14 * u, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); }
    // brows
    const tilt = mood === 'angry' ? 0.35 : mood === 'sad' || mood === 'worried' ? -0.35 : 0;
    c.save(); c.translate(s * 48 * u, -36 * u - (mood === 'happy' ? 6 * u : 0)); c.rotate(s * tilt);
    c.beginPath(); c.moveTo(-26 * u, 0); c.lineTo(26 * u, 0); c.lineWidth = 9 * u; c.lineCap = 'round'; c.strokeStyle = HAIR; c.stroke(); c.restore();
  }
  c.strokeStyle = INK;
  // nose
  c.beginPath(); c.arc(4 * u, 52 * u, 12 * u, -Math.PI * 0.6, Math.PI * 0.4); c.lineWidth = 5 * u; c.stroke();
  // mouth
  c.beginPath();
  if (mood === 'happy') { c.moveTo(-48 * u, 82 * u); c.quadraticCurveTo(0, 140 * u, 48 * u, 82 * u); c.closePath(); shape(c, '#C0392B', 6 * u); }
  else if (mood === 'sad' || mood === 'worried') { c.moveTo(-34 * u, 108 * u); c.quadraticCurveTo(0, 80 * u, 34 * u, 108 * u); c.lineWidth = 7 * u; c.stroke(); }
  else if (mood === 'angry') { c.moveTo(-36 * u, 100 * u); c.lineTo(36 * u, 100 * u); c.lineWidth = 8 * u; c.stroke(); }
  else { c.moveTo(-28 * u, 96 * u); c.quadraticCurveTo(0, 108 * u, 28 * u, 96 * u); c.lineWidth = 7 * u; c.stroke(); }
  if (mood === 'worried') { c.beginPath(); c.ellipse(118 * u, -70 * u, 10 * u, 16 * u, 0, 0, Math.PI * 2); shape(c, '#8FD3FF', 4 * u); }
  c.restore();
}

function phone(c: CanvasRenderingContext2D, u: number, local: number, chat: string, header: string) {
  const w = 420 * u, h = 780 * u;
  rr(c, -w / 2, -h / 2, w, h, 56 * u); shape(c, INK, 6 * u);
  rr(c, -w / 2 + 18 * u, -h / 2 + 18 * u, w - 36 * u, h - 36 * u, 40 * u); shape(c, PAPER, 0.001);
  c.save(); rr(c, -w / 2 + 18 * u, -h / 2 + 18 * u, w - 36 * u, 110 * u, 40 * u); c.clip(); c.fillStyle = GREEN; c.fillRect(-w / 2, -h / 2, w, 130 * u); c.restore();
  rr(c, -50 * u, -h / 2 + 30 * u, 100 * u, 22 * u, 11 * u); c.fillStyle = INK; c.fill();
  c.beginPath(); c.arc(-w / 2 + 70 * u, -h / 2 + 92 * u, 18 * u, 0, Math.PI * 2); shape(c, '#D9D9D9', 4 * u, '#FFFFFF');
  c.fillStyle = '#FFFFFF'; c.font = BODY(28 * u, 800); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(header, -w / 2 + 100 * u, -h / 2 + 92 * u);
  // typed bubble
  const n = Math.floor(clamp((local - 0.4) / 1.6) * chat.length), shown = chat.slice(0, n);
  if (!n) return;
  c.font = BODY(26 * u, 700); const maxW = w - 120 * u, lines: string[] = []; let line = '';
  for (const wd of shown.split(' ')) { const test = line ? line + ' ' + wd : wd; if (c.measureText(test).width > maxW && line) { lines.push(line); line = wd; } else line = test; }
  lines.push(line);
  const bh = lines.length * 36 * u + 36 * u, bx = -w / 2 + 40 * u, by = -h / 2 + 160 * u;
  rr(c, bx, by, w - 80 * u, bh, 18 * u); shape(c, '#D7F7C4', 5 * u);
  c.fillStyle = INK; lines.forEach((l, i) => c.fillText(l, bx + 20 * u, by + 36 * u + i * 36 * u));
}

function laptop(c: CanvasRenderingContext2D, u: number, local: number, label?: string) {
  const w = 620 * u, h = 400 * u;
  rr(c, -w / 2, -h / 2, w, h, 24 * u); shape(c, INK, 6 * u);
  rr(c, -w / 2 + 20 * u, -h / 2 + 20 * u, w - 40 * u, h - 40 * u, 10 * u); shape(c, PAPER, 0.001);
  rr(c, -w / 2 - 50 * u, h / 2, w + 100 * u, 30 * u, 14 * u); shape(c, '#9AA3B5', 6 * u);
  // building site blocks
  const prog = clamp((local - 0.3) / 1.4);
  const blocks: [number, number, number, number, string][] = [[-260, -150, 520, 40, GREEN], [-260, -90, 280, 28, INK], [-260, -50, 220, 20, '#9AA3B5'], [-260, 0, 160, 44, '#F08A3C'], [60, -90, 200, 170, '#FFD23F']];
  blocks.forEach(([x, y, bw, bh, col], i) => { if (prog * blocks.length > i) { rr(c, x * u, y * u, bw * u, bh * u, 8 * u); c.fillStyle = col; c.fill(); } });
  if (label) badge(c, label, w * 0.25, -h / 2 - 20 * u, u, pop(local, 0.9), -0.12, '#F08A3C', '#FFFFFF');
}

function mapPins(c: CanvasRenderingContext2D, u: number, local: number) {
  const w = 640 * u, h = 480 * u;
  rr(c, -w / 2, -h / 2, w, h, 24 * u); shape(c, '#CFEAD6', 7 * u);
  c.save(); rr(c, -w / 2, -h / 2, w, h, 24 * u); c.clip(); c.fillStyle = '#FFFFFF';
  for (const x of [-180, 0, 170]) c.fillRect(x * u, -h / 2, 34 * u, h);
  for (const y of [-120, 30, 150]) c.fillRect(-w / 2, y * u, w, 30 * u);
  c.fillStyle = '#9FD3F4'; c.fillRect(150 * u, -h / 2, 200 * u, 80 * u); c.restore();
  const pins = [[-220, -60], [-60, -150], [120, -40], [250, 60], [-130, 120], [40, 90], [220, -170], [-250, 160]];
  pins.forEach(([x, y], i) => {
    const s = pop(local, 0.2 + i * 0.12, 0.35); if (s <= 0) return;
    c.save(); c.translate(x * u, (y - 40 * (1 - s)) * u); c.scale(s, s);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-34 * u, -40 * u, -26 * u, -72 * u, 0, -72 * u); c.bezierCurveTo(26 * u, -72 * u, 34 * u, -40 * u, 0, 0); shape(c, i === 3 ? '#2ECC71' : '#E74C3C', 5 * u);
    c.beginPath(); c.arc(0, -48 * u, 9 * u, 0, Math.PI * 2); c.fillStyle = '#FFFFFF'; c.fill(); c.restore();
  });
}

function clock(c: CanvasRenderingContext2D, u: number, local: number) {
  c.beginPath(); c.arc(0, 0, 220 * u, 0, Math.PI * 2); shape(c, '#FFFFFF', 12 * u);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 180 * u, Math.sin(a) * 180 * u); c.lineTo(Math.cos(a) * 200 * u, Math.sin(a) * 200 * u); c.lineWidth = 8 * u; c.stroke(); }
  const hand = (a: number, len: number, lw: number, col: string) => { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a) * len * u, -Math.cos(a) * len * u); c.lineWidth = lw * u; c.lineCap = 'round'; c.strokeStyle = col; c.stroke(); };
  hand(local * 6, 160, 10, '#E74C3C'); hand(local * 0.5, 110, 16, INK);
  c.beginPath(); c.arc(0, 0, 16 * u, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); c.strokeStyle = INK;
}

function scale(c: CanvasRenderingContext2D, u: number, local: number, chips: string[]) {
  const tilt = Math.sin(clamp(local / 1.6) * Math.PI * 0.5) * 0.22;
  c.beginPath(); c.moveTo(0, -150 * u); c.lineTo(0, 260 * u); c.lineWidth = 16 * u; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.moveTo(-120 * u, 290 * u); c.lineTo(120 * u, 290 * u); c.lineTo(0, 220 * u); c.closePath(); shape(c, '#C9CED8', 6 * u);
  c.save(); c.translate(0, -150 * u); c.rotate(-tilt); rr(c, -300 * u, -10 * u, 600 * u, 20 * u, 10 * u); shape(c, '#C9CED8', 6 * u);
  [-1, 1].forEach((s, i) => {
    c.save(); c.translate(s * 280 * u, 0); c.rotate(tilt);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 110 * u); c.lineWidth = 5 * u; c.stroke();
    c.beginPath(); c.ellipse(0, 120 * u, 90 * u, 22 * u, 0, 0, Math.PI); shape(c, '#FFFFFF', 6 * u);
    if (chips[i]) { c.font = FONT(36 * u); c.textAlign = 'center'; c.fillStyle = GREEN; c.fillText(chips[i], 0, 90 * u); }
    c.restore();
  });
  c.restore(); c.beginPath(); c.arc(0, -150 * u, 22 * u, 0, Math.PI * 2); shape(c, '#FFD23F', 6 * u);
}

function eye(c: CanvasRenderingContext2D, u: number, local: number) {
  const open = (local % 2.6) > 2.45 ? 0.08 : 1;
  c.beginPath(); c.moveTo(-300 * u, 0); c.quadraticCurveTo(0, -260 * u * open, 300 * u, 0); c.quadraticCurveTo(0, 260 * u * open, -300 * u, 0); shape(c, '#FFFFFF', 14 * u);
  if (open < 0.5) return;
  const lx = Math.sin(local * 1.4) * 40 * u;
  c.beginPath(); c.arc(lx, 0, 110 * u, 0, Math.PI * 2); shape(c, '#22B07D', 8 * u);
  c.beginPath(); c.arc(lx, 0, 55 * u, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
  c.beginPath(); c.arc(lx + 30 * u, -30 * u, 20 * u, 0, Math.PI * 2); c.fillStyle = '#FFFFFF'; c.fill();
}

function city(c: CanvasRenderingContext2D, w: number, h: number, u: number, local: number) {
  c.fillStyle = '#0B1A24'; c.fillRect(0, 0, w, h);
  const rnd = (i: number) => { const x = Math.sin(i * 91.7) * 43758.5; return x - Math.floor(x); };
  for (let i = 0; i < 9; i++) {
    const bw = w / 7, bx = i * bw * 0.85 - bw * 0.3, bh = h * (0.35 + rnd(i) * 0.3), by = h * 0.62 - bh;
    c.fillStyle = i % 2 ? '#13283A' : '#102230'; c.fillRect(bx, by, bw, bh + h);
    for (let r = 0; r < 14; r++) for (let k = 0; k < 4; k++) {
      if (rnd(i * 100 + r * 7 + k) > 0.55) { c.fillStyle = rnd(r + k + i) > 0.5 ? '#F4D58D' : '#9FD3F4'; c.fillRect(bx + 12 * u + k * bw / 4.4, by + 20 * u + r * 44 * u, 16 * u, 22 * u); }
    }
  }
  const g = c.createRadialGradient(w / 2, h * 0.66, 0, w / 2, h * 0.66, w * 0.5); g.addColorStop(0, 'rgba(46,204,151,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.save(); c.translate(w / 2, h * 0.66);
  rr(c, -170 * u, -120 * u, 340 * u, 160 * u, 10 * u); shape(c, '#CFF5E7', 6 * u, '#0B1A24');
  for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#FFFFFF' : '#2B5AA8'; c.fillRect(-190 * u + i * 63 * u, -170 * u, 63 * u, 50 * u); }
  const s = pop(local, 0.3), by = -320 * u + Math.sin(local * 3) * 12 * u;
  withPop(c, 0, by, s, () => { c.beginPath(); c.moveTo(0, 60 * u); c.bezierCurveTo(-70 * u, -10 * u, -55 * u, -90 * u, 0, -90 * u); c.bezierCurveTo(55 * u, -90 * u, 70 * u, -10 * u, 0, 60 * u); shape(c, '#3DDC97', 6 * u, '#0B1A24'); c.beginPath(); c.arc(0, -30 * u, 22 * u, 0, Math.PI * 2); c.fillStyle = '#0B1A24'; c.fill(); });
  c.restore();
}

export function drawExplainerFrame(c: CanvasRenderingContext2D, plan: ExplainerPlan, t: number) {
  const w = c.canvas.width, h = c.canvas.height, u = Math.min(w, h) / 1080;
  const at = sceneAt(plan, t); if (!at) return;
  const { scene, local } = at;
  if (scene.visual === 'city_night') city(c, w, h, u, local); else sunburst(c, w, h, PAL[scene.palette] || PAL.orange, t);
  const portrait = h > w, cy = portrait ? h * 0.55 : h * 0.58, k = portrait ? 1.15 : 0.9;
  const enter = pop(local, 0.05, 0.5);
  withPop(c, w / 2, cy, enter * k, () => {
    switch (scene.visual) {
      case 'phone_chat': phone(c, u, local, scene.chat || scene.text, scene.label || 'Conversa'); break;
      case 'laptop': laptop(c, u, local, scene.label); break;
      case 'map_pins': mapPins(c, u, local); break;
      case 'clock': clock(c, u, local); break;
      case 'scale': scale(c, u, local, scene.chips || []); break;
      case 'eye': eye(c, u, local); break;
      case 'chips': {
        const chips = scene.chips?.length ? scene.chips : words(scene.text).filter((x) => x.length > 4).slice(0, 4);
        chips.forEach((ch, i) => badge(c, ch.toUpperCase(), (i % 2 ? 1 : -1) * 170 * u, (-180 + i * 120) * u, u, pop(local, 0.3 + i * 0.25), i % 2 ? 0.05 : -0.05, i % 2 ? '#FFFFFF' : '#3DDC97'));
        break;
      }
      case 'city_night': break;
      default: drawCharacter(c, 0, -60 * u, u * 1.3, scene.mood, t);
    }
  });
  if (scene.label && scene.visual !== 'laptop' && scene.visual !== 'phone_chat' && scene.visual !== 'chips')
    badge(c, scene.label.toUpperCase(), w / 2, portrait ? h * 0.3 : h * 0.27, u, pop(local, 0.5), -0.06, scene.visual === 'city_night' ? '#3DDC97' : '#FFFFFF');
  caption(c, scene, local, w, portrait ? h * 0.13 : h * 0.13, u);
}
