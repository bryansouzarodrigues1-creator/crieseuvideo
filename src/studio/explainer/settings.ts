/**
 * Full-screen animated scenarios drawn in code (sky, city, beach, road...). The AI only names one per scene.
 */
export const SETTINGS = ['sunburst', 'sky_day', 'sunset', 'night', 'city_day', 'beach', 'forest', 'road', 'room', 'office', 'space', 'rain'] as const;
export type Setting = (typeof SETTINGS)[number];

const INK = '#1B1B24';
const grad = (c: CanvasRenderingContext2D, h: number, stops: string[]) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  return g;
};
const hash = (i: number) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

function cloud(c: CanvasRenderingContext2D, x: number, y: number, s: number, col = '#FFFFFF') {
  c.fillStyle = col; c.beginPath();
  [[0, 0, 50], [45, -18, 42], [90, 0, 46], [45, 14, 44]].forEach(([dx, dy, r]) => { c.moveTo(x + dx * s + r * s, y + dy * s); c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); });
  c.fill();
}
function clouds(c: CanvasRenderingContext2D, w: number, h: number, u: number, t: number, col?: string) {
  for (let i = 0; i < 5; i++) {
    const sp = 18 + hash(i) * 22, x = ((hash(i + 9) * w + t * sp * u) % (w + 400 * u)) - 200 * u;
    cloud(c, x, h * (0.08 + hash(i + 3) * 0.25), u * (0.7 + hash(i + 5) * 0.8), col);
  }
}
function sunDisc(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, col: string) {
  c.fillStyle = col; c.globalAlpha = 0.25; c.beginPath(); c.arc(x, y, r * (1.5 + 0.06 * Math.sin(t * 2)), 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function hills(c: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, col: string, seed: number) {
  c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += w / 40) c.lineTo(x, base - Math.sin(x / w * 6 + seed) * amp - Math.sin(x / w * 13 + seed * 2) * amp * 0.4);
  c.lineTo(w, h); c.closePath(); c.fill();
}
function skyline(c: CanvasRenderingContext2D, w: number, h: number, u: number, t: number, base: number, night: boolean) {
  let x = 0, i = 0;
  while (x < w) {
    const bw = (90 + hash(i) * 110) * u, bh = (200 + hash(i + 40) * 420) * u;
    c.fillStyle = night ? (i % 2 ? '#1E2340' : '#272D52') : (i % 3 ? '#8EA3C7' : '#A9BBD8');
    c.fillRect(x, base - bh, bw - 6 * u, bh);
    for (let wy = base - bh + 22 * u; wy < base - 30 * u; wy += 46 * u)
      for (let wx = x + 16 * u; wx < x + bw - 34 * u; wx += 36 * u) {
        const on = hash(i * 31 + Math.floor(wx + wy)) > (night ? 0.45 : 0.7);
        c.fillStyle = night ? (on ? `rgba(255,214,102,${0.7 + 0.3 * Math.sin(t * 2 + wx)})` : '#151933') : (on ? '#E8F1FF' : '#6F86AE');
        c.fillRect(wx, wy, 16 * u, 22 * u);
      }
    x += bw; i++;
  }
}
function stars(c: CanvasRenderingContext2D, w: number, h: number, u: number, t: number, n = 70) {
  for (let i = 0; i < n; i++) {
    c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + hash(i)) + i));
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(hash(i) * w, hash(i + 77) * h * 0.7, (1.5 + hash(i + 5) * 2.5) * u, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}

/** Returns false for 'sunburst' so the caller keeps its palette background. */
export function drawSetting(c: CanvasRenderingContext2D, setting: Setting, w: number, h: number, t: number): boolean {
  if (setting === 'sunburst') return false;
  const u = Math.min(w, h) / 1080, ground = h * 0.78;
  c.save();
  switch (setting) {
    case 'sky_day':
      c.fillStyle = grad(c, h, ['#5EC8FF', '#BDEBFF']); c.fillRect(0, 0, w, h);
      sunDisc(c, w * 0.82, h * 0.12, 70 * u, t, '#FFD23F'); clouds(c, w, h, u, t);
      hills(c, w, h, ground, 40 * u, '#7BD389', 1); hills(c, w, h, ground + 60 * u, 30 * u, '#4FB36A', 3); break;
    case 'sunset':
      c.fillStyle = grad(c, h, ['#3A1C71', '#D76D77', '#FFAF7B']); c.fillRect(0, 0, w, h);
      sunDisc(c, w * 0.5, ground - 40 * u, 120 * u, t, '#FFE29A'); clouds(c, w, h, u, t, 'rgba(255,200,180,0.6)');
      hills(c, w, h, ground, 50 * u, '#5B2C5F', 2); hills(c, w, h, ground + 70 * u, 30 * u, '#3B1D44', 4); break;
    case 'night':
      c.fillStyle = grad(c, h, ['#0B1033', '#2B2F77']); c.fillRect(0, 0, w, h); stars(c, w, h, u, t);
      sunDisc(c, w * 0.8, h * 0.14, 60 * u, t, '#F6F1D5'); hills(c, w, h, ground, 40 * u, '#1B2550', 1); break;
    case 'city_day':
      c.fillStyle = grad(c, h, ['#7FD1FF', '#E3F6FF']); c.fillRect(0, 0, w, h); clouds(c, w, h, u, t);
      skyline(c, w, h, u, t, ground, false); c.fillStyle = '#4A4F5E'; c.fillRect(0, ground, w, h - ground);
      c.fillStyle = '#F5F5F5'; for (let x = (-(t * 120 * u) % (160 * u)); x < w; x += 160 * u) c.fillRect(x, ground + (h - ground) * 0.45, 80 * u, 10 * u); break;
    case 'beach': {
      c.fillStyle = grad(c, h, ['#4FC3F7', '#B3E5FC']); c.fillRect(0, 0, w, h); sunDisc(c, w * 0.2, h * 0.13, 70 * u, t, '#FFD23F'); clouds(c, w, h, u, t);
      const sea = h * 0.62; c.fillStyle = '#1E88E5'; c.fillRect(0, sea, w, h);
      c.fillStyle = 'rgba(255,255,255,0.6)';
      for (let k = 0; k < 3; k++) { c.beginPath(); for (let x = 0; x <= w; x += 20 * u) c.lineTo(x, sea + 30 * u * (k + 1) + Math.sin(x / (60 * u) + t * 2 + k) * 8 * u); c.lineTo(w, sea + 30 * u * (k + 1) + 6 * u); c.lineTo(0, sea + 30 * u * (k + 1) + 6 * u); c.fill(); }
      hills(c, w, h, ground + 20 * u, 18 * u, '#F4D58D', 5); break;
    }
    case 'forest':
      c.fillStyle = grad(c, h, ['#9BE7C4', '#E9FBEF']); c.fillRect(0, 0, w, h); clouds(c, w, h, u, t);
      for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
        const x = (i / 8) * w + (row ? 60 * u : 0), base = ground - (row ? 0 : 60 * u), s = u * (row ? 1.2 : 0.85), sway = Math.sin(t * 1.3 + i) * 6 * s;
        c.fillStyle = '#6B4226'; c.fillRect(x - 12 * s, base - 90 * s, 24 * s, 90 * s);
        c.fillStyle = row ? '#2E8B57' : '#3FA96B';
        [0, 1, 2].forEach((k) => { c.beginPath(); c.moveTo(x - (110 - k * 25) * s + sway, base - (70 + k * 80) * s); c.lineTo(x + sway * (k + 1), base - (210 + k * 80) * s); c.lineTo(x + (110 - k * 25) * s + sway, base - (70 + k * 80) * s); c.fill(); });
      }
      c.fillStyle = '#3E9B5C'; c.fillRect(0, ground, w, h - ground); break;
    case 'road': {
      c.fillStyle = grad(c, h, ['#87D7FF', '#DDF5FF']); c.fillRect(0, 0, w, h); clouds(c, w, h, u, t);
      hills(c, w, h, h * 0.6, 50 * u, '#8FD694', 2);
      const top = h * 0.66; c.fillStyle = '#3C3F4A'; c.fillRect(0, top, w, h - top);
      c.fillStyle = '#FFD23F'; for (let x = (-(t * 400 * u) % (220 * u)); x < w; x += 220 * u) c.fillRect(x, top + (h - top) * 0.4, 120 * u, 14 * u); break;
    }
    case 'room': case 'office': {
      const office = setting === 'office';
      c.fillStyle = office ? '#DCE6F2' : '#F6E3C8'; c.fillRect(0, 0, w, ground);
      c.fillStyle = office ? '#8D99AE' : '#B5835A'; c.fillRect(0, ground, w, h - ground);
      // window with drifting clouds
      const wx = w * 0.62, wy = h * 0.12, ww = w * 0.3, wh = h * 0.24;
      c.fillStyle = '#9BDCFF'; c.fillRect(wx, wy, ww, wh);
      c.save(); c.beginPath(); c.rect(wx, wy, ww, wh); c.clip(); clouds(c, w, h, u * 0.6, t); c.restore();
      c.strokeStyle = INK; c.lineWidth = 8 * u; c.strokeRect(wx, wy, ww, wh); c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.stroke();
      if (office) { c.fillStyle = '#FFFFFF'; c.fillRect(w * 0.08, h * 0.14, w * 0.34, h * 0.18); c.strokeRect(w * 0.08, h * 0.14, w * 0.34, h * 0.18);
        c.strokeStyle = '#3DDC97'; c.beginPath(); [0, 1, 2, 3, 4].forEach((k) => c.lineTo(w * (0.11 + k * 0.07), h * (0.29 - k * 0.025 - 0.01 * Math.sin(t + k)))); c.stroke(); }
      else { c.fillStyle = '#E07A5F'; c.beginPath(); c.arc(w * 0.22, h * 0.2, 60 * u, 0, Math.PI * 2); c.fill(); c.strokeStyle = INK; c.stroke(); }
      break;
    }
    case 'space':
      c.fillStyle = grad(c, h, ['#05010F', '#1A0B3D']); c.fillRect(0, 0, w, h); stars(c, w, h * 1.4, u, t, 120);
      c.fillStyle = '#FF7F50'; c.beginPath(); c.arc(w * 0.8, h * 0.2, 110 * u, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#FFD7A8'; c.lineWidth = 10 * u; c.beginPath(); c.ellipse(w * 0.8, h * 0.2, 190 * u, 40 * u, -0.3, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#6C63FF'; c.beginPath(); c.arc(w * 0.15, h * 0.85, 260 * u, 0, Math.PI * 2); c.fill(); break;
    case 'rain':
      c.fillStyle = grad(c, h, ['#4B5563', '#9CA3AF']); c.fillRect(0, 0, w, h); clouds(c, w, h, u, t, '#6B7280');
      skyline(c, w, h, u, t, ground, true); c.fillStyle = '#374151'; c.fillRect(0, ground, w, h - ground);
      c.strokeStyle = 'rgba(200,220,255,0.6)'; c.lineWidth = 3 * u; c.beginPath();
      for (let i = 0; i < 90; i++) { const x = hash(i) * w, y = (hash(i + 3) * h + t * 900 * u) % h; c.moveTo(x, y); c.lineTo(x - 8 * u, y + 34 * u); }
      c.stroke(); if (Math.sin(t * 0.7) > 0.995) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(0, 0, w, h); } break;
  }
  c.restore();
  return true;
}

export const SETTING_GUIDE = `setting: cenário de fundo animado em tela cheia, escolha o que combina com a frase: ${SETTINGS.join(', ')} (sunburst = fundo colorido, use SÓ para ideias abstratas; se a frase cita lugar, objeto, hora do dia ou clima, use o cenário real). Varie o cenário entre as cenas como num filme.`;
