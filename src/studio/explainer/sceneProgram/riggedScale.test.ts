import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { calibrateRiggedHumanoid, HumanoidCalibrationError } from './riggedScale';

function riggedFixture() {
  const scene=new THREE.Group();
  const model=new THREE.Group();scene.add(model);
  const armature=new THREE.Group();armature.name='CharacterArmature';
  armature.scale.setScalar(100); model.add(armature);
  const hip=new THREE.Bone();hip.name='Hips';hip.position.y=.008;armature.add(hip);
  const head=new THREE.Bone();head.name='Head';head.position.y=.009;hip.add(head);
  const left=new THREE.Bone();left.name='Foot.L';left.position.set(-.002,-.008,0);hip.add(left);
  const right=new THREE.Bone();right.name='Foot.R';right.position.set(.002,-.008,0);hip.add(right);
  // A misleading giant imported mesh should NOT define character height.
  const giant=new THREE.Mesh(new THREE.BoxGeometry(3,64,3),new THREE.MeshBasicMaterial());
  model.add(giant);
  return {scene,model,head,left,right};
}

describe('rigged humanoid scaling, independent from mesh bounds', () => {
  it('uses actual bone span with internal Blender 100x armature',()=>{
    const {model,head,left,right}=riggedFixture();
    const report=calibrateRiggedHumanoid(model,1.88);
    expect(report.originalHeightMetres).toBeCloseTo(1.7);
    expect(report.scaleRatio).toBeGreaterThan(.9);
    expect(report.scaleRatio).toBeLessThan(1.2);
    const h=head.getWorldPosition(new THREE.Vector3()).y;
    const f=left.getWorldPosition(new THREE.Vector3()).y;
    expect(h-f).toBeGreaterThan(1.5);
    expect(Math.abs(right.getWorldPosition(new THREE.Vector3()).y)).toBeLessThan(.05);
    expect(Math.abs(report.newFootHeight)).toBeLessThan(.05);
  });
  it('rejects a rigid box with no animated skeleton rather than pretending it is humanoid',()=>{
    const o=new THREE.Group();
    o.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1)));
    expect(()=>calibrateRiggedHumanoid(o)).toThrow(HumanoidCalibrationError);
  });
  it('rejects impossible rig calibration and dimensions',()=>{
    const {model,head}=riggedFixture();
    expect(()=>calibrateRiggedHumanoid(model,3.4)).toThrow(HumanoidCalibrationError);
    head.position.y=.00001;
    expect(()=>calibrateRiggedHumanoid(model)).toThrow(HumanoidCalibrationError);
  });
});
