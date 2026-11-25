/**
 * Trusted, application-owned asset registry.
 *
 * Gemini/Claude scene JSON may refer to IDs, never fetch arbitrary URLs.
 * Production registration of new fal outputs requires explicit user approval,
 * private storage, ownership/license review and server-side limits.
 */
export interface ApprovedModelInfo { url: string; bytes: number; source: string; licensing: string; display: string; /** Real vertex count when known; otherwise the compiler assumes a conservative default. */ vertices?: number;
  /** The stage has no environment map, so strongly metallic GLB materials render almost black; cap them on import. */ maxMetalness?: number }
export const APPROVED_MODELS: Readonly<Record<string, ApprovedModelInfo>> = Object.freeze({
  'expressive-robot-v1': {
    url: '/__l5e/assets-v1/9878ecc5-49b2-4d40-92d0-0116735797d1/expressive-robot.glb',
    bytes: 463988,
    source: 'existing-lovable-upload',
    licensing: 'pending-owner-review',
    display: 'Robô expressivo (upload existente)',
  },
  'money-pallet-v1': {
    url: '/models/pilha_notas_100.glb',
    vertices: 3528, // measured from the audited file; used by the scene geometry budget
    bytes: 108592,
    source: 'gemini-procedural-script',
    licensing: 'owner-generated (scripts/glb/gerar_pack_dinheiro.py)',
    display: 'Pallet de notas (1,2 × 1,0 × 1,2 m)',
  },
  'armored-truck-v1': {
    url: '/models/caminhao_blindado.glb',
    vertices: 3888, // measured from the audited file; used by the scene geometry budget
    bytes: 115344,
    source: 'gemini-procedural-script',
    licensing: 'owner-generated (scripts/glb/gerar_pack_dinheiro.py)',
    display: 'Caminhão blindado (porta_traseira, roda_1..6)',
  },
  'giant-safe-v1': {
    url: '/models/cofre_gigante.glb',
    maxMetalness: 0.4,
    vertices: 3288, // measured from the audited file; used by the scene geometry budget
    bytes: 91164,
    source: 'gemini-procedural-script',
    licensing: 'owner-generated (scripts/glb/gerar_pack_dinheiro.py)',
    display: 'Cofre gigante (porta, volante; piso interno y=0,28)',
  },
  'money-bag-v1': {
    url: '/models/saco_dinheiro.glb',
    vertices: 2064, // measured from the audited file; used by the scene geometry budget
    bytes: 56316,
    source: 'gemini-procedural-script',
    licensing: 'owner-generated (scripts/glb/gerar_pack_dinheiro.py)',
    display: 'Saco de dinheiro',
  },
  'giant-coin-v1': {
    url: '/models/moeda_grande.glb',
    maxMetalness: 0.25,
    vertices: 3168, // measured from the audited file; used by the scene geometry budget
    bytes: 84720,
    source: 'gemini-procedural-script',
    licensing: 'owner-generated (scripts/glb/gerar_pack_dinheiro.py)',
    display: 'Moeda grande de pé',
  },
});

export type ApprovedModelId = 'expressive-robot-v1' | 'money-pallet-v1' | 'armored-truck-v1' | 'giant-safe-v1' | 'money-bag-v1' | 'giant-coin-v1';
export const approvedModelIds = Object.keys(APPROVED_MODELS) as ApprovedModelId[];

export function approvedModel(id: unknown): ApprovedModelInfo | undefined {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(APPROVED_MODELS, id)
    ? APPROVED_MODELS[id] : undefined;
}
