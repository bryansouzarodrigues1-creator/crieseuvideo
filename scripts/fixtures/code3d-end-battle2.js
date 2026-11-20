/*
Adapted from artemnovitckii/claude-animation-skills, Minecraft template.
MIT License

Copyright (c) 2026 Artem Novitckii

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

CrieSeuVideo adaptation: original dragon/golem story, articulated actors,
physical destruction, End scenes and Portuguese captions. The village asset
is adapted from the MIT reference; no new Gemini response or external asset.
*/

function createScene(THREE,canvas,width,height){
const FILM={"title":"A Batalha do End — Parte 2","duration":120,"scenes":[{"id":0,"title":"A promessa","action":"Os seis golems observam o End. O líder se vira para os aliados, fecha o punho e encara o dragão que circula as torres.","captions":[[0,4,"PARTE 2 — A BATALHA DO END"],[4,10,"Seis golems. Uma promessa."]]},{"id":1,"title":"O primeiro avanço","action":"Dois golems correm. O dragão passa baixo e lança uma rajada. Eles se protegem, recuam e recuperam o equilíbrio.","captions":[[0,4,"O avanço começou."],[4,10,"O dragão respondeu primeiro."]]},{"id":2,"title":"O golpe e a cura","action":"O líder prepara um golpe, planta os pés e acerta o dragão. O dragão recua, mas um feixe do cristal restaura sua energia.","captions":[[0,4,"Um golpe certeiro..."],[4,10,"...mas o cristal restaurava sua força."]]},{"id":3,"title":"A mudança de estratégia","action":"O líder acompanha o feixe com o olhar e aponta a torre. Os aliados se dividem: dois distraem o dragão e outro segue para a escadaria.","captions":[[0,4,"O líder encontrou a fraqueza."],[4,10,"Eles precisavam agir juntos."]]},{"id":4,"title":"A distração","action":"Os combatentes atraem o dragão para a frente da arena. Ao fundo, o aliado sobe degraus, apoiando um pé de cada vez.","captions":[[0,4,"Dois ficariam com o dragão."],[4,10,"Um aliado subiria até o cristal."]]},{"id":5,"title":"O último cristal","action":"O golem alcança a plataforma, recua o braço e quebra o cristal. Fragmentos violetas se espalham e o feixe de cura desaparece.","captions":[[0,4,"Só faltava alcançar o topo."],[4,10,"O último cristal se despedaçou."]]},{"id":6,"title":"A fúria","action":"Sem o cristal, o dragão mergulha e lança outra rajada. Os golems usam a torre como cobertura e saem do alcance do ataque.","captions":[[0,4,"A fonte de cura desapareceu."],[4,10,"A fúria do dragão aumentou."]]},{"id":7,"title":"A aproximação","action":"O dragão baixa até a arena. Dois golems se aproximam de lados diferentes, mantêm apoio no chão e o atingem em conjunto.","captions":[[0,4,"Os golems fecharam as fileiras."],[4,10,"Cada um protegia o outro."]]},{"id":8,"title":"O aliado atingido","action":"Uma virada da cauda atinge um dos aliados. Ele perde o equilíbrio, cai de joelhos e apoia a mão no chão. O líder corre até ele.","captions":[[0,4,"Então, a cauda atingiu um aliado."],[4,10,"O líder correu para ajudá-lo."]]},{"id":9,"title":"A mão estendida","action":"O líder abaixa o corpo e oferece a mão. O aliado segura e se ergue com apoio dos pés. Os dois voltam a encarar o dragão.","captions":[[0,4,"Uma mão se estendeu."],[4,10,"O exército voltou a se levantar."]]},{"id":10,"title":"O golpe final","action":"O líder sobe na pequena plataforma enquanto os aliados flanqueiam o dragão. Ele firma os pés, torce o tronco e acerta um último golpe; o dragão recua.","captions":[[0,4,"Era a chance que faltava."],[4,10,"Todo o peso em um único golpe."]]},{"id":11,"title":"O retorno","action":"O dragão sobe e se desfaz em partículas violetas. Um portal se abre, os seis golems se reúnem e seguem para reconstruir seu lar.","captions":[[0,5,"O dragão perdeu suas forças."],[5,10,"Eles voltariam para reconstruir."]]}]};
const SCENE=typeof BATTLE_SCENE==='number'?BATTLE_SCENE:0;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setSize(width,height,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x141024);scene.fog=new THREE.Fog(0x191426,70,210);
const camera=new THREE.PerspectiveCamera(45,width/height,.1,450);scene.add(camera);
const hemi=new THREE.HemisphereLight(0xd9ddeb,0x706a7e,1.85);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xf4ecf9,1.55);sun.position.set(-19,35,26);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:1,far:110});sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;scene.add(sun);
const fill=new THREE.DirectionalLight(0x9c9ab9,.7);fill.position.set(15,8,-20);scene.add(fill);
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const smooth=(a,b,t)=>{const q=clamp((t-a)/(b-a),0,1);return q*q*(3-2*q);};
const V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),up3=V3(0,1,0),down3=V3(0,-1,0);
const G=(p=scene)=>{const g=new THREE.Group();p.add(g);return g;};
const LM=(c,o={})=>new THREE.MeshLambertMaterial({color:c,...o}),BM=(c,o={})=>new THREE.MeshBasicMaterial({color:c,...o});
const boxGeo=new THREE.BoxGeometry(1,1,1);
const cub=(p,m,x,y,z,sx,sy,sz)=>{const q=new THREE.Mesh(boxGeo,m);q.position.set(x,y,z);q.scale.set(sx,sy,sz);q.castShadow=true;q.receiveShadow=true;p.add(q);return q;};
let seed=23;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const hashS=(i,j=0)=>{let h=Math.imul(i+31,374761393)^Math.imul(j+71,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
const C=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const pick=a=>a[Math.floor(rnd()*a.length)];
const mul=(c,k)=>c.map(v=>clamp(Math.round(v*k),0,255));
function makeTex(draw){const cv=document.createElement('canvas');cv.width=cv.height=16;const ctx=cv.getContext('2d'),im=ctx.createImageData(16,16);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const c=draw(x,y),k=(y*16+x)*4;im.data.set([c[0],c[1],c[2],c[3]??255],k);}ctx.putImageData(im,0,0);const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;tx.magFilter=THREE.NearestFilter;tx.minFilter=THREE.LinearMipmapLinearFilter;return tx;}
const angle=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;

const ironTex=makeTex(()=>{const c=pick(['#e0dfd5','#d7d8cd','#ecebe2','#cfd1c4'].map(C));return rnd()<.025?mul(c,.72):c;});
const ironMat=new THREE.MeshLambertMaterial({map:ironTex}),jointMat=LM(0x7d8178),vineMat=LM(0x477343),vineLight=LM(0x6c874a),eyeRed=BM(0x952c2e),darkFace=LM(0x41443c);
function makeGolem(index){
 const root=G(),parts={};
 cub(root,ironMat,0,1.33,0,1.05,.5,.66);
 cub(root,ironMat,0,1.99,0,1.55,1.05,.84);
 cub(root,jointMat,0,2.3,.425,1.26,.055,.025);
 cub(root,jointMat,.32,1.72,.426,.035,.44,.025);
 const head=G(root);head.position.y=2.65;
 cub(head,ironMat,0,.08,0,.84,.81,.79);
 cub(head,ironMat,0,-.09,.49,.23,.43,.27);
 cub(head,darkFace,0,.31,.401,.67,.08,.025);
 for(const side of [-1,1]){cub(head,darkFace,side*.205,.17,.406,.21,.13,.025);cub(head,eyeRed,side*.205,.16,.424,.11,.075,.023);}
 const vx=index%2?-.42:.47;
 cub(root,vineMat,vx,2.0,.436,.085,.94,.025);
 for(let k=0;k<5;k++)cub(root,k%2?vineMat:vineLight,vx+(k%2?.09:-.08),1.65+k*.17,.45,.21,.12,.035);
 cub(root,LM(0xc9b95d),vx+.08,2.25,.47,.085,.085,.03);
 const arms=[];
 for(const side of [-1,1]){
  const pivot=G(root);pivot.position.set(side*.98,2.35,0);
  cub(pivot,jointMat,0,-.04,0,.44,.27,.53);
  cub(pivot,ironMat,0,-.55,0,.49,1.10,.54);
  const elbow=G(pivot);elbow.position.y=-1.10;cub(elbow,jointMat,0,0,0,.47,.17,.51);
  cub(elbow,ironMat,0,-.49,.025,.53,.98,.59);cub(elbow,ironMat,0,-1.03,.04,.56,.21,.63);
  if(side<0){cub(pivot,vineMat,.25,-.58,.16,.025,.72,.12);cub(elbow,vineMat,.265,-.32,.13,.024,.42,.11);}
  arms.push({pivot,elbow,side,L1:1.1,L2:1.06});
 }
 const legs=[];
 for(const side of [-1,1]){
  const hip=G(root);hip.position.set(side*.36,1.32,0);
  cub(hip,ironMat,0,-.315,0,.51,.63,.57);
  const knee=G(hip);knee.position.y=-.63;cub(knee,jointMat,0,0,0,.48,.16,.53);
  cub(knee,ironMat,0,-.315,0,.48,.63,.55);
  const foot=G(knee);foot.position.y=-.63;cub(foot,ironMat,0,-.01,.1,.54,.24,.83);
  legs.push({hip,knee,foot,side});
 }
 return {root,head,arms,legs,index};
}
const golems=Array.from({length:6},(_,i)=>makeGolem(i));

const dragonSkin=LM(0x181520),dragonBone=LM(0x4b414f),dragonWing=LM(0x241d32,{side:THREE.DoubleSide}),purpleEye=BM(0xe771ff);
function membrane(parent,vertices){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,dragonWing);m.castShadow=true;parent.add(m);return m;}
function linkBlock(parent,a,b,thickness,material){const delta=b.clone().sub(a),o=new THREE.Mesh(new THREE.BoxGeometry(thickness,delta.length(),thickness),material);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(up3,delta.normalize());o.castShadow=true;parent.add(o);return o;}
function makeDragon(){
 const root=G();cub(root,dragonSkin,0,0,-.4,1.9,1.25,4.8);cub(root,dragonBone,0,.69,-.4,.6,.14,4.5);
 const neck=G(root);neck.position.set(0,.05,2.0);cub(neck,dragonSkin,0,0,1,.9,.75,2.2);
 const head=G(neck);head.position.z=2.15;cub(head,dragonSkin,0,.05,.65,1.45,.86,1.9);
 const jaw=G(head);jaw.position.set(0,-.3,-.05);cub(jaw,dragonSkin,0,-.06,.9,1.42,.25,1.8);
 for(const side of [-1,1]){cub(head,purpleEye,side*.737,.17,.54,.035,.15,.52);cub(head,dragonBone,side*.48,.65,-.1,.25,.65,.3);cub(head,dragonBone,side*.4,-.02,1.63,.25,.12,.05);}
 const mouth=G(head);mouth.position.set(0,-.2,1.73);
 const wings=[];
 for(const side of [-1,1]){
  const joint=G(root);joint.position.set(side*.8,.45,.7);
  linkBlock(joint,V3(),V3(side*3.25,0,-.5),.19,dragonBone);
  membrane(joint,[0,0,0,side*3.25,0,-.5,side*.65,0,-3.1,side*3.25,0,-.5,side*3.0,0,-2.9,side*.65,0,-3.1]);
  const outer=G(joint);outer.position.set(side*3.25,0,-.5);
  linkBlock(outer,V3(),V3(side*3.7,0,-.8),.13,dragonBone);
  membrane(outer,[0,0,0,side*3.7,0,-.8,side*2.5,0,-2.1,0,0,0,side*2.5,0,-2.1,side*1.4,0,-2.9,0,0,0,side*1.4,0,-2.9,side*-.3,0,-2.4]);
  linkBlock(outer,V3(),V3(side*2.5,0,-2.1),.065,dragonBone);linkBlock(outer,V3(),V3(side*1.4,0,-2.9),.055,dragonBone);
  wings.push({joint,outer,side});
  for(const zz of [-1.4,1.35]){const leg=G(root);leg.position.set(side*.85,-.4,zz);cub(leg,dragonSkin,0,-.55,0,.48,1.1,.57);cub(leg,dragonBone,0,-1.12,.25,.58,.24,.95);}
 }
 const tail=[];let parent=root;
 for(let i=0;i<7;i++){const joint=G(parent);joint.position.set(0,0,i===0?-2.7:-1.05);const size=.72-i*.07;cub(joint,dragonSkin,0,0,-.48,size,size,1.25);cub(joint,dragonBone,0,size*.65,-.3,.13,.3,.3);tail.push(joint);parent=joint;}
 return {root,neck,head,jaw,mouth,wings,tail};
}
const dragon=makeDragon();
function flapDragon(t,power=1){for(const w of dragon.wings){w.joint.rotation.z=w.side*(.15+Math.sin(t*3.9)*.55*power);w.outer.rotation.z=w.side*(.05+Math.sin(t*3.9-.65)*.24*power);}dragon.tail.forEach((j,i)=>{j.rotation.y=Math.sin(t*2.5-i*.65)*.16;j.rotation.x=Math.sin(t*1.6-i*.6)*.055;});dragon.neck.rotation.set(.02*Math.sin(t*2),.04*Math.sin(t*1.3),0);dragon.jaw.rotation.x=.06;}
function aimDragon(position,target,t,bank=0){dragon.root.position.copy(position);const d=target.clone().sub(position);dragon.root.rotation.set(-Math.atan2(d.y,Math.hypot(d.x,d.z)),Math.atan2(d.x,d.z),bank);flapDragon(t);dragon.root.updateMatrixWorld(true);}


// Separate the torso from planted feet, and make the fist endpoint explicit.
for(const g of golems){
 const body=G(g.root);body.position.y=1.4;
 for(const o of [...g.root.children])if(o!==body&&!g.legs.some(l=>l.hip===o))body.attach(o);
 g.body=body;g.feet=[];
 for(const a of g.arms){a.L2=1.135;a.tip=G(a.elbow);a.tip.position.set(0,-a.L2,.04);}
 g.phase=g.index*.173;
}
cub(golems[0].body,BM(0xc24a42),.51,.8,.465,.11,.11,.035);
for(const m of [dragonSkin,dragonBone,dragonWing])m.transparent=true;

// Low crystal tower with real steps, a low fighting ledge and distant pillars.
const rockTex=makeTex(()=>pick(['#d1d2a8','#d9d9b4','#c7c99e','#dfe0bd'].map(C)));
const darkTex=makeTex(()=>pick(['#171322','#211b30','#251f34','#1d1829'].map(C)));
const rock=new THREE.MeshLambertMaterial({map:rockTex}),obsidian=new THREE.MeshLambertMaterial({map:darkTex});
function inst(material,list){const mesh=new THREE.InstancedMesh(boxGeo,material,list.length),dummy=new THREE.Object3D();list.forEach((p,i)=>{dummy.position.set(p[0],p[1],p[2]);dummy.scale.set(p[3]??1,p[4]??1,p[5]??1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;}
const ground=[];for(let x=-26;x<=26;x++)for(let z=-26;z<=24;z++)if(Math.hypot(x/1.1,z)<26){ground.push([x,-.5,z]);if(Math.hypot(x/1.1,z)>24)for(let y=-1;y>=-3;y--)ground.push([x,y-.5,z]);}inst(rock,ground);
const columns=[];for(const [x,z,h] of [[-18,-16,23],[-8,-22,26],[7,-22,25],[18,-13,21],[-23,1,18],[23,2,20]])for(let y=0;y<h;y++)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)columns.push([x+dx,y+.5,z+dz]);inst(obsidian,columns);
const stairStart=V3(-11.5,0,6.5),stairEnd=V3(-6.5,0,-.8),stairDir=stairEnd.clone().sub(stairStart),stairLength=stairDir.length();stairDir.normalize();const stairRight=V3(-stairDir.z,0,stairDir.x);
for(let i=0;i<12;i++){const p=stairStart.clone().addScaledVector(stairDir,(i+.5)*stairLength/12),b=cub(scene,rock,p.x,(i+1)*.25,p.z,3.6,(i+1)*.5,stairLength/12+.02);b.rotation.y=Math.atan2(stairDir.x,stairDir.z);}
cub(scene,obsidian,-6.5,2.9,-3.5,3.1,5.8,3.1);cub(scene,rock,-6.5,5.85,-3.5,5,.3,7.6);
for(let i=0;i<4;i++)cub(scene,rock,7.1,-.01+(i+1)*.175,4.6-i*.85,3.2,(i+1)*.35,.86);
cub(scene,rock,7.1,.7,1.3,3.7,1.4,2.4);
const cover=cub(scene,obsidian,-3,2,4,2,4,2);
function floorAt(x,z){
 let h=0;if(x>=-9&&x<=-4&&z>=-7.3&&z<=.3)h=6;
 const delta=V3(x-stairStart.x,0,z-stairStart.z),along=delta.dot(stairDir),side=Math.abs(delta.dot(stairRight));
 if(along>=0&&along<=stairLength&&side<1.8)h=Math.max(h,Math.ceil(along/stairLength*12)*.5);
 if(x>5.25&&x<8.95&&z>.1&&z<2.5)h=Math.max(h,1.4);
 if(x>5.5&&x<8.7&&z>=2.5&&z<5.1)h=Math.max(h,clamp(Math.ceil((5.03-z)/.85),1,4)*.35);
 return h;
}
function supportFloor(index,t,x,z){
 if(index===3&&t>=38&&t<=69)return floorAt(x,z);
 if(index===0&&t>=98&&t<=115){if(x>5.25&&x<8.95&&z>.1&&z<2.5)return 1.4;if(x>5.5&&x<8.7&&z>=2.5&&z<5.1)return clamp(Math.ceil((5.03-z)/.85),1,4)*.35;}
 return 0;
}
const crystal=G();crystal.position.set(-6.5,8.0,-3.5);
const crystalCore=cub(crystal,BM(0xf39fe8),0,0,0,1.15,1.15,1.15);crystalCore.rotation.set(.75,.3,.75);
const crystalShell=cub(crystal,BM(0xd867d1,{transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false}),0,0,0,1.65,1.65,1.65);crystalShell.rotation.set(.75,.3,.75);crystalShell.castShadow=false;
const stars=[];for(let i=0;i<800;i++){const a=hashS(i,21)*Math.PI*2,e=.1+hashS(i,22)*1.3;stars.push(Math.sin(a)*Math.cos(e)*160,Math.sin(e)*160,Math.cos(a)*Math.cos(e)*160);}const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xbfb8d3,size:.32,fog:false})));

// Smooth paths carry their own arclength: gait is based on travel, not a clock.
function makeTrack(keys){
 const raw=t=>{
  let j=0;while(j<keys.length-2&&t>keys[j+1][0])j++;
  const a=keys[j],b=keys[j+1],p=keys[Math.max(0,j-1)],q=keys[Math.min(keys.length-1,j+2)],dt=b[0]-a[0],u=clamp((t-a[0])/dt,0,1);
  if(a[1]===b[1]&&a[2]===b[2])return V3(a[1],0,a[2]);
  const h0=2*u*u*u-3*u*u+1,h1=u*u*u-2*u*u+u,h2=-2*u*u*u+3*u*u,h3=u*u*u-u*u;
  const tangent=(dim,left)=>{if(left&&p[dim]===a[dim])return 0;if(!left&&q[dim]===b[dim])return 0;return left?(b[dim]-p[dim])/(b[0]-p[0]):(q[dim]-a[dim])/(q[0]-a[0]);};
  return V3(h0*a[1]+h1*dt*tangent(1,true)+h2*b[1]+h3*dt*tangent(1,false),0,h0*a[2]+h1*dt*tangent(2,true)+h2*b[2]+h3*dt*tangent(2,false));
 };
 const samples=[],distances=[];let distance=0,prev;
 for(let i=0;i<=7200;i++){const p=raw(i/60);if(prev)distance+=p.distanceTo(prev);samples.push(p);distances.push(distance);prev=p;}
 const at=t=>{const f=clamp(t*60,0,7199.999),i=Math.floor(f),u=f-i,p=samples[i].clone().lerp(samples[i+1],u),v=samples[Math.min(7200,i+1)].clone().sub(samples[Math.max(0,i-1)]).multiplyScalar(30);return {p,d:lerp(distances[i],distances[i+1],u),v,speed:v.length()};};
 const atD=d=>{d=clamp(d,0,distance);let lo=0,hi=7200;while(hi-lo>1){const mid=(lo+hi)>>1;if(distances[mid]<d)lo=mid;else hi=mid;}const f=(d-distances[lo])/Math.max(.000001,distances[hi]-distances[lo]);const p=samples[lo].clone().lerp(samples[hi],f),dir=samples[Math.min(7200,hi+1)].clone().sub(samples[Math.max(0,lo-1)]);if(dir.lengthSq()<.000001)dir.set(0,0,-1);return {p,dir:dir.normalize()};};
 return {at,atD};
}
const dragonKeys=[[0,-8,10,-14],[5,4,9,-15],[10,10,8,-7],[13,4,5,-1],[16,-6,6,-1],[20,0,3.1,-6.4],[24,0,3.1,-6.4],[26,0,4.4,-8],[30,7,8,-12],[35,9,8,-6],[40,5,7,-4],[45,0,5,0],[50,-6,8,-10],[55,-9,10,-13],[60,-5,9,-10],[64,-1,4.2,-4.5],[67,5,5,-1],[70,0,3.8,-6.5],[76,0,3.8,-6.5],[80,0,2.6,-6.5],[83,0,2.6,-6.5],[86,6,6,-10],[90,8,7,-12],[95,4,7,-11],[100,2,7,-10],[104,6,4.1,-6.2],[108,6,4.1,-6.2],[110,6,6.3,-8.2],[113,6,10,-10],[120,6,12,-11]];
function dragonPoint(t){
 let i=0;while(i<dragonKeys.length-2&&t>dragonKeys[i+1][0])i++;
 const a=dragonKeys[i],b=dragonKeys[i+1],p=dragonKeys[Math.max(0,i-1)],q=dragonKeys[Math.min(dragonKeys.length-1,i+2)],dt=b[0]-a[0],u=clamp((t-a[0])/dt,0,1);
 const coord=k=>{if(a[k]===b[k])return a[k];const m0=p[k]===a[k]?0:(b[k]-p[k])/(b[0]-p[0]),m1=q[k]===b[k]?0:(q[k]-a[k])/(q[0]-a[0]);return (2*u*u*u-3*u*u+1)*a[k]+(u*u*u-2*u*u+u)*dt*m0+(-2*u*u*u+3*u*u)*b[k]+(u*u*u-u*u)*dt*m1;};
 return V3(coord(1),coord(2),coord(3));
}
const basis=new THREE.Matrix4(),zero=V3(),rollAxis=V3(0,0,1);
function poseDragon(t){
 const p=dragonPoint(t),next=dragonPoint(Math.min(119.99,t+.05)),prev=dragonPoint(Math.max(0,t-.05));let dir=next.clone().sub(prev);if(dir.lengthSq()<.00001)dir.set(0,0,1);
 const groundWeight=Math.max(smooth(18.5,19.8,t)*(1-smooth(24.4,25.6,t)),smooth(68.5,70,t)*(1-smooth(84.2,85.4,t)),smooth(102.5,104,t)*(1-smooth(109.0,110.4,t)));
 basis.lookAt(zero,dir.clone().normalize().negate(),up3);dragon.root.quaternion.setFromRotationMatrix(basis);
 const bank=(1-groundWeight)*Math.sin(t*.63)*.16;dragon.root.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(rollAxis,bank));
 let groundYaw=0;if(t>=80&&t<=85.4)groundYaw=t<=82.4?lerp(0,-Math.PI/2,smooth(80,82.4,t)):lerp(-Math.PI/2,-Math.PI,smooth(82.4,84.5,t));
 dragon.root.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(up3,groundYaw),groundWeight);
 const firstRecoil=smooth(23.4,23.7,t)*(1-smooth(24.3,25.4,t));p.z-=firstRecoil*.55;p.y+=firstRecoil*.25;
 const finalRecoil=smooth(106.5,107.0,t);if(t<110){p.z-=finalRecoil*.8;p.y+=finalRecoil*.35;}
 dragon.root.position.copy(p);dragon.root.visible=t<113.8;
 const flap=1-.73*groundWeight,frequencyPhase=t*3.5+.14*Math.sin(t*.6);
 for(const w of dragon.wings){w.joint.rotation.z=w.side*(.12+Math.sin(frequencyPhase)*.52*flap);w.outer.rotation.z=w.side*(.04+Math.sin(frequencyPhase-.65)*.23*flap);}
 dragon.tail.forEach((j,i)=>{j.rotation.y=Math.sin(t*2.1-i*.58)*.115;j.rotation.x=Math.sin(t*1.5-i*.6)*.035;});
 dragon.neck.rotation.set(.035*Math.sin(t*1.4),.04*Math.sin(t*.9),0);dragon.head.rotation.set(.015*Math.sin(t*2.2),0,0);
 dragon.jaw.rotation.x=.04+.34*(smooth(12.6,13.1,t)*(1-smooth(15,15.4,t))+smooth(43.2,43.8,t)*(1-smooth(46,46.5,t))+smooth(62.6,63.1,t)*(1-smooth(66,66.5,t)));
 for(const m of [dragonSkin,dragonBone,dragonWing])m.opacity=1-smooth(111,113.8,t);
 dragon.root.updateMatrixWorld(true);
}
poseDragon(23.4);const hitFirst=dragon.mouth.getWorldPosition(V3());poseDragon(106.5);const hitFinal=dragon.mouth.getWorldPosition(V3());poseDragon(82.4);const tailHit=dragon.tail[4].getWorldPosition(V3());
const hurt=V3(tailHit.x-.5,0,tailHit.z+.55),helper=V3(hurt.x+1.75,0,hurt.z+.15);
const actorKeys=[
 [[0,0,7],[10,0,5.5],[15,0,-.3],[17,1,1],[20,1,.1],[24,1,.1],[30,2.5,4],[40,1,3],[45,0,-.5],[50,4,1.2],[55,4,2],[60,2,3],[65,-.8,1.5],[70,1,2],[78,1,2],[84,1,2],[90,helper.x,helper.z],[96,helper.x,helper.z],[99,7.1,6],[103,7.1,1.2],[108,7.1,1.2],[112,7.1,2.7],[116,0,6],[120,0,9]],
 [[0,-3,8],[10,-3,6],[12,-6.5,5],[15,-4.6,1.6],[20,-2,.1],[28,-2,1],[35,-1.8,1.5],[40,-1,2],[46,6,-1],[50,10,-1],[55,10,6.2],[60,3,6.2],[68,-1.85,-3.8],[77,-1.85,-3.8],[84,-3,-2.8],[94,-3,0],[102,4.15,-3.2],[108,4.15,-3.2],[112,1,5.5],[116,-2.7,7],[120,-2.7,8]],
 [[0,3,8],[10,3,6],[16,3.5,1],[25,3.5,-1],[35,3.5,0],[45,3.5,0],[55,3.5,-2],[65,3.5,-2],[70,1.85,-3.8],[77,1.85,-3.8],[86,4,-1],[98,4,1],[104,7.85,-3.2],[108,7.85,-3.2],[112,10.5,-.5],[116,10.5,6],[120,2.7,8]],
 [[0,-5.5,10],[20,-5.5,7],[30,-8,8],[40,-11.5,6.5],[46,-9.4,3],[51,-7.3,.1],[54,-5.5,-1.2],[58,-5.5,-1.2],[61,-7.7,.8],[65,-10,4.6],[70,-11.5,8.5],[84,-6,8.5],[98,-6,6.5],[110,-5.4,7],[120,-5.4,9]],
 [[0,0,10.5],[20,0,7],[35,0,5.5],[50,2,6],[65,1,5],[80,2,3.5],[88,0,5],[100,0,6],[110,-1,7],[120,0,11.5]],
 [[0,5.5,10],[20,5.5,6],[35,3,3],[42,3,-2.2],[50,7,-2.5],[65,5,-3],[75,6,-7],[80,tailHit.x-.8,tailHit.z-.8],[82.4,tailHit.x-.5,tailHit.z+.1],[84.3,hurt.x,hurt.z],[96,hurt.x,hurt.z],[101,2,7],[110,4,6],[120,5.4,9]]
];
const tracks=actorKeys.map(makeTrack);

// Two-bone solvers use the actual parent coordinate space and bounded reach.
function twoBone(joint,elbow,targetParent,L1,L2,pole){
 const s=joint.position.clone(),delta=targetParent.clone().sub(s),d=clamp(delta.length(),.001,L1+L2-.0001),dir=delta.normalize();
 let side=pole.clone().addScaledVector(dir,-pole.dot(dir));if(side.lengthSq()<.000001)side=V3(1,0,0).cross(dir);if(side.lengthSq()<.000001)side=V3(0,0,1).cross(dir);side.normalize();
 const along=(L1*L1+d*d-L2*L2)/(2*d),height=Math.sqrt(Math.max(0,L1*L1-along*along)),e=s.clone().addScaledVector(dir,along).addScaledVector(side,height),tip=s.clone().addScaledVector(dir,d);
 joint.quaternion.setFromUnitVectors(down3,e.clone().sub(s).normalize());elbow.quaternion.setFromUnitVectors(down3,tip.sub(e).applyQuaternion(joint.quaternion.clone().invert()).normalize());
}
function reach(g,arm,targetWorld){arm.pivot.parent.updateWorldMatrix(true,false);const target=arm.pivot.parent.worldToLocal(targetWorld.clone());twoBone(arm.pivot,arm.elbow,target,arm.L1,arm.L2,V3(arm.side*.8,-1,.2));}
function punchAmount(t,hit){return smooth(hit-.2,hit,t)*(1-smooth(hit+.12,hit+.85,t));}
function punchWind(t,hit){return smooth(hit-.85,hit-.35,t)*(1-smooth(hit-.2,hit,t));}
function controls(i,t){
 const c={crouch:0,lean:0,twist:0,guard:0,raise:0,shift:0,look:dragon.root.position.clone(),face:null};
 if(i===0){for(const hit of [23.4,106.5]){const w=punchWind(t,hit),p=punchAmount(t,hit);c.crouch+=w*.09;c.twist+=w*.28-p*.22;c.lean+=p*.12;c.shift+=-w*.12+p*.08;}if(t>30&&t<40){c.raise=smooth(31.2,32,t)*(1-smooth(37.3,38,t));c.look=V3(-6.5,8,-3.5);}if(t>89&&t<97){c.face=Math.atan2(hurt.x-helper.x,hurt.z-helper.z);c.look=V3(hurt.x,2,hurt.z);c.crouch=.22*(1-smooth(94,96,t));c.lean=.14;}}
 if(i===3&&t>41&&t<60){c.look=crystal.position.clone();c.face=Math.PI;const w=punchWind(t,56.8),p=punchAmount(t,56.8);c.twist=w*.23-p*.18;c.lean=p*.1;c.crouch=w*.07+.18*smooth(56.8,57.0,t)*(1-smooth(58,59,t));}
 if((i===0||i===1)&&t>13&&t<18)c.guard=smooth(13,13.4,t)*(1-smooth(17,18,t));
 if(t>63&&t<67)c.guard=smooth(63,63.5,t)*(1-smooth(66.4,67,t));
 if((i===1||i===2)&&t>70&&t<79){c.crouch=.1;c.lean=.09;c.guard=.17;}
 if(i===5){c.crouch=.65*smooth(82.4,83.4,t)*(1-smooth(93,96,t));c.lean=.22*smooth(82.4,83.4,t)*(1-smooth(93,96,t));if(t>84&&t<97){c.face=Math.atan2(helper.x-hurt.x,helper.z-hurt.z);c.look=V3(helper.x,2.4,helper.z);}}
 if(i>0&&i<5&&t>84&&t<97)c.look=V3(hurt.x,2,hurt.z);
 if(t>115)c.look=V3(0,2.5,15);
 return c;
}
function footTargets(g,tr,t,yaw,walk){
 const info=[];
 for(const leg of g.legs){
  const phase=(tr.d/1.3+g.phase+(leg.side<0?.5:0)),p=((phase%1)+1)%1,d0=tr.d-p*1.3;
  let footD,lift=0,swingFloor=null;if(p<.6)footD=d0+.3*1.3;else{const u=(p-.6)/.4;footD=lerp(d0+.3*1.3,d0+1.3*1.3,smooth(0,1,u));lift=.26*Math.sin(u*Math.PI);const a=tracks[g.index].atD(d0+.3*1.3).p,b=tracks[g.index].atD(d0+1.3*1.3).p,fa=supportFloor(g.index,t,a.x,a.z),fb=supportFloor(g.index,t,b.x,b.z);swingFloor=lerp(fa,fb,fb>fa?smooth(0,.45,u):smooth(.55,1,u));}
  const s=tracks[g.index].atD(footD),right=V3(s.dir.z,0,-s.dir.x),planted=s.p.clone().addScaledVector(right,leg.side*.36);
  const idle=tr.p.clone().add(V3(Math.cos(yaw)*leg.side*.36,0,-Math.sin(yaw)*leg.side*.36));
  const target=idle.lerp(planted,walk);const floor=swingFloor===null?supportFloor(g.index,t,target.x,target.z):lerp(supportFloor(g.index,t,idle.x,idle.z),swingFloor,walk);target.y=floor+.13+lift*walk;
  info.push({leg,target,floor,phase:p,yaw:Math.atan2(s.dir.x,s.dir.z)});
 }
 return info;
}
function poseActor(g,t){
 const tr=tracks[g.index].at(t),c=controls(g.index,t),walk=smooth(.08,.65,tr.speed),face=c.face??Math.atan2(c.look.x-tr.p.x,c.look.z-tr.p.z),heading=tr.speed>.02?Math.atan2(tr.v.x,tr.v.z):face,yaw=angle(face,heading,walk);
 const feet=footTargets(g,tr,t,yaw,walk),heightDifference=Math.abs(feet[0].floor-feet[1].floor),stairCrouch=Math.min(.27,heightDifference*.55),bob=.025*(1-Math.cos(tr.d/1.3*Math.PI*4))*walk;
 const floor=(feet[0].floor+feet[1].floor)*.5;
 g.root.position.set(tr.p.x+Math.sin(yaw)*c.shift,floor+bob-c.crouch-stairCrouch,tr.p.z+Math.cos(yaw)*c.shift);g.root.rotation.set(0,yaw,0);g.root.visible=true;
 g.body.rotation.set(.022*Math.sin(t*1.65+g.index)+walk*.045+c.lean,c.twist,.012*Math.sin(t*1.2+g.index)*(.4+walk));
 g.head.rotation.set(c.crouch*.15,clamp(angle(0,Math.atan2(c.look.x-tr.p.x,c.look.z-tr.p.z)-yaw-c.twist,1),-.7,.7),.018*Math.sin(t*.9+g.index));
 for(const arm of g.arms){arm.pivot.rotation.set(.23*Math.sin(tr.d/1.3*Math.PI*2+arm.side*Math.PI+g.phase)*walk-2.30*c.guard-1.55*c.raise,0,arm.side*(.055+.08*c.guard));arm.elbow.rotation.set(-.1-.32*c.guard-.3*c.raise,0,0);}
 g.root.updateMatrixWorld(true);
 for(const f of feet){const local=g.root.worldToLocal(f.target.clone());twoBone(f.leg.hip,f.leg.knee,local,.63,.63,V3(0,0,1));f.leg.foot.quaternion.copy(f.leg.hip.quaternion.clone().multiply(f.leg.knee.quaternion).invert()).multiply(new THREE.Quaternion().setFromAxisAngle(up3,angle(yaw,f.yaw,walk)-yaw));}
 g.feet=feet;g.intent=c;
}
function strike(g,t,hit,target,armIndex=1){
 if(t<hit-.9||t>hit+1)return;
 g.root.updateMatrixWorld(true);const arm=g.arms[armIndex],guard=g.root.localToWorld(V3(arm.side*.75,2.15,.48)),draw=g.root.localToWorld(V3(arm.side*.8,2.25,-.35));
 const wind=punchWind(t,hit),p=punchAmount(t,hit);const point=guard.clone().lerp(draw,wind).lerp(target,p);point.y+=.16*Math.sin(p*Math.PI);reach(g,arm,point);
}
function contactAt(time,which='mouth'){poseDragon(time);return which==='mouth'?dragon.mouth.getWorldPosition(V3()):dragon.root.localToWorld(which.clone());}
const grappleA=contactAt(74,V3(-.85,-1.0,1.35)),grappleB=contactAt(74,V3(.85,-1.0,1.35));
function stageContacts(t){
 strike(golems[0],t,23.4,hitFirst);strike(golems[3],t,56.8,V3(-6.5,8,-2.72));strike(golems[0],t,106.5,hitFinal);
 if(t>70&&t<79){
  const blend=smooth(70,71,t)*(1-smooth(78,79,t));
  for(const [g,point,arm] of [[golems[1],grappleA,0],[golems[2],grappleB,1]]){const idle=g.root.localToWorld(V3(arm===0?-.8:.8,2.1,.5));reach(g,g.arms[arm],idle.lerp(point,blend));}
 }
 if(t>84&&t<91.8){const g=golems[5],p=V3(hurt.x+.45,.14,hurt.z+.65);reach(g,g.arms[1],p);}
 if(t>90.5&&t<97){
  const grip=V3((helper.x+hurt.x)*.5,lerp(1.7,2.5,smooth(93,96,t)),(helper.z+hurt.z)*.5);
  const amount=smooth(90.5,92,t)*(1-smooth(96.4,97,t));
  for(const [g,a,sign] of [[golems[0],golems[0].arms[1],1],[golems[5],golems[5].arms[0],-1]]){const start=g.root.localToWorld(V3(a.side*.8,2.0,.6));reach(g,a,start.lerp(grip.clone().add(V3(sign*.07,0,0)),amount));}
 }
}

// Beams, crystal shards, impact particles and dust use absolute event times.
function beam(color,radius){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius*1.4,1,7),BM(color,{transparent:true,opacity:.38,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(mesh);return mesh;}
const breath=beam(0xb646f1,.26),heal=beam(0xeaa4ed,.055),breathBits=[];
for(let i=0;i<28;i++){const m=cub(scene,BM(i%3?0x9a37dd:0xd273ed,{transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false}),0,0,0,.16,.16,.16);m.castShadow=false;breathBits.push(m);}
function placeBeam(mesh,a,b){const d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=d.length();mesh.quaternion.setFromUnitVectors(up3,d.normalize());}
const shards=[];for(let i=0;i<62;i++){const m=cub(scene,BM(i%2?0xe994ed:0xa86bd5,{transparent:true,opacity:1}),0,0,0,.22,.22,.22);m.castShadow=false;shards.push(m);}
const defeat=[];for(let i=0;i<90;i++){const m=cub(scene,BM(i%4?0x7859b3:0xdca1ec,{transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}),0,0,0,.2,.2,.2);m.castShadow=false;defeat.push(m);}
const impact=[];for(let i=0;i<20;i++){const m=cub(scene,BM(i%2?0xe2d7bf:0xaf87b9,{transparent:true,opacity:.8}),0,0,0,.1,.1,.1);m.castShadow=false;impact.push(m);}
const footDust=new THREE.InstancedMesh(boxGeo,LM(0xb4b5a6,{transparent:true,opacity:.3,depthWrite:false}),60);footDust.frustumCulled=false;scene.add(footDust);const dustDummy=new THREE.Object3D();
const deathOrigin=dragonPoint(111.6);
function effects(t){
 crystal.visible=t<56.8;crystalCore.rotation.y=t*.7;crystalShell.rotation.y=-t*.55;
 heal.visible=t>=24.5&&t<56.8;if(heal.visible){placeBeam(heal,crystal.position,dragon.root.position.clone().add(V3(0,.3,1)));heal.material.opacity=.27+.1*Math.sin(t*7)**2;}
 const active=(t>=13&&t<15.3)||(t>=43.8&&t<46.3)||(t>=63&&t<66.3);breath.visible=active;breathBits.forEach(p=>p.visible=active);
 if(active){const origin=dragon.mouth.getWorldPosition(V3()),target=t<20?V3(0,1.3,2):t<50?golems[1].root.position.clone().add(V3(0,1.25,0)):V3(-3,1.7,3);placeBeam(breath,origin,target);breathBits.forEach((m,i)=>{const p=((t*1.45+i*.093)%1),v=origin.clone().lerp(target,p);v.x+=Math.sin(t*9+i)*.28*p;v.y+=Math.cos(t*7+i)*.23*p;m.position.copy(v);m.scale.setScalar(.13+p*.3);});}
 shards.forEach((m,i)=>{const a=t-56.8;m.visible=a>=0&&a<2.2;if(m.visible){const theta=i*2.4,v=1.6+hashS(i,34)*2.4;m.position.set(-6.5+Math.cos(theta)*v*a,8+(1+hashS(i,35)*3)*a-2.8*a*a,-3.5+Math.sin(theta)*v*a);m.rotation.set(i+a*3,i*.3+a*2,0);m.scale.setScalar(.16*(1-a/2.2));m.material.opacity=1-smooth(1.2,2.2,a);}});
 defeat.forEach((m,i)=>{const a=t-111.5;m.visible=a>=0&&a<5.0;if(m.visible){const theta=i*2.399,el=hashS(i,37)*1.6-.5,r=(.5+hashS(i,36)*2)*a;m.position.set(deathOrigin.x+Math.cos(theta)*r,deathOrigin.y+Math.sin(el)*r+a*.5,deathOrigin.z+Math.sin(theta)*r);m.rotation.set(a+i,a*.7,0);m.scale.setScalar((.12+hashS(i,38)*.2)*(1-smooth(3.5,5,a)));m.material.opacity=1-smooth(2.5,5,a);}});
 let event=null;for(const [hit,p] of [[23.4,hitFirst],[56.8,crystal.position],[82.4,tailHit],[106.5,hitFinal]])if(t>=hit&&t<hit+.45)event={hit,p};
 impact.forEach((m,i)=>{m.visible=!!event;if(event){const a=t-event.hit,ang=i*2.4;m.position.copy(event.p).add(V3(Math.sin(ang)*a*4,(hashS(i,39)-.3)*a*4,Math.cos(ang)*a*4));m.scale.setScalar(.08*(1-a/.45));m.material.opacity=(1-a/.45)*.7;}});
 let index=0;for(const g of golems)for(const f of g.feet)for(let k=0;k<5;k++){
  const age=f.phase,visible=age<.13&&tracks[g.index].at(t).speed>.5;
  dustDummy.position.copy(f.target).add(V3((hashS(index,40)-.5)*.65,.02+age*.8,(hashS(index,41)-.5)*.65));dustDummy.scale.setScalar(visible?.08*(1-age/.13):0);dustDummy.updateMatrix();footDust.setMatrixAt(index++,dustDummy.matrix);
 }footDust.instanceMatrix.needsUpdate=true;
}

const portal=G();portal.position.set(0,0,11.4);const portalMat=BM(0x121d2b),rim=LM(0x516561),eyes=BM(0x96b4a2);
for(let i=-1;i<=1;i++)for(const [x,z] of [[i,-2],[i,2],[-2,i],[2,i]]){cub(portal,rim,x,.18,z,.98,.36,.98);cub(portal,eyes,x,.39,z,.35,.09,.35);}
const gate=new THREE.Mesh(new THREE.PlaneGeometry(3,3),portalMat);gate.rotation.x=-Math.PI/2;gate.position.y=.19;portal.add(gate);const gateStars=[];for(let i=0;i<35;i++){const m=cub(portal,BM(0x91bdb7),0,.2,0,.035,.01,.035);m.position.set((hashS(i,45)-.5)*2.8,.2,(hashS(i,46)-.5)*2.8);m.castShadow=false;gateStars.push(m);}

// Captions share the export canvas. Native system font, no external font request.
const cards=[];
for(const [start,end,text] of FILM.scenes[SCENE].captions){
 const cv=document.createElement('canvas');cv.width=864;cv.height=152;const ctx=cv.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,152);gradient.addColorStop(0,'rgba(4,5,10,0)');gradient.addColorStop(.5,'rgba(4,5,10,.38)');gradient.addColorStop(1,'rgba(4,5,10,.65)');ctx.fillStyle=gradient;ctx.fillRect(0,0,864,152);ctx.font='bold 41px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.strokeStyle='#0b0c12';ctx.lineWidth=7;ctx.fillStyle='white';
 const lines=[];let line='';for(const word of text.split(' ')){const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width>800&&line){lines.push(line);line=word;}else line=candidate;}if(line)lines.push(line);lines.forEach((s,i)=>{const y=88+(i-(lines.length-1)/2)*48;ctx.strokeText(s,432,y);ctx.fillText(s,432,y);});
 const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.78,.314),new THREE.MeshBasicMaterial({map:tx,transparent:true,depthTest:false,depthWrite:false,fog:false,toneMapped:false}));mesh.position.set(0,-1.06,-4);mesh.renderOrder=2000;mesh.frustumCulled=false;camera.add(mesh);cards.push({start,end,mesh});
}
const cameraPlans=[
 [[14,11,28],[0,3,0],[8,8,22],[0,3,-2]],
 [[12,7,18],[0,2,-1],[-9,7,14],[0,3,-2]],
 [[9,6,13],[0,3,-1],[7,5,11],[0,3,-2]],
 [[8,6,17],[0,2.5,1],[-3,9,18],[-4,4,-1]],
 [[14,7,12],[2,3,0],[-14,10,12],[-7,5,-1]],
 [[-13,11,7],[-6.5,7,-3],[-11,10,4],[-6.5,8,-3.5]],
 [[11,8,17],[0,3,-1],[-9,7,14],[-1,3,-2]],
 [[12,7,13],[0,2.8,-3],[8,5,10],[0,3,-4]],
 [[-15,6,6],[hurt.x,2,hurt.z],[-13,5,3],[hurt.x,1.6,hurt.z]],
 [[helper.x+8,5,helper.z+9],[(helper.x+hurt.x)/2,1.8,hurt.z],[helper.x+7,4.8,helper.z+8],[(helper.x+hurt.x)/2,2,hurt.z]],
 [[17,7,13],[7,3,0],[14,6,11],[6,4,-1]],
 [[12,10,23],[4,7,-5],[12,9,26],[0,2.5,8]]
];
function cameraAt(t){
 const local=t-SCENE*10,p=cameraPlans[SCENE],q=smooth(0,10,local);camera.position.set(lerp(p[0][0],p[2][0],q),lerp(p[0][1],p[2][1],q),lerp(p[0][2],p[2][2],q));camera.lookAt(lerp(p[1][0],p[3][0],q),lerp(p[1][1],p[3][1],q),lerp(p[1][2],p[3][2],q));camera.updateMatrixWorld();
}
function renderAt(seconds){
 const local=clamp(Number(seconds)||0,0,9.999),t=SCENE*10+local;
 poseDragon(t);for(const g of golems)poseActor(g,t);stageContacts(t);effects(t);portal.visible=t>=115;
 gateStars.forEach((m,i)=>{m.material.color.setHSL(.47,.3,.25+.4*Math.sin(t*2+i)**2);});cameraAt(t);cards.forEach(c=>c.mesh.visible=local>=c.start&&local<c.end);renderer.render(scene,camera);
}
return {duration:10,renderAt,dispose(){const geos=new Set(),mats=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of (o.material?(Array.isArray(o.material)?o.material:[o.material]):[])){mats.add(m);for(const v of Object.values(m))if(v&&v.isTexture)textures.add(v);}if(o.isInstancedMesh)o.dispose();});textures.forEach(x=>x.dispose());geos.forEach(x=>x.dispose());mats.forEach(x=>x.dispose());renderer.dispose();}};
}
