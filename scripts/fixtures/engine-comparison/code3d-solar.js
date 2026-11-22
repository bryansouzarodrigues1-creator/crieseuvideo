// Hand-authored renderer study. Explicit import, NOT a Gemini response.
function createScene(THREE, canvas, width, height) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#a7d9e9');
  scene.fog=new THREE.Fog('#bde0e5',35,70);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(width,height,false);renderer.setPixelRatio(1);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const camera=new THREE.PerspectiveCamera(36,width/height,.1,100);
  scene.add(new THREE.HemisphereLight('#edfcff','#71867b',2.4));
  const sun=new THREE.DirectionalLight('#ffedcb',3.1);sun.position.set(-6,11,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;sun.shadow.normalBias=.05;scene.add(sun);
  const rim=new THREE.DirectionalLight('#b8dfff',1.2);rim.position.set(5,4,-6);scene.add(rim);
  const materials={};
  const mat=(color,metal=0)=>{const key=color+metal;return materials[key]||(materials[key]=new THREE.MeshStandardMaterial({color,roughness:metal?.3:.78,metalness:metal}));};
  function box(w,h,d,color,x,y,z,parent=scene,metal=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,metal));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function ball(r,color,x,y,z,parent=scene){const m=new THREE.Mesh(new THREE.SphereGeometry(r,18,12),mat(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
  const ground=box(70,.15,70,'#8ebc91',0,-.11,0);
  box(6.7,.035,4.6,'#c7d7bf',0,-.015,-.3);
  for(let i=0;i<5;i++)box(.47,.025,.38,'#e9dec7',.56,.02,.7-i*.5);
  const house=new THREE.Group();house.position.set(1.25,0,-1.75);scene.add(house);
  box(2.3,2.1,1.8,'#f0dfc3',0,1.05,0,house);
  const tri=new THREE.Shape();tri.moveTo(-1.4,0);tri.lineTo(1.4,0);tri.lineTo(0,.95);tri.closePath();
  const rg=new THREE.ExtrudeGeometry(tri,{depth:2.15,bevelEnabled:false});rg.translate(0,0,-1.075);
  const roof=new THREE.Mesh(rg,mat('#af5d45'));roof.position.y=2.1;roof.castShadow=true;house.add(roof);
  for(let i=-4;i<=4;i++)box(.035,.035,2.22,'#c47755',i*.28,2.1+.95*(1-Math.abs(i*.28)/1.4)+.015,0,house);
  box(.58,1.28,.06,'#73513f',.56,.64,.94,house);ball(.035,'#e8bd67',.74,.65,.99,house);
  box(.94,.87,.10,'#fff4dc',-.52,1.35,.95,house);
  const windowMaterial=new THREE.MeshStandardMaterial({color:'#233e58',roughness:.3,emissive:'#ffd269',emissiveIntensity:0});
  const windowPane=new THREE.Mesh(new THREE.BoxGeometry(.74,.65,.025),windowMaterial);windowPane.position.set(-.52,1.35,1.015);house.add(windowPane);
  box(.045,.71,.04,'#f3e7d1',-.52,1.35,1.05,house);box(.80,.045,.04,'#f3e7d1',-.52,1.35,1.05,house);
  const warmLight=new THREE.PointLight('#ffcb70',0,3.6);warmLight.position.set(-.52,1.35,1.35);house.add(warmLight);
  const panel=new THREE.Group();panel.position.set(-1.13,0,.42);panel.rotation.y=.10;scene.add(panel);
  box(.12,.8,.14,'#91a9af',-.80,.4,-.25,panel,.55);box(.12,.8,.14,'#91a9af',.80,.4,-.25,panel,.55);
  const plate=new THREE.Group();plate.position.y=.95;plate.rotation.x=-.32;panel.add(plate);
  box(2.18,1.48,.12,'#c4d4df',0,0,0,plate,.65);
  const cells=[];
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){
    const g=new THREE.Group(),x=(col-1)*.65,y=(row-.5)*.66;plate.add(g);
    box(.60,.60,.035,'#1b4688',0,0,0,g,.12);
    for(let j=-2;j<=2;j++)box(.004,.56,.004,'#77a8d5',j*.105,0,.022,g,.35);
    box(.56,.009,.005,'#aec5df',0,0,.024,g,.4);
    cells.push({g,x,y,index:cells.length});
  }
  const glass=new THREE.Mesh(new THREE.BoxGeometry(1.99,1.31,.016),new THREE.MeshPhysicalMaterial({color:'#a2deed',transparent:true,opacity:.19,roughness:.08,metalness:.05,depthWrite:false}));plate.add(glass);
  // One restrained reflection strip; no growing/stretching of rigid parts.
  const sheen=box(.028,1.29,.004,'#bce5ed',.56,0,.153,plate);sheen.rotation.z=-.1;
  const battery=new THREE.Group();battery.position.set(.15,0,1.18);scene.add(battery);
  box(.62,.76,.45,'#398c79',0,.38,0,battery);box(.68,.10,.49,'#263d4c',0,.78,0,battery);
  box(.26,.28,.012,'#d1e4d5',0,.43,.235,battery);box(.036,.13,.016,'#398c79',0,.43,.248,battery);box(.13,.036,.017,'#398c79',0,.43,.249,battery);
  const plug=box(.17,.11,.15,'#edb04c',-.8,.9,1.18);
  const path=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.1,.66,.6),new THREE.Vector3(-.65,.12,1.2),new THREE.Vector3(.15,.15,1.5),new THREE.Vector3(.55,.25,.45),new THREE.Vector3(.75,1.1,-.73)]);
  const wire=new THREE.Mesh(new THREE.TubeGeometry(path,64,.025,8,false),mat('#37404b'));scene.add(wire);
  const energy=[];for(let i=0;i<5;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.048,12,8),new THREE.MeshBasicMaterial({color:'#ffe188'}));scene.add(m);energy.push(m);}
  // Mesh character with elbow groups; no pretend gripping of the moving panel.
  const worker=new THREE.Group();worker.position.set(-2.72,0,-.45);scene.add(worker);
  box(.46,.68,.30,'#df8e47',0,1.10,0,worker);ball(.25,'#bc8668',0,1.72,0,worker);ball(.254,'#49352d',0,1.83,-.05,worker);
  for(const side of [-1,1]){box(.15,.60,.19,'#293e55',side*.13,.42,0,worker);box(.19,.10,.29,'#f1e9d6',side*.13,.075,.05,worker);ball(.023,'#182633',side*.082,1.75,.23,worker);}
  const arm=new THREE.Group();arm.position.set(.28,1.34,0);worker.add(arm);box(.13,.33,.15,'#df8e47',0,-.16,0,arm);
  const elbow=new THREE.Group();elbow.position.y=-.32;arm.add(elbow);box(.11,.30,.13,'#bc8668',0,-.14,0,elbow);ball(.075,'#bc8668',0,-.30,0,elbow);
  box(.13,.5,.15,'#df8e47',-.30,1.03,0,worker);ball(.075,'#bc8668',-.30,.75,0,worker);
  const trees=[];for(const [x,z,s] of [[-4,-5,1],[4,-6,1.2],[-6,-8,1.5],[6,-9,1.5]]){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);box(.20,1.4,.20,'#8c7354',0,.7,0,g);ball(.73,'#629a76',0,1.8,0,g);ball(.5,'#7bad80',.4,2,0,g);trees.push(g);}
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const wide=new THREE.Vector3(5.8,5.1,17.0),wideLook=new THREE.Vector3(-.1,1.4,-.5);
  const closeStart=new THREE.Vector3(-.35,3.45,8.2),closeEnd=new THREE.Vector3(-.70,2.5,5.7);
  const closeLookStart=new THREE.Vector3(-1.13,2.15,.42),closeLookEnd=new THREE.Vector3(-1.13,1.10,.42);
  return {duration:12,renderAt(t){
    const blend=ease((t-3.75)/.55)*(1-ease((t-7.7)/.6)),assemblyFit=ease((t-6.65)/.95);
    const close=closeStart.clone().lerp(closeEnd,assemblyFit),closeLook=closeLookStart.clone().lerp(closeLookEnd,assemblyFit);
    camera.position.copy(wide).lerp(close,blend);camera.lookAt(wideLook.clone().lerp(closeLook,blend));
    for(const c of cells){const p=ease((t-4.3-c.index*.33)/.62);c.g.position.set(c.x+(1-p)*(.35*(c.index%2?1:-1)),c.y+(1-p)*2.5,.085+(1-p)*.18);c.g.rotation.z=(1-p)*.12*(c.index%2?1:-1);}
    const gp=ease((t-6.65)/.92);glass.position.set(0,(1-gp)*3.6,.12+(1-gp)*.22);sheen.visible=gp>.98;
    const connect=ease((t-8.15)/.70);plug.position.set(-.8+connect*1.10,.90,1.18);
    for(let i=0;i<energy.length;i++){const a=8.85+i*.18,p=(t-a)/1.5;energy[i].visible=p>=0&&p<=1;if(p>=0&&p<=1)energy[i].position.copy(path.getPoint(p));else energy[i].position.copy(path.getPoint(0));}
    const light=ease((t-10.0)/.35);windowMaterial.color.set(light>.1?'#ffdd8c':'#233e58');windowMaterial.emissiveIntensity=light*1.25;warmLight.intensity=light*2;
    arm.rotation.z=.20+.95*ease((t-1)/.5)-.55*ease((t-8.7)/.5);arm.rotation.x=-.15;elbow.rotation.z=-.25-.30*ease((t-1.2)/.6);
    worker.rotation.y=.18+.12*Math.sin(t*.7);worker.position.y=0;
    renderer.render(scene,camera);
  },dispose(){scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();}};
}
