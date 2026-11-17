/**
 * Investigates the real Quaternius GLB rig, not the procedural Toon actor.
 * Separate cases: rest pose, a single unmodified Three.AnimationMixer clip,
 * and a series of clips through our RiggedClipPlayer.
 * Nothing here calls Gemini or writes to the production asset catalogue.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneWithSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { RiggedClipPlayer } from '../../src/studio/explainer/sceneProgram/riggedClipPlayer';
import { calibrateRiggedHumanoid } from '../../src/studio/explainer/sceneProgram/riggedScale';

const loader=new GLTFLoader();
const original=await loader.loadAsync('/Worker.glb');
const clips=original.animations;
const names=['CharacterArmature|Walk','CharacterArmature|Idle_Neutral','CharacterArmature|Interact'];
const scene=new THREE.Scene();
scene.background=new THREE.Color('#a2cddc');
const camera=new THREE.PerspectiveCamera(40,720/1280,.1,100);
camera.position.set(1.7,1.5,4.0);camera.lookAt(0,1,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x777777,2));
const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(3,6,4);scene.add(sun);
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(720,1280,false);
renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;

const prepare=()=> {
  const root=cloneWithSkeleton(original.scene);
  const holder=new THREE.Group();scene.add(holder);holder.add(root);
  // Avoid the inflated bind-pose bounds found in this exact imported GLB.
  // The real head/foot bones give a consistent human-sized calibration.
  const fit=calibrateRiggedHumanoid(root,1.88);
  holder.position.x=0;
  holder.rotation.y=Math.PI/2;
  scene.updateMatrixWorld(true);
  const bones:THREE.Bone[]=[];
  const skinned:THREE.SkinnedMesh[]=[];
  root.traverse(o=>{if(o instanceof THREE.Bone)bones.push(o); if(o instanceof THREE.SkinnedMesh)skinned.push(o);});
  const wrist=bones.find(x=>x.name.replace(/[._]/g,'').toLowerCase()==='wristr');
  const hip=bones.find(x=>x.name.toLowerCase()==='hips');
  if(!wrist||!hip||!skinned.length)throw Error('Model is missing a true animated wrist, hips or skinned mesh');
  const metrics=()=>{
    scene.updateMatrixWorld(true);
    const p=(o:THREE.Object3D)=>o.getWorldPosition(new THREE.Vector3()).toArray();
    const boneScale=(o:THREE.Object3D)=>o.getWorldScale(new THREE.Vector3()).toArray();
    const parentChain:string[]=[];
    for(let o:THREE.Object3D|null=wrist; o && parentChain.length<14;o=o.parent)parentChain.push(o.name||o.type);
    return {
      wrist:p(wrist),wristLocal:wrist.position.toArray(),
      wristParentWorld:p(wrist.parent!),wristWorldScale:boneScale(wrist),
      hip:p(hip),hipLocal:hip.position.toArray(),
      root:p(root),rootScale:root.scale.toArray(),
      armature:root.getObjectByName('CharacterArmature')?.scale.toArray(),
      skinnedMeshes:skinned.length, parentChain
    };
  };
  return {root,holder,wrist,metrics};
};

const report:{source:string; clips:string[]; cases:unknown[]; warnings:string[]}={
  source:'Quaternius Worker GLB SHA eb29e2adb795972e1f475cd25a000975fe260aa9',
  clips:clips.map(c=>c.name),cases:[],warnings:[]
};
function append(label:string, sample:ReturnType<ReturnType<typeof prepare>['metrics']>, clip?:string,time?:number){
  const y=sample.wrist[1];
  if(!Number.isFinite(y)||y<-.4||y>3.2)report.warnings.push('Implausible wrist '+label+' y='+y);
  report.cases.push({label,clip,time,...sample});
}
for(const clipName of names){
  const clip=THREE.AnimationClip.findByName(clips,clipName)!;
  const test=prepare();
  const mixer=new THREE.AnimationMixer(test.root);
  const action=mixer.clipAction(clip);action.play();
  for(const t of [0,.24,.7,Math.min(1.14,clip.duration-.02)]){
    mixer.setTime(t);
    append('isolated-mixer',test.metrics(),clipName,t);
  }
  test.holder.parent?.remove(test.holder);
}
// Compare the exact flawed 8-second scripted clip transitions with a fresh player.
const actual=prepare();
const player=new RiggedClipPlayer(actual.root,clips,[
  {start:0,clip:'CharacterArmature|Walk'},
  {start:2.25,clip:'CharacterArmature|Idle_Neutral'},
  {start:2.85,clip:'CharacterArmature|Interact',loop:false},
  {start:4.55,clip:'CharacterArmature|Idle_Neutral'}
]);
for(const t of [0,.5,1.5,2.20,2.25,2.7,2.85,3.0,3.55,4.4,4.55,5.82,3.55]){
  const a=player.at(t);
  append('sequential-player',actual.metrics(),a.clip,t);
}
const snapshot=()=>{
  player.at(3.55);
  renderer.render(scene,camera);
  return (document.querySelector('canvas') as HTMLCanvasElement).toDataURL('image/png');
};
(window as any).__rigMatrixAudit={report,snapshot};
document.body.dataset.ready='ok';
console.log('RIG_AUDIT',JSON.stringify({
   warnings:report.warnings,
   summary:report.cases.map((x:any)=>({label:x.label,clip:x.clip,time:x.time,wrist:x.wrist,hip:x.hip}))
 }));
