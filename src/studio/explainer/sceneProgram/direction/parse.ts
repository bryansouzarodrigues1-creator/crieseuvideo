/* eslint-disable @typescript-eslint/no-explicit-any -- untyped model JSON, validated field by field */
import type { ProgramSource } from "../score";
import { DirectionError } from "./errors";
import { EMOTIONS, POSE_NAMES } from "./poses";
import { isLocomotion } from "./locomotion";
import type { CastMember, Direction } from "./direction";
import { strictCast, strictVerb } from "./strict";

export const VERB_NAMES = [
  "appear",
  "vanish",
  "move",
  "scale",
  "turn",
  "rotatePart",
  "open",
  "close",
  "spin",
  "drive",
  "roll",
  "rise",
  "pose",
] as const;
export const CAST_KINDS = ["model", "mesh", "actor", "group"] as const;
const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const MAX_CAST = 60,
  MAX_VERBS_PER_SCENE = 120;

/**
 * What a model wrote → a Direction, or a DirectionError whose message is addressed to the model (it is quoted back in the repair round).
 * Structural only: geometry, ranges, windows, overlaps and every physical limit are checked by compileDirection and the engine.
 */
export function parseDirection(raw: unknown, sources: ProgramSource[]): Direction {
  const r = raw as any;
  const fail = (m: string): never => {
    throw new DirectionError(m);
  };
  if (!r || typeof r !== "object" || Array.isArray(r))
    return fail("A direção precisa ser um objeto JSON { version, background, cast, scenes }.");
  const extra = Object.keys(r).filter(
    (k) => !["version", "background", "world", "cast", "scenes", "title"].includes(k),
  );
  if (extra.length) fail(`Campos não suportados na direção: ${extra.join(", ")}.`);
  if (r.version !== 1) fail("version precisa ser 1.");
  if (typeof r.background !== "string" || !/^#[0-9a-f]{6}$/i.test(r.background))
    fail("background precisa ser uma cor #RRGGBB.");
  if (!Array.isArray(r.cast) || r.cast.length < 1 || r.cast.length > MAX_CAST)
    fail(`cast precisa ter de 1 a ${MAX_CAST} itens.`);
  const ids = new Set<string>();
  r.cast.forEach((m: any, i: number) => {
    if (!m || typeof m !== "object") fail(`cast[${i}] não é um objeto.`);
    if (typeof m.id !== "string" || !ID.test(m.id))
      fail(`cast[${i}].id precisa usar minúsculas, números, - ou _ (até 40 caracteres).`);
    if (ids.has(m.id)) fail(`cast repete o id "${m.id}".`);
    ids.add(m.id);
    if (!CAST_KINDS.includes(m.kind))
      fail(`cast[${i}].kind precisa ser um destes: ${CAST_KINDS.join(", ")}.`);
  });
  if (r.world !== undefined) {
    const w = r.world;
    if (
      !w ||
      w.kind !== "cliff" ||
      typeof w.height !== "number" ||
      !["day", "dusk", "night"].includes(w.mood)
    )
      fail('world precisa ser { kind: "cliff", height: 2.4–4.5, mood: "day"|"dusk"|"night" }.');
    if (w.height < 2.4 || w.height > 4.5)
      fail("world.height (altura da parede, em metros) precisa estar entre 2.4 e 4.5.");
  }
  if (!Array.isArray(r.scenes) || r.scenes.length !== sources.length)
    fail(`scenes precisa ter exatamente ${sources.length} item(ns), um por frase, na ordem.`);
  r.scenes.forEach((sc: any, i: number) => {
    if (!sc || typeof sc !== "object") fail(`scenes[${i}] não é um objeto.`);
    if (sc.sourceId !== sources[i].sourceId)
      fail(`scenes[${i}].sourceId precisa ser "${sources[i].sourceId}".`);
    const s = sc.shot;
    if (
      !s ||
      !Array.isArray(s.subjects) ||
      !s.subjects.length ||
      s.subjects.some((x: unknown) => typeof x !== "string")
    )
      fail(`scenes[${i}].shot.subjects precisa ser uma lista de ids do elenco.`);
    for (const k of ["azimuth", "elevation", "distance"])
      if (typeof s[k] !== "number" || !Number.isFinite(s[k]))
        fail(`scenes[${i}].shot.${k} precisa ser um número.`);
    if (!Array.isArray(sc.verbs) || sc.verbs.length > MAX_VERBS_PER_SCENE)
      fail(`scenes[${i}].verbs precisa ser uma lista (até ${MAX_VERBS_PER_SCENE}).`);
    sc.verbs.forEach((v: any, j: number) => {
      if (!v || typeof v !== "object") fail(`scenes[${i}].verbs[${j}] não é um objeto.`);
      if (!VERB_NAMES.includes(v.do) && !isLocomotion(v.do))
        fail(
          `scenes[${i}].verbs[${j}].do "${String(v.do)}" não existe. Use: ${[...VERB_NAMES, ...(r.world ? ["walk", "climb", "plant", "celebrate", "stand"] : [])].join(", ")}.`,
        );
      if (typeof v.node !== "string" || !ids.has(v.node))
        fail(`scenes[${i}].verbs[${j}].node "${String(v.node)}" não está no elenco.`);
      if (v.do === "pose") {
        if (!POSE_NAMES.includes(v.pose))
          fail(`scenes[${i}].verbs[${j}].pose precisa ser: ${POSE_NAMES.join(", ")}.`);
        if (v.emotion !== undefined && !EMOTIONS.includes(v.emotion))
          fail(`scenes[${i}].verbs[${j}].emotion precisa ser: ${EMOTIONS.join(", ")}.`);
      }
    });
  });
  // Second pass: allowlist of every field, ranges, and the model-catalogue defaults (door angle/axis, wheel names/radius, roll radius).
  const idSet = new Set<string>(),
    cast = new Map<string, CastMember>();
  for (const item of r.cast) {
    const m = strictCast(item, idSet);
    cast.set(m.id, m);
  }
  const num = (v: unknown, what: string, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
      ? v
      : fail(`${what} precisa ser um número entre ${min} e ${max}.`);
  const scenes = r.scenes.map((sc: any, i: number) => {
    const s = sc.shot;
    const unknown = Object.keys(s).find(
      (k) => !["subjects", "azimuth", "endAzimuth", "elevation", "distance"].includes(k),
    );
    if (unknown) fail(`scenes[${i}].shot tem o campo não suportado "${unknown}".`);
    // With `world` the engine creates reserved nodes (ground, wall, …) that a shot may cite; compileDirection checks them.
    if (r.world === undefined)
      for (const id of s.subjects)
        if (!cast.has(id)) fail(`scenes[${i}].shot cita "${id}", que não está no elenco.`);
    const extraKeys = Object.keys(sc).filter((k) => !["sourceId", "shot", "verbs"].includes(k));
    if (extraKeys.length) fail(`scenes[${i}] tem o campo não suportado "${extraKeys[0]}".`);
    return {
      sourceId: sc.sourceId as string,
      shot: {
        subjects: s.subjects as string[],
        azimuth: num(s.azimuth, `scenes[${i}].shot.azimuth`, -Math.PI * 2, Math.PI * 2),
        ...(s.endAzimuth !== undefined && s.endAzimuth !== null
          ? {
              endAzimuth: num(
                s.endAzimuth,
                `scenes[${i}].shot.endAzimuth`,
                -Math.PI * 2,
                Math.PI * 2,
              ),
            }
          : {}),
        elevation: num(s.elevation, `scenes[${i}].shot.elevation`, -0.35, 1.1),
        distance: num(s.distance, `scenes[${i}].shot.distance`, 1, 2.5),
      },
      verbs: sc.verbs.map((v: unknown) => strictVerb(v, cast)),
    };
  });
  return {
    version: 1,
    background: r.background,
    cast: [...cast.values()],
    scenes,
    ...(r.world !== undefined ? { world: r.world } : {}),
  };
}
