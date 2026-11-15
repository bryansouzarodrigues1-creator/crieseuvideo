import { MOODS, PALETTES, PRESENTER_POSES, VISUALS } from '../explainer/plan';
import { SETTINGS } from '../explainer/settings';
import { STORY_ACTIONS, STORY_PROPS } from '../explainer/storyAction';
import { inferStaging } from '../explainer/staging';
import { ASSET_KINDS, CHANNELS, SOCKETS } from '../explainer/production/score';
import { MAX_SHAPES, SHAPE_TYPES, SHAPE_ANIMS } from '../explainer/drawing';
import type { SourceBeat } from './grounding';

export type OutputSchema = Record<string, unknown>;
const text = { type: 'string' };
const choices = (values: readonly string[]) => ({ type: 'string', enum: values });
const object = (properties: Record<string, unknown>, required: string[] = [], additionalProperties: unknown = false) => ({ type: 'object', properties, required, additionalProperties });
const list = (items: unknown, maxItems: number) => ({ type: 'array', items, maxItems });
const nullable = (schema: OutputSchema) => ({ anyOf: [schema, { type: 'null' }] });
const number = { type: 'number' };
const vec3 = { ...list(number, 3), minItems: 3 };

/** Reference/test schema for the finite renderer vocabulary, not a provider
 * request option. The compatible transport uses JSON MIME; stagingContract and
 * server validators bind source meaning, actions, roles and physical contacts. */
export function directionSchema(beats: SourceBeat[]): OutputSchema {
  const source = choices(beats.map((b) => b.sourceId));
  const story = nullable(object({
    action: choices(STORY_ACTIONS), prop: choices(STORY_PROPS),
    actors: { ...list(object({ name: text, color: text }, ['name']), 2), minItems: 1 },
    performance: nullable(choices(['grounded-v1'])),
  }, ['action', 'prop', 'actors']));
  const production = nullable(object({
    version: { type: 'integer', enum: [1] }, world: choices(['construction', 'studio']),
    assets: { ...list(object({
      id: text, kind: choices(ASSET_KINDS), position: vec3, yaw: number, color: text,
      initial: object({}, [], number), evidence: text, cargoStyle: choices(['box', 'sacks', 'pallet']),
    }, ['id', 'kind', 'position', 'evidence']), 12), minItems: 1 },
    tracks: list(object({ asset: text, channel: choices([...new Set(Object.values(CHANNELS).flatMap(Object.keys))]), sourceId: source,
      begin: { type: 'number', minimum: 0, maximum: 1 }, end: { type: 'number', minimum: 0, maximum: 1 }, to: number, evidence: text,
    }, ['asset', 'channel', 'sourceId', 'begin', 'end', 'to', 'evidence']), 100),
    couplings: list(object({ child: text, parent: nullable(text), socket: choices([...new Set(Object.values(SOCKETS).flat())]),
      childSocket: choices(['origin', 'base', 'grip']), at: object({ sourceId: source, phase: { type: 'number', minimum: 0, maximum: 1 } }, ['sourceId', 'phase']),
    }, ['child', 'parent', 'socket', 'childSocket', 'at']), 32),
    shots: list(object({ sourceId: source, subject: text, socket: choices([...new Set(Object.values(SOCKETS).flat())]),
      kind: choices(['wide', 'detail', 'follow', 'orbit']),
    }, ['sourceId', 'subject', 'kind']), 120),
  }, ['version', 'world', 'assets', 'tracks', 'couplings', 'shots']));
  const shared = {
    visual: choices(VISUALS), mood: choices(MOODS), palette: choices(PALETTES),
    setting: nullable(choices(SETTINGS)), presenterPose: nullable(choices(PRESENTER_POSES)),
    label: nullable(text), chat: nullable(text), chips: list(text, 4), highlight: list(text, 5), gallery: nullable(text),
    drawing: { anyOf: [{ $ref: '#/$defs/drawing' }, { type: 'null' }] }, story: { $ref: '#/$defs/story' },
  };
  return {
    ...object({
      title: text,
      scenes: {
        type: 'array', minItems: beats.length, maxItems: beats.length,
        prefixItems: beats.map((beat) => {
          const action = inferStaging(beat.text)?.action;
          return object({ ...shared, sourceId: choices([beat.sourceId]), text: choices([beat.text]),
            staging: action ? nullable(object({ action: choices([action]), camera: choices(['follow', 'detail', 'wide']) }, ['action'])) : { type: 'null' },
          }, ['sourceId', 'visual']);
        }),
      },
      production: { $ref: '#/$defs/production' },
    }, ['scenes']),
    $defs: { story, production, drawing: list(object({ type: choices(SHAPE_TYPES), anim: choices(SHAPE_ANIMS) }, ['type'], true), MAX_SHAPES) },
  };
}

export function stagingContract(beats: SourceBeat[]) {
  return JSON.stringify(beats.map((beat) => ({ sourceId: beat.sourceId, staging: inferStaging(beat.text)?.action ?? null })));
}
