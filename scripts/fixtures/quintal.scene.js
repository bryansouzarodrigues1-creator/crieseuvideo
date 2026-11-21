/* Original garden explainer. Same world and absolute clock in every native segment.
   The supplied voice stays outside this public source; no audio, keys or service calls.
   Section cuts use the supplied script and measured pauses, not word-level ASR. */
/* SEGMENT_CONFIG */
function createScene(THREE,canvas,width,height){
 const OFFSET=typeof SEGMENT_OFFSET==='number'?SEGMENT_OFFSET:0;
 const DURATION=typeof SEGMENT_DURATION==='number'?SEGMENT_DURATION:10;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(width,height,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.14;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#bce0ed');
 const camera=new THREE.OrthographicCamera(-8,8,14,-14,.1,160);
 const hemi=new THREE.HemisphereLight('#e2f5ff','#8a7c54',2.35);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#fff0cc',3.1);sun.position.set(-9,18,8);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-14;sun.shadow.camera.right=14;sun.shadow.camera.top=17;sun.shadow.camera.bottom=-17;sun.shadow.camera.near=.5;sun.shadow.camera.far=55;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.shadow.radius=2;scene.add(sun);
 const fill=new THREE.DirectionalLight('#c8e8ff',.75);fill.position.set(10,7,-6);scene.add(fill);
 const materials=new Map(),geometries=new Set(),textures=new Set();
 const unitBox=new THREE.BoxGeometry(1,1,1),unitSphere=new THREE.SphereGeometry(1,10,7),unitCylinder=new THREE.CylinderGeometry(1,1,1,14),unitCone=new THREE.ConeGeometry(1,1,10);
 [unitBox,unitSphere,unitCylinder,unitCone].forEach(g=>geometries.add(g));
 function mat(c,opts={}){const key=c+JSON.stringify(opts);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:c,roughness:.8,metalness:0,...opts}));return materials.get(key);}
 const M={grass:mat('#7eae60'),grass2:mat('#91bd65'),wood:mat('#b47d4e'),woodLight:mat('#d5ad76'),darkWood:mat('#795538'),soil:mat('#624334'),soil2:mat('#846044'),cream:mat('#f2e9d4'),white:mat('#fff4df'),roof:mat('#bf6650'),red:mat('#bc594c'),blue:mat('#3d86aa'),water:mat('#35a9d1',{transparent:true,opacity:.73,roughness:.24,metalness:.18}),pipe:mat('#dae7d9'),green:mat('#36894b'),leaf:mat('#57a45a'),yellow:mat('#edbb53'),navy:mat('#273f50'),steel:mat('#779395',{metalness:.3}),orange:mat('#ef8b3f'),glow:mat('#aeeccd',{emissive:'#70cba4',emissiveIntensity:.5}),window:mat('#77bfcf',{roughness:.2,metalness:.15}),wire:mat('#74836c')};
 function group(parent=scene,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
 function mesh(geo,m,p,x,y,z,sx=1,sy=1,sz=1){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=!m.transparent;o.receiveShadow=true;p.add(o);return o;}
 const box=(p,x,y,z,sx,sy,sz,m)=>mesh(unitBox,m,p,x,y,z,sx,sy,sz);
 const ball=(p,x,y,z,sx,sy,sz,m)=>mesh(unitSphere,m,p,x,y,z,sx,sy,sz);
 const cyl=(p,x,y,z,r,h,m)=>mesh(unitCylinder,m,p,x,y,z,r,h,r);
 const cone=(p,x,y,z,r,h,m)=>mesh(unitCone,m,p,x,y,z,r,h,r);
 const V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 const phase=(t,a,b)=>smooth((t-a)/(b-a));
 function rod(p,a,b,r,m){a=V(...a);b=V(...b);const d=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5);const o=cyl(p,mid.x,mid.y,mid.z,r,d.length(),m);o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o;}
 function pipe(p,points,r=.07,m=M.pipe){for(let i=1;i<points.length;i++)rod(p,points[i-1],points[i],r,m);for(let i=1;i<points.length-1;i++)ball(p,...points[i],r*1.15,r*1.15,r*1.15,m);}
 const allFlows=[];
 function flow(p,points,count,color='#78d9ff',speed=.4,size=.055){
  const pts=points.map(a=>V(...a)),lengths=[0];for(let i=1;i<pts.length;i++)lengths.push(lengths[i-1]+pts[i].distanceTo(pts[i-1]));
  const drops=[];const m=mat(color,{emissive:color,emissiveIntensity:.45,roughness:.25});for(let i=0;i<count;i++)drops.push(ball(p,0,0,0,size,size,size,m));
  const f={pts,lengths,total:lengths.at(-1),drops,speed,active:true};allFlows.push(f);return f;
 }
 function placeFlow(f,t){f.drops.forEach((o,i)=>{o.visible=f.active;if(!f.active)return;let d=((t*f.speed+i/f.drops.length)%1)*f.total,k=1;while(k<f.lengths.length-1&&f.lengths[k]<d)k++;o.position.copy(f.pts[k-1]).lerp(f.pts[k],(d-f.lengths[k-1])/(f.lengths[k]-f.lengths[k-1]));});}
 function outlinePanel(p,x,y,z,w,h,d){box(p,x,y,z,w,h,d,M.wood);box(p,x,y+h*.52,z,w*.94,.04,d*.94,M.soil);}
 const slab=group();box(slab,0,-.47,0,10.7,.92,20.7,M.soil2);box(slab,0,-.14,0,10.72,.13,20.72,M.soil);box(slab,0,.015,0,10.65,.19,20.65,M.grass);
 box(scene,0,-1.04,0,250,.12,250,mat('#afd0cc'));
 const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.035,0,0,.035,0,0,0,.18,0],3));grassGeo.computeVertexNormals();geometries.add(grassGeo);
 const grass=new THREE.InstancedMesh(grassGeo,mat('#85b360',{side:THREE.DoubleSide}),200);const dummy=new THREE.Object3D();
 for(let i=0;i<200;i++){const x=((i*7.317)%9.6)-4.8,z=((i*3.941)%19.6)-9.8;dummy.position.set(x,.12,z);dummy.rotation.y=i*2.3;dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);}scene.add(grass);
 const fence=group();
 for(let side of [-1,1]){for(let i=0;i<15;i++){const z=-10+i*1.43;box(fence,side*5.12,.66,z,.13,1.1,.13,M.woodLight);}box(fence,side*5.12,.64,0,.085,.12,20,M.woodLight);box(fence,side*5.12,.98,0,.085,.1,20,M.woodLight);}
 for(let i=0;i<9;i++)box(fence,-5+i*1.25,.66,-10,.13,1.1,.13,M.woodLight);box(fence,0,.65,-10,10.1,.12,.09,M.woodLight);
 for(let side of [-1,1]){box(fence,side*3.2,.65,10,3.9,.12,.09,M.woodLight);for(let i=0;i<4;i++)box(fence,side*(1.3+i*1.22),.66,10,.13,1.1,.13,M.woodLight);}
 const path=group();box(path,0,.125,2.1,1.27,.05,15.7,mat('#c5bba1'));
 for(let i=0;i<26;i++)box(path,(i%2)*.025,.17,-5.25+i*.58,1.04,.06,.43,M.cream);
 for(let z of [-4.25,0,6.2])for(let i=1;i<7;i++)box(path,-3.9+i*.58,.16,z,.43,.05,.64,M.cream);
 for(let z of [-3.7,4.35])for(let i=1;i<7;i++)box(path,.5+i*.58,.16,z,.43,.05,.64,M.cream);
 const house=group(scene,0,.12,-7.6);box(house,0,.13,0,6.2,.25,4.45,M.cream);box(house,0,1.57,0,5.85,2.8,4.05,M.white);
 for(let x of [-2.85,2.85])for(let z of [-1.95,1.95])box(house,x,1.65,z,.16,3.0,.16,M.woodLight);
 box(house,0,.98,2.035,1.06,1.8,.08,M.wood);ball(house,.35,1.05,2.1,.045,.045,.045,M.yellow);
 for(let x of [-1.92,1.92]){box(house,x,1.75,2.08,1.19,1.11,.12,M.woodLight);box(house,x,1.75,2.16,1.02,.94,.03,M.window);box(house,x,1.75,2.2,1.05,.05,.035,M.cream);box(house,x,1.75,2.2,.05,.95,.035,M.cream);}
 const roof=group(house,0,0,0);
 for(let side of [-1,1]){const p=box(roof,side*1.53,3.4,0,3.4,.17,4.7,M.roof);p.rotation.z=-side*.4;for(let j=0;j<10;j++)rod(roof,[side*.05,4.04,-2.2+j*.49],[side*3.05,2.78,-2.2+j*.49],.027,mat('#d48063'));}
 rod(roof,[0,4.08,-2.42],[0,4.08,2.42],.105,M.roof);
 const panels=group(house,1.48,3.69,0);panels.rotation.z=-.4;
 for(let x of [-.66,.66])for(let z of [-.86,.86]){box(panels,x,.12,z,1.22,.12,1.5,M.steel);box(panels,x,.19,z,1.11,.035,1.39,mat('#244a72',{metalness:.42,roughness:.28}));for(let k=0;k<4;k++)box(panels,x-.42+k*.28,.212,z,.014,.012,1.38,mat('#86b3c8'));for(let k=0;k<5;k++)box(panels,x,.212,z-.56+k*.28,1.1,.012,.014,mat('#86b3c8'));}
 const cistern=group(scene,-3.75,.14,-5.05);cyl(cistern,0,.08,0,1.12,.16,M.cream);
 const shell=cyl(cistern,0,1.23,0,1.02,2.3,mat('#a4c7b5'));
 const shellGeo=new THREE.CylinderGeometry(1.02,1.02,2.3,28,1,true,Math.PI/2,Math.PI);geometries.add(shellGeo);const cutShell=mesh(shellGeo,mat('#a4c7b5',{side:THREE.DoubleSide}),cistern,0,1.23,0);cutShell.visible=false;
 const tankWater=cyl(cistern,0,.9,0,.94,1.45,M.water);const surface=cyl(cistern,0,1.63,0,.94,.015,mat('#59c7db',{roughness:.22,transparent:true,opacity:.8}));
 const lid=cyl(cistern,0,2.42,0,1.06,.13,M.navy);cyl(cistern,0,2.52,0,.28,.08,M.steel);
 for(let y of [.36,.89,1.42,1.96]){const g=new THREE.TorusGeometry(1.026,.018,4,32);geometries.add(g);const ring=mesh(g,M.cream,cistern,0,y,0);ring.rotation.x=Math.PI/2;}
 const roofRoute=[[-3.06,2.98,-9.9],[-3.06,2.98,-5.2],[-3.42,2.98,-5.2],[-3.42,1.88,-5.2],[-3.75,1.88,-5.2]];
 pipe(scene,roofRoute,.095,M.navy);const roofFlow=flow(scene,roofRoute,15,'#65d8ff',.3,.052);
 const leafFilter=group(scene,-3.42,2.4,-5.2);cyl(leafFilter,0,0,0,.22,.4,M.cream);cyl(leafFilter,0,.22,0,.24,.06,M.navy);
 pipe(scene,[[-3.42,2.21,-5.2],[-3.13,2.21,-5.2],[-3.13,.38,-5.2]],.075,M.pipe);
 const leafs=[];for(let i=0;i<5;i++){const b=ball(leafFilter,0,0,0,.11,.025,.055,M.woodLight);leafs.push(b);}
 const manifold=group(scene,-2.6,.14,-4.05);box(manifold,0,.17,0,.55,.34,.38,M.navy);cyl(manifold,.32,.24,0,.15,.35,M.steel);box(manifold,-.1,.45,0,.22,.04,.07,M.red);
 const irrigation=[[-3.05,.25,-5.05],[-2.58,.25,-5.05],[-2.58,.25,-4.05],[1.72,.25,-4.05],[1.72,.25,4.3]];
 pipe(scene,irrigation,.055,M.navy);const irrigationFlow=flow(scene,irrigation,18,'#6cdeff',.22,.04);
 const potable=group(scene,-1.45,.16,-5.2);for(let x of [-.23,.23]){box(potable,x,.36,0,.37,.65,.32,M.cream);box(potable,x,.73,0,.16,.1,.13,M.blue);box(potable,x,.5,.17,.18,.21,.02,M.blue);}
 const beds=group(),plants=[],bedBoards=[],bedSoil=[],drippers=[];
 const plantGeos={leaf:new THREE.SphereGeometry(1,7,5)};geometries.add(plantGeos.leaf);
 function vegetable(parent,x,z,kind=0,scale=1){
  const g=group(parent,x,.43,z);cyl(g,0,.17,0,.025,.33,M.green);
  const leaves=[];for(let k=0;k<(kind===1?5:4);k++){const a=k*Math.PI*.5+.4;const l=mesh(plantGeos.leaf,kind===2?mat('#76a64b'):M.leaf,g,Math.cos(a)*.11,.22+Math.sin(k)*.025,Math.sin(a)*.11,.14,.055,.28);l.rotation.z=Math.cos(a)*.55;l.rotation.y=-a;leaves.push(l);}
  if(kind===1)for(let k=0;k<3;k++)ball(g,Math.cos(k*2.1)*.13,.28+Math.sin(k)*.09,Math.sin(k*2.1)*.13,.075,.075,.075,M.red);
  if(kind===2){g.children.slice(1).forEach((l,k)=>{l.scale.set(.035,.35,.045);l.position.y=.25;});}
  g.userData={s:scale,phase:x*2+z,leaves};plants.push(g);return g;
 }
 for(let ix=0;ix<2;ix++)for(let iz=0;iz<2;iz++){
  const x=2.05+ix*1.7,z=-1.95+iz*3.85;const b=group(beds,x,0,z);bedSoil.push(box(b,0,.31,0,1.38,.38,3.05,M.soil));
  for(let side of [-1,1]){bedBoards.push(box(b,side*.73,.35,0,.09,.46,3.2,M.wood));bedBoards.push(box(b,0,.35,side*1.59,1.55,.46,.09,M.wood));}
  for(let r=0;r<5;r++)for(let c=0;c<2;c++)vegetable(b,-.34+c*.68,-1.2+r*.58,(ix+iz)%3,.9+((r+c)%3)*.06);
  for(let side of [-1,1]){pipe(b,[[side*.32,.52,-1.4],[side*.32,.52,1.4]],.018,M.navy);for(let k=0;k<5;k++){const dr=ball(b,side*.32,.4,-1.2+k*.58,.028,.042,.028,M.water);drippers.push(dr);}}
  for(let k=0;k<7;k++){const straw=box(b,-.58+k*.18,.52,-1.38+(k%3)*.2,.23,.015,.015,M.woodLight);straw.rotation.y=k*.6;}
 }
 const composter=group(scene,-3.15,.15,7.65),compostLids=[],compostContents=[];
 for(let j=0;j<2;j++){
  const x=(j-.5)*1.35;box(composter,x,.15,0,1.25,.15,1.6,M.wood);
  for(let k=0;k<5;k++){box(composter,x,.25+k*.19,-.8,1.3,.14,.08,M.wood);for(let side of [-1,1])box(composter,x+side*.64,.25+k*.19,0,.08,.14,1.65,M.wood);}
  for(let k=0;k<4;k++)box(composter,x,.25+k*.19,.8,1.3,.14,.08,M.wood);
  const l=group(composter,x,1.18,-.83);box(l,0,0,.83,1.35,.08,1.7,M.woodLight);compostLids.push(l);
  const content=box(composter,x,.65,0,1.12,.65,1.45,j===0?mat('#7b9260'):M.soil);compostContents.push(content);
  for(let k=0;k<15;k++){const a=k*2.4;const o=ball(composter,x+Math.sin(a)*.43,.99+Math.sin(k*3)*.04,Math.cos(a)*.57,.09,.035,.16,j===0?(k%3?M.leaf:M.orange):M.soil2);o.rotation.y=a;}
 }
 const fallingLeaves=[];for(let i=0;i<9;i++){const o=ball(composter,0,0,0,.12,.025,.08,i%2?M.woodLight:M.leaf);fallingLeaves.push(o);}
 const compostBag=group(scene,-2.5,.2,7.6);box(compostBag,0,.25,0,.48,.5,.37,mat('#c0a477'));box(compostBag,0,.3,.194,.31,.22,.01,M.green);
 const trees=[],fruits=[];
 function tree(x,z,s=1){const tr=group(scene,x,.12,z);cyl(tr,0,1,0,.12,2,M.wood);rod(tr,[0,1.25,0],[.55,2.2,.1],.085,M.wood);rod(tr,[0,1.35,0],[-.45,2.1,-.2],.075,M.wood);
  const canopy=group(tr,0,2.35,0);for(let k=0;k<4;k++){const geo=new THREE.IcosahedronGeometry(.72,1);geometries.add(geo);mesh(geo,k%2?M.green:M.leaf,canopy,Math.cos(k*2.4)*.45,.1+Math.sin(k*2)*.23,Math.sin(k*2.4)*.4,1,1,1);}
  for(let k=0;k<9;k++){const a=k*2.4;fruits.push(ball(canopy,Math.sin(a)*.77,-.35+(k%3)*.21,Math.cos(a)*.73,.1,.1,.1,k%2?M.orange:M.yellow));}tr.scale.setScalar(s);trees.push({tr,canopy,s});return tr;
 }
 tree(-4.2,3.7,.9);tree(-4.15,1.7,.76);tree(4.22,-4.0,.72);
 const flowers=group();const flowerCenters=[];
 for(let i=0;i<10;i++){const x=1.0+(i%2)*.35,z=-3.3+Math.floor(i/2)*1.35;const f=group(flowers,x,.14,z);cyl(f,0,.22,0,.018,.43,M.green);for(let j=0;j<5;j++){const a=j*1.256;ball(f,.08*Math.cos(a),.45,.08*Math.sin(a),.075,.035,.075,mat(i%2?'#ed966e':'#f4d565'));}ball(f,0,.47,0,.045,.035,.045,M.yellow);flowerCenters.push([x,.7,z]);}
 const beeStand=group(scene,4.3,.15,-7.0);for(let x of [-.4,.4])box(beeStand,x,.53,0,.065,1.05,.065,M.wood);box(beeStand,0,1.05,0,1.23,.1,.65,M.woodLight);
 for(let j=0;j<2;j++){const x=-.31+j*.62;for(let k=0;k<3;k++)box(beeStand,x,1.2+k*.2,0,.49,.16,.47,k%2?M.yellow:M.woodLight);ball(beeStand,x,1.42,.245,.055,.055,.025,M.navy);}box(beeStand,0,1.93,0,1.5,.12,.94,M.roof);
 const bees=[];for(let i=0;i<7;i++){const b=group();ball(b,0,0,0,.065,.05,.11,M.yellow);for(let k of [-.035,.035]){const band=cyl(b,0,0,k,.052,.027,M.navy);band.rotation.x=Math.PI/2;}const wings=[];for(let s of [-1,1])wings.push(ball(b,s*.07,.04,-.02,.07,.018,.09,mat('#e3f1e8',{transparent:true,opacity:.7})));bees.push({b,wings,i});}
 const aqua=group(scene,-3.25,.15,-1.2);cyl(aqua,0,.08,0,1.28,.16,M.cream);
 const tankWhole=cyl(aqua,0,.75,0,1.16,1.35,mat('#a5c8c4'));
 const tankGeo=new THREE.CylinderGeometry(1.16,1.16,1.35,30,1,true,Math.PI/2,Math.PI);geometries.add(tankGeo);const tankCut=mesh(tankGeo,mat('#a5c8c4',{side:THREE.DoubleSide}),aqua,0,.75,0);tankCut.visible=false;
 const fishWater=cyl(aqua,0,.7,0,1.08,1.13,M.water);const aquaRimGeo=new THREE.TorusGeometry(1.17,.075,5,32);geometries.add(aquaRimGeo);const aquaRim=mesh(aquaRimGeo,M.cream,aqua,0,1.45,0);aquaRim.rotation.x=Math.PI/2;
 const fish=[];for(let i=0;i<5;i++){const f=group(aqua);ball(f,0,0,0,.17,.11,.085,i%2?M.orange:mat('#c77954'));const tail=cone(f,-.21,0,0,.12,.18,M.orange);tail.rotation.z=Math.PI/2;ball(f,.12,.025,.075,.018,.018,.012,M.navy);fish.push({f,tail,i});}
 const bubbles=[];for(let i=0;i<14;i++)bubbles.push(ball(aqua,0,0,0,.025,.025,.025,mat('#cff4f8',{transparent:true,opacity:.8})));
 pipe(aqua,[[0,.14,0],[0,1.65,0],[-.5,1.65,0]],.04,M.navy);
 const filters=group(scene,-3.6,.15,1.05),filterCaps=[];
 for(let j=0;j<2;j++){const x=-.56+j*1.12;cyl(filters,x,.55,0,.44,1.05,j===0?M.cream:M.blue);filterCaps.push(cyl(filters,x,1.12,0,.46,.08,M.navy));for(let k=0;k<10;k++)ball(filters,x+Math.sin(k*2.4)*.25,.62+Math.cos(k*1.4)*.32,Math.cos(k*2.4)*.25,.09,.09,.09,j===0?M.soil:M.orange);}
 const hydro=group(scene,-2.45,.15,3.35);for(let x of [-.95,.95])for(let z of [-.62,.62])box(hydro,x,.61,z,.09,1.18,.09,M.woodLight);box(hydro,0,1.17,0,2.25,.28,1.6,M.cream);box(hydro,0,1.34,0,2.08,.06,1.42,mat('#93b5b2'));
 for(let x of [-.73,0,.73])for(let z of [-.39,.39]){cyl(hydro,x,1.39,z,.15,.08,M.navy);const p=vegetable(hydro,x,z,0,.9);p.position.y=1.32;}
 const aquaRoute=[[-3.25,.95,-.12],[-3.25,.95,.5],[-4.15,.95,.5],[-4.15,.95,1.05],[-3.04,.95,1.05],[-3.04,1.48,1.65],[-2.45,1.48,2.65],[-2.45,1.48,4.2],[-1.1,1.48,4.2],[-1.1,.3,-1.2],[-2.1,.3,-1.2]];
 pipe(scene,aquaRoute,.065,M.pipe);const aquaFlow=flow(scene,aquaRoute,21,'#8ce2ef',.23,.055);
 const foodJar=group(scene,-1.55,.18,-1.1);cyl(foodJar,0,.34,0,.22,.65,M.yellow);cyl(foodJar,0,.7,0,.24,.08,M.navy);
 const meter=group(scene,-1.6,.2,.0);box(meter,0,.42,0,.38,.65,.2,M.navy);box(meter,0,.53,.12,.27,.23,.015,M.glow);rod(meter,[.08,.15,0],[.16,.02,0],.016,M.steel);
 const coop=group(scene,3.0,.15,7.15);const coopRoof=group(coop,.4,2.25,-.75);
 for(let x of [-.45,1.25])for(let z of [-1.6,.1])box(coop,x,.55,z,.12,1.1,.12,M.wood);
 box(coop,.4,1.25,-.75,1.9,1.55,1.95,M.red);box(coop,.4,.53,-.75,2,.12,2.05,M.woodLight);
 for(let side of [-1,1]){const p=box(coopRoof,side*.55,.12,0,1.22,.12,2.45,M.roof);p.rotation.z=-side*.32;}
 box(coop,.4,1.05,.24,.65,.98,.03,M.darkWood);const ramp=box(coop,.4,.38,1.03,.68,.09,1.75,M.woodLight);ramp.rotation.x=.32;
 for(let k=0;k<6;k++){const r=box(coop,.4,.13+k*.075,1.79-k*.25,.7,.04,.05,M.wood);r.rotation.x=.32;}
 const nest=group(coop,.9,1.0,-.5);box(nest,0,-.06,0,.55,.12,.58,M.woodLight);for(let k=0;k<3;k++)ball(nest,-.13+k*.13,.07,.03,.075,.105,.075,M.cream);
 for(let side of [-1,1]){for(let k=0;k<5;k++)box(coop,side*1.55,.6,-2.0+k*1.0,.08,1.18,.08,M.woodLight);for(let h of [.34,.7,1.05])box(coop,side*1.55,h,0,.022,.025,4.0,M.wire);}
 for(let z of [-2,2]){for(let k=0;k<4;k++)box(coop,-1.55+k*1.03,.6,z,.08,1.18,.08,M.woodLight);for(let h of [.34,.7,1.05])box(coop,0,h,z,3.1,.025,.022,M.wire);}
 const feeder=group(coop,-.92,.04,.28);cyl(feeder,0,.12,0,.25,.18,M.yellow);cyl(feeder,0,.35,0,.16,.48,M.cream);
 const drinker=group(coop,-.9,.04,-.7);cyl(drinker,0,.08,0,.29,.12,M.blue);cyl(drinker,0,.34,0,.18,.48,M.cream);
 const chickens=[];
 function chicken(parent,i){const g=group(parent);ball(g,0,.35,0,.24,.23,.32,i%2?M.cream:mat('#c69255'));const neck=group(g,0,.45,.2);ball(neck,0,.13,.03,.12,.17,.12,M.cream);ball(neck,0,.31,.07,.055,.07,.05,M.red);const beak=cone(neck,0,.12,.19,.055,.14,M.yellow);beak.rotation.x=Math.PI/2;for(let s of [-1,1])ball(neck,s*.105,.18,.08,.018,.018,.018,M.navy);const tail=cone(g,0,.49,-.3,.16,.34,M.cream);tail.rotation.x=-.7;const legs=[];for(let s of [-1,1]){const l=group(g,s*.09,.18,0);rod(l,[0,0,0],[0,-.16,.03],.018,M.yellow);rod(l,[0,-.16,.03],[0,-.16,.12],.015,M.yellow);legs.push(l);}return {g,neck,legs,i};}
 for(let i=0;i<3;i++)chickens.push(chicken(coop,i));
 const annex=group(scene,-17,.1,4);box(annex,0,-.08,0,7,.16,6,M.grass);for(let side of [-1,1]){box(annex,side*3.4,.55,0,.07,.08,6,M.woodLight);box(annex,0,.55,side*2.9,6.8,.08,.07,M.woodLight);}box(annex,0,1.1,-2.1,3.4,2.1,1.5,M.cream);box(annex,0,2.18,-2.1,4,.17,2.0,M.roof);
 function goat(x,z){const g=group(annex,x,.12,z);ball(g,0,.77,0,.33,.37,.62,M.cream);for(let a of [-1,1])for(let b of [-1,1]){rod(g,[a*.22,.74,b*.4],[a*.22,.05,b*.4],.055,M.darkWood);}const head=group(g,0,1.1,.48);ball(head,0,.08,.1,.19,.24,.27,M.cream);for(let s of [-1,1]){rod(head,[s*.1,.27,.04],[s*.12,.46,-.08],.03,M.wood);ball(head,s*.22,.1,.02,.13,.045,.07,M.woodLight);}return g;}
 goat(-1.5,.0);goat(-.5,1.0);
 for(let i=0;i<2;i++){const g=group(annex,1.2+i*.7,.16,.5-i*.8);ball(g,0,.5,0,.38,.35,.58,mat('#dbab96'));ball(g,0,.48,.55,.24,.22,.25,mat('#e7baa5'));for(let s of [-1,1]){cone(g,s*.17,.78,.5,.1,.2,mat('#dbab96'));for(let z of [-.32,.32])cyl(g,s*.25,.19,z,.07,.37,mat('#dbab96'));}}
 const electric=group(scene,-1.8,.15,-5.26);box(electric,0,.75,0,1.12,1.5,.35,M.cream);box(electric,0,1.12,.2,.86,.48,.07,M.navy);box(electric,0,1.18,.25,.48,.21,.02,M.glow);
 const batteryBars=[];for(let i=0;i<3;i++){box(electric,-.3+i*.3,.48,.22,.23,.58,.04,M.navy);batteryBars.push(box(electric,-.3+i*.3,.48,.25,.16,.47,.025,M.glow));}
 const powerRoute=[[1.5,4.0,-7.6],[2.95,3.25,-7.6],[2.95,2.5,-5.46],[-1.8,2.5,-5.46],[-1.8,1.3,-5.26]];
 pipe(scene,powerRoute,.025,M.navy);const powerFlow=flow(scene,powerRoute,13,'#f6d876',.28,.04);
 const backupRoute=[[-1.8,.3,-5.26],[-1.2,.3,-5.26],[-1.2,.3,-1.2],[-3.25,.3,-1.2],[-3.25,1.8,-1.2]];
 pipe(scene,backupRoute,.028,M.navy);const backupFlow=flow(scene,backupRoute,14,'#f6d876',.3,.04);
 const porchLight=ball(house,0,2.25,2.13,.12,.08,.08,mat('#fbe7b0',{emissive:'#ffb65f',emissiveIntensity:1.4}));
 const grid=group(scene,6.7,.13,-6.0);cyl(grid,0,2.1,0,.09,4.2,M.wood);box(grid,0,4.12,0,1.2,.1,.1,M.wood);pipe(scene,[[6.1,4.15,-6],[6.1,4.15,-8],[3.0,3.1,-8]],.014,M.navy);
 const gridLamp=ball(grid,0,3.55,.15,.12,.12,.12,M.glow);
 const rainGeo=new THREE.CylinderGeometry(.012,.025,.22,4);geometries.add(rainGeo);const rain=new THREE.InstancedMesh(rainGeo,mat('#74c2df',{transparent:true,opacity:.72}),120);scene.add(rain);
 const hud=new THREE.Scene(),hudCamera=new THREE.OrthographicCamera(0,width,height,0,-10,10);hudCamera.position.z=2;
 function textSprite(text,{font=36,color='#fff9e9',bg='#243f43',w=620,h=100,small='',accent='#f5cf6b'}={}){
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=bg;x.beginPath();x.roundRect(0,0,w,h,24);x.fill();
  if(small){x.font='bold 17px Arial';x.fillStyle=accent;x.textAlign='center';x.fillText(small,w/2,28);}
  x.font='bold '+font+'px Arial';x.textAlign='center';x.textBaseline='middle';x.fillStyle=color;const max=w-40;let size=font;while(x.measureText(text).width>max&&size>18){size--;x.font='bold '+size+'px Arial';}x.fillText(text,w/2,small?h*.64:h*.51);
  const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;textures.add(tx);const material=new THREE.SpriteMaterial({map:tx,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});materials.set('sprite-'+textures.size,material);const sp=new THREE.Sprite(material);return {sp,w,h};
 }
 const screens=[];
 const chapters=[
  ['SEU QUINTAL PODE AJUDAR','Água, alimentos e energia','QUINTAL VIVO'],
  ['UM MAPA QUE FAZ SENTIDO','Sol e drenagem orientam o projeto','01  •  PLANEJAR'],
  ['APROVEITAR A CHUVA','Telhado → calhas → cisterna','02  •  ÁGUA'],
  ['CADA ÁGUA TEM SEU USO','Rede potável separada','02  •  ÁGUA'],
  ['PLANTAR EM ETAPAS','Colheitas ao longo do tempo','03  •  HORTA'],
  ['RESÍDUOS VIRAM RECURSO','Misturar, cuidar e deixar maturar','04  •  COMPOSTAGEM'],
  ['FRUTAS E POLINIZADORES','Espécies adequadas à sua região','05  •  BIODIVERSIDADE'],
  ['PEIXES + PLANTAS','Filtrar → cultivar → recircular','06  •  AQUAPONIA OPCIONAL'],
  ['EQUILÍBRIO EXIGE CUIDADO','Ração, água, oxigênio e energia','06  •  AQUAPONIA'],
  ['UM GALINHEIRO BEM CUIDADO','Abrigo, água e alimentação','07  •  CRIAÇÃO OPCIONAL'],
  ['MAIS ANIMAIS, OUTRA ÁREA','Instalações e manejo próprios','AMPLIAÇÃO SEPARADA'],
  ['SOLAR COM BACKUP','Inversor + baterias + proteções','08  •  ENERGIA'],
  ['O ESSENCIAL NO APAGÃO','Armazenamento e consumo têm limites','08  •  ENERGIA'],
  ['OS SISTEMAS SE CONECTAM','Autonomia cresce com manutenção','QUINTAL VIVO'],
  ['COMECE PELO BÁSICO','Água • canteiros • compostagem','UMA ETAPA DE CADA VEZ'],
  ['QUER VER CADA ETAPA?','COMENTE  QUINTAL','CONTINUE ESSA CONSTRUÇÃO']
 ];
 for(const [title,sub,kicker] of chapters){const top=textSprite(title,{w:640,h:112,font:32,small:kicker});top.sp.position.set(width/2,height-height*.105,0);top.sp.scale.set(width*.87,width*.87*112/640,1);hud.add(top.sp);
  const bot=textSprite(sub,{w:640,h:78,font:29,bg:'#fff3d9',color:'#254c45'});bot.sp.position.set(width/2,height*.214,0);bot.sp.scale.set(width*.84,width*.84*78/640,1);hud.add(bot.sp);screens.push([top.sp,bot.sp]);}
 const worldTags=[];
 function tag(text,p,pos,w=2.7,color='#254c45'){const q=textSprite(text,{w:480,h:92,font:29,bg:color});q.sp.scale.set(w,w*92/480,1);q.sp.position.set(...pos);p.add(q.sp);worldTags.push(q.sp);return q.sp;}
 const tags={cistern:tag('ÁGUA DE CHUVA',scene,[-3.75,2.95,-5.05],2.9),potable:tag('ÁGUA POTÁVEL',scene,[-1.45,1.45,-5.2],2.1),nonpotable:tag('NÃO POTÁVEL',scene,[-3.75,2.98,-5.05],2.5),filter:tag('FILTRO DE FOLHAS',scene,[-3.42,3.33,-5.2],2.8),drip:tag('GOTEJAMENTO',scene,[2.7,1.3,1.9],2.5),mature:tag('COMPOSTO MADURO',scene,[-2.5,2.12,7.65],3.0),bee:tag('ABELHAS NATIVAS',scene,[4.3,2.5,-7.0],2.5),solids:tag('RETÉM OS SÓLIDOS',scene,[-4.16,1.9,1.05],2.7),bio:tag('BIOFILTRO',scene,[-3.04,1.9,1.05],2.2),hydro:tag('NUTRIENTES PARA AS PLANTAS',scene,[-2.45,2.4,3.35],3.6),aero:tag('AERAÇÃO CONTÍNUA',scene,[-3.25,2.0,-1.2],3.0),solar:tag('ENERGIA SOLAR',scene,[1.4,5.3,-7.6],3.0),backup:tag('BACKUP DIMENSIONADO',scene,[-1.8,2.5,-5.0],3.7)};
 const footprints=[];for(const [x,z,sx,sz] of [[-3.65,-5.05,2.5,2.8],[2.9,0,3.6,7.8],[-3.15,7.65,3.0,2.2]]){const p=box(scene,x,.14,z,sx,.025,sz,mat('#f3d178',{transparent:true,opacity:.3}));footprints.push(p);}
 function cam(target,direction,viewHeight){const t=V(...target);camera.position.copy(t).add(V(...direction));camera.lookAt(t);const hh=viewHeight/2,hw=hh*width/height;camera.left=-hw;camera.right=hw;camera.top=hh;camera.bottom=-hh;camera.updateProjectionMatrix();}
 const shots=[
  [0,[0,1,-.8],[3,24,28],28],[5,[0,1.2,-.5],[2,26,28],26],
  [11,[0,.4,0],[0,35,12],25.5],[21,[0,.4,0],[3,34,13],25.0],
  [27.56,[-2,2.1,-6.7],[-7,8,10],9.4],[34.2,[-3.38,2.05,-5.15],[-4,4.2,7],5.3],
  [40.6,[-3.75,1.35,-5.05],[3.8,3.3,7],5.5],[45.0,[-3.0,1.2,-5.0],[5,6.4,9],7.6],
  [51,[-2.6,1.2,-5.05],[1,4.8,8],6.6],[58.0,[2.6,.5,.35],[-1.5,6,7],7.6],
  [64.91,[2.85,.55,0],[3,9,10],11.6],[72,[2.5,.65,-1.85],[3.7,4.8,6],6.1],
  [78.3,[2.7,.6,1.9],[2,3.8,5.6],5.4],[84.2,[2.7,.5,0],[1,10,7],10.8],
  [91.45,[-3.15,.85,7.65],[-4,4.8,7],6.5],[100.7,[-2.55,.85,7.65],[3,4.5,6],5.7],
  [106.3,[2.1,.5,1.9],[3,6,7],6.0],[110.37,[-4.12,1.7,3.6],[5,4.8,7],6.6],
  [118.1,[4.3,1.4,-6.8],[4,3.1,6],4.8],[126.49,[-2.95,.8,.8],[4,10,11],10.4],
  [132.1,[-4.16,.85,1.05],[3,4,5],4.6],[136.2,[-3.04,.85,1.05],[4,4.1,6],4.5],
  [142.15,[-2.45,1.45,3.35],[4,5,7],5.9],[145.0,[-3.0,.83,-1.15],[3.5,3.7,6],5.7],
  [152.8,[-2.8,.9,-.7],[4,4.5,7],6.9],[156.67,[3.0,.9,7.15],[5.5,6.8,10],8.1],
  [163.0,[2.3,.65,7.5],[3,3.5,6],4.8],[169.0,[3.85,1.18,6.65],[2.5,3.2,5],3.7],
  [172.2,[-17,1,4],[7,10,13],11.5],[176.29,[1.45,3.8,-7.6],[3.8,7,8],7.4],
  [182.5,[-1.8,.9,-5.1],[3.2,3.6,6],4.5],[188.0,[-1.6,1.0,-3.5],[5,8,11],9.7],
  [193.0,[-3.05,1.0,-1.2],[4,4.7,7],6.0],[198.4,[0,.7,.4],[2,25,25],26],
  [213.0,[0,.4,.2],[1,33,17],25.5],[226.8,[0,.6,.2],[3,24,25],27]
 ];
 const revealGroups=[cistern,beds,composter,hydro,aqua,filters,coop,beeStand,panels,potable,electric,flowers];
 function chapter(t){if(t<11)return 0;if(t<27.56)return 1;if(t<45)return 2;if(t<64.91)return 3;if(t<91.45)return 4;if(t<110.37)return 5;if(t<126.49)return 6;if(t<145)return 7;if(t<156.67)return 8;if(t<172.2)return 9;if(t<176.29)return 10;if(t<188)return 11;if(t<198.4)return 12;if(t<213)return 13;if(t<226.8)return 14;return 15;}
 function renderAt(local){
  const t=Math.min(231.8,OFFSET+local),ch=chapter(t);screens.forEach((pair,i)=>pair.forEach(o=>{o.visible=i===ch;}));worldTags.forEach(o=>{o.visible=false;});
  const nth=shots.findLastIndex(s=>s[0]<=t),s=shots[Math.max(0,nth)],next=shots[Math.min(shots.length-1,nth+1)];const u=clamp((t-s[0])/Math.max(1,next[0]-s[0]));
  const drift=Math.sin(u*Math.PI)*.18;const target=[s[1][0]+drift*.5,s[1][1],s[1][2]-drift*.35];cam(target,[s[2][0]+u*.32,s[2][1],s[2][2]-u*.23],s[3]*(1-u*.025));
  const night=phase(t,187.8,190.3)*(1-phase(t,198.4,201));hemi.intensity=2.35-night*1.68;sun.intensity=3.1-night*2.48;fill.intensity=.75+night*.2;scene.background.set('#bce0ed').lerp(new THREE.Color('#244451'),night*.86);gridLamp.visible=night<.4;porchLight.scale.setScalar(1+night*.2);
  revealGroups.forEach((g,i)=>{const k=phase(t,3+i*.32,4.2+i*.32);g.visible=k>.001;g.scale.setScalar(k);});
  // Root scales are rebuilt from absolute t, including backwards seeks.
  trees.forEach(({tr,canopy,s},i)=>{const k=phase(t,4.2+i*.38,5.3+i*.38);tr.visible=k>.001;tr.scale.setScalar(s*k);canopy.rotation.z=Math.sin(t*.65+i)*.012;});
  plants.forEach((p,i)=>{let k=1;if(t<9)k=phase(t,4+(i%10)*.14,5.7+(i%10)*.14);if(t>=70&&t<78)k=.25+.75*phase(t,70+(i%5)*.14,73.3+(i%5)*.14);if(t>=84.2&&t<91.45)k=.35+((i%3)/3)*.65;const s=p.userData.s*k;p.scale.set(s,s,s);p.rotation.z=Math.sin(t*.9+p.userData.phase)*.022;});
  const tankOpen=t>=40.6&&t<45;shell.visible=!tankOpen;cutShell.visible=tankOpen;lid.position.y=2.42+(tankOpen?.6:0);
  const level=tankOpen?.65+.75*phase(t,40.7,43.9):1.45;tankWater.scale.y=level;tankWater.position.y=.18+level/2;surface.position.y=.18+level;
  const aquaOpen=t>=126.49&&t<156.67;tankWhole.visible=!aquaOpen;tankCut.visible=aquaOpen;fishWater.material.opacity=aquaOpen?.34:.73;
  filterCaps.forEach((o,i)=>{o.position.y=1.12+(t>=132.1&&t<142.15?.7:0);});
  compostLids.forEach((o,i)=>{o.rotation.x=(t>=91.45&&t<106.3)?-1.7:0;});
  fallingLeaves.forEach((o,i)=>{const active=t>=94&&t<100.7;o.visible=active;const a=((t*.47+i*.117)%1);o.position.set(-.65+Math.sin(i*2.4)*.35,1.03+(1-a)*1.5,Math.cos(i*2.4)*.5);o.rotation.set(a*4,i+a*3,a*2);});
  if(t>=104.5&&t<110.37){const a=phase(t,104.5,109.1);compostBag.position.set(-2.5+4.6*a,.2+Math.sin(a*Math.PI)*1.2,7.6-5.7*a);}else compostBag.position.set(-2.5,.2,7.6);
  bees.forEach(({b,wings,i})=>{const a=t*.65+i*.87,buzz=Math.sin(t*8+i)*.06;b.position.set(2.9+Math.sin(a)*1.3,1.9+Math.sin(a*1.4)*.55+buzz,-5.9+Math.cos(a)*1.1);b.rotation.y=a+Math.PI/2;wings.forEach((w,k)=>{w.rotation.z=(k?1:-1)*Math.sin(t*40+i)*.7;});b.visible=t>6;});
  fish.forEach(({f,tail,i})=>{const a=t*(.35+i*.025)+i*1.3;f.position.set(Math.cos(a)*.65,.7+Math.sin(a*1.8+i)*.18,Math.sin(a)*.65);f.rotation.y=-a-Math.PI/2;tail.rotation.y=Math.sin(t*6+i)*.28;});
  bubbles.forEach((b,i)=>{const a=(t*.55+i/14)%1;b.position.set(Math.sin(i*2.3)*.12,.2+a*1.12,Math.cos(i*2.3)*.13);b.scale.setScalar(.015+.028*a);});
  chickens.forEach(({g,neck,legs,i})=>{const a=t*.3+i*2.1,walk=(Math.sin(t*.37+i)>.1),dist=walk?t*.4:Math.floor(t*.2)*2;g.position.set(-.63+Math.sin(a)*.48,.12,1.1+Math.cos(a)*.5);g.rotation.y=-a+.6;neck.rotation.x=walk?Math.sin(t*3+i)*.08:.35+.38*Math.sin(t*4+i);legs.forEach((l,k)=>{l.rotation.x=walk?Math.sin(dist*9+k*Math.PI)*.35:0;});});
  coopRoof.position.y=2.25+((t>=169&&t<172.2)?1.1:0);
  drippers.forEach((d,i)=>{const a=(t*1.4+i*.13)%1;d.position.y=.49-a*.14;d.visible=t>=58&&t<91.45;});
  for(let i=0;i<120;i++){const x=-2.85+((i*1.873)%5.7),z=-9.6+((i*2.347)%4.1),y=3+((1-(t*1.2+i*.213)%1)*4.2);dummy.position.set(x,y,z);dummy.rotation.set(0,0,-.14);dummy.scale.set(1,1,1);dummy.updateMatrix();rain.setMatrixAt(i,dummy.matrix);}rain.instanceMatrix.needsUpdate=true;rain.visible=t>=27.56&&t<40.6;
  leafs.forEach((l,i)=>{l.position.set(Math.sin(i*2)*.12,.22+((1-(t*.65+i*.16)%1)*.35),Math.cos(i*2)*.11);l.visible=t>=34.2&&t<40.6;});
  roofFlow.active=t>=27.56&&t<64.91;irrigationFlow.active=(t>=58&&t<91.45)||(t>=198.4&&t<213);aquaFlow.active=t>126.49;powerFlow.active=t>176.29&&night<.4;backupFlow.active=t>182.5;
  allFlows.forEach(f=>placeFlow(f,t));
  batteryBars.forEach((b,i)=>{const charge=1-night*(.19+i*.06);b.scale.y=.47*charge;b.position.y=.245+.235*charge;});
  Object.assign(tags.cistern,{visible:t>=40.6&&t<51});tags.filter.visible=t>=34.2&&t<40.6;tags.potable.visible=t>=51&&t<58;tags.nonpotable.visible=t>=51&&t<58;tags.drip.visible=t>=78.3&&t<84.2;tags.mature.visible=t>=100.7&&t<106.3;tags.bee.visible=t>=118.1&&t<126.49;tags.solids.visible=t>=132.1&&t<136.2;tags.bio.visible=t>=136.2&&t<142.15;tags.hydro.visible=t>=142.15&&t<145;tags.aero.visible=t>=145&&t<152.8;tags.solar.visible=t>=176.29&&t<182.5;tags.backup.visible=t>=182.5&&t<188;
  footprints.forEach((p,i)=>{p.visible=t>=213&&t<226.8&&Math.floor((t-213)/4.5)===i;});
  renderer.autoClear=true;renderer.render(scene,camera);renderer.autoClear=false;renderer.clearDepth();renderer.render(hud,hudCamera);
 }
 renderAt(0);
 return {duration:DURATION,renderAt,dispose(){scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();for(const tx of textures)tx.dispose();renderer.dispose();}};
}
