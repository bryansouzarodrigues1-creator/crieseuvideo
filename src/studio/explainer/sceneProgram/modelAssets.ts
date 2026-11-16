import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneWithSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { SceneProgramError } from './score';
import { approvedModel, type ApprovedModelId } from './modelRegistry';

/**
 * Never let an AI plan provide arbitrary URLs. Names resolve ONLY to reviewed,
 * same-origin assets with ownership/provenance recorded by the application.
 *
 * This pre-existing Lovable upload is a private QA candidate. Before publishing
 * it, verify user ownership and license as well as access from the deployed site.
 */
const MAX_GLB_BYTES = 16 * 1024 * 1024;
const MAX_TRIANGLES = 180_000;
const MAX_CLIPS = 24;

/** Reject remote resources and unsupported compressed geometry before GLTFLoader. */
export function inspectGLB(buffer: ArrayBuffer): { triangles: number; nodes: number } {
  if (buffer.byteLength < 20 || buffer.byteLength > MAX_GLB_BYTES)
    throw new SceneProgramError('O arquivo GLB é muito pequeno ou excede o limite seguro de 16 MB.');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== buffer.byteLength)
    throw new SceneProgramError('O arquivo não é um GLB 2.0 válido.');
  const jsonSize = view.getUint32(12, true), jsonType = view.getUint32(16, true);
  if (jsonType !== 0x4e4f534a || jsonSize < 10 || jsonSize > Math.min(buffer.byteLength - 20, 2_000_000))
    throw new SceneProgramError('O bloco JSON do GLB é inválido ou excessivo.');
  let gltf: any;
  try {
    gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonSize)));
  } catch { throw new SceneProgramError('O cabeçalho JSON do GLB não pode ser interpretado.'); }
  if (!gltf?.asset || gltf.asset.version !== '2.0' || !Array.isArray(gltf.nodes) ||
      !Array.isArray(gltf.meshes) || gltf.nodes.length > 2048 || gltf.meshes.length > 1024)
    throw new SceneProgramError('O GLB possui estrutura ou quantidade de objetos inválida.');
  // Inline data is bounded by MAX_GLB_BYTES; external URIs can escape the
  // application's trusted asset boundary, so reject all of them.
  for (const entry of [...(gltf.buffers || []), ...(gltf.images || [])]) {
    if (entry.uri && (typeof entry.uri !== 'string' || !entry.uri.startsWith('data:')))
      throw new SceneProgramError('O GLB contém recursos externos não autorizados.');
  }
  const extensions = [...(gltf.extensionsRequired || [])];
  if (extensions.some((x) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(x)))
    throw new SceneProgramError('A compactação desse modelo 3D requer um decodificador ainda não habilitado.');
  if ((gltf.animations || []).length > MAX_CLIPS)
    throw new SceneProgramError('O modelo possui animações demais para a prévia.');
  let triangles = 0;
  for (const mesh of gltf.meshes) for (const prim of mesh.primitives || []) {
    if (![undefined, 4].includes(prim.mode)) throw new SceneProgramError('O GLB exige uma topologia diferente de triângulos.');
    const accessor = gltf.accessors?.[prim.indices ?? prim.attributes?.POSITION];
    if (!accessor || !Number.isSafeInteger(accessor.count)) throw new SceneProgramError('O GLB não descreve seus triângulos corretamente.');
    triangles += Math.ceil(accessor.count / 3);
  }
  if (triangles > MAX_TRIANGLES) throw new SceneProgramError('O modelo excede o orçamento de 180 mil triângulos.');
  return { triangles, nodes: gltf.nodes.length };
}

export interface PreparedModel {
  id: ApprovedModelId;
  gltf: GLTF;
}

/** The only outbound request here is to a known, same-origin project asset. */
export async function loadApprovedModel(id: ApprovedModelId, fetchAsset = fetch): Promise<PreparedModel> {
  const info = approvedModel(id);
  if (!info) throw new SceneProgramError('O catálogo seguro não contém o modelo solicitado.');
  const response = await fetchAsset(info.url, { credentials: 'same-origin' });
  if (!response.ok) throw new SceneProgramError('O arquivo GLB autorizado não foi encontrado no armazenamento do projeto.');
  const bytes = Number(response.headers.get('content-length') || 0);
  if (bytes > MAX_GLB_BYTES) throw new SceneProgramError('O modelo excede o limite de transferência.');
  const data = await response.arrayBuffer();
  inspectGLB(data);
  const gltf = await new GLTFLoader().parseAsync(data, '/');
  if (!gltf.scene) throw new SceneProgramError('O modelo não contém uma cena tridimensional.');
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  if (box.isEmpty() || !Number.isFinite(size.length()) || size.length() > 200)
    throw new SceneProgramError('O modelo GLB possui dimensões inválidas.');
  return { id, gltf };
}

export interface ModelInstance {
  root: THREE.Object3D;
  setTime(time: number): void;
}

/** Clone mesh skeletons AND resources so one timeline never mutates another. */
export function instantiateModel(loaded: PreparedModel): ModelInstance {
  const root = cloneWithSkeleton(loaded.gltf.scene);
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  const mixer = new THREE.AnimationMixer(root);
  for (const clip of loaded.gltf.animations.slice(0, MAX_CLIPS)) {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
  }
  return {
    root,
    setTime(time) {
      // setTime, unlike update(delta), is seekable and independent of render order.
      mixer.setTime(Math.max(0, Number.isFinite(time) ? time : 0));
    },
  };
}
