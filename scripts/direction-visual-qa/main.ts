/* eslint-disable @typescript-eslint/no-explicit-any -- QA page publishes results on window for Playwright */
import * as THREE from "three";
import {
  compileDirectionDetailed,
  type Direction,
} from "@/studio/explainer/sceneProgram/direction/direction";
import { SceneProgram3D } from "@/studio/explainer/sceneProgram/stage3d";
import { loadProgramModels } from "@/studio/explainer/sceneProgram/modelAssets";
import { normalizeSceneProgram } from "@/studio/explainer/sceneProgram/score";

const sentences = [
  "Ele atravessou a neve até a base da montanha.",
  "Depois começou a escalar a parede de gelo, devagar, passo a passo, procurando apoio para cada mão e cada pé, sem olhar para baixo.",
  "No topo, cravou a bandeira.",
  "E finalmente comemorou.",
];
const sources = sentences.map((text, i) => ({
  sourceId: `s${i + 1}`,
  text,
  duration: Math.max(2, text.split(/\s+/).length / 2.6),
}));
const cam = (subjects: string[], az = 0.9, el = 0.14, d = 1.4) => ({
  subjects,
  azimuth: az,
  endAzimuth: az + 0.2,
  elevation: el,
  distance: d,
});
const direction: Direction = {
  version: 1,
  background: "#BCD9EA",
  world: { kind: "cliff", height: 3.3, mood: "day" },
  cast: [
    { id: "hero", kind: "actor", color: "#DF6B35" },
    {
      id: "banner",
      kind: "mesh",
      hidden: true,
      position: [1.6, 1.2, 1.2],
      geometry: { shape: "box", size: [0.8, 0.5, 0.05] },
      color: "#EF4444",
    },
    { id: "coin", kind: "model", hidden: true, assetId: "giant-coin-v1", position: [-2.2, 0, 1.4] },
  ],
  scenes: [
    {
      sourceId: "s1",
      shot: cam(["hero"]),
      verbs: [
        { do: "walk", node: "hero", from: "left" },
        { do: "appear", node: "banner", at: [0.2, 0.6] },
      ],
    },
    {
      sourceId: "s2",
      shot: cam(["hero", "wall"], 0.75, 0.1, 1.1),
      verbs: [
        { do: "climb", node: "hero" },
        { do: "move", node: "banner", by: [0, 0.6, 0], at: [0, 1] },
      ],
    },
    {
      sourceId: "s3",
      shot: cam(["hero"], 1.2, 0.04, 1.05),
      verbs: [
        { do: "plant", node: "hero" },
        { do: "appear", node: "coin", at: [0, 0.5] },
      ],
    },
    {
      sourceId: "s4",
      shot: cam(["hero"], 0.2, 0.2, 1.5),
      verbs: [
        { do: "celebrate", node: "hero" },
        { do: "vanish", node: "banner", at: [0, 0.4] },
      ],
    },
  ],
};
(async () => {
  const { program, report } = compileDirectionDetailed(direction, sources);
  const norm = normalizeSceneProgram(program, sources);
  const models = await loadProgramModels(norm);
  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("c") as HTMLCanvasElement,
    preserveDrawingBuffer: true,
    antialias: true,
  });
  const stage = new SceneProgram3D(norm, sources, models);
  const total = sources.reduce((t, s) => t + s.duration, 0);
  const starts: number[] = [];
  let acc = 0;
  for (const s of sources) {
    starts.push(acc);
    acc += s.duration;
  }
  const times = [
    0.5,
    1.5,
    starts[1] + 1,
    starts[1] + 3.5,
    starts[1] + 5.5,
    starts[2] + 0.4,
    starts[2] + 1.6,
    starts[3] + 1.2,
    total - 0.2,
  ].map((t) => +t.toFixed(2));
  const frames: { t: number; png: string }[] = [];
  for (const t of times) {
    stage.render(renderer, t, 800, 450);
    frames.push({
      t,
      png: (document.getElementById("c") as HTMLCanvasElement).toDataURL("image/png"),
    });
  }
  (window as any).__done = { frames, report: { ...report, climb: undefined }, total };
})().catch((e) => {
  (window as any).__error = String(e?.stack || e);
});
