// Câmera dirigida: função pura (sem Three.js) que devolve posição/alvo da câmera em função do progresso da cena.
// Determinística por tempo, então prévia e exportação MP4 geram exatamente os mesmos quadros.
import type { CameraMove, Shot } from './catalog';

export interface Vec3 { x: number; y: number; z: number }
export interface CameraPose { pos: Vec3; look: Vec3 }
export interface CameraSpec { move: CameraMove; shot: Shot; intensity: number }

/** Cada movimento vai de um estado inicial a um final, relativos ao estado neutro (az 0, el 0, dist 1, lookY 0). */
interface Track { az: [number, number]; el: [number, number]; dist: [number, number]; lookY: [number, number] }
const TRACKS: Record<CameraMove, Track> = {
  static: { az: [0, 0], el: [0, 0], dist: [1, 1], lookY: [0, 0] },
  push_in: { az: [0.05, 0], el: [0.02, 0], dist: [1.3, 0.86], lookY: [0, 0] },
  pull_out: { az: [0, 0.05], el: [0, 0.04], dist: [0.8, 1.25], lookY: [0, 0.1] },
  orbit_left: { az: [0.45, -0.3], el: [0.04, 0.04], dist: [1.05, 0.95], lookY: [0, 0] },
  orbit_right: { az: [-0.45, 0.3], el: [0.04, 0.04], dist: [1.05, 0.95], lookY: [0, 0] },
  crane_up: { az: [0.1, 0], el: [-0.05, 0.5], dist: [0.95, 1.2], lookY: [-0.2, 0.3] },
  crane_down: { az: [0, 0.05], el: [0.55, 0], dist: [1.2, 0.9], lookY: [0.3, 0] },
  pan_left: { az: [0.28, -0.12], el: [0.03, 0.03], dist: [1, 1], lookY: [0, 0] },
  pan_right: { az: [-0.28, 0.12], el: [0.03, 0.03], dist: [1, 1], lookY: [0, 0] },
};
const SHOT_DIST: Record<Shot, number> = { wide: 1.6, medium: 1, close: 0.62 };

export const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
const smooth = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Aproxima o estado neutro conforme a intensidade (0 = parado, 1 = movimento completo). */
const scaled = (pair: [number, number], neutral: number, intensity: number): [number, number] =>
  [lerp(neutral, pair[0], intensity), lerp(neutral, pair[1], intensity)];

/**
 * progress: 0..1 ao longo da cena. focus: ponto que a câmera olha. baseDist: distância do plano médio.
 * baseElev: elevação padrão da câmera em radianos.
 */
export function cameraPose(spec: CameraSpec, progress: number, focus: Vec3, baseDist: number, baseElev = 0.1): CameraPose {
  const track = TRACKS[spec.move] ?? TRACKS.static;
  const i = clamp01(spec.intensity);
  const s = smooth(progress);
  const [az0, az1] = scaled(track.az, 0, i);
  const [el0, el1] = scaled(track.el, 0, i);
  const [d0, d1] = scaled(track.dist, 1, i);
  const [ly0, ly1] = scaled(track.lookY, 0, i);
  const az = lerp(az0, az1, s);
  const el = baseElev + lerp(el0, el1, s);
  const dist = Math.max(0.5, baseDist * (SHOT_DIST[spec.shot] ?? 1) * lerp(d0, d1, s));
  const look = { x: focus.x, y: focus.y + lerp(ly0, ly1, s), z: focus.z };
  return {
    look,
    pos: {
      x: look.x + Math.sin(az) * Math.cos(el) * dist,
      y: look.y + Math.sin(el) * dist,
      z: look.z + Math.cos(az) * Math.cos(el) * dist,
    },
  };
}
