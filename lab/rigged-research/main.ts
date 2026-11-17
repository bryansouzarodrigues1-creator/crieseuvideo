/**
 * 8-second honest motion laboratory — TWO genuine Quaternius/CC0 skinned
 * humans, selected clips, named wrist bone attachment, rendered in Three.js.
 * Agent-authored calibration, NOT Gemini generation and NOT a fixed production
 * preset. Test source video: two workers, barred concrete room, tool use.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RiggedClipPlayer } from '../../src/studio/explainer/sceneProgram/riggedClipPlayer';

const W=720,H=1280,DURATION=8;
const canvas=document.querySelector<HTMLCanvasElement>('#view')!;
const status=document.querySelector<HTMLDivElement>('#status')!;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1); renderer.setSize(W,H,false);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color('#8eabbd');
const camera=new THREE.PerspectiveCamera(38,W/H,.04,90);
const ambient=new THREE.HemisphereLight('#eaf7ff','#a28d75',2.1);scene.add(ambient);
const sun=new THREE.DirectionalLight('#ffe7cd',3.1);sun.position.set(-3,8,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;scene.add(sun);
const fill=new THREE.DirectionalLight('#a9deff',.7);fill.position.set(3,5,-3);scene.add(fill);

function mat(color:string,roughness=.82){return new THREE.MeshStandardMaterial({color,roughness});}
function block(w:number,h:number,d:number,color:string,x:number,y:number,z:number,parent:THREE.Object3D=scene){
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));o.position.set(x,y,z);o.receiveShadow=true;o.castShadow=true;parent.add(o);return o;
}
function cyl(radius:number,height:number,color:string,x:number,y:number,z:number,parent:THREE.Object3D=scene){
  const o=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,12),mat(color));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
// Set is detailed enough to establish where the action happens, rather than
// an empty stage. Room, gridded tile floor, warm bricks, window and bars.
block(10,.16,8,'#728d9d',0,-.10,-.3);
for(let x=-4.5;x<=4.5;x+=.5)block(.012,.004,7.8,'#466475',x,-.015,-.3);
for(let z=-4;z<=3.5;z+=.5)block(9.8,.004,.012,'#466475',0,-.013,z);
block(10,5,.18,'#e0bb9d',0,2.5,-3.5);
block(.22,5,8,'#d4ae8f',-5,2.5,-.25);
block(.22,5,8,'#cfa88e',5,2.5,-.25);
for(let row=0;row<13;row++)for(let col=0;col<20;col++){
  const x=-4.82+col*.5+(row%2)*.25, y=.14+row*.34;
  if(x>4.8)continue;
  block(.474,.322,.028,((row*3+col)%7===0)?'#b66b58':(col%3===0?'#b97b61':'#c88968'),x,y,-3.376);
}
for(let x of [-1.92,-1.51,-1.1,-.69,-.28]){
  cyl(.031,2.9,'#384858',x,1.45,-3.14);
}
block(2.1,.07,.10,'#354553',-1.10,2.91,-3.14);
block(2.1,.07,.10,'#354553',-1.10,.2,-3.14);
block(1.7,.12,.58,'#56748c',2.65,.73,-2.7);
block(.12,.74,.12,'#3c5d72',1.98,.36,-2.7);
block(.12,.74,.12,'#3c5d72',3.32,.36,-2.7);
// Ambient industrial details that do not distract from actors.
block(.95,1.15,.10,'#3c5d6d',3.5,2.7,-3.3);
block(.8,.5,.04,'#9ed1df',3.5,2.7,-3.23);
for(let z=0;z<3;z++)block(.14,.7,.22,'#e8bc65',4.5,.42,-1-z*.62);

const loader=new GLTFLoader();
const [workerGltf,casualGltf]=await Promise.all([
  loader.loadAsync('/Worker.glb'), loader.loadAsync('/Casual.glb'),
]);
for(const gltf of [workerGltf,casualGltf]){
  if(!gltf.scene.getObjectByName('Wrist.R') || !gltf.animations.find(c=>c.name==='CharacterArmature|Interact'))
    throw new Error('GLB real incompatível com a prova de personagem e ferramenta');
}
const makeActor=(gltf:typeof workerGltf, groupName:string, x:number)=>{
  const holder=new THREE.Group();holder.name=groupName;scene.add(holder);holder.add(gltf.scene);
  const bodyBox=new THREE.Box3().setFromObject(gltf.scene);
  const size=bodyBox.getSize(new THREE.Vector3());
  if(!size.y||size.y>10)throw new Error('Escala inválida do personagem');
  const height=1.88;
  const ratio=height/size.y;
  gltf.scene.scale.setScalar(ratio);
  gltf.scene.position.y=-bodyBox.min.y*ratio;
  holder.position.x=x;
  const director=new RiggedClipPlayer(gltf.scene,gltf.animations,groupName==='worker'?[
    {start:0,clip:'CharacterArmature|Walk'},
    {start:2.25,clip:'CharacterArmature|Idle_Neutral'},
    {start:2.85,clip:'CharacterArmature|Interact',loop:false},
    {start:4.55,clip:'CharacterArmature|Idle_Neutral'}
  ]:[
    {start:0,clip:'CharacterArmature|Idle_Neutral'},
    {start:5.2,clip:'CharacterArmature|Interact',loop:false},
    {start:6.9,clip:'CharacterArmature|Idle_Neutral'}
  ]);
  return {holder,director,size:height,clipNames:director.clips,ratio};
};
// Build with explicit clips; makeActor initializes only after cues are supplied
// by the lab, not by the JSON generator.


const worker=makeActor(workerGltf,'worker',-1.55);
const casual=makeActor(casualGltf,'casual',1.12);
const pickupAt=3.55, transferAt=5.82;
const gripWorker=new THREE.Vector3(.01,.02,.10);
const workerWalk=(t:number)=>-1.55+1.0*(Math.min(1,Math.max(0,t/2.25))**2*(3-2*Math.min(1,Math.max(0,t/2.25))));
function characters(t:number) {
  worker.holder.position.set(workerWalk(t),0,.08);
  worker.holder.rotation.y=Math.PI/2;
  casual.holder.rotation.y=-Math.PI/2;
  worker.director.at(t);casual.director.at(t);
  scene.updateMatrixWorld(true);
}
characters(pickupAt);
const handA=worker.director.socket('rightHand');
const handB=casual.director.socket('rightHand');
const worldPickup=handA.localToWorld(gripWorker.clone());
const tool=new THREE.Group();tool.name='mechanical-prop';scene.add(tool);
block(.40,.18,.28,'#eda73c',0,0,0,tool);
block(.26,.035,.035,'#364954',0,.12,0,tool);
cyl(.05,.1,'#6d7077',.24,-.01,0,tool);
const propStandY=Math.max(.13,worldPickup.y-.14);
block(.69,.10,.52,'#394f5d',worldPickup.x,propStandY,worldPickup.z);
for(const dx of [-.29,.29])for(const dz of [-.18,.18])
  block(.05,Math.max(.2,propStandY-.07),.055,'#405d6d',worldPickup.x+dx,(propStandY-.08)/2,worldPickup.z+dz);

// The handoff is staged by placing the recipients' wrist at the actual point
// where the first actor reaches. Its feasibility is checked in browser QA.
characters(transferAt);
const gripWorld=handA.localToWorld(gripWorker.clone());
const receiver=handB.getWorldPosition(new THREE.Vector3());
const handDelta=gripWorld.clone().sub(receiver);
if(handDelta.length()>3)throw new Error('Interaction staging impossible: hands too far apart.');
casual.holder.position.add(new THREE.Vector3(handDelta.x,0,handDelta.z));
scene.updateMatrixWorld(true);
const handHeightMismatch=Math.abs(handB.getWorldPosition(new THREE.Vector3()).y-gripWorld.y);
if(handHeightMismatch>.36)throw new Error('Hands too far apart vertically for a believable transfer: '+handHeightMismatch.toFixed(3));
const gripCasual=handB.worldToLocal(gripWorld.clone());
// A tool must be in contact with the acting wrist at attachment time.
const gripAtPickup=gripWorker.clone();
const look=new THREE.Vector3();
const cameraPos=new THREE.Vector3();
function seek(t:number){
  const time=Math.max(0,Math.min(DURATION,t));
  characters(time);
  let owner:'table'|'worker'|'casual';
  if(time<pickupAt) {
    if(tool.parent!==scene)scene.add(tool);
    tool.position.copy(worldPickup);
    owner='table';
  } else if(time<transferAt) {
    if(tool.parent!==handA)handA.add(tool);
    tool.position.copy(gripAtPickup);
    owner='worker';
  } else {
    if(tool.parent!==handB)handB.add(tool);
    tool.position.copy(gripCasual);
    owner='casual';
  }
  tool.rotation.set(0,0,0);tool.scale.setScalar(1);
  scene.updateMatrixWorld(true);
  const movingActor=time<2.5?-1.1:time<5.3?-.4:.18;
  const targetX=movingActor;
  const targetY=time<5.3?1.30:1.42;
  look.set(targetX,targetY,-.45);
  cameraPos.set(targetX+.18,targetY+.78,time<2.5?5.85:5.30);
  camera.position.copy(cameraPos);camera.lookAt(look);
  renderer.render(scene,camera);
  const wrist=owner==='casual'?handB:handA;
  const handError=owner==='table'?0:wrist.getWorldPosition(new THREE.Vector3()).distanceTo(tool.getWorldPosition(new THREE.Vector3()));
  return {
    time,owner,toolHandDistance:handError,
    workerClip:worker.director.activeClip,
    casualClip:casual.director.activeClip,
    riggedSkinnedMeshes:scene.children.reduce((a,o)=>{
      o.traverse(c=>{if((c as THREE.SkinnedMesh).isSkinnedMesh)a++});return a;
    },0),
    textureExternalDownloads:false,
    handoffHeightMismatch:handHeightMismatch,
    workerPosition:worker.holder.position.toArray(),
    casualPosition:casual.holder.position.toArray(),
  };
}
const detail=seek(0);
(window as any).__riggedLab={
  duration:DURATION,
  workerClips:worker.clipNames,
  casualClips:casual.clipNames,
  seek,
  frame:()=>canvas.toDataURL('image/png'),
  info:()=>detail,
};
status.textContent='SceneProgram research: rigged GLB humanoids + true skeleton clips + prop attachment';
document.body.dataset.ready='rigged-qa';
