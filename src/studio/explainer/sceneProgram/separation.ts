/** Render-time body separation: actors neither merge into each other nor stand inside solid props.
 * Pure geometry on the ground plane (x,z), so it is deterministic and easy to test. It is a safety net for
 * layouts the model got wrong; bodies that a contact deliberately touches are exempt. */
export interface Body { id: string; x: number; z: number; y: number; radius: number }
export interface Solid { id: string; min: [number, number, number]; max: [number, number, number] }
export interface SeparationRules { bodyHeight?: number; pairDistance?: number; ignoreSolid?: (bodyId: string, solidId: string) => boolean; ignorePair?: (a: string, b: string) => boolean;
  /** Bodies that must not move (they are mid-contact); others yield to them. */ pinned?: ReadonlySet<string> }

export function separate(bodies: readonly Body[], solids: readonly Solid[], rules: SeparationRules = {}): Map<string, [number, number]> {
  const height = rules.bodyHeight ?? 1.7, pair = rules.pairDistance ?? .7, pos = new Map(bodies.map((b) => [b.id, [b.x, b.z] as [number, number]]));
  const out = (b: Body, s: Solid) => {
    if (rules.pinned?.has(b.id)) return;
    const p = pos.get(b.id)!, r = b.radius;
    if (b.y > s.max[1] - .25 || b.y + height < s.min[1] + .05) return; // standing on it, or it is entirely overhead
    const left = p[0] - (s.min[0] - r), right = (s.max[0] + r) - p[0], back = p[1] - (s.min[2] - r), front = (s.max[2] + r) - p[1];
    if (left <= 0 || right <= 0 || back <= 0 || front <= 0) return; // outside the padded footprint
    const least = Math.min(left, right, back, front);
    if (least === left) p[0] -= left; else if (least === right) p[0] += right; else if (least === back) p[1] -= back; else p[1] += front;
  };
  for (let pass = 0; pass < 4; pass++) {
    for (const b of bodies) for (const s of solids) if (!rules.ignoreSolid?.(b.id, s.id)) out(b, s);
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], c = bodies[j];
      if (rules.ignorePair?.(a.id, c.id) || Math.abs(a.y - c.y) > height) continue;
      const pa = pos.get(a.id)!, pc = pos.get(c.id)!;
      let dx = pc[0] - pa[0], dz = pc[1] - pa[1], d = Math.hypot(dx, dz);
      if (d >= pair) continue;
      if (d < 1e-4) { dx = 1; dz = 0; d = 1; }
      const need = pair - Math.hypot(pc[0] - pa[0], pc[1] - pa[1]), ux = dx / d, uz = dz / d, pa_ = rules.pinned?.has(a.id), pc_ = rules.pinned?.has(c.id);
      if (pa_ && pc_) continue;
      const fa = pa_ ? 0 : pc_ ? need : need / 2, fc = pc_ ? 0 : pa_ ? need : need / 2;
      pa[0] -= ux * fa; pa[1] -= uz * fa; pc[0] += ux * fc; pc[1] += uz * fc;
    }
  }
  const shift = new Map<string, [number, number]>();
  for (const b of bodies) { const p = pos.get(b.id)!, dx = p[0] - b.x, dz = p[1] - b.z; if (Math.abs(dx) > 1e-6 || Math.abs(dz) > 1e-6) shift.set(b.id, [dx, dz]); }
  return shift;
}
