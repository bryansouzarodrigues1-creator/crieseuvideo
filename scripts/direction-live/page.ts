/* eslint-disable @typescript-eslint/no-explicit-any -- QA page publishes a small API on window for Playwright */
import * as THREE from "three";
import { SceneProgram3D } from "@/studio/explainer/sceneProgram/stage3d";
import { loadProgramModels } from "@/studio/explainer/sceneProgram/modelAssets";
import { normalizeSceneProgram } from "@/studio/explainer/sceneProgram/score";
import { encodeFixedFrame3DClip } from "@/studio/utils/deterministic3dExport";

const canvas = document.getElementById("c") as HTMLCanvasElement;
let renderer: THREE.WebGLRenderer | null = null;
let stage: SceneProgram3D | null = null;
let size = { w: 396, h: 704 };
let total = 0;

(window as any).__qa = {
  /** Builds the stage for a compiled program. Same loader and stage as the studio player. */
  async load(program: unknown, sources: any[], w = 396, h = 704) {
    size = { w, h };
    const norm = normalizeSceneProgram(program, sources);
    const models = await loadProgramModels(norm);
    renderer ??= new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage?.dispose();
    stage = new SceneProgram3D(norm, sources, models);
    total = sources.reduce((t, s) => t + (s.duration ?? 0), 0);
    return { total, nodes: norm.nodes.length };
  },
  /** One real engine frame as a JPEG (the review sends images, 250 kB max each). */
  frame(t: number, quality = 0.72) {
    stage!.render(renderer!, Math.max(0, Math.min(total - 0.001, t)), size.w, size.h);
    return canvas.toDataURL("image/jpeg", quality).split(",")[1];
  },
  /** Mean absolute difference between two frames, 0..255: proves the picture really changes (not a frozen frame). */
  motion(t0: number, t1: number) {
    const read = (t: number) => {
      stage!.render(renderer!, t, size.w, size.h);
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 114;
      const g = c.getContext("2d")!;
      g.drawImage(canvas, 0, 0, 64, 114);
      return g.getImageData(0, 0, 64, 114).data;
    };
    const a = read(t0),
      b = read(t1);
    let sum = 0;
    for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return sum / (a.length / 4) / 3;
  },
  async exportVideo(fps = 12) {
    const result = await encodeFixedFrame3DClip({
      canvas,
      durationSeconds: total,
      fps,
      maxSeconds: 60,
      renderFrame: (t) => stage!.render(renderer!, Math.min(total - 0.001, t), size.w, size.h),
    });
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(result.blob);
    });
    return { base64, ext: result.filenameExtension, frames: result.frames, fps: result.fps, bytes: result.blob.size };
  },
};
(window as any).__ready = true;
