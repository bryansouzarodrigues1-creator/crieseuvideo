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
