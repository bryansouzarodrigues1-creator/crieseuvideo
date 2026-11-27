/**
 * Deterministic framing checks on a compiled program, written for the model (Portuguese, with the fix in the message).
 * They run on engine data only — no pixels, no extra AI call — and feed `measure` of the planners and the review:
 *  1. facing: a model with a front (cofre: porta; saco: cifrão) that is a subject of a shot must face that shot's camera;
 *  2. occlusion: no other visible model may stand between the camera and a subject;
 *  3. visibility: a subject must not be hidden (scale ≈ 0) while the camera is looking at it.
 * Conventions (same as stage3d.frame): the camera sits at subject + (sin az, ·, cos az); a model's front is local +Z
 * rotated by yaw, i.e. (sin yaw, cos yaw) in (x, z). It faces the camera when cos(yaw − az) > 0.
 */
import { approvedModel } from "../modelRegistry";
import { compileSceneProgram, type ProgramSource, type SceneProgram } from "../score";

const r2 = (n: number) => Math.round(n * 100) / 100;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function framingProblems(program: SceneProgram, allSources: ProgramSource[]): string[] {
  // A block planner measures a prefix of the story: only the sentences already planned.
  const sources = allSources.slice(0, program.shots.length);
  const timeline = compileSceneProgram(program, sources);
  const nodes = new Map(program.nodes.map((n) => [n.id, n]));
  const out: string[] = [];
  for (const span of timeline.spans) {
    const shot = program.shots.find((s) => s.sourceId === span.sourceId);
    if (!shot) continue;
    const times = [0.35, 0.8].map((p) => span.start + span.duration * p);
    for (const t of times) {
      const state = timeline.sample(t);
      const u = Math.max(0, Math.min(1, (t - span.start) / span.duration));
      const az = shot.azimuth + (shot.endAzimuth - shot.azimuth) * u;
      for (const id of shot.subjects) {
        const node = nodes.get(id);
        const s = state.get(id);
        if (!node || !s) continue;
        const hidden = s.scale[0] < 0.05 && s.scale[1] < 0.05;
        if (hidden) {
          out.push(`${span.sourceId}: "${id}" é assunto da câmera mas está oculto nesta cena; faça-o aparecer antes ou troque o assunto.`);
          continue;
        }
        const info = node.kind === "model" && node.assetId ? approvedModel(node.assetId) : undefined;
        if (!node.parent && info?.catalogue?.front) {
          const off = Math.abs(wrap(s.rotation[1] - az));
          if (off > Math.PI / 2 - 0.25) {
            out.push(
              `${span.sourceId}: "${id}" está de costas/de lado para a câmera (a frente dele, que tem a porta/símbolo, aponta ${Math.round((off * 180) / Math.PI)}° fora do olhar). Gire-o com turn para rotation [0, ${r2(az)}, 0] (frente para a câmera) ou mude o azimute do plano para ${r2(s.rotation[1])}.`,
            );
            break;
          }
        }
      }
      // Occlusion: segment from the subject centre toward the camera, against the footprint of other visible models.
      for (const id of shot.subjects) {
        const sn = nodes.get(id);
        const ss = state.get(id);
        if (!sn || !ss || sn.parent) continue;
        const sInfo = sn.assetId ? approvedModel(sn.assetId) : undefined;
        const sSize = sInfo?.catalogue?.size ?? [1, 1, 1];
        const sHalf = Math.max(sSize[0] * ss.scale[0], sSize[2] * ss.scale[2]) / 2;
        const cy = ss.position[1] + (sSize[1] * ss.scale[1]) / 2;
        const reach = Math.max(sHalf * 4 * shot.distance, 4);
        const dir = [Math.sin(az), Math.cos(az)];
        let blocked: string | undefined;
        for (const other of program.nodes) {
          if (other.id === id || shot.subjects.includes(other.id) || other.parent || other.kind !== "model" || !other.assetId) continue;
          const os = state.get(other.id);
          const oi = approvedModel(other.assetId)?.catalogue;
          if (!os || !oi || (os.scale[0] < 0.05 && os.scale[1] < 0.05)) continue;
          const half = Math.max(oi.size[0] * os.scale[0], oi.size[2] * os.scale[2]) / 2;
          const top = os.position[1] + oi.size[1] * os.scale[1];
          if (top < cy * 0.5 || os.position[1] > cy * 2) continue;
          // distance along the camera ray and sideways offset (plan view)
          const dx = os.position[0] - ss.position[0], dz = os.position[2] - ss.position[2];
          const along = dx * dir[0] + dz * dir[1];
          const side = Math.abs(dx * dir[1] - dz * dir[0]);
          if (along > sHalf * 0.5 && along < reach && side < half + sHalf * 0.6) { blocked = other.id; break; }
        }
        if (blocked) {
          out.push(
            `${span.sourceId}: "${blocked}" fica entre a câmera e "${id}" e tapa a vista. Afaste "${blocked}" (move) ou oculte-o nesta cena, ou mude o azimute do plano.`,
          );
          break;
        }
      }
    }
  }
  return [...new Set(out)];
}
