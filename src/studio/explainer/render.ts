// Code-drawn 2D explainer renderer (flat cartoon, sunburst backgrounds, word-by-word captions).
import { ExplainerPlan, ExplainerScene, sceneAt, sceneDuration, wordAt, words, Mood, MOODS } from './plan';
import { drawStory } from './storyRender';
import type { Shape } from './drawing';
import { drawSetting } from './settings';
import { laidOut, foregroundExtent } from './layout';
import { frameZones, fitScale, centerIn, padRect, scaleRect, MAX_CAPTION_LINES, type FrameZones, type Rect } from './safeZone';

const PAL: Record<string, [string, string]> = {
  orange: ['#F08A3C', '#E46F2A'], purple: ['#8B6FD6', '#6E52C2'], teal: ['#2FA8A8', '#22898C'],
  pink: ['#E46A92', '#CF4F7A'], night: ['#3A3350', '#24203A'],
};
const INK = '#2A2230', SKIN = '#F1C8A4', HAIR = '#B9853F', GREEN = '#1F7A57', PAPER = '#F4F1EA';
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const outBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
/** Damped spring (harmonic oscillator): 0 → ~1.15 overshoot → settles at 1 in about `len`·2.5 seconds. */
export const spring = (x: number) => (x <= 0 ? 0 : x >= 3 ? 1 : 1 - Math.exp(-5 * x) * Math.cos(9 * x));
const pop = (t: number, delay = 0, len = 0.4) => spring((t - delay) / len);
void outBack;
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

/** Caption pages: fixed font size per scene, at most MAX_CAPTION_LINES lines per page, stable between frames. */
interface CapPage { from: number; to: number; lines: number[][]; size: number }
const pageCache = new Map<string, CapPage[]>();
export function captionPages(c: CanvasRenderingContext2D, all: string[], maxW: number, design: number, minSize: number): CapPage[] {
  c.font = FONT(design);
  const key = `${all.join(' ')}|${Math.round(maxW)}|${Math.round(design)}|${Math.round(c.measureText('MMMMMMMM').width)}`;
  const hit = pageCache.get(key); if (hit) return hit;
  const up = all.map((x) => x.toUpperCase());
  // one font size for the whole scene: shrink until the longest single word fits the line width
  let size = design;
  const widest = () => { c.font = FONT(size); return Math.max(...up.map((x) => c.measureText(x).width)); };
  while (widest() > maxW && size > minSize) size -= 2;
  c.font = FONT(size);
  const sp = c.measureText(' ').width, wordW = up.map((x) => c.measureText(x).width);
  const pages: CapPage[] = [];
  let page: CapPage = { from: 0, to: -1, lines: [[]], size }, lw = 0;
  all.forEach((_, i) => {
    let line = page.lines[page.lines.length - 1];
    if (line.length && lw + sp + wordW[i] > maxW) {
      if (page.lines.length >= MAX_CAPTION_LINES) { pages.push(page); page = { from: i, to: i - 1, lines: [[]], size }; }
      else page.lines.push([]);
      line = page.lines[page.lines.length - 1]; lw = 0;
    }
    lw += (line.length ? sp : 0) + wordW[i]; line.push(i); page.to = i;
  });
  if (page.to >= page.from) pages.push(page);
  if (pageCache.size > 200) pageCache.clear();
  pageCache.set(key, pages);
  return pages;
}

/**
 * Word-by-word caption locked to the bottom band of the frame: never more than 2 lines, the last
 * line always sits on the same baseline and nothing else is ever drawn inside the band.
 */
function caption(c: CanvasRenderingContext2D, scene: ExplainerScene, local: number, z: FrameZones, u: number) {
  const wd = wordAt(scene, local); if (!wd) return;
  const all = words(scene.text), key = (x: string) => x.toLowerCase().replace(/[^\p{L}\d]/gu, '');
  const hlSet = new Set((scene.highlight || []).map(key));
  const maxW = z.caption.x1 - z.caption.x0;
  const pages = captionPages(c, all, maxW, z.captionFont, 24 * u);
  const page = pages.find((p) => wd.index >= p.from && wd.index <= p.to) ?? pages[pages.length - 1]; if (!page) return;
  const lh = page.size * 1.12, fade = pop(local, 0, 0.2);
  c.save(); c.globalAlpha = Math.min(1, fade); c.textBaseline = 'middle'; c.textAlign = 'left'; c.lineJoin = 'round'; c.font = FONT(page.size);
  const sp = c.measureText(' ').width, base = z.caption.y1 - lh / 2 - 6 * u;
  page.lines.forEach((line, li) => {
    const ly = base - (page.lines.length - 1 - li) * lh;
    const lineW = line.reduce((a, k) => a + c.measureText(all[k].toUpperCase()).width, 0) + sp * (line.length - 1);
    let x = (z.caption.x0 + z.caption.x1) / 2 - lineW / 2;
    for (const k of line) {
      const txt = all[k].toUpperCase(), ww = c.measureText(txt).width, active = k === wd.index;
      c.lineWidth = 12 * u; c.strokeStyle = INK; c.strokeText(txt, x, ly);
      c.fillStyle = active ? '#FFD23F' : hlSet.has(key(all[k])) ? '#FFE88A' : k < wd.index ? '#FFFFFF' : 'rgba(255,255,255,0.72)';
      c.fillText(txt, x, ly); x += ww + sp;
    }
  });
  c.restore();
}

function badge(c: CanvasRenderingContext2D, text: string, x: number, y: number, u: number, s: number, rot = -0.05, fill = '#FFFFFF', color = INK) {
  withPop(c, x, y, s, () => {
    c.rotate(rot); let fs = 64 * u; c.font = FONT(fs); while (c.measureText(text).width > c.canvas.width * 0.72 && fs > 24 * u) { fs -= 4 * u; c.font = FONT(fs); } const tw = c.measureText(text).width + 70 * u, th = fs * 1.56;
    c.fillStyle = 'rgba(0,0,0,0.2)'; rr(c, -tw / 2 + 6 * u, -th / 2 + 8 * u, tw, th, th / 2); c.fill();
    rr(c, -tw / 2, -th / 2, tw, th, th / 2); shape(c, fill, 6 * u);
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 0, 2 * u);
  });
}

const rand = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Two-bone arm (shoulder → elbow → hand) solved with simple IK so gestures bend naturally. */
function arm(c: CanvasRenderingContext2D, sx: number, sy: number, hx: number, hy: number, len: number, side: number, u: number, sleeve: string, fist = false) {
  const dx = hx - sx, dy = hy - sy, d = Math.min(Math.hypot(dx, dy), len * 1.98);
  const a = Math.atan2(dy, dx), bend = Math.acos(clamp(d / (2 * len), -1, 1)) * -side;
  const ex = sx + Math.cos(a + bend) * len, ey = sy + Math.sin(a + bend) * len;
  const fx = sx + Math.cos(a) * d, fy = sy + Math.sin(a) * d;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(ex, ey, fx, fy);
  c.strokeStyle = INK; c.lineWidth = 46 * u; c.stroke(); c.strokeStyle = sleeve; c.lineWidth = 32 * u; c.stroke();
  c.beginPath(); c.arc(fx, fy, (fist ? 26 : 24) * u, 0, Math.PI * 2); shape(c, SKIN, 6 * u);
  if (!fist) { c.beginPath(); c.ellipse(fx + side * -14 * u, fy - 18 * u, 8 * u, 14 * u, side * 0.5, 0, Math.PI * 2); shape(c, SKIN, 5 * u); }
}

/**
 * Expressive presenter: breathing, head tilt and nods on each spoken word, eye saccades and blinks,
 * mood-driven arm gestures and a mouth that opens with the narration.
 */
export function drawCharacter(c: CanvasRenderingContext2D, x: number, y: number, u: number, mood: Mood, t: number, talk = 0, beat = 1, arms = true) {
  const lw = 7 * u, breath = Math.sin(t * 2.2), slump = mood === 'sad' ? 1 : 0;
  const nod = (1 - smooth(clamp(beat / 0.3))) * 0.015;
  c.save(); c.translate(x, y + Math.sin(t * 1.4) * 2 * u + slump * 18 * u);
  // soft ground shadow
  c.beginPath(); c.ellipse(0, 345 * u, 210 * u, 26 * u, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fill();
  // body with breathing
  c.save(); c.translate(0, 330 * u); c.scale(1 + breath * 0.008, 1 + breath * 0.016); c.translate(0, -330 * u);
  // navy jacket, slate vest with buttons, open-collar light blue shirt
  const top = 168 * u + slump * 18 * u, JACKET = '#2E3650', VEST = '#4A5873', SHIRT = '#CFE3F5';
  c.beginPath(); c.moveTo(-175 * u, 340 * u); c.quadraticCurveTo(-170 * u, 180 * u, 0, top); c.quadraticCurveTo(170 * u, 180 * u, 175 * u, 340 * u); c.closePath(); shape(c, JACKET, lw);
  c.beginPath(); c.moveTo(-70 * u, top + 10 * u); c.lineTo(-80 * u, 340 * u); c.lineTo(80 * u, 340 * u); c.lineTo(70 * u, top + 10 * u); c.closePath(); shape(c, VEST, 5 * u);
  c.beginPath(); c.moveTo(-50 * u, top + 2 * u); c.lineTo(0, 260 * u); c.lineTo(50 * u, top + 2 * u); c.closePath(); shape(c, SHIRT, 5 * u);
  c.beginPath(); c.moveTo(-50 * u, top); c.lineTo(-20 * u, 215 * u); c.lineTo(0, top + 20 * u); c.moveTo(50 * u, top); c.lineTo(20 * u, 215 * u); c.lineTo(0, top + 20 * u); c.lineWidth = 5 * u; c.strokeStyle = INK; c.fillStyle = '#FFFFFF'; c.stroke();
  for (const s2 of [-1, 1]) { c.beginPath(); c.moveTo(s2 * 70 * u, top + 10 * u); c.lineTo(s2 * 30 * u, 290 * u); c.lineTo(s2 * 110 * u, 230 * u); c.closePath(); shape(c, JACKET, 5 * u); }
  for (const by of [280, 310]) { c.beginPath(); c.arc(0, by * u, 6 * u, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); }
  c.restore();
  // arms: target hand positions per mood, animated with time and speech beats
  const sh = 205 * u + slump * 20 * u, wave = Math.sin(t * 1.6) * 0.3, sway = Math.sin(t * 1.2) * 0.5;
  const hands: [number, number, boolean][] = (() => {
    switch (mood) {
      case 'happy': return [[-250 + wave * 20, -40 + wave * 15, false], [250 - wave * 20, -40 - wave * 15, false]];
      case 'sad': return [[-150, 360, false], [150, 360, false]];
      case 'worried': return [[-170, 330 + sway * 6, false], [120, -80, false]];
      case 'angry': return [[-200 + 0, 300, true], [200 - 0, 300, true]];
      default: return [[-170, 330 + sway * 6, false], [210 + talk * 10, 150 - talk * 20 + sway * 6, false]];
    }
  })();
  if (arms) {
  arm(c, -140 * u, sh, hands[0][0] * u, hands[0][1] * u, 120 * u, -1, u, '#2E3650', hands[0][2]);
  arm(c, 140 * u, sh, hands[1][0] * u, hands[1][1] * u, 120 * u, 1, u, '#2E3650', hands[1][2]);
  }
  // head group: idle tilt + nod on every word
  c.save(); c.translate(0, 150 * u); c.rotate(Math.sin(t * 0.9) * 0.02 + (mood === 'sad' ? 0.06 : 0)); c.translate(0, nod * 200 * u - 150 * u);
  for (const s2 of [-1, 1]) { c.beginPath(); c.ellipse(s2 * 128 * u, 10 * u, 26 * u, 36 * u, 0, 0, Math.PI * 2); shape(c, SKIN, lw); }
  c.beginPath(); c.ellipse(0, 0, 128 * u, 150 * u, 0, 0, Math.PI * 2); shape(c, SKIN, lw);
  // tousled, swept-back wavy golden hair with side locks
  c.beginPath(); c.moveTo(-132 * u, 40 * u);
  c.bezierCurveTo(-175 * u, -40 * u, -150 * u, -150 * u, -90 * u, -170 * u);
  c.bezierCurveTo(-60 * u, -215 * u, 20 * u, -205 * u, 40 * u, -180 * u);
  c.bezierCurveTo(90 * u, -200 * u, 160 * u, -150 * u, 150 * u, -70 * u);
  c.bezierCurveTo(165 * u, -30 * u, 150 * u, 20 * u, 132 * u, 40 * u);
  c.bezierCurveTo(130 * u, -20 * u, 115 * u, -70 * u, 70 * u, -95 * u);
  c.bezierCurveTo(30 * u, -70 * u, -40 * u, -75 * u, -60 * u, -110 * u);
  c.bezierCurveTo(-95 * u, -80 * u, -125 * u, -30 * u, -132 * u, 40 * u); shape(c, HAIR, lw);
  c.beginPath(); for (const [x0, y0, x1, y1] of [[-90, -150, -30, -110], [0, -170, 50, -120], [70, -160, 110, -100]]) { c.moveTo(x0 * u, y0 * u); c.quadraticCurveTo(((x0 + x1) / 2 + 20) * u, ((y0 + y1) / 2 - 15) * u, x1 * u, y1 * u); }
  c.lineWidth = 5 * u; c.strokeStyle = '#7A5424'; c.stroke();
  // eyes: random saccades between fixation points, eased; natural blink curve
  const seg = Math.floor(t / 1.4), f = smooth(clamp((t % 1.4) / 0.12));
  const lookX = ((rand(seg - 1) - 0.5) * (1 - f) + (rand(seg) - 0.5) * f) * 18 * u, lookY = ((rand(seg + 50) - 0.5) * f) * 8 * u;
  const bp = (t + 0.7) % 3.4, blink = bp < 0.16 ? Math.abs(Math.cos((bp / 0.16) * Math.PI)) * 0.9 + 0.1 : 1;
  const squint = mood === 'happy' ? 0.7 : mood === 'angry' ? 0.75 : mood === 'neutral' ? 0.78 : 1;
  for (const s2 of [-1, 1]) {
    c.beginPath(); c.ellipse(s2 * 48 * u, 10 * u, 30 * u, 32 * u * blink * squint, 0, 0, Math.PI * 2); shape(c, '#FFFFFF', 6 * u);
    if (blink > 0.45) { c.beginPath(); c.arc(s2 * 48 * u + lookX, 14 * u + lookY, 14 * u, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); c.beginPath(); c.arc(s2 * 48 * u + lookX + 5 * u, 9 * u + lookY, 4 * u, 0, Math.PI * 2); c.fillStyle = '#FFFFFF'; c.fill(); }
    const tilt = mood === 'angry' ? 0.35 : mood === 'sad' || mood === 'worried' ? -0.35 : 0;
    const lift = (mood === 'happy' ? 8 : 0) + talk * 6 + 0;
    c.save(); c.translate(s2 * 48 * u, -36 * u - lift * u); c.rotate(s2 * tilt);
    c.beginPath(); c.moveTo(-26 * u, 0); c.quadraticCurveTo(0, -6 * u, 26 * u, 0); c.lineWidth = 9 * u; c.lineCap = 'round'; c.strokeStyle = '#8A6030'; c.stroke(); c.restore();
  }
  c.strokeStyle = INK;
  c.beginPath(); c.arc(4 * u, 52 * u, 12 * u, -Math.PI * 0.6, Math.PI * 0.4); c.lineWidth = 5 * u; c.stroke();
  if (mood === 'happy' || mood === 'neutral') { for (const s2 of [-1, 1]) { c.beginPath(); c.ellipse(s2 * 82 * u, 66 * u, 20 * u, 11 * u, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(231,76,60,0.22)'; c.fill(); } }
  // mouth: mood shape, opened by narration amplitude
  c.beginPath();
  if (talk > 0.08) {
    const mw = (mood === 'happy' ? 44 : 34) * u, mh = (10 + talk * 34) * u, my = (mood === 'sad' ? 104 : 96) * u;
    c.ellipse(0, my, mw, mh, 0, 0, Math.PI * 2); shape(c, '#6B1E22', 6 * u);
    c.save(); c.clip(); c.beginPath(); c.ellipse(0, my + mh * 0.8, mw * 0.7, mh * 0.6, 0, 0, Math.PI * 2); c.fillStyle = '#E86A6A'; c.fill(); c.fillStyle = '#FFFFFF'; c.fillRect(-mw, my - mh, mw * 2, mh * 0.35); c.restore();
  } else if (mood === 'happy') { c.moveTo(-48 * u, 82 * u); c.quadraticCurveTo(0, 140 * u, 48 * u, 82 * u); c.closePath(); shape(c, '#C0392B', 6 * u); }
  else if (mood === 'sad' || mood === 'worried') { c.moveTo(-34 * u, 108 * u); c.quadraticCurveTo(0, 80 * u, 34 * u, 108 * u); c.lineWidth = 7 * u; c.stroke(); }
  else if (mood === 'angry') { c.moveTo(-36 * u, 100 * u); c.lineTo(36 * u, 100 * u); c.lineWidth = 8 * u; c.stroke(); }
  else { c.moveTo(-34 * u, 100 * u); c.quadraticCurveTo(5 * u, 112 * u, 40 * u, 86 * u); c.lineWidth = 7 * u; c.stroke(); c.beginPath(); c.arc(44 * u, 84 * u, 5 * u, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); }
  if (mood === 'worried') { const dy = ((t * 0.8) % 1) * 40 * u; c.beginPath(); c.ellipse(118 * u, -70 * u + dy, 10 * u, 16 * u, 0, 0, Math.PI * 2); shape(c, '#8FD3FF', 4 * u); }
  if (mood === 'angry') { c.globalAlpha = 0.85; for (const s2 of [-1, 1]) { c.beginPath(); c.moveTo(s2 * 150 * u, -150 * u); c.lineTo(s2 * 185 * u, -185 * u); c.moveTo(s2 * 170 * u, -120 * u); c.lineTo(s2 * 210 * u, -130 * u); c.lineWidth = 8 * u; c.strokeStyle = '#E74C3C'; c.stroke(); } c.globalAlpha = 1; }
  c.restore();
  c.restore();
}

function chartUp(c: CanvasRenderingContext2D, u: number, local: number) {
  const w = 600 * u, h = 440 * u;
  rr(c, -w / 2, -h / 2, w, h, 28 * u); shape(c, '#FFFFFF', 7 * u);
  const vals = [0.25, 0.4, 0.35, 0.6, 0.8, 1];
  vals.forEach((v, i) => {
    const g = smooth(clamp((local - 0.2 - i * 0.12) / 0.5)), bh = v * 300 * u * g, bx = -240 * u + i * 85 * u;
    rr(c, bx, 170 * u - bh, 60 * u, Math.max(1, bh), 10 * u); shape(c, i === vals.length - 1 ? '#2ECC71' : '#9FD3F4', 5 * u);
  });
  const g = smooth(clamp((local - 0.9) / 0.6));
  c.beginPath(); c.moveTo(-210 * u, 80 * u);
  const pts = vals.map((v, i) => [-210 * u + i * 85 * u, 170 * u - v * 300 * u - 30 * u] as const);
  pts.forEach(([px, py], i) => { if (i / (pts.length - 1) <= g + 0.001) c.lineTo(px, py); });
  c.lineWidth = 12 * u; c.strokeStyle = '#E74C3C'; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  if (g >= 1) { const [px, py] = pts[pts.length - 1]; withPop(c, px, py, pop(local, 1.5), () => { c.beginPath(); c.moveTo(0, -36 * u); c.lineTo(30 * u, 10 * u); c.lineTo(-30 * u, 10 * u); c.closePath(); shape(c, '#E74C3C', 5 * u); }); }
}

function money(c: CanvasRenderingContext2D, u: number, local: number) {
  for (let i = 0; i < 14; i++) {
    const fall = ((local * 0.9 + rand(i)) % 1.2) / 1.2, x = (rand(i + 9) - 0.5) * 760 * u, y = -520 * u + fall * 1000 * u;
    c.save(); c.translate(x + Math.sin(local * 3 + i) * 30 * u, y); c.rotate(Math.sin(local * 2.5 + i) * 0.6); c.scale(Math.cos(local * 4 + i), 1);
    rr(c, -70 * u, -36 * u, 140 * u, 72 * u, 8 * u); shape(c, '#7BD389', 5 * u);
    c.beginPath(); c.arc(0, 0, 20 * u, 0, Math.PI * 2); c.fillStyle = '#4CAF6A'; c.fill(); c.restore();
  }
  const s = pop(local, 0.15, 0.5), bounce = Math.abs(Math.sin(local * 4)) * 14 * u;
  withPop(c, 0, 80 * u - bounce, s, () => {
    c.beginPath(); c.moveTo(-150 * u, -40 * u); c.quadraticCurveTo(-200 * u, 200 * u, 0, 200 * u); c.quadraticCurveTo(200 * u, 200 * u, 150 * u, -40 * u); c.quadraticCurveTo(0, -90 * u, -150 * u, -40 * u); shape(c, '#E3B04B', 7 * u);
    c.beginPath(); c.moveTo(-60 * u, -70 * u); c.lineTo(60 * u, -70 * u); c.lineWidth = 16 * u; c.strokeStyle = INK; c.stroke();
    c.font = FONT(150 * u); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.lineWidth = 10 * u; c.strokeText('$', 0, 70 * u); c.fillText('$', 0, 70 * u);
  });
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

function profile(c: CanvasRenderingContext2D, u: number, local: number, name?: string) {
  const w = 420 * u, h = 780 * u, top = -h / 2 + 18 * u;
  rr(c, -w / 2, -h / 2, w, h, 56 * u); shape(c, INK, 6 * u);
  rr(c, -w / 2 + 18 * u, top, w - 36 * u, h - 36 * u, 40 * u); shape(c, PAPER, 0.001);
  c.save(); rr(c, -w / 2 + 18 * u, top, w - 36 * u, 190 * u, 40 * u); c.clip(); const g = c.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#F58529'); g.addColorStop(1, '#DD2A7B'); c.fillStyle = g; c.fillRect(-w / 2, top, w, 200 * u); c.restore();
  c.beginPath(); c.arc(0, top + 190 * u, 70 * u * pop(local, 0.1), 0, Math.PI * 2); shape(c, SKIN, 6 * u);
  c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = BODY(30 * u, 800); c.fillText(name || '@seuperfil', 0, top + 300 * u);
  const s = pop(local, 0.4); rr(c, -150 * u, top + 340 * u, 300 * u, 66 * u, 20 * u); shape(c, '#2F80ED', 5 * u); c.fillStyle = '#FFFFFF'; c.fillText('Seguir', 0, top + 374 * u);
  const pulse = 1 + 0.06 * Math.sin(local * 8) * clamp(local - 0.8);
  c.save(); c.translate(0, top + 470 * u); c.scale(pulse * pop(local, 0.7), pulse * pop(local, 0.7)); rr(c, -170 * u, -40 * u, 340 * u, 80 * u, 20 * u); shape(c, '#FFE066', 6 * u); c.fillStyle = INK; c.font = BODY(30 * u, 900); c.fillText('🔗 LINK NA BIO', 0, 2 * u); c.restore();
  void s;
  const ay = top + 560 * u + Math.sin(local * 6) * 10 * u; c.beginPath(); c.moveTo(0, ay - 40 * u); c.lineTo(-34 * u, ay + 10 * u); c.lineTo(34 * u, ay + 10 * u); c.closePath(); shape(c, '#E63946', 5 * u);
}

/** Captions only, drawn over the 3D engine frame, in the same bottom band as the 2D engine. */
export function drawOverlay(c: CanvasRenderingContext2D, plan: ExplainerPlan, t: number) {
  const w = c.canvas.width, h = c.canvas.height, u = Math.min(w, h) / 1080, at = sceneAt(plan, t);
  if (at) caption(c, at.scene, at.local, frameZones(w, h), u);
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

function customDrawing(c: CanvasRenderingContext2D, u: number, local: number, t: number, shapes: Shape[], talk: number, beat: number) {
  const firstPerson = shapes.find((x) => x.type === 'person' || x.type === 'bust');
  shapes.forEach((sh, i) => {
    const d = sh.delay, ph = t * 1.3 + i;
    let sc = sh.anim === 'none' ? (local >= d ? 1 : 0) : pop(local, d, 0.45);
    if (sc <= 0.001) return;
    let dx = 0, dy = 0, rot = (sh.rot || 0) * Math.PI / 180, alpha = 1;
    switch (sh.anim) {
      case 'float': dy = Math.sin(ph * 1.4) * 10; break;
      case 'flicker': alpha = 0.75 + 0.25 * Math.sin(t * 11 + i * 2); sc *= 1 + 0.05 * Math.sin(t * 9 + i); break;
      case 'spin': rot += (local - d) * 2.2; break;
      case 'shake': dx = Math.sin(t * 30 + i) * 4 * Math.max(0, 1 - (local - d) / 0.8); break;
      case 'rise': dy = -Math.min(1, Math.max(0, local - d) / 2) * 80; break;
      case 'fall': dy = Math.min(1, Math.max(0, local - d) / 1.5) * 120; break;
      case 'pulse': sc *= 1 + 0.07 * Math.sin(t * 4 + i); break;
      case 'swing': rot += Math.sin(t * 2 + i) * 0.18; break;
      case 'rock': rot += Math.sin(t * 1.8 + i) * 0.1; break;
      case 'walk': dx = Math.sin(t * 0.8 + i) * 22; dy = -Math.abs(Math.sin(t * 4 + i)) * 5; break;
      case 'drive': dx = -700 + ((local - d) * 260) % 1400; dy = Math.sin(t * 14 + i) * 2; break;
      case 'bounce': dy = -Math.abs(Math.sin((local - d) * 3 + i)) * 30 * Math.max(0.3, 1 - (local - d) * 0.3); break;
      case 'grow': sc *= Math.min(1, Math.max(0.01, (local - d) / 1.2)); break;
      case 'zoom': sc *= 1 + Math.min(0.5, Math.max(0, local - d) * 0.12); break;
      case 'orbit': dx = Math.cos(t * 1.1 + i) * 50; dy = Math.sin(t * 1.1 + i) * 22; break;
    }
    if (sh.type === 'stamp' || sh.type === 'xmark' || sh.type === 'check') rot += (1 - clamp((local - d) / 0.35)) * -0.5; // stamp slam
    c.save(); c.globalAlpha *= alpha;
    c.translate((sh.x + dx) * u, (sh.y + dy) * u); c.rotate(rot); c.scale(sc, sc);
    // solid sticker shadow keeps every element in the same finished style
    if (sh.type !== 'line' && sh.type !== 'text') { c.shadowColor = 'rgba(20,10,30,0.28)'; c.shadowOffsetY = 9 * u; c.shadowOffsetX = 4 * u; c.shadowBlur = 0; }
    const fill = sh.color || '#FFFFFF', lw = 6 * u, st = sh.stroke || INK;
    const w = (sh.w || 120) * u, h = (sh.h || 120) * u, r = (sh.r || 60) * u;
    switch (sh.type) {
      case 'circle': c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); shape(c, fill, lw, st); break;
      case 'ellipse': c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); shape(c, fill, lw, st); break;
      case 'rect': rr(c, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.08); shape(c, fill, lw, st); break;
      case 'poly': case 'line': {
        const pts = sh.points || []; c.beginPath();
        pts.forEach(([px, py], k) => { const X = (px - sh.x) * u, Y = (py - sh.y) * u; k ? c.lineTo(X, Y) : c.moveTo(X, Y); });
        if (sh.type === 'poly') { c.closePath(); shape(c, fill, lw, st); }
        else { c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = st; c.lineWidth = (sh.size || 1) * 22 * u; c.stroke(); c.strokeStyle = fill; c.lineWidth = (sh.size || 1) * 12 * u; c.stroke(); }
        break;
      }
      case 'star': {
        c.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? r * 0.45 : r; k ? c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); }
        c.closePath(); shape(c, fill === '#FFFFFF' ? '#FFD23F' : fill, lw, st); break;
      }
      case 'flame': {
        const z = (sh.size || 1) * u;
        [['#E8402A', 1], ['#FF9F1C', 0.68], ['#FFE66D', 0.38]].forEach(([col, k], j) => {
          const f = Number(k) * z, wob = Math.sin(t * 9 + i + j) * 10 * f;
          c.beginPath(); c.moveTo(0, 60 * f);
          c.bezierCurveTo(-70 * f, 40 * f, -60 * f + wob, -40 * f, wob * 1.5, -130 * f - Math.abs(wob));
          c.bezierCurveTo(60 * f + wob, -40 * f, 70 * f, 40 * f, 0, 60 * f);
          if (j === 0) shape(c, String(col), 5 * u, st); else { c.fillStyle = String(col); c.fill(); }
        });
        break;
      }
      case 'text': {
        c.font = `${Math.round(64 * (sh.size || 1) * u)}px 'Lilita One', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineJoin = 'round'; c.lineWidth = 10 * u; c.strokeStyle = st; c.strokeText(sh.text || '', 0, 0); c.fillStyle = fill; c.fillText(sh.text || '', 0, 0); break;
      }
      case 'bust': {
        const mood = (MOODS as readonly string[]).includes(sh.mood || '') ? (sh.mood as Mood) : 'neutral';
        c.shadowColor = 'transparent';
        drawCharacter(c, 0, 0, u * 0.8 * (sh.size || 1), mood, t + i, sh === firstPerson ? talk : 0, beat, false);
        break;
      }
      case 'phone': case 'laptop': case 'pin': case 'scale': case 'chart': case 'coin': case 'clock': case 'stamp': case 'xmark': case 'check': case 'hand': case 'dog': case 'cat': case 'crowd': case 'skyline':
        drawProp(c, sh.type, (sh.size || 1) * u, sh.color, st, t + i, local - d, sh.text); break;
      case 'car': case 'house': case 'tree': case 'cloud': case 'building': case 'sun': case 'moon': case 'heart': case 'arrow': case 'bubble':
        drawObject(c, sh.type, (sh.size || 1) * u, sh.color, st, t + i, lw, sh.anim === 'drive' || sh.anim === 'walk', sh.text); break;
      case 'person': {
        const mood = (MOODS as readonly string[]).includes(sh.mood || '') ? (sh.mood as Mood) : 'neutral';
        drawCharacter(c, 0, 0, u * 0.55 * (sh.size || 1), mood, t + i, sh === firstPerson ? talk : 0, beat);
        break;
      }
    }
    c.restore();
  });
}

export function drawExplainerFrame(c: CanvasRenderingContext2D, plan: ExplainerPlan, t: number) {
  const w = c.canvas.width, h = c.canvas.height, u = Math.min(w, h) / 1080;
  const at = sceneAt(plan, t);
  if (!at) { sunburst(c, w, h, PAL.purple, t); return; }
  const { scene, local, index, duration } = at;
  // camera impact: short decaying shake as each scene lands
  const kick = Math.max(0, 1 - local / 0.35);
  c.save(); c.translate(Math.sin(local * 70) * 6 * u * kick, Math.cos(local * 55) * 5 * u * kick);
  try { drawSceneFrame(c, scene, local, index, duration, w, h, u, t); } finally { c.restore(); }
}

/** Drawn extent of each hero visual (px at u = 1, relative to its origin), measured from the draw code. */
const HERO_EXT: Record<string, Rect> = {
  character: { x0: -345, y0: -342, x1: 348, y1: 466 },
  phone_chat: { x0: -210, y0: -390, x1: 210, y1: 390 },
  profile: { x0: -210, y0: -390, x1: 210, y1: 390 },
  laptop: { x0: -360, y0: -244, x1: 377, y1: 230 },
  map_pins: { x0: -320, y0: -242, x1: 350, y1: 240 },
  clock: { x0: -220, y0: -220, x1: 220, y1: 220 },
  scale: { x0: -369, y0: -211, x1: 369, y1: 290 },
  eye: { x0: -300, y0: -260, x1: 300, y1: 260 },
  chart_up: { x0: -300, y0: -220, x1: 300, y1: 220 },
  money: { x0: -205, y0: -15, x1: 205, y1: 290 }, // the bag; falling bills are clipped above the caption band
  chips: { x0: -470, y0: -215, x1: 470, y1: 255 },
};
/** Labels that already live inside their prop; every other label gets the badge slot above the hero zone. */
const LABEL_IN_PROP = new Set(['laptop', 'phone_chat', 'profile', 'chips']);

function heroExtent(scene: ExplainerScene, u: number): Rect {
  if (scene.story) return scaleRect({ x0: -405, y0: -250, x1: 405, y1: 290 }, u);
  if (scene.visual === 'custom') return scaleRect(foregroundExtent(laidOut(scene.drawing || [])) ?? { x0: -420, y0: -290, x1: 420, y1: 430 }, u);
  return scaleRect(HERO_EXT[scene.visual] ?? HERO_EXT.character, u);
}

function drawHero(c: CanvasRenderingContext2D, scene: ExplainerScene, local: number, t: number, u: number, talk: number, beat: number) {
  switch (scene.visual) {
    case 'phone_chat': phone(c, u, local, scene.chat || scene.text, scene.label || 'Conversa'); break;
    case 'profile': profile(c, u, local, scene.label); break;
    case 'laptop': laptop(c, u, local, scene.label); break;
    case 'map_pins': mapPins(c, u, local); break;
    case 'clock': clock(c, u, local); break;
    case 'scale': scale(c, u, local, scene.chips || []); break;
    case 'eye': eye(c, u, local); break;
    case 'chart_up': chartUp(c, u, local); break;
    case 'money': money(c, u, local); break;
    case 'chips': {
      const chips = scene.chips?.length ? scene.chips : words(scene.text).filter((x) => x.length > 4).slice(0, 4);
      chips.forEach((ch, i) => badge(c, ch.toUpperCase(), (i % 2 ? 1 : -1) * 170 * u + Math.sin(t * 2 + i) * 6 * u, (-180 + i * 120) * u + Math.cos(t * 1.7 + i) * 6 * u, u, pop(local, 0.3 + i * 0.25), (i % 2 ? 0.05 : -0.05) + Math.sin(t * 1.5 + i) * 0.02, i % 2 ? '#FFFFFF' : '#3DDC97'));
      break;
    }
    case 'city_night': break;
    case 'custom':
      if (scene.story) drawStory(c, scene.story, u, local, sceneDuration(scene));
      else customDrawing(c, u, local, t, laidOut(scene.drawing || []), talk, beat);
      break;
    default: drawCharacter(c, 0, -60 * u, u * 1.3, scene.mood, t, talk, beat);
  }
}

/**
 * The scene's illustration alone (backdrop + hero visual, no caption/label), fitted inside the given canvas.
 * The 3D engine paints this onto the presentation board next to the host, so every script line gets
 * a matching visual in 3D too without modelling new 3D objects.
 */
export function drawBoardArt(c: CanvasRenderingContext2D, scene: ExplainerScene, local: number, t: number) {
  const w = c.canvas.width, h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  sunburst(c, w, h, PAL[scene.palette] || PAL.orange, t);
  // a lone host on the board would duplicate the 3D host: show the scene's key words instead
  const art: ExplainerScene = scene.visual === 'character' || scene.visual === 'city_night' ? { ...scene, visual: 'chips', label: undefined } : scene;
  const wd = wordAt(scene, local);
  const talk = wd?.speaking ? 0.35 + 0.65 * Math.abs(Math.sin(wd.since * 17 + wd.index)) : 0;
  const ext = padRect(heroExtent(art, 1), 30);
  const zone: Rect = { x0: w * 0.05, y0: h * 0.06, x1: w * 0.95, y1: h * 0.94 };
  const s = fitScale(ext, zone, Infinity) * (1 + Math.min(local, 8) * 0.006);
  const spot = centerIn(ext, zone, s);
  c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  withPop(c, spot.x, spot.y, s * Math.min(1, pop(local, 0.1, 0.5)), () => drawHero(c, art, local, t, 1, talk, wd?.since ?? 1));
  c.restore();
}

function drawSceneFrame(c: CanvasRenderingContext2D, scene: ExplainerScene, local: number, index: number, duration: number, w: number, h: number, u: number, t: number) {
  if (scene.visual === 'city_night') city(c, w, h, u, local); else if (!scene.setting || !drawSetting(c, scene.setting, w, h, t)) sunburst(c, w, h, PAL[scene.palette] || PAL.orange, t);
  const wd = wordAt(scene, local);
  const talk = wd?.speaking ? 0.35 + 0.65 * Math.abs(Math.sin(wd.since * 17 + wd.index)) * (1 - 0.4 * clamp(wd.since / 0.5)) : 0;
  const portrait = h > w, k = portrait ? 1.15 : 0.9;
  const outerLabel = !!scene.label && !LABEL_IN_PROP.has(scene.visual);
  const z = frameZones(w, h, outerLabel);
  // hero placement: the whole group is scaled to fit the hero zone (headroom kept for the push-in and idle float)
  // and centred in it, so it can never reach the label slot above or the caption band below
  const ext = padRect(heroExtent(scene, u), 6 * u);
  const push = 1 + Math.min(local, 8) * 0.008; // slow Ken Burns push-in
  const sBase = Math.min(k, fitScale(ext, z.hero, Infinity) / 1.065), sSteady = sBase * push;
  const spot = centerIn(ext, z.hero, sSteady);
  // camera: whip-in from alternating sides, slow push-in, quick exit
  const enter = pop(local, 0.05, 0.5), dir = index % 2 ? 1 : -1;
  const exit = smooth(clamp((local - (duration - 0.22)) / 0.22));
  const float = Math.sin(t * 1.6) * 8 * u, rot = Math.sin(t * 1.1) * 0.015;
  const px = spot.x + dir * (1 - smooth(clamp(local / 0.45))) * w * 0.18 - dir * exit * w * 0.25;
  const isProp = scene.visual !== 'custom' && scene.visual !== 'character' && scene.visual !== 'city_night' && scene.visual !== 'money';
  if (isProp && enter > 0.01) {
    const shadowW = Math.min(260 * u * sBase, ((ext.x1 - ext.x0) / 2) * sSteady * 0.8);
    c.beginPath(); c.ellipse(px, spot.y + (ext.y1 - 18 * u) * sSteady, shadowW * (1 - float / (80 * u)), 26 * u, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.16)'; c.fill();
  }
  c.save(); c.globalAlpha = 1 - exit;
  if (scene.visual === 'money') { c.beginPath(); c.rect(0, 0, w, z.caption.y0 - 4 * u); c.clip(); }
  withPop(c, px, spot.y + (isProp ? float : 0), Math.min(1, enter) * sBase * push * (1 - exit * 0.15), () => {
    if (isProp) c.rotate(rot);
    drawHero(c, scene, local, t, u, talk, wd?.since ?? 1);
  });
  c.restore();
  // label badge: fixed slot above the hero zone
  if (outerLabel)
    badge(c, scene.label!.toUpperCase(), w / 2, (z.label.y0 + z.label.y1) / 2, u, pop(local, 0.5) * (1 - exit), -0.06 + Math.sin(t * 2) * 0.02, scene.visual === 'city_night' ? '#3DDC97' : '#FFFFFF');
  caption(c, scene, local, z, u);
}

function drawObject(c: CanvasRenderingContext2D, type: string, z: number, col: string | undefined, st: string, t: number, lw: number, moving: boolean, text?: string) {
  const lw2 = lw;
  switch (type) {
    case 'car': {
      const body = col || '#E63946';
      c.beginPath(); c.moveTo(-170 * z, 30 * z); c.lineTo(-170 * z, -20 * z); c.lineTo(-110 * z, -30 * z); c.lineTo(-60 * z, -90 * z); c.lineTo(70 * z, -90 * z); c.lineTo(120 * z, -30 * z); c.lineTo(170 * z, -20 * z); c.lineTo(170 * z, 30 * z); c.closePath(); shape(c, body, lw2, st);
      c.beginPath(); c.moveTo(-90 * z, -32 * z); c.lineTo(-50 * z, -76 * z); c.lineTo(0, -76 * z); c.lineTo(0, -32 * z); c.closePath(); shape(c, '#BDE8FF', lw2 * 0.7, st);
      c.beginPath(); c.moveTo(14 * z, -32 * z); c.lineTo(14 * z, -76 * z); c.lineTo(62 * z, -76 * z); c.lineTo(100 * z, -32 * z); c.closePath(); shape(c, '#BDE8FF', lw2 * 0.7, st);
      c.beginPath(); c.arc(160 * z, -6 * z, 10 * z, 0, Math.PI * 2); shape(c, '#FFE66D', lw2 * 0.5, st);
      [-100, 100].forEach((x) => { c.save(); c.translate(x * z, 34 * z); c.rotate(moving ? t * 8 : 0); c.beginPath(); c.arc(0, 0, 38 * z, 0, Math.PI * 2); shape(c, '#2B2D42', lw2, st);
        c.beginPath(); c.arc(0, 0, 16 * z, 0, Math.PI * 2); shape(c, '#CED4DA', lw2 * 0.5, st); c.fillStyle = st; c.fillRect(-3 * z, -16 * z, 6 * z, 32 * z); c.restore(); });
      break;
    }
    case 'house': {
      rr(c, -130 * z, -80 * z, 260 * z, 180 * z, 6 * z); shape(c, col || '#F4A261', lw2, st);
      c.beginPath(); c.moveTo(-160 * z, -70 * z); c.lineTo(0, -200 * z); c.lineTo(160 * z, -70 * z); c.closePath(); shape(c, '#C1121F', lw2, st);
      rr(c, -30 * z, 10 * z, 60 * z, 90 * z, 6 * z); shape(c, '#8D5524', lw2, st);
      [-90, 90].forEach((x) => { rr(c, (x - 30) * z, -45 * z, 60 * z, 55 * z, 4 * z); shape(c, `rgba(255,230,109,${0.8 + 0.2 * Math.sin(t * 2)})`, lw2 * 0.7, st); });
      break;
    }
    case 'tree': {
      const sw = Math.sin(t * 1.4) * 0.05; rr(c, -20 * z, -40 * z, 40 * z, 140 * z, 6 * z); shape(c, '#8D5524', lw2, st);
      c.save(); c.rotate(sw); c.beginPath(); [[0, -130, 90], [-70, -80, 65], [70, -80, 65]].forEach(([x, y, r]) => { c.moveTo(x * z + r * z, y * z); c.arc(x * z, y * z, r * z, 0, Math.PI * 2); }); shape(c, col || '#2A9D8F', lw2, st); c.restore();
      break;
    }
    case 'cloud': c.beginPath(); [[-60, 0, 50], [0, -25, 60], [60, 0, 50]].forEach(([x, y, r]) => { c.moveTo(x * z + r * z, y * z); c.arc(x * z, y * z, r * z, 0, Math.PI * 2); }); shape(c, col || '#FFFFFF', lw2, st); break;
    case 'building': {
      rr(c, -90 * z, -320 * z, 180 * z, 420 * z, 6 * z); shape(c, col || '#577590', lw2, st);
      for (let y = -290; y < 60; y += 60) for (let x = -60; x <= 30; x += 45) { c.fillStyle = Math.sin(x * 3 + y + Math.floor(t)) > 0 ? '#FFE66D' : '#2B2D42'; c.fillRect(x * z, y * z, 28 * z, 36 * z); }
      break;
    }
    case 'sun': { c.save(); c.rotate(t * 0.4); c.strokeStyle = '#FFB703'; c.lineWidth = 14 * z; c.lineCap = 'round';
      for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; c.beginPath(); c.moveTo(Math.cos(a) * 100 * z, Math.sin(a) * 100 * z); c.lineTo(Math.cos(a) * 140 * z, Math.sin(a) * 140 * z); c.stroke(); } c.restore();
      c.beginPath(); c.arc(0, 0, 80 * z, 0, Math.PI * 2); shape(c, col || '#FFD23F', lw2, st); break; }
    case 'moon': c.beginPath(); c.arc(0, 0, 80 * z, 0.6, Math.PI * 2 - 0.6 + Math.PI * 0.0); c.arc(40 * z, -10 * z, 65 * z, Math.PI * 2 - 0.9, 0.9, true); c.closePath(); shape(c, col || '#F6F1D5', lw2, st); break;
    case 'heart': { const b = 1 + 0.08 * Math.max(0, Math.sin(t * 6)); c.scale(b, b); c.beginPath(); c.moveTo(0, 70 * z);
      c.bezierCurveTo(-120 * z, -10 * z, -60 * z, -110 * z, 0, -50 * z); c.bezierCurveTo(60 * z, -110 * z, 120 * z, -10 * z, 0, 70 * z); shape(c, col || '#EF233C', lw2, st); break; }
    case 'arrow': c.beginPath(); c.moveTo(-120 * z, -25 * z); c.lineTo(40 * z, -25 * z); c.lineTo(40 * z, -65 * z); c.lineTo(130 * z, 0); c.lineTo(40 * z, 65 * z); c.lineTo(40 * z, 25 * z); c.lineTo(-120 * z, 25 * z); c.closePath(); shape(c, col || '#3DDC97', lw2, st); break;
    case 'bubble': {
      const label = text || '...'; c.font = `${Math.round(46 * z)}px 'Lilita One', sans-serif`;
      const tw = Math.max(120 * z, c.measureText(label).width + 60 * z);
      rr(c, -tw / 2, -60 * z, tw, 100 * z, 30 * z); shape(c, col || '#FFFFFF', lw2, st);
      c.beginPath(); c.moveTo(-20 * z, 38 * z); c.lineTo(-40 * z, 80 * z); c.lineTo(10 * z, 38 * z); c.closePath(); shape(c, col || '#FFFFFF', lw2, st);
      c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, 0, -10 * z); break;
    }
  }
}


/** Polished sticker-style props the AI can freely combine (all drawn in code, no images). */
function drawProp(c: CanvasRenderingContext2D, type: string, z: number, col: string | undefined, st: string, t: number, lt: number, text?: string) {
  const lw = 7 * z, sp = (d: number) => spring((lt - d) / 0.35);
  switch (type) {
    case 'phone': {
      rr(c, -140 * z, -260 * z, 280 * z, 520 * z, 44 * z); shape(c, col || '#2B2D42', lw, st);
      rr(c, -120 * z, -230 * z, 240 * z, 460 * z, 28 * z); shape(c, '#ECE5DD', 4 * z, st);
      c.shadowColor = 'transparent';
      rr(c, -120 * z, -230 * z, 240 * z, 60 * z, 28 * z); c.fillStyle = '#128C7E'; c.fill();
      c.beginPath(); c.arc(-80 * z, -200 * z, 16 * z, 0, Math.PI * 2); c.fillStyle = '#FFFFFF'; c.fill();
      const msgs = [text || 'Oi! Tudo bem?', 'Tenho interesse!', '👍'];
      msgs.forEach((m, k) => {
        const s = sp(0.3 + k * 0.6); if (s <= 0.01) return; const mine = k % 2 === 0;
        c.save(); c.translate(mine ? 22 * z : -22 * z, (-120 + k * 90) * z); c.scale(s, s);
        c.font = `${Math.round(24 * z)}px 'Plus Jakarta Sans', sans-serif`; const tw = Math.min(190 * z, c.measureText(m).width + 30 * z); c.font = `${Math.round(24 * z * Math.min(1, 160 * z / Math.max(1, c.measureText(m).width)))}px 'Plus Jakarta Sans', sans-serif`;
        rr(c, -tw / 2, -28 * z, tw, 56 * z, 16 * z); shape(c, mine ? '#DCF8C6' : '#FFFFFF', 3 * z, st);
        c.fillStyle = '#1A1A1A'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m.slice(0, 18), 0, -2 * z);
        if (mine) { c.strokeStyle = '#34B7F1'; c.lineWidth = 3 * z; c.beginPath(); c.moveTo(tw / 2 - 34 * z, 16 * z); c.lineTo(tw / 2 - 28 * z, 22 * z); c.lineTo(tw / 2 - 18 * z, 10 * z); c.moveTo(tw / 2 - 26 * z, 16 * z); c.lineTo(tw / 2 - 20 * z, 22 * z); c.lineTo(tw / 2 - 10 * z, 10 * z); c.stroke(); }
        c.restore();
      });
      break;
    }
    case 'laptop': {
      rr(c, -260 * z, -190 * z, 520 * z, 330 * z, 22 * z); shape(c, '#3A3F55', lw, st);
      rr(c, -235 * z, -165 * z, 470 * z, 280 * z, 10 * z); shape(c, '#FFFFFF', 4 * z, st);
      c.shadowColor = 'transparent';
      c.fillStyle = col || '#FF7A45'; c.fillRect(-235 * z, -165 * z, 470 * z, 50 * z);
      [0, 1, 2].forEach((k) => { const g = smooth(clamp((lt - 0.3 - k * 0.3) / 0.4)); rr(c, -200 * z, (-90 + k * 60) * z, 400 * z * g * (k === 2 ? 0.6 : 1), 32 * z, 10 * z); c.fillStyle = k === 2 ? '#3DDC97' : '#E3E6EE'; c.fill(); });
      if (text) { c.font = FONT(30 * z); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text.slice(0, 16), 0, -140 * z); }
      c.beginPath(); c.moveTo(-300 * z, 140 * z); c.lineTo(300 * z, 140 * z); c.lineTo(330 * z, 180 * z); c.lineTo(-330 * z, 180 * z); c.closePath(); shape(c, '#C9CED9', lw, st);
      break;
    }
    case 'pin': {
      const drop = (1 - smooth(clamp(lt / 0.4))) * -200 * z, b = Math.abs(Math.sin(lt * 6)) * 12 * z * Math.max(0, 1 - lt);
      c.save(); c.shadowColor = 'transparent'; c.beginPath(); c.ellipse(0, 60 * z, 40 * z, 12 * z, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fill(); c.restore();
      c.translate(0, drop - b); c.beginPath(); c.moveTo(0, 60 * z); c.bezierCurveTo(-80 * z, -20 * z, -60 * z, -110 * z, 0, -110 * z); c.bezierCurveTo(60 * z, -110 * z, 80 * z, -20 * z, 0, 60 * z); shape(c, col || '#E63946', lw, st);
      c.beginPath(); c.arc(0, -55 * z, 22 * z, 0, Math.PI * 2); shape(c, '#FFFFFF', 5 * z, st); break;
    }
    case 'scale': {
      const tilt = Math.sin(lt * 2.2) * Math.exp(-lt * 0.6) * 0.25 + 0.15;
      rr(c, -20 * z, -150 * z, 40 * z, 270 * z, 10 * z); shape(c, '#8D99AE', lw, st);
      rr(c, -110 * z, 110 * z, 220 * z, 40 * z, 14 * z); shape(c, '#5C677D', lw, st);
      c.save(); c.translate(0, -150 * z); c.rotate(tilt);
      rr(c, -230 * z, -12 * z, 460 * z, 24 * z, 12 * z); shape(c, col || '#FFD23F', lw, st);
      for (const s2 of [-1, 1]) { c.save(); c.translate(s2 * 210 * z, 0); c.rotate(-tilt); c.strokeStyle = st; c.lineWidth = 4 * z; c.beginPath(); c.moveTo(0, 0); c.lineTo(-60 * z, 110 * z); c.moveTo(0, 0); c.lineTo(60 * z, 110 * z); c.stroke(); c.beginPath(); c.ellipse(0, 115 * z, 85 * z, 22 * z, 0, 0, Math.PI); shape(c, '#FFD23F', lw, st); c.restore(); }
      c.restore(); break;
    }
    case 'chart': {
      rr(c, -230 * z, -180 * z, 460 * z, 340 * z, 24 * z); shape(c, '#FFFFFF', lw, st);
      c.shadowColor = 'transparent';
      [0.3, 0.5, 0.45, 0.75, 1].forEach((v, k) => { const g = spring((lt - 0.2 - k * 0.12) / 0.35), bh = v * 240 * z * g; rr(c, (-190 + k * 80) * z, 130 * z - bh, 56 * z, Math.max(1, bh), 10 * z); shape(c, k === 4 ? (col || '#2ECC71') : '#9FD3F4', 4 * z, st); });
      break;
    }
    case 'coin': {
      const sq = Math.abs(Math.cos(t * 2.5));
      c.beginPath(); c.ellipse(0, 0, 80 * z * Math.max(0.15, sq), 80 * z, 0, 0, Math.PI * 2); shape(c, col || '#FFC23D', lw, st);
      if (sq > 0.4) { c.font = FONT(80 * z * sq); c.fillStyle = '#C98A00'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, 4 * z); }
      break;
    }
    case 'clock': {
      c.beginPath(); c.arc(0, 0, 140 * z, 0, Math.PI * 2); shape(c, col || '#FFFFFF', lw, st);
      c.shadowColor = 'transparent';
      for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; c.beginPath(); c.moveTo(Math.cos(a) * 110 * z, Math.sin(a) * 110 * z); c.lineTo(Math.cos(a) * 125 * z, Math.sin(a) * 125 * z); c.strokeStyle = st; c.lineWidth = 6 * z; c.stroke(); }
      for (const [len, sp2, wd] of [[70, 0.3, 10], [105, 3.6, 6]] as const) { const a = t * sp2 - Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * len * z, Math.sin(a) * len * z); c.lineCap = 'round'; c.lineWidth = wd * z; c.stroke(); }
      break;
    }
    case 'stamp': {
      const label = (text || 'OK').toUpperCase().slice(0, 14); c.font = FONT(60 * z); const tw = c.measureText(label).width + 70 * z;
      rr(c, -tw / 2, -55 * z, tw, 110 * z, 22 * z); shape(c, col || '#FFFFFF', lw, st);
      c.shadowColor = 'transparent'; c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, 0, 4 * z); break;
    }
    case 'xmark': case 'check': {
      c.beginPath(); c.arc(0, 0, 110 * z, 0, Math.PI * 2); shape(c, type === 'xmark' ? (col || '#E63946') : (col || '#2ECC71'), lw, st);
      c.shadowColor = 'transparent'; c.strokeStyle = '#FFFFFF'; c.lineWidth = 26 * z; c.lineCap = 'round'; c.beginPath();
      if (type === 'xmark') { c.moveTo(-50 * z, -50 * z); c.lineTo(50 * z, 50 * z); c.moveTo(50 * z, -50 * z); c.lineTo(-50 * z, 50 * z); }
      else { c.moveTo(-55 * z, 5 * z); c.lineTo(-15 * z, 45 * z); c.lineTo(60 * z, -45 * z); }
      c.stroke(); break;
    }
    case 'hand': {
      const tap = Math.max(0, Math.sin(lt * 4)) * 14 * z; c.translate(0, -tap);
      rr(c, -45 * z, -40 * z, 90 * z, 110 * z, 34 * z); shape(c, SKIN, lw, st);
      rr(c, -16 * z, -140 * z, 32 * z, 120 * z, 16 * z); shape(c, SKIN, lw, st);
      rr(c, -60 * z, 60 * z, 120 * z, 70 * z, 14 * z); shape(c, col || '#2E3650', lw, st); break;
    }
    case 'dog': case 'cat': {
      const fur = col || (type === 'dog' ? '#C68B59' : '#F4A261'), wag = Math.sin(t * (type === 'dog' ? 12 : 3)) * 0.4;
      c.save(); c.translate(110 * z, 10 * z); c.rotate(-0.8 + wag); rr(c, -10 * z, -80 * z, 20 * z, 80 * z, 10 * z); shape(c, fur, lw, st); c.restore();
      c.beginPath(); c.ellipse(0, 30 * z, 120 * z, 70 * z, 0, 0, Math.PI * 2); shape(c, fur, lw, st);
      for (const s2 of [-70, -25, 25, 70]) { rr(c, (s2 - 14) * z, 70 * z, 28 * z, 50 * z, 12 * z); shape(c, fur, 5 * z, st); }
      c.save(); c.translate(-110 * z, -60 * z); c.rotate(Math.sin(t * 1.3) * 0.08);
      if (type === 'dog') for (const s2 of [-1, 1]) { c.beginPath(); c.ellipse(s2 * 55 * z, 0, 22 * z, 45 * z, s2 * 0.3, 0, Math.PI * 2); shape(c, '#8D5524', lw, st); }
      else for (const s2 of [-1, 1]) { c.beginPath(); c.moveTo(s2 * 20 * z, -50 * z); c.lineTo(s2 * 60 * z, -95 * z); c.lineTo(s2 * 65 * z, -30 * z); c.closePath(); shape(c, fur, lw, st); }
      c.beginPath(); c.arc(0, 0, 70 * z, 0, Math.PI * 2); shape(c, fur, lw, st);
      const bl = ((t + 1.1) % 3.2) < 0.15 ? 0.15 : 1;
      for (const s2 of [-1, 1]) { c.beginPath(); c.ellipse(s2 * 25 * z, -8 * z, 9 * z, 12 * z * bl, 0, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); }
      c.beginPath(); c.ellipse(0, 20 * z, 14 * z, 10 * z, 0, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); c.restore(); break;
    }
    case 'crowd': {
      const cols = ['#577590', '#E76F51', '#2A9D8F', '#8B6FD6', '#F4A261', '#4A5873'];
      for (let k = 0; k < 7; k++) { const x = (-300 + k * 100) * z, bob = Math.sin(t * 2 + k) * 4 * z, back = k % 2 ? -30 * z : 0;
        c.beginPath(); c.moveTo(x - 45 * z, 120 * z); c.quadraticCurveTo(x - 45 * z, 20 * z + back + bob, x, 15 * z + back + bob); c.quadraticCurveTo(x + 45 * z, 20 * z + back + bob, x + 45 * z, 120 * z); c.closePath(); shape(c, col || cols[k % cols.length], 5 * z, st);
        c.beginPath(); c.arc(x, -25 * z + back + bob, 32 * z, 0, Math.PI * 2); shape(c, SKIN, 5 * z, st); }
      break;
    }
    case 'skyline': {
      [[-330, 260], [-230, 380], [-120, 300], [-10, 440], [110, 330], [220, 400], [320, 280]].forEach(([x, hh], k) => {
        rr(c, (x - 50) * z, (120 - hh) * z, 100 * z, hh * z, 4 * z); shape(c, col || ['#3D405B', '#4A4E69', '#22223B'][k % 3], 5 * z, st);
        c.shadowColor = 'transparent';
        for (let y = 140 - hh; y < 100; y += 45) for (const dx of [-25, 10]) { c.fillStyle = rand(x * 7 + y + k) > 0.4 ? '#FFE66D' : '#2B2D42'; c.fillRect((x + dx) * z, y * z, 18 * z, 22 * z); }
      });
      for (let k = 0; k < 4; k++) { const x = ((t * 120 + k * 230) % 900 - 450) * z; c.fillStyle = k % 2 ? '#E63946' : '#3A86FF'; rr(c, x - 30 * z, 128 * z, 60 * z, 24 * z, 8 * z); c.fill(); c.beginPath(); c.arc(x + 30 * z, 138 * z, 6 * z, 0, Math.PI * 2); c.fillStyle = '#FFF3B0'; c.fill(); }
      break;
    }
  }
}
