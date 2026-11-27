/**
 * Trusted, application-owned asset registry.
 *
 * Gemini/Claude scene JSON may refer to IDs, never fetch arbitrary URLs.
 * Production registration of new fal outputs requires explicit user approval,
 * private storage, ownership/license review and server-side limits.
 */
export interface ApprovedModelInfo { url: string; bytes: number; source: string; licensing: string; display: string; /** Real vertex count when known; otherwise the compiler assumes a conservative default. */ vertices?: number;
  /** The stage has no environment map, so strongly metallic GLB materials render almost black; cap them on import. */ maxMetalness?: number;
  /** Authoring facts for direction writers (human or LLM). Only models that have it are offered to the AI. */
  catalogue?: ModelCatalogue }

/** Rotatable inner node of a GLB, with the axis/angle convention verified in modelParts.test.ts. */
export interface ModelPartInfo {
  name: string; kind: 'door' | 'wheel' | 'dial'; axis: 'x' | 'y' | 'z';
  /** Angle (rad) that opens a door, or the default for the part. */
  openAngle?: number; note: string;
}
export interface ModelCatalogue {
  /** Unscaled width (x) × height (y) × depth (z) in metres. */
  size: [number, number, number]; origin: string; description: string;
  parts?: ModelPartInfo[];
  /** Vehicles: wheel radius (m). Forward is local +Z; the compiler rolls the wheels by distance / radius. */
  wheelRadius?: number;
  /** Upright discs that can roll along +X: radius and centre height above the node origin (unscaled). */
  roll?: { radius: number; centerY: number };
  /** Height (y, unscaled) of the floor inside an enclosure, for placing small models inside. */
  interiorFloorY?: number;
  /** The model has a face that matters (door, symbol) on local +Z: it must face the camera in every shot where it is a subject. */
  front?: boolean;
}
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
    catalogue: { size: [1.2, 1.0, 1.2], origin: 'centro da base', description: 'Pallet com 24 fardos de notas de 100 e uma cinta. Sem peças móveis.' },
  },
  'armored-truck-v1': {
    url: '/models/caminhao_blindado.glb',
    vertices: 3888, // measured from the audited file; used by the scene geometry budget
    bytes: 115344,
    source: 'gemini-procedural-script',
    licensing: 'owner-generated (scripts/glb/gerar_pack_dinheiro.py)',
    display: 'Caminhão blindado (porta_traseira, roda_1..6)',
    catalogue: { size: [2.4, 2.6, 6.0], origin: 'centro da base; a frente (cabine) aponta para +Z', description: 'Caminhão blindado com cabine, carroceria e porta traseira.', wheelRadius: 0.42,
      parts: [
        { name: 'porta_traseira', kind: 'door', axis: 'y', openAngle: 2.09, note: 'abre para −Z (atrás) com +Y; 0 = fechada, 2,09 = aberta (~120°)' },
        ...[1, 2, 3, 4, 5, 6].map((i): ModelPartInfo => ({ name: 'roda_' + i, kind: 'wheel', axis: 'x', note: '+X gira a roda para a frente (+Z)' })),
      ] },
  },
  'giant-safe-v1': {
    url: '/models/cofre_gigante.glb',
    maxMetalness: 0.4,
    vertices: 3288, // measured from the audited file; used by the scene geometry budget
    bytes: 91164,
    source: 'gemini-procedural-script',
    licensing: 'owner-generated (scripts/glb/gerar_pack_dinheiro.py)',
    display: 'Cofre gigante (porta, volante; piso interno y=0,28)',
    catalogue: { size: [1.94, 2.0, 1.54], origin: 'centro da base; a porta fica na face +Z', description: 'Cofre de aço com porta de dobradiça e volante.', interiorFloorY: 0.28, front: true,
      parts: [
        { name: 'porta', kind: 'door', axis: 'y', openAngle: 2.0, note: 'abre para +Z (para a câmera) com +Y; 0 = fechada, 2,0 = aberta (~115°)' },
        { name: 'volante', kind: 'dial', axis: 'z', note: 'volante da porta; gira em Z' },
      ] },
  },
  'money-bag-v1': {
    url: '/models/saco_dinheiro.glb',
    vertices: 2064, // measured from the audited file; used by the scene geometry budget
    bytes: 56316,
    source: 'gemini-procedural-script',
    licensing: 'owner-generated (scripts/glb/gerar_pack_dinheiro.py)',
    display: 'Saco de dinheiro',
    catalogue: { size: [0.4, 0.5, 0.36], origin: 'centro da base', description: 'Saco de dinheiro amarrado com símbolo de cifrão na frente (+Z).' },
  },
  'giant-coin-v1': {
    url: '/models/moeda_grande.glb',
    maxMetalness: 0.25,
    vertices: 3168, // measured from the audited file; used by the scene geometry budget
    bytes: 84720,
    source: 'gemini-procedural-script',
    licensing: 'owner-generated (scripts/glb/gerar_pack_dinheiro.py)',
    display: 'Moeda grande de pé',
    catalogue: { size: [1.0, 1.0, 0.12], origin: 'centro da base; a face com o símbolo aponta para +Z', description: 'Moeda grande em pé com cifrão nas duas faces.', roll: { radius: 0.5, centerY: 0.5 } },
  },
});

export type ApprovedModelId = 'expressive-robot-v1' | 'money-pallet-v1' | 'armored-truck-v1' | 'giant-safe-v1' | 'money-bag-v1' | 'giant-coin-v1';
export const approvedModelIds = Object.keys(APPROVED_MODELS) as ApprovedModelId[];

export function approvedModel(id: unknown): ApprovedModelInfo | undefined {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(APPROVED_MODELS, id)
    ? APPROVED_MODELS[id] : undefined;
}
