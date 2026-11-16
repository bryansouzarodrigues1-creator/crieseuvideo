/**
 * Time-of-day palettes. Library sets and model drawings both use $tokens, so a whole scene recolors
 * consistently when the director says "dusk" or "night" (the flat videos this engine imitates do exactly that).
 */
export const TIMES = ['day', 'dusk', 'sunset', 'night', 'rain', 'warm'] as const;
export type TimeOfDay = (typeof TIMES)[number];

export interface Palette {
  sky1: string; sky2: string; wall: string; wall2: string; floor: string; floor2: string;
  glow: string; city: string; city2: string; lit: string; acc: string; light: string; dim: string;
}
const base = { glow: '#FFE08A', lit: '#FFD966' };
export const PALETTES: Record<TimeOfDay, Palette> = {
  day:    { ...base, sky1: '#7EC8F2', sky2: '#E8F6FF', wall: '#CFE3F5', wall2: '#B5CFE6', floor: '#8C95A8', floor2: '#7A8398', city: '#7F95BC', city2: '#9DB0D2', lit: '#EAF3FF', acc: '#FF7A59', light: '#FFFFFF', dim: '#000000' },
  dusk:   { ...base, sky1: '#9AA7E8', sky2: '#FFE7A3', wall: '#A8B4E8', wall2: '#8E9BD6', floor: '#5B6385', floor2: '#4C5475', city: '#3E4A86', city2: '#4F5C9A', acc: '#FF7A59', light: '#FFE9B8', dim: '#10123A' },
  sunset: { ...base, sky1: '#FF6B4A', sky2: '#FFE45E', wall: '#F2A15C', wall2: '#D9803F', floor: '#58505E', floor2: '#4A4352', city: '#C0623B', city2: '#E08A47', acc: '#3A7BD5', light: '#FFF3C4', dim: '#3A1020' },
  night:  { ...base, sky1: '#120F3A', sky2: '#2B2570', wall: '#262060', wall2: '#1D1850', floor: '#161238', floor2: '#100D2C', city: '#171A47', city2: '#212762', acc: '#7C6CFF', light: '#B9B2FF', dim: '#05041A' },
  rain:   { ...base, sky1: '#5E6470', sky2: '#9AA0AC', wall: '#6E7480', wall2: '#5A606C', floor: '#3E424C', floor2: '#333640', city: '#464B58', city2: '#565C6A', lit: '#B8BDC8', acc: '#8FB3FF', light: '#C9CDD6', dim: '#0A0B10' },
  warm:   { ...base, sky1: '#FFB067', sky2: '#FFE7B0', wall: '#F6C98E', wall2: '#E3AE6E', floor: '#9B6B4A', floor2: '#865A3C', city: '#C98A5A', city2: '#DDA070', acc: '#D94F3D', light: '#FFF1CF', dim: '#2A1408' },
};

export const NAMED: Record<string, string> = {
  ink: '#1B1B2E', white: '#FFFFFF', skin: '#FBEFE3', skin2: '#EFC9A3', skin3: '#C98F62',
  red: '#E5383B', blue: '#3A86FF', green: '#2EC4B6', yellow: '#FFC93C', orange: '#FF8C42', purple: '#8B5CF6', pink: '#FF6FB5', brown: '#8A5A3C',
  gray: '#8A90A0', dark: '#2A2D3E', navy: '#26356B', cream: '#FFF4DC', wood: '#9B6B43', metal: '#B8C0CC', leaf: '#3DAE5B', screen: '#7FD4FF', lcd: '#B7E36A',
};

export function token(pal: Palette, name: string): string | undefined {
  const k = name.toLowerCase();
  if (k in NAMED) return NAMED[k];
  return (pal as unknown as Record<string, string>)[k];
}
