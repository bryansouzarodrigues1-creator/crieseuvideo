// Original movement study: look, walk, arrive, grasp, explain the floor connection.
function createScene(THREE,canvas,width,height,tools){
 if(!tools||tools.version!==1)throw new Error('Esta cena precisa dos recursos de movimento versão 1.');
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setSize(width,height,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.autoClear=false;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xc5e1e2);scene.fog=new THREE.Fog(0xd3e3df,27,95);
 const camera=new THREE.PerspectiveCamera(40,width/height,.12,180),detailCamera=new THREE.PerspectiveCamera(38,width/height,.08,100),V=tools.vec;
 scene.add(new THREE.HemisphereLight(0xe7f3ff,0x99816b,1.5));const sun=new THREE.DirectionalLight(0xffedca,3.1);sun.position.set(8,15,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:1,far:45});sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;scene.add(sun);const fill=new THREE.DirectionalLight(0xd2e5f0,.75);fill.position.set(-8,7,-4);scene.add(fill);
 const M=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.74,...extra});
 const stone=M(0xd5d9cc),metal=M(0xa7b7be,{metalness:.55,roughness:.35}),dark=M(0x253d47,{metalness:.3,roughness:.48}),wood=M(0xa77a50),white=M(0xf4efe0),blue=M(0x4f8999),glass=M(0xa5cdd2,{transparent:true,opacity:.25,roughness:.2,metalness:.1,side:THREE.DoubleSide,depthWrite:false}),gold=M(0xf2c14a);
 const cameraBlockers=[];const cube=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
 function box(parent,mat,x,y,z,w,h,d){const m=new THREE.Mesh(cube,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(!mat.transparent)cameraBlockers.push(m);return m;}
 const lower=box(scene,stone,0,.11,-1.1,9,.22,13),upper=box(scene,stone,0,2.52,6.8,8,.22,4.8);
 const lowerY=tools.registerSurface('lobby',lower),upperY=tools.registerSurface('upper',upper),lo=.4,hi=4.4,rise=upperY-lowerY;
 function texture(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#cdd3cc';x.fillRect(0,0,256,256);x.fillStyle='#dce0d8';x.fillRect(2,2,124,124);x.fillRect(130,130,124,124);x.strokeStyle='#b3beb9';x.lineWidth=2;for(const a of [0,128,256]){x.beginPath();x.moveTo(a,0);x.lineTo(a,256);x.moveTo(0,a);x.lineTo(256,a);x.stroke();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,6);return t;}
 lower.material=M(0xffffff,{map:texture()});
 // Open shopfronts: framing and glass, without an opaque wall covering the view.
 for(const side of [-1,1])for(let z=-4.8;z<5;z+=2.6){for(const dz of [-1.24,1.24])box(scene,white,side*3.7,1.65,z+dz,.18,2.86,.15);box(scene,white,side*3.7,3.06,z,.18,.16,2.6);box(scene,glass,side*3.7,1.53,z,.025,2.45,2.4);box(scene,M(z<0?0xe0b55e:0x5a9699),side*3.68,2.56,z,.06,.45,2.25);box(scene,wood,side*4.02,.55,z,.55,.66,1.25);}
 // A bench and planter are placed using their actual lower bounds, then reused.
 const bench=new THREE.Group();scene.add(bench);box(bench,wood,0,.49,0,1.55,.15,.55);for(const x of [-.55,.55])box(bench,dark,x,.22,0,.09,.44,.47);box(bench,wood,0,.88,-.22,1.55,.62,.09);tools.placeOnSurface(bench,'lobby',-2.3,-1.65);
 for(const [x,z] of [[-2.5,-4.8],[2.7,1.8],[-2.8,7.1]]){const plant=new THREE.Group();scene.add(plant);const pot=new THREE.Mesh(new THREE.CylinderGeometry(.27,.21,.48,16),M(0xe9d6b5));pot.position.y=.24;plant.add(pot);for(const a of [0,1,2,3,4,5]){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),M(0x5b9273));leaf.position.set(Math.cos(a)*.16,.7+Math.sin(a)*.12,Math.sin(a)*.16);leaf.scale.set(.7,2,.7);plant.add(leaf);}tools.placeOnSurface(plant,z>4?'upper':'lobby',x,z);cameraBlockers.push(plant);}
 // Repeated upper-storey details are inset, leaving a clear view of the mechanism.
 for(const x of [-3.4,3.4])for(let z=4.7;z<9;z+=1.1){box(scene,blue,x,upperY+.55,z,.04,1.1,.92);box(scene,dark,x,upperY+1.12,z,.075,.065,1.1);}
 const rampY=z=>lowerY+rise*tools.ease((z-lo)/(hi-lo));
 // Mesh strips follow the same ramp function as the visible treads and rails.
 function strip(side,material,lowerOffset,upperOffset){const vertices=[];for(let i=0;i<32;i++){const z=lo+(hi-lo)*i/32,q=lo+(hi-lo)*(i+1)/32;const a=[side,rampY(z)+lowerOffset,z],b=[side,rampY(q)+lowerOffset,q],c=[side,rampY(q)+upperOffset,q],d=[side,rampY(z)+upperOffset,z];vertices.push(...a,...b,...c,...a,...c,...d);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
 const sideMat=M(0x667d83,{side:THREE.DoubleSide,metalness:.35});for(const side of [-.86,.86]){strip(side,sideMat,-.34,.04);strip(side,glass,.05,.99);}
 const railCurves=[];
 for(const side of [-1,1]){const x=side*.94;class Rail extends THREE.Curve{getPoint(t,target=new THREE.Vector3()){const z=-.9+t*6.0;return target.set(x,rampY(z)+1.02,z);}}const curve=new Rail();railCurves.push(curve);const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,120,.045,8,false),dark);tube.castShadow=true;scene.add(tube);for(const z of [-.7,5.0])box(scene,metal,x,rampY(z)+.52,z,.055,1.04,.055);}
 // End frames are inlaid at both measured floor levels. No independent height constant.
 const lowerLanding=box(scene,dark,0,lowerY-.035,-.17,1.70,.07,1.14),upperLanding=box(scene,dark,0,upperY-.035,4.76,1.70,.07,.72);
 // Remove overlap with the floors from the depth buffer, retaining exact support height.
 lowerLanding.material=dark.clone();lowerLanding.material.polygonOffset=true;lowerLanding.material.polygonOffsetFactor=-1;lowerLanding.material.polygonOffsetUnits=-1;upperLanding.material=lowerLanding.material;
 const steps=new THREE.InstancedMesh(cube,metal,20);steps.castShadow=true;steps.receiveShadow=true;steps.frustumCulled=false;scene.add(steps);
 for(const z of [-.62,-.26,.10,4.52,4.85])for(const x of [-.72,.72])box(scene,gold,x,rampY(z)+.005,z,.025,.012,.22);
 const person=tools.createPerson({shirt:0xe8b844,trousers:0x315b76,helmet:0xf3c84c});scene.add(person.root);
 const start=V([.25,lowerY,-4.05]),direction=V([0,0,1]),distance=3.4;
 const grip=V([.94,lowerY+1.02,-.35]);
 const hudScene=new THREE.Scene(),hudCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);hudCamera.position.z=2;const overlay=document.createElement('canvas');overlay.width=width;overlay.height=height;const ctx=overlay.getContext('2d'),tex=new THREE.CanvasTexture(overlay);tex.colorSpace=THREE.SRGBColorSpace;hudScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false,toneMapped:false})));
 function pill(text,x,y,w,h,bg,color,size){ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(h*.25,15));ctx.fill();ctx.font='800 '+Math.round(width*size)+'px sans-serif';ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x+w/2,y+h/2,w*.94);}
 function caption(a,b,y){ctx.font='800 '+Math.round(width*.042)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#17252d';ctx.fillStyle='#ffffff';ctx.lineWidth=width*.009;ctx.lineJoin='round';for(const [i,s] of [a,b].entries())if(s){ctx.strokeText(s,width/2,height*y+i*width*.055);ctx.fillText(s,width/2,height*y+i*width*.055);}}
 function renderAt(t){
  t=tools.clamp(Number(t)||0,0,11.999);const p=tools.cue(t,1,5),d=distance*p,velocity=t>1&&t<5?6*tools.progress(t,1,5)*(1-tools.progress(t,1,5)):0;
  const gait=tools.walkFeet({distance:d,origin:start,direction,stride:1.12,width:.28,lift:.115,limit:distance,surface:'lobby'});
  person.root.position.copy(start).addScaledVector(direction,d);
  const reach=tools.cue(t,5.15,6.25),rest=person.root.localToWorld(V([.40,.94,.08]));const rightHand=rest.lerp(grip,reach);
  person.pose({time:t,leftFoot:gait.left,rightFoot:gait.right,phase:gait.phase,swing:.23*tools.clamp(velocity),lean:.035*velocity,bob:Math.sin(gait.phase*2)*.012*tools.clamp(velocity),rightHand:reach>0?rightHand:undefined,lookYaw:tools.cue(t,4.8,6.2)*.31,lookPitch:tools.cue(t,5.1,6.2)*.10});
  const travel=(t*.48)%5.6;
  for(let i=0;i<20;i++){const z=-.4+((i*.28+travel)%5.6),visible=z>lo+.025&&z<hi-.025;dummy.position.set(0,rampY(z)-.09,z);dummy.rotation.set(0,0,0);dummy.scale.set(visible?1.54:0,visible?.18:0,visible?.30:0);dummy.updateMatrix();steps.setMatrixAt(i,dummy.matrix);}steps.instanceMatrix.needsUpdate=true;
  const visibility=[person.head.getWorldPosition(new THREE.Vector3()).add(V([0,.15,0])),...person.feet.map(f=>f.group.getWorldPosition(new THREE.Vector3()))];
  const split=t>=8.2;
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.clear();
  if(split){const bottom=Math.round(height*.36),top=height-bottom;camera.aspect=width/top;camera.updateProjectionMatrix();const target=person.root.position.clone().add(V([0,1.02,0]));tools.aimCamera(camera,target,[[.6,.3,1.1],[-.6,.3,1.1],[0,.3,1]],3.5,cameraBlockers,visibility);renderer.setScissorTest(true);renderer.setScissor(0,bottom,width,top);renderer.setViewport(0,bottom,width,top);renderer.render(scene,camera);
   detailCamera.aspect=width/bottom;detailCamera.updateProjectionMatrix();tools.aimCamera(detailCamera,V([0,upperY+.17,4.43]),[[1,.65,-1]],2.65,[]);renderer.setScissor(0,0,width,bottom);renderer.setViewport(0,0,width,bottom);renderer.render(scene,detailCamera);renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);
  }else{camera.aspect=width/height;camera.updateProjectionMatrix();let target,dirs,span;if(t<4.9){target=person.root.position.clone().add(V([0,.98,0]));dirs=[[.55,.30,1],[-.55,.30,1],[0,.3,1]];span=4.4;}else{target=person.root.position.clone().add(V([.28,1.02,.16]));dirs=[[1,.12,1.15],[-1,.22,1.1]];span=3.25;}tools.aimCamera(camera,target,dirs,span,cameraBlockers,visibility);renderer.render(scene,camera);}
  ctx.clearRect(0,0,width,height);pill('MOVIMENTO COM APOIO',width*.13,height*.052,width*.74,height*.055,'#153742','#f9d778',.039);
  pill(t<5?'01  CAMINHAR':t<8.2?'02  ALCANÇAR':'03  CONFERIR O ENCAIXE',width*.22,height*.116,width*.56,height*.035,'rgba(25,48,57,.9)','#ffffff',.023);
  if(split){ctx.fillStyle='#e4bc54';ctx.fillRect(0,Math.round(height*.64)-2,width,4);pill('PISO SUPERIOR + DEGRAU',width*.22,height*.655,width*.56,height*.032,'#193842','#f6d980',.023);caption('O piso define a altura.','A escada chega ao mesmo apoio.',.89);}else if(t<1)caption('Olhar, preparar','e só então caminhar.',.79);else if(t<5)caption('Um pé fica apoiado','enquanto o outro avança.',.79);else caption('A mão alcança o corrimão','e mantém o contato.',.79);
  tex.needsUpdate=true;renderer.clearDepth();renderer.render(hudScene,hudCamera);
 }
 function inspect(t){renderAt(t);return {camera:camera.userData.targetVisibility,headScreen:person.head.getWorldPosition(new THREE.Vector3()).project(camera).toArray(),feet:person.diagnostics.feet.slice(),legReach:person.diagnostics.legReach.slice(),hand:person.diagnostics.hands[1],rightHand:person.hands[1].getWorldPosition(new THREE.Vector3()).toArray(),grip:grip.toArray(),lower:lowerY,upper:upperY,footSoles:person.feet.map(f=>f.sole.getWorldPosition(new THREE.Vector3()).toArray())};}
 return {duration:12,renderAt,inspect,dispose(){const geometries=new Set(),materials=new Set(),textures=new Set();for(const root of [scene,hudScene])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const value of Object.values(m))if(value&&value.isTexture)textures.add(value);}if(o.isInstancedMesh)o.dispose();});textures.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());geometries.forEach(x=>x.dispose());renderer.dispose();}};
}
