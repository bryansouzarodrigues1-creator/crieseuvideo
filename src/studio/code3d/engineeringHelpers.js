/** Trusted, reusable Engineering 3D helpers adapted from Casa Forno V4.
 * No renderer ownership, timers, network, or story-specific geometry.
 * Imported only inside the existing opaque-origin Code3D sandbox. */
export function createEngineeringHelpers(THREE){
 const V=(x,y,z)=>new THREE.Vector3(x,y,z),clamp=v=>Math.min(1,Math.max(0,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v)},phase=(t,a,b)=>smooth((t-a)/(b-a)),mix=(a,b,t)=>a+(b-a)*t;
 function ArchitectureBuilder(root){
  const mats=new Map();const mat=(color,roughness=.8)=>{let k=color+':'+roughness;if(!mats.has(k))mats.set(k,new THREE.MeshStandardMaterial({color,roughness}));return mats.get(k)};
  function mesh(parent,geo,m,x=0,y=0,z=0){const o=new THREE.Mesh(geo,typeof m==='number'?mat(m):m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function box(p,x,y,z,w,h,d,m){return mesh(p,new THREE.BoxGeometry(w,h,d),m,x,y,z)}
  function group(p,x=0,y=0,z=0){let g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g}
  function cyl(p,x,y,z,r1,r2,h,m,n=16){return mesh(p,new THREE.CylinderGeometry(r1,r2,h,n),m,x,y,z)}
  function ball(p,x,y,z,r,m){return mesh(p,new THREE.IcosahedronGeometry(r,1),m,x,y,z)}
  function line(p,a,b,r,m){const d=b.clone().sub(a);const o=cyl(p,0,0,0,r,r,d.length(),m,8);o.position.copy(a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o}
  function textureMat(color,kind,rng){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),img=c.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){let v=kind==='wood'?225+10*Math.sin(y*.66+2*Math.sin(x*.045))+(rng()-.5)*18:kind==='grass'?222+11*Math.sin(x*.14)*Math.sin(y*.13)+(rng()-.5)*26:240+(rng()-.5)*18;const i=(y*128+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=255;}c.putImageData(img,0,0);const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(kind==='wood'?2:3,kind==='wood'?1:3);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return new THREE.MeshStandardMaterial({color,map:tex,roughness:.86});}
  return {root,mat,mesh,box,group,cyl,ball,line,textureMat};
 }
 function CutawaySystem(group,offset){const initial=group.position.clone(),items=[];group.traverse(o=>{if(o.isMesh){o.material=o.material.clone();items.push([o,o.material,o.material.opacity]);}});return p=>{p=clamp(p);group.position.copy(initial).addScaledVector(offset,p);group.visible=p<.999;for(const [o,m,alpha] of items){m.opacity=alpha*(1-p);m.transparent=p>.001||alpha<1;m.depthWrite=p<.001;o.castShadow=p<.15;}};}
 function FlowVisualizer(parent,points,color,count=26,r=.065){const curve=new THREE.CatmullRomCurve3(points),g=new THREE.SphereGeometry(r,10,8),m=new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false}),mesh=new THREE.InstancedMesh(g,m,count);mesh.frustumCulled=false;parent.add(mesh);const arrows=new THREE.InstancedMesh(new THREE.ConeGeometry(r*1.65,r*4,10),m,Math.max(2,Math.floor(count/6)));arrows.frustumCulled=false;parent.add(arrows);const trace=new THREE.Mesh(new THREE.TubeGeometry(curve,48,r*.55,6,false),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false}));parent.add(trace);const dummy=new THREE.Object3D(),up=V(0,1,0);return(t,strength=1,speed=.22)=>{strength=clamp(strength);mesh.visible=arrows.visible=trace.visible=strength>.005;m.opacity=strength;trace.material.opacity=strength*.18;for(const [inst,isArrow] of [[mesh,false],[arrows,true]]){for(let i=0;i<inst.count;i++){let u=((i/inst.count+t*speed+(isArrow?.07:0))%1+1)%1;dummy.position.copy(curve.getPointAt(u));if(isArrow)dummy.quaternion.setFromUnitVectors(up,curve.getTangentAt(u).normalize());else dummy.quaternion.identity();let s=smooth(Math.min(u,1-u)/.075)*(.75+.25*Math.sin(Math.PI*u))*Math.max(.001,strength);dummy.scale.setScalar(s);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);}inst.instanceMatrix.needsUpdate=true;}};}
 function AtmosphereController(scene){const hemi=new THREE.HemisphereLight(0xe3f6ff,0x9f8869,1.02),sun=new THREE.DirectionalLight(0xffe7b7,2.25),fill=new THREE.DirectionalLight(0xa8d6ff,.35);scene.add(hemi,sun,fill);fill.position.set(9,10,-12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.5,far:55});sun.shadow.bias=-.0003;sun.shadow.normalBias=.018;const day=new THREE.Color(0xc2dfed),night=new THREE.Color(0x263b63),warm=new THREE.Color(0xffe7b7),cool=new THREE.Color(0xa5c9ff),topDay=new THREE.Color(0x7eb8d1),topNight=new THREE.Color(0x172742);const canvas=document.createElement('canvas');canvas.width=8;canvas.height=256;const c=canvas.getContext('2d'),bg=new THREE.CanvasTexture(canvas);bg.colorSpace=THREE.SRGBColorSpace;const previous=scene.background;scene.background=bg;const update=p=>{const grad=c.createLinearGradient(0,0,0,256);grad.addColorStop(0,'#'+topDay.clone().lerp(topNight,p).getHexString());grad.addColorStop(1,'#'+day.clone().lerp(night,p).getHexString());c.fillStyle=grad;c.fillRect(0,0,8,256);bg.needsUpdate=true;hemi.intensity=mix(1.02,.78,p);sun.intensity=mix(2.25,.38,p);sun.color.copy(warm).lerp(cool,p);sun.position.set(mix(-8,-16,p),mix(17,5,p),mix(10,-5,p));fill.intensity=mix(.35,.65,p);};update.dispose=()=>{scene.remove(hemi,sun,fill);sun.shadow.map?.dispose();bg.dispose();scene.background=previous;};return update;}
 // Sharp, screen-space labels in the SAME exported WebGL canvas, not external DOM.
 function TechnicalCallout(camera,width,height){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const overlay=new THREE.Scene(),oc=new THREE.OrthographicCamera(-1,1,1,-1,0,2);oc.position.z=1;
  const geo=new THREE.PlaneGeometry(2,2),mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  overlay.add(new THREE.Mesh(geo,mat));
  function draw(renderer,labels){
   ctx.clearRect(0,0,width,height);const s=width/1080;
   ctx.font='700 '+Math.round(29*s)+'px system-ui,sans-serif';ctx.textBaseline='middle';
   for(const l of labels.slice(0,6)){
    const p=l.anchor.clone().project(camera);
    if(p.z>1||p.z< -1||Math.abs(p.x)>1||Math.abs(p.y)>1)continue;
    const ax=(p.x+1)*width/2,ay=(1-p.y)*height/2,txt=String(l.text).slice(0,50);
    const w=Math.min(width*.8,ctx.measureText(txt).width+72*s),h=62*s;
    const x=Math.max(width*.05,Math.min(width*.95-w,l.x*width)),y=Math.max(height*.15,Math.min(height*.77-h,l.y*height));
    ctx.save();ctx.globalAlpha=clamp(l.opacity??1);
    ctx.strokeStyle='#233f50';ctx.lineWidth=4*s;ctx.setLineDash([8*s,10*s]);ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax<x+w/2?x:x+w,y+h/2);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.roundRect(x,y,w,h,18*s);ctx.fill();
    ctx.fillStyle=l.color||'#13b8d4';ctx.beginPath();ctx.arc(ax,ay,8*s,0,Math.PI*2);ctx.arc(x+22*s,y+h/2,7*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#183342';ctx.fillText(txt,x+42*s,y+h/2,w-50*s);ctx.restore();
   }
   tex.needsUpdate=true;const old=renderer.autoClear;
   try{renderer.autoClear=false;renderer.clearDepth();renderer.render(overlay,oc);}finally{renderer.autoClear=old;}
  }
  draw.dispose=()=>{geo.dispose();mat.dispose();tex.dispose();};return draw;
 }
 // Arbitrary time/position/target keys, not a house-specific camera.
 function CameraDirector(camera,t,keys,fov=26){
  if(!Array.isArray(keys)||keys.length<2)throw Error('CameraDirector requires at least two keyframes');
  let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
  const a=keys[i],b=keys[i+1],dt=b[0]-a[0];
  if(dt<=0)throw Error('Camera keys must be sorted');
  const u=smooth((t-a[0])/dt);
  camera.fov=fov;
  camera.position.set(...a[1].map((v,j)=>mix(v,b[1][j],u)));
  camera.lookAt(...a[2].map((v,j)=>mix(v,b[2][j],u)));
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 }
 return {V,clamp,smooth,phase,mix,ArchitectureBuilder,CutawaySystem,FlowVisualizer,AtmosphereController,TechnicalCallout,CameraDirector};

}
