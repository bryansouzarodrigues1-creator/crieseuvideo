/**
 * Human-sized placement for approved skinned GLB characters.
 *
 * Some Blender/FBX-derived GLBs have internal Armature scale=100 and multiple
 * SkinnedMeshes whose bind-pose bounding boxes are NOT useful for actor size.
 * Box3.setFromObject(model) can falsely report a 60+ metre avatar and make
 * an actual 1.8m person render as a tiny dot.
 *
 * Use real skeleton landmarks under the full parent transform instead.
 * This is a bounded calibration for humanoids, NOT a substitute for humanoid
 * animation, rig retargeting, proper joint contacts, or semantic scene direction.
 */
import * as THREE from 'three';

export class HumanoidCalibrationError extends Error {}

export interface HumanoidScaleReport {
  originalHeightMetres: number;
  scaleRatio: number;
  headBone: string;
  footBones: [string,string];
  newFootHeight: number;
}

const normalized = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

function findBone(root: THREE.Object3D, names: string[]) {
  const accepted=new Set(names.map(normalized));
  let found: THREE.Bone|undefined;
  root.traverse(n=>{
    if (found || !(n instanceof THREE.Bone)) return;
    if (accepted.has(normalized(n.name))) found=n;
  });
  return found;
}

export function calibrateRiggedHumanoid(
  model: THREE.Object3D,
  targetHeightMetres=1.88,
): HumanoidScaleReport {
  if(!Number.isFinite(targetHeightMetres) ||
    targetHeightMetres<1.20 || targetHeightMetres>2.20)
    throw new HumanoidCalibrationError('Altura de personagem fora da faixa segura.');

  const head=findBone(model,['Head']);
  const left=findBone(model,['Foot.L','LeftFoot','foot_l']);
  const right=findBone(model,['Foot.R','RightFoot','foot_r']);
  if(!head||!left||!right)
    throw new HumanoidCalibrationError('Modelo sem cabeça e ambos os pés articulados.');
  // Preserve the source model's glTF coordinate origin and rotation.
  model.updateWorldMatrix(true,true);
  const h=head.getWorldPosition(new THREE.Vector3()).y;
  const l=left.getWorldPosition(new THREE.Vector3()).y;
  const r=right.getWorldPosition(new THREE.Vector3()).y;
  const ground=Math.min(l,r);
  // Head is at a joint, not at the character crown: reserve 12cm.
  const boneHeight=h-ground;
  if (!Number.isFinite(boneHeight) || boneHeight < .45 || boneHeight > 4.0)
    throw new HumanoidCalibrationError(
      'Altura incoerente do esqueleto; verificar eixos, escala de armadura ou bind pose.',
    );
  const scaleRatio=targetHeightMetres/(boneHeight+.12);
  if (scaleRatio < .30 || scaleRatio > 3.5)
    throw new HumanoidCalibrationError('GLB exige correção excessiva de escala; não aplicar automaticamente.');

  // Only use on a standalone GLB root before another transform changes it.
  const current=model.scale.clone();
  model.scale.copy(current.multiplyScalar(scaleRatio));
  // Re-measure after scaling. Avoid multiplying the pre-scaled bounding box.
  model.updateWorldMatrix(true,true);
  const worldFoot=Math.min(
    left.getWorldPosition(new THREE.Vector3()).y,
    right.getWorldPosition(new THREE.Vector3()).y,
  );
  // The root normally has no parent in the assets inspector. If parented,
  // world displacement is converted to its parent's local Y correctly.
  if(model.parent) {
    const v=new THREE.Vector3(0,-worldFoot,0);
    const from=model.parent.worldToLocal(new THREE.Vector3());
    const to=model.parent.worldToLocal(v);
    model.position.add(to.sub(from));
  } else model.position.y-=worldFoot;
  model.updateWorldMatrix(true,true);
  const newFootHeight=Math.min(
    left.getWorldPosition(new THREE.Vector3()).y,
    right.getWorldPosition(new THREE.Vector3()).y,
  );
  if (!Number.isFinite(newFootHeight) || Math.abs(newFootHeight)>.05)
    throw new HumanoidCalibrationError('Pés não assentaram no chão depois de calibrar o rig.');
  return {
    originalHeightMetres:Number(boneHeight.toFixed(4)),
    scaleRatio:Number(scaleRatio.toFixed(5)),
    headBone:head.name,
    footBones:[left.name,right.name],
    newFootHeight,
  };
}


/**
 * Translate a grip displacement expressed in real metres into local bone units.
 *
 * Legacy humanoid GLBs use 100x scale inside the Armature. Treating .10 as a
 * local bone offset would move a prop more than TEN metres in world space.
 * Bone keyframes remain untouched. This only calibrates the prop's local grip.
 */
export function localGripOffsetMetres(
  wrist: THREE.Bone, offsetMetres: THREE.Vector3,
): THREE.Vector3 {
  wrist.updateWorldMatrix(true,false);
  const scale=wrist.getWorldScale(new THREE.Vector3());
  for(const v of [scale.x,scale.y,scale.z,...offsetMetres.toArray()])
    if(!Number.isFinite(v)) throw new HumanoidCalibrationError('A transformação do pulso não é finita.');
  if(Math.min(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z))<1e-5)
    throw new HumanoidCalibrationError('Escala inválida no osso do pulso.');
  const local=new THREE.Vector3(offsetMetres.x/scale.x,offsetMetres.y/scale.y,offsetMetres.z/scale.z);
  if(offsetMetres.length()>.25)
    throw new HumanoidCalibrationError('Um deslocamento de pega maior que 25cm exige outra articulação.');
  return local;
}
