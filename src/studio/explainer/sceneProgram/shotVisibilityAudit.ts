/**
 * Deterministic, browser-safe shot framing audit for REAL Three.js scene graphs.
 *
 * This is diagnostic evidence for AI revision and human review; it is not a
 * substitute for visual inspection, a segmentation model or an artistic judge.
 * No model API, screenshot dependency, stochastic sampling or GPU readback.
 */
import * as THREE from 'three';
import type { SceneProgram3D } from './stage3d';

export type ShotVisibilityIssue =
  | 'subject_offscreen'
  | 'subject_too_small'
  | 'possible_occlusion'
  | 'subject_missing_geometry';

export interface ShotSubjectVisibility {
  id: string;
  /** Clipped [left, top, right, bottom] in normalized viewport coordinates, 0..1. */
  rect: [number, number, number, number] | null;
  /** Percentage of the full frame occupied by the subject's projected bounding rectangle, 0..1. */
  areaFraction: number;
  /** Percentage of the projected bounding rectangle that lies inside frame, 0..1. */
  insideFraction: number;
  /** Number of sampled rays with the first hit on another object. Not pixel segmentation. */
  blockedRays: number;
  /** Number of sampled rays that hit any eligible solid geometry. */
  testedRays: number;
  issues: ShotVisibilityIssue[];
}

export interface ShotVisibilityReport {
  sourceId: string;
  timeSeconds: number;
  aspect: number;
  subjects: ShotSubjectVisibility[];
  issues: Array<{ subjectId: string; code: ShotVisibilityIssue; suggestion: string }>;
}

export interface ShotVisibilityOptions {
  /** Smallest allowed on-screen bounding rectangle area. Default 0.7% of frame. */
  minimumAreaFraction?: number;
  /** Minimum fraction of the subject's projected bounds inside frame, default 95%. */
  minimumInsideFraction?: number;
  /** Report a possible obstruction when at least this fraction of hit rays is blocked. */
  occludedRayFraction?: number;
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const suggestion = (code: ShotVisibilityIssue, id: string) => {
  if (code === 'subject_offscreen') return `Reenquadre a câmera para mostrar ${id} inteiro e respeitar a área segura.`;
  if (code === 'subject_too_small') return `Aproxime a câmera, reorganize o palco ou use uma tomada dedicada para destacar ${id}.`;
  if (code === 'possible_occlusion') return `Confira a visibilidade de ${id} em uma captura: pode estar atrás de outra peça. Mude azimute/elevação ou reposicione o obstáculo.`;
  return `O objeto ${id} não possui geometria visível. Confira sua construção e posição.`;
};
const contains = (object: THREE.Object3D, root: THREE.Object3D) => {
  for (let current: THREE.Object3D | null = object; current; current = current.parent)
    if (current === root) return true;
  return false;
};

/** One absolute-time sample: does not mutate authored tracks or camera parameters. */
export function auditShotVisibilityAt(
  stage: SceneProgram3D,
  timeSeconds: number,
  aspect: number,
  options: ShotVisibilityOptions = {},
): ShotVisibilityReport {
  if (!Number.isFinite(timeSeconds) || !Number.isFinite(aspect) || aspect <= 0)
    throw new Error('Auditoria de quadro recebeu tempo ou proporção inválidos.');
  const minArea = clamp(options.minimumAreaFraction ?? .007);
  const minInside = clamp(options.minimumInsideFraction ?? .95);
  const blockedThreshold = clamp(options.occludedRayFraction ?? .80);

  stage.update(timeSeconds);
  stage.frame(aspect);
  stage.scene.updateMatrixWorld(true);
  const { span, shot } = stage.score.shot(timeSeconds);
  const sourceId = span.sourceId;
  const results: ShotSubjectVisibility[] = [];
  const problems: ShotVisibilityReport['issues'] = [];

  // Raycast only actual, visible, reasonably opaque scene meshes (no sky or
  // ink outlines). A ray hitting a different mesh FIRST is a possible blocker.
  const meshes: THREE.Object3D[] = [];
  stage.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.visible || node.name === 'ink') return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.some(m => m.visible && (m.opacity ?? 1) > .2)) return;
    if (node.userData?.ignoreFramingAudit === true) return;
    meshes.push(node);
  });
  const raycaster = new THREE.Raycaster();
  const coords: Array<[number, number]> = [
    [.5, .5], [.33, .33], [.67, .33], [.33, .67], [.67, .67],
    [.5, .25], [.5, .75], [.25, .5], [.75, .5],
  ];

  for (const id of shot.subjects) {
    const root = stage.nodes.get(id);
    const box = root ? new THREE.Box3().setFromObject(root) : new THREE.Box3();
    const issues: ShotVisibilityIssue[] = [];
    let rect: ShotSubjectVisibility['rect'] = null;
    let areaFraction = 0, insideFraction = 0, blockedRays = 0, testedRays = 0;

    if (!root || box.isEmpty()) {
      issues.push('subject_missing_geometry');
    } else {
      const ndc: THREE.Vector3[] = [];
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z])
            ndc.push(new THREE.Vector3(x, y, z).project(stage.camera));
      if (ndc.some(p => !p.toArray().every(Number.isFinite) || p.z < -1 || p.z > 1)) {
        issues.push('subject_offscreen');
      } else {
        const left = Math.min(...ndc.map(p => (p.x + 1) / 2));
        const right = Math.max(...ndc.map(p => (p.x + 1) / 2));
        const top = Math.min(...ndc.map(p => (1 - p.y) / 2));
        const bottom = Math.max(...ndc.map(p => (1 - p.y) / 2));
        const area = Math.max(0, right - left) * Math.max(0, bottom - top);
        const clipped = Math.max(0, clamp(right) - clamp(left)) *
          Math.max(0, clamp(bottom) - clamp(top));
        areaFraction = clipped;
        insideFraction = area > 1e-10 ? clamp(clipped / area) : 0;
        rect = [clamp(left), clamp(top), clamp(right), clamp(bottom)];
        if (insideFraction < minInside && !issues.includes('subject_offscreen'))
          issues.push('subject_offscreen');
        if (areaFraction < minArea) issues.push('subject_too_small');

        // Samples inside the screen-projected bounds, NOT guessed 3D points.
        // Only raise a warning if we have enough actual ray hits to judge.
        if (clipped > 1e-6) {
          for (const [u,v] of coords) {
            const px = clamp(left) + (clamp(right) - clamp(left)) * u;
            const py = clamp(top) + (clamp(bottom) - clamp(top)) * v;
            raycaster.setFromCamera(new THREE.Vector2(px * 2 - 1, 1 - py * 2), stage.camera);
            const hits = raycaster.intersectObjects(meshes, false);
            if (hits.length === 0) continue;
            testedRays++;
            if (!contains(hits[0].object, root)) blockedRays++;
          }
          if (testedRays >= 5 && blockedRays / testedRays >= blockedThreshold)
            issues.push('possible_occlusion');
        }
      }
    }
    results.push({ id, rect, areaFraction, insideFraction, blockedRays, testedRays, issues });
    for (const code of issues) problems.push({subjectId: id, code, suggestion: suggestion(code,id)});
  }

  return { sourceId, timeSeconds, aspect, subjects: results, issues: problems };
}

/**
 * The same report is usable by a future model-tool loop as tool_result JSON:
 * no source code, no credentials, no unbounded screenshot payload.
 */
export function auditShotVisibilitySequence(
  stage: SceneProgram3D,
  aspect: number,
  options?: ShotVisibilityOptions,
): ShotVisibilityReport[] {
  const reports: ShotVisibilityReport[] = [];
  for (const span of stage.score.spans) {
    for (const phase of [.12, .5, .88])
      reports.push(auditShotVisibilityAt(stage, span.start + phase * span.duration, aspect, options));
  }
  stage.update(0);
  return reports;
}
