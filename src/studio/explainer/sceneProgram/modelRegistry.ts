/**
 * Trusted, application-owned asset registry.
 *
 * Gemini/Claude scene JSON may refer to IDs, never fetch arbitrary URLs.
 * Production registration of new fal outputs requires explicit user approval,
 * private storage, ownership/license review and server-side limits.
 */
export const APPROVED_MODELS = Object.freeze({
  'human-prototype-v1': {
    url: '/__local-models/human-prototype-v1.glb',
    bytes: 0,
    source: 'original-procedural-qa',
    licensing: 'project-original',
    display: 'Humano articulado de teste',
  },
  'expressive-robot-v1': {
    url: '/__l5e/assets-v1/9878ecc5-49b2-4d40-92d0-0116735797d1/expressive-robot.glb',
    bytes: 463988,
    source: 'existing-lovable-upload',
    licensing: 'pending-owner-review',
    display: 'Robô expressivo (upload existente)',
  },
} as const);

export type ApprovedModelId = keyof typeof APPROVED_MODELS;
export const approvedModelIds = Object.keys(APPROVED_MODELS) as ApprovedModelId[];

export function approvedModel(id: unknown): (typeof APPROVED_MODELS)[ApprovedModelId] | undefined {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(APPROVED_MODELS, id)
    ? APPROVED_MODELS[id as ApprovedModelId] : undefined;
}
