// Original fictional acting study. Directed route, not autonomous navigation or physics.
function createScene(THREE,canvas,width,height,tools){
 if(!tools||!tools.createPropTransfer||!tools.walkOnPath)throw new Error('Esta cena precisa dos novos recursos de transporte.');
 const V=tools.vec,C=tools.cue;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setSize(width,height,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.autoClear=false;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xd0e3df);scene.fog=new THREE.Fog(0xd0e3df,24,70);const camera=new THREE.PerspectiveCamera(39,width/height,.1,100);
 scene.add(new THREE.HemisphereLight(0xe5f3ff,0x987857,1.7));const sun=new THREE.DirectionalLight(0xffe2b3,3.2);sun.position.set(5,11,-3);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:1,far:30});sun.shadow.normalBias=.025;scene.add(sun);const fill=new THREE.DirectionalLight(0xc4e4ed,.8);fill.position.set(-5,4,3);scene.add(fill);
 const mat=(c,e={})=>new THREE.MeshStandardMaterial({color:c,roughness:.78,...e});
 const cream=mat(0xe7decb),blue=mat(0x4e8590),dark=mat(0x233b47),metal=mat(0x94adb0,{metalness:.55,roughness:.35}),wood=mat(0xbe8a54),yellow=mat(0xf4c95a),red=mat(0xba5c4b),green=mat(0x54847a);
 const cube=new THREE.BoxGeometry(1,1,1),solids=[];
 function box(parent,m,x,y,z,w,h,d,block=true){const o=new THREE.Mesh(cube,m);o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=true;o.receiveShadow=true;parent.add(o);if(block)solids.push(o);return o;}
 function tube(parent,a,b,r,m){a=V(a);b=V(b);const delta=b.clone().sub(a),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),10),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(V([0,1,0]),delta.normalize());o.castShadow=true;parent.add(o);return o;}
 function label(text,w,h,bg='#f1dfb2',fg='#233b47'){const c=document.createElement('canvas');c.width=512;c.height=192;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.fillStyle=fg;x.font='800 58px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,256,96,480);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,toneMapped:false}));return o;}
 const floor=box(scene,mat(0xd9d4bf),0,.06,0,8.4,.12,9.2),floorY=tools.registerSurface('workshop',floor);
 // Fine floor seams, with a clear central transport lane.
 for(let x=-4;x<=4;x+=1)box(scene,mat(0xb9bba9),x,floorY+.001,0,.012,.002,9.1,false);
 for(let z=-4;z<=4;z+=1)box(scene,mat(0xb9bba9),0,floorY+.001,z,8.3,.002,.012,false);
 box(scene,cream,0,2.05,4.5,8.4,4.1,.18);box(scene,blue,-4.15,1.7,1,.16,3.4,6.8);
 // The open right-hand camera sees the side work area behind the actor.
 box(scene,cream,-4.045,2.20,-1.20,.035,.98,1.65);box(scene,mat(0x9bc8c5),-4.02,2.20,-1.20,.025,.82,1.48);
 for(const z of [-1.92,-1.20,-.48])box(scene,cream,-3.99,2.20,z,.055,.88,.045);
 box(scene,cream,-3.99,2.20,-1.20,.055,.045,1.48);
 const sideBoard=box(scene,dark,-4.02,1.92,1.2,.06,1.24,1.8);
 for(let i=0;i<4;i++){const z=.55+i*.43;tube(scene,[-3.94,1.61,z],[-3.94,2.16,z],.024,metal);const ring=new THREE.Mesh(new THREE.TorusGeometry(.075,.022,6,16),metal);ring.rotation.y=Math.PI/2;ring.position.set(-3.94,2.2,z);scene.add(ring);}
 box(scene,wood,-3.49,floorY+.96,1.2,.94,.12,2.05);for(const z of [.37,2.03])for(const x of [-3.85,-3.14])box(scene,dark,x,floorY+.44,z,.07,.88,.07);
 box(scene,blue,-3.50,floorY+.55,1.4,.72,.7,.7);for(const y of [.43,.68])box(scene,metal,-3.125,floorY+y,1.4,.018,.035,.26,false);
 box(scene,red,-3.48,floorY+1.18,1.7,.4,.3,.36);box(scene,metal,-3.48,floorY+1.38,1.7,.18,.1,.12);
 for(const x of [-3.4,0,3.4])box(scene,blue,x,2.05,4.37,.12,4.1,.08);
 const sign=label('OFICINA  /  ENTREGA',3.5,.6);sign.position.set(-.6,3.34,4.38);scene.add(sign);
 // Workbench with real legs, apron, top and a measured placement surface.
 const bench=new THREE.Group();scene.add(bench);bench.position.set(-1.25,floorY,2.0);
 for(const x of [-.82,.82])for(const z of [-.39,.39])box(bench,dark,x,.42,z,.09,.84,.09);
 box(bench,blue,0,.77,0,1.84,.18,.96);const top=box(bench,wood,0,.89,0,1.96,.12,1.04);const tableY=tools.registerSurface('bench',top);
 const benchLabel=label('MESA',.56,.19,'#395b67','#fff1cc');benchLabel.position.set(-1.25,floorY+.78,1.505);benchLabel.rotation.y=Math.PI;scene.add(benchLabel);
 // Background storage: simple tools, wheels, jars and a framed pegboard.
 const shelf=new THREE.Group();scene.add(shelf);shelf.position.set(2.5,floorY,3.8);
 for(const x of [-.7,.7])box(shelf,dark,x,1.2,0,.08,2.4,.08);
 for(const y of [.22,.95,1.7,2.4])box(shelf,wood,0,y,0,1.6,.08,.64);
 for(let i=0;i<8;i++){const y=i<4?1.15:1.9,x=-.58+(i%4)*.39;box(shelf,i%2?blue:yellow,x,y,0,.28,.31,.4);box(shelf,cream,x,y,.208,.14,.07,.008,false);}
 const board=box(scene,dark,-2.15,2.05,4.34,2.3,1.5,.08);
 for(let i=0;i<5;i++){const x=-3.05+i*.42;for(let j=0;j<3;j++)box(scene,metal,x,1.55+j*.45,4.275,.025,.025,.018,false);tube(scene,[x,1.65,4.2],[x,2.25,4.2],.027,metal);const ring=new THREE.Mesh(new THREE.TorusGeometry(.08,.022,6,16),metal);ring.position.set(x,2.29,4.2);scene.add(ring);}
 for(const x of [1.7,2.5]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.25,.07,8,20),dark);wheel.position.set(x,floorY+.31,4.2);scene.add(wheel);}
 const obstacle=box(scene,red,-1.36,floorY+.28,-.38,.85,.56,.82);box(scene,dark,-1.36,floorY+.59,-.38,.5,.06,.28);box(scene,metal,-1.36,floorY+.43,-.805,.2,.055,.02,false);
 // One and only one cargo object, with integral tape, side grips and a label.
 const cargo=new THREE.Group();scene.add(cargo);const cardboard=mat(0xc68d4b),edge=mat(0x92633b),tape=mat(0xe9ce8a);
 box(cargo,cardboard,0,0,0,.62,.44,.46,false);box(cargo,tape,0,.222,0,.10,.008,.465,false);box(cargo,tape,0,0,.233,.1,.44,.008,false);
 for(const side of [-1,1]){const x=side*.385;box(cargo,edge,side*.31,.08,0,.028,.18,.10,false);for(const y of [.005,.155])tube(cargo,[side*.318,y,0],[x,y,0],.014,dark);tube(cargo,[x,.005,0],[x,.155,0],.018,dark);}
 const cargoLabel=label('CUIDADO',.25,.085,'#f7e8ba','#624b35');cargoLabel.position.set(.12,.025,.238);cargo.add(cargoLabel);
 const actor=tools.createPerson({shirt:0xeeb94d,trousers:0x345f70,helmet:0xf4c34e,hands:'articulated'});scene.add(actor.root);
 const route=tools.createWalkPath([[-1.4,floorY,-1.9],[-1.4,floorY,-1.65],[-.20,floorY,-1.15],[-.10,floorY,-.30],[-.30,floorY,.45],[-1.25,floorY,.70],[-1.25,floorY,1.10]]);
 const pickup=1.85,release=9.45,grips=[-1,1].map(side=>({point:[side*.385,.08,0],normal:[-side,0,0],fingers:[0,0,1]})),qUp=V([0,1,0]);
 function bodyAt(t){const d=route.length*C(t,3.05,7.85),s=route.at(d),walk=t>3.05&&t<7.85?Math.sin(Math.PI*tools.progress(t,3.05,7.85)):0;return {distance:d,position:s.point,yaw:s.yaw,walk};}
 const initialBody=bodyAt(0),initialQ=new THREE.Quaternion().setFromAxisAngle(qUp,initialBody.yaw),initialPosition=initialBody.position.clone().add(V([0,.22,.55]).applyQuaternion(initialQ));
 tools.setWorldPose(cargo,{position:initialPosition,quaternion:initialQ});tools.placeOnSurface(cargo,'workshop',initialPosition.x,initialPosition.z);
 const source={position:cargo.position.clone(),quaternion:cargo.quaternion.clone()},centerOffset=source.position.y-floorY;
 function heldAt(t){const b=bodyAt(t),q=new THREE.Quaternion().setFromAxisAngle(qUp,b.yaw),raise=C(t,2.18,3.02),place=C(t,8.35,release),effort=Math.sin(Math.PI*tools.progress(t,pickup,2.12))*.024;
  const y=centerOffset+(1.22-centerOffset)*raise+(tableY+centerOffset-floorY-1.22)*place+effort*(1-raise),z=.55+.17*place;
  return {position:b.position.clone().add(V([0,y,z]).applyQuaternion(q)),quaternion:q};
 }
 const transfer=tools.createPropTransfer(cargo,{source,pickup,release,heldAt});
 const hudScene=new THREE.Scene(),hudCam=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);hudCam.position.z=2;const hud=document.createElement('canvas');hud.width=width;hud.height=height;const ctx=hud.getContext('2d'),texture=new THREE.CanvasTexture(hud);texture.colorSpace=THREE.SRGBColorSpace;hudScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false})));
 let lastDiagnostic;
 function text(s,x,y,size,color='#fff2ca'){ctx.font='800 '+Math.round(width*size)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.strokeStyle='#223945';ctx.lineWidth=width*.009;ctx.strokeText(s,x,y);ctx.fillStyle=color;ctx.fillText(s,x,y);}
 function blendHand(a,b,p){return {point:a.point.clone().lerp(b.point,p),quaternion:a.quaternion.clone().slerp(b.quaternion,p),grip:0};}
 function renderAt(t,detail=false){
  t=tools.clamp(Number(t)||0,0,11.999);const b=bodyAt(t),gait=tools.walkOnPath({path:route,distance:b.distance,stride:.82,width:.28,lift:.11,surface:'workshop',settle:C(t,7.85,8.28)});
  actor.root.position.copy(b.position);actor.root.rotation.y=b.yaw;actor.root.updateWorldMatrix(true,true);transfer.apply(t);const contacts=tools.graspFrames(cargo,grips);
  const crouch=.54*C(t,.7,1.15)*(1-C(t,2.18,3.02))+.13*b.walk;
  const lean=.32*C(t,.7,1.15)*(1-C(t,2.18,3.02))+.055*b.walk+.22*C(t,8.0,8.8)*(1-C(t,9.6,10.3));
  const rests=tools.graspFrames(actor.root,[-1,1].map(side=>({point:[side*.40,.78,.08],normal:[-side,0,0],fingers:[0,-1,0]})));
  const outside=contacts.map(c=>({point:c.point.clone().add(V([0,0,-.12]).applyQuaternion(c.quaternion)),quaternion:c.quaternion.clone()}));
  const closure=C(t,1.58,1.80)*(1-C(t,9.50,9.80));
  const hands=rests.map((r,i)=>{let h;if(t<1.25)h=blendHand(r,outside[i],C(t,.65,1.25));else if(t<1.6)h=blendHand(outside[i],contacts[i],C(t,1.25,1.6));else if(t<9.8)h=blendHand(contacts[i],contacts[i],0);else if(t<10.1)h=blendHand(contacts[i],outside[i],C(t,9.8,10.1));else h=blendHand(outside[i],r,C(t,10.1,10.5));h.grip=closure;return h;});
  const wipe=C(t,10.55,11.05)*(1-C(t,11.25,11.85)),wipeFrame=tools.graspFrames(actor.root,[{point:[.2796,1.604,.2728],normal:[-.6,0,-.8],fingers:[0,1,0]}])[0];hands[1]=blendHand(hands[1],wipeFrame,wipe);hands[1].grip=closure;
  const diagnostics=actor.pose({time:t,leftFoot:gait.left,rightFoot:gait.right,leftHand:hands[0],rightHand:hands[1],phase:gait.phase,swing:0,crouch,lean,kneeSpread:(.45+.70*C(t,.35,.65))*(1-C(t,2.18,3.02)),effort:C(t,1.0,1.4)*(1-C(t,9.5,10.2)),lookPitch:.38*C(t,.65,1.15)*(1-C(t,2.2,3.0))+.10*C(t,8.2,9)*(1-C(t,9.5,10.1)),lookYaw:.25*wipe,bob:Math.sin(gait.phase*2)*.009*b.walk});
  let target,dir,span,shot;if(t<.7){shot=0;target=V([-.45,1.0,-.65]);dir=[1,.62,.65];span=5.3;}else if(t<3.05){shot=1;target=b.position.clone().add(V([0,.75,.22]));dir=[1,.45,.65];span=3.25;}else if(t<8.1){shot=2;target=b.position.clone().add(V([0,.90,.15]));dir=[1,.48,.32];span=3.8;}else if(t<10.35){shot=3;target=b.position.clone().add(V([0,1.0,.34]));dir=[1,.44,.22];span=3.45;}else{shot=4;target=b.position.clone().add(V([0,1.14,.05]));dir=[1,.33,.55];span=3.0;}
  const head=actor.head.getWorldPosition(new THREE.Vector3());tools.aimCamera(camera,target,[dir],span,solids,[head,cargo.getWorldPosition(new THREE.Vector3())]);
  if(detail){const side=detail===2?0:1,rotation=cargo.getWorldQuaternion(new THREE.Quaternion()),direction=V([side?1:-1,.38,.72]).applyQuaternion(rotation);target=contacts[side].point.clone().add(V([0,.015,0]));tools.aimCamera(camera,target,[direction.toArray()],.82,[]);}
  renderer.setViewport(0,0,width,height);renderer.clear();renderer.render(scene,camera);
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#234651';ctx.beginPath();ctx.roundRect(width*.12,height*.05,width*.76,height*.065,12);ctx.fill();text(detail?'PEGAR E SOLTAR':'PARECIA LEVE...',width/2,height*.083,.048);ctx.font='800 '+Math.round(width*.025)+'px sans-serif';ctx.fillStyle='#29434b';ctx.fillText(detail?'REVISÃO DAS MÃOS':'TESTE DE ATUAÇÃO  /  OFICINA',width/2,height*.135);
  const caption=detail?(t<1.6?'Chegar com a mão aberta.':t<1.85?'Fechar os dedos.':t<9.5?'Manter a pega.':t<9.8?'Abrir com a caixa apoiada.':'Afastar a mão.'):(t<.9?'Só levar até a mesa.':t<2.25?'Opa... pesa!':t<3.3?'Duas mãos. Agora vai.':t<4.6?'Devagar...':t<7.9?'Tem coisa no caminho.':t<9.5?'Apoiar primeiro.':t<10.35?'Soltar depois.':'Pronto. Ufa!');text(caption,width/2,height*.805,.043,'#ffffff');texture.needsUpdate=true;renderer.clearDepth();renderer.render(hudScene,hudCam);
  const cargoBounds=new THREE.Box3().setFromObject(cargo),obstacleBounds=new THREE.Box3().setFromObject(obstacle);
  lastDiagnostic={time:t,shot,phase:transfer.phase(t),closure,position:b.position.toArray(),yaw:b.yaw,distance:b.distance,pathLength:route.length,feet:diagnostics.feet.slice(),legReach:diagnostics.legReach.slice(),armReach:diagnostics.armReach.slice(),kneesLocal:diagnostics.knees.map(p=>cargo.worldToLocal(V(p)).toArray()),handSamples:diagnostics.handSamples.map(samples=>samples.map(s=>({...s,from:cargo.worldToLocal(V(s.from)).toArray(),to:cargo.worldToLocal(V(s.to)).toArray()}))),wrists:diagnostics.wrists,elbows:diagnostics.elbows,handTargets:hands.map(h=>h.point.toArray()),gripErrors:actor.hands.map((h,i)=>h.getWorldPosition(new THREE.Vector3()).distanceTo(contacts[i].point)),footSoles:actor.feet.map(f=>f.sole.getWorldPosition(new THREE.Vector3()).toArray()),planted:[gait.left.planted,gait.right.planted],cargoPosition:cargo.position.toArray(),cargoBottom:cargoBounds.min.y,obstacleMin:obstacleBounds.min.toArray(),obstacleMax:obstacleBounds.max.toArray(),floorY,tableY,headScreen:head.project(camera).toArray(),camera:camera.userData.targetVisibility};
 }
 function inspect(t){renderAt(t);return lastDiagnostic;}
 return {duration:12,renderAt,renderHandDetailAt:(t,side=1)=>renderAt(t,side?1:2),inspect,dispose(){const geometries=new Set(),materials=new Set(),textures=new Set();for(const root of [scene,hudScene])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v&&v.isTexture)textures.add(v);}});textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());renderer.dispose();}};
}
