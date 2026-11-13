/**
 * Rigid frame zones for the explainer canvas. Every layer draws inside exactly one zone, so text,
 * labels and illustrations can never overlap:
 *
 *   9:16 (720x1280)                       16:9 (1280x720)
 *   ┌────────────────┐ 0                  ┌──────────────────────┐ 0
 *   │  platform UI   │ 9%                 │ top inset            │ 6%
 *   │  label zone    │ 19%                │ label zone           │ 16%
 *   │  hero zone     │                    │ hero zone            │
 *   │  (characters,  │ 68%                │                      │ 71%
 *   │   props, art)  │                    │ caption zone (≤2 ln) │ 74–93%
 *   │  caption zone  │ 71–86%             └──────────────────────┘
 *   │  (≤ 2 lines)   │
 *   │  platform UI   │ 86–100%
 *   └────────────────┘
 */
export interface Rect { x0: number; y0: number; x1: number; y1: number }

export const MAX_CAPTION_LINES = 2;

export interface FrameZones {
  w: number;
  h: number;
  portrait: boolean;
  /** Where characters, props and AI drawings live. */
  hero: Rect;
  /** Where the scene label badge lives (above the hero). */
  label: Rect;
  /** Fixed base band for the caption: at most MAX_CAPTION_LINES lines, bottom-anchored. */
  caption: Rect;
  captionFont: number;
  captionLineHeight: number;
}

/** `hasLabel` lets the hero zone grow into the (otherwise empty) label zone. */
export function frameZones(w: number, h: number, hasLabel = true): FrameZones {
  const portrait = h > w, u = Math.min(w, h) / 1080;
  const side = w * (portrait ? 0.08 : 0.07);
  const top = h * (portrait ? 0.09 : 0.06);
  const bottom = h * (portrait ? 0.14 : 0.07);
  const capH = h * (portrait ? 0.15 : 0.19);
  const gap = h * 0.03;

  const caption: Rect = { x0: side, x1: w - side, y1: h - bottom, y0: h - bottom - capH };
  const label: Rect = { x0: side, x1: w - side, y0: top, y1: top + h * 0.1 };
  const hero: Rect = { x0: side, x1: w - side, y0: hasLabel ? label.y1 + h * 0.01 : top, y1: caption.y0 - gap };

  // two lines + outline stroke must fit the band; never larger than the design size
  const stroke = 12 * u;
  const captionFont = Math.min(78 * u, (capH - stroke) / (MAX_CAPTION_LINES * 1.12));
  return { w, h, portrait, hero, label, caption, captionFont, captionLineHeight: captionFont * 1.12 };
}

/** Largest scale (≤ `want`) at which a box of size ext (relative to its origin) fits inside `zone`. */
export function fitScale(ext: Rect, zone: Rect, want: number): number {
  const ew = Math.max(1, ext.x1 - ext.x0), eh = Math.max(1, ext.y1 - ext.y0);
  return Math.min(want, (zone.x1 - zone.x0) / ew, (zone.y1 - zone.y0) / eh);
}

/** Origin (x, y) that centres ext, drawn at scale `s`, inside `zone`. */
export function centerIn(ext: Rect, zone: Rect, s: number) {
  return { x: (zone.x0 + zone.x1) / 2 - ((ext.x0 + ext.x1) / 2) * s, y: (zone.y0 + zone.y1) / 2 - ((ext.y0 + ext.y1) / 2) * s };
}

export const scaleRect = (r: Rect, k: number): Rect => ({ x0: r.x0 * k, y0: r.y0 * k, x1: r.x1 * k, y1: r.y1 * k });
export const padRect = (r: Rect, p: number): Rect => ({ x0: r.x0 - p, y0: r.y0 - p, x1: r.x1 + p, y1: r.y1 + p });
