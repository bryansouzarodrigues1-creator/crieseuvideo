/* eslint-disable @typescript-eslint/no-explicit-any -- untyped model/provider JSON is validated field by field below */
/** Cliff world builder: every size is derived from the engine's measured actor (≈2.25 m) and the wall height, so scale is consistent by construction. */
import type { Mood } from "./plan";
import type { Ladder, Limb, World } from "./verbs";

const SKY: Record<Mood, { bg: string; ground: string; rock: string; far: string; snow: string }> = {
  day: { bg: "#BCD9EA", ground: "#E8EFF2", rock: "#7F8FA3", far: "#8EA6BC", snow: "#F2F7F8" },
  dusk: { bg: "#E8B58E", ground: "#EBD9D2", rock: "#7A6E86", far: "#8C7A98", snow: "#FBEDE6" },
  night: { bg: "#18233F", ground: "#B8C6DA", rock: "#46566F", far: "#33425E", snow: "#DCE7F5" },
};
export const WALL_WIDTH = 4.6,
  WALL_DEPTH = 3;
export const makeWorld = (height: number): World => ({
  height,
  faceZ: -0.35,
  wallCenter: [0, (height - 0.48) / 2, -0.35 - WALL_DEPTH / 2],
  summit: [0, height, -1.6],
});

export function buildNodes(
  world: World,
  mood: Mood,
  heroColor: string,
  ladders: Record<Limb, Ladder> | undefined,
  evidence: string,
  withPole: boolean,
) {
  const sky = SKY[mood],
    H = world.height,
    nodes: any[] = [];
  const mesh = (
    id: string,
    shape: string,
    size: number[],
    color: string,
    position: [number, number, number],
    more: Record<string, any> = {},
  ) =>
    nodes.push({ id, kind: "mesh", position, color, evidence, geometry: { shape, size }, ...more });
  mesh("ground", "box", [60, 0.4, 60], sky.ground, [0, -0.2, 0]);
  mesh("wall", "box", [WALL_WIDTH, H + 0.4 - 0.08, WALL_DEPTH], sky.rock, [
    world.wallCenter[0],
    world.wallCenter[1],
    world.wallCenter[2],
  ]);
  mesh("summit-snow", "box", [WALL_WIDTH + 0.06, 0.08, WALL_DEPTH + 0.06], sky.snow, [
    0,
    H - 0.04,
    world.wallCenter[2],
  ]);
  if (ladders)
    for (const limb of Object.keys(ladders) as Limb[]) {
      const l = ladders[limb],
        hand = limb.endsWith("Hand"),
        size = hand ? [0.26, 0.1, 0.2] : [0.44, 0.12, 0.34];
      const dz = hand ? -0.03 : -0.05;
      mesh(
        `hold-${limb.replace(/([A-Z])/g, "-$1").toLowerCase()}`,
        "box",
        size,
        hand ? "#9AA9B8" : "#90A0B0",
        [l.first[0], l.first[1] - (hand ? 0.07 : 0.1), l.first[2] + dz],
        {
          repeat: { count: Math.max(1, l.count), step: [0, l.step, 0], jitter: [0, 0, 0], seed: 1 },
        },
      );
    }
  const peaks: [number, number, number, number][] = [
    [-7, -15, 7 + H, 5],
    [8, -19, 9 + H, 6.5],
    [-15, -26, 8 + H, 7],
    [17, -30, 12 + H, 8.5],
  ];
  peaks.forEach(([x, z, h, r], i) => {
    mesh(`peak-${i}`, "cone", [r, h], sky.far, [x, h / 2 - 0.1, z]);
    mesh(`cap-${i}`, "cone", [r * 0.46, h * 0.42], sky.snow, [x, h * 0.79, z]);
  });
  mesh("snowfall", "sphere", [0.03], "#FFFFFF", [0, 6, 2], {
    repeat: { count: 90, step: [0, 0, 0], jitter: [14, 7, 5], seed: 37 },
  });
  nodes.push({
    id: "hero",
    kind: "actor",
    position: [0, 0, 0],
    rotation: [0, Math.PI, 0],
    color: heroColor,
    evidence,
  });
  mesh("helmet", "sphere", [0.36], "#F2BD42", [0, 0.17, 0], {
    parent: "hero",
    socket: "head",
    geometry: { shape: "sphere", size: [0.36] },
  });
  mesh("pack", "box", [0.5, 0.6, 0.26], "#314C63", [0, 1.24, -0.33], { parent: "hero" });
  if (withPole) {
    nodes.push({
      id: "pole",
      kind: "group",
      position: [world.summit[0], H + 0.45, world.summit[2]],
      scale: [0.01, 0.01, 0.01],
      evidence,
    });
    mesh("pole-shaft", "cylinder", [0.035, 0.035, 1.9], "#D9D4C7", [0, 0.95, 0], {
      parent: "pole",
    });
    nodes.push({
      id: "flag",
      kind: "group",
      position: [0, 1.62, 0],
      scale: [0.01, 1, 1],
      parent: "pole",
      evidence,
    });
    mesh("flag-cloth", "box", [0.7, 0.42, 0.02], "#D93F2E", [0.36, 0, 0], { parent: "flag" });
  }
  return { nodes, background: sky.bg };
}
