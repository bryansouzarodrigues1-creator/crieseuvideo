// Authored fixed helpers. Loaded only inside the opaque Code 3D sandbox.
function createSceneTools(THREE) {
  const up=new THREE.Vector3(0,1,0),down=new THREE.Vector3(0,-1,0),surfaces=new Map();
  const vec=p=>p&&p.isVector3?p.clone():new THREE.Vector3(...(p||[0,0,0]));
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  function progress(t,start,end){if(!(end>start))throw new Error('Intervalo de movimento inválido.');return clamp((t-start)/(end-start));}
  const ease=p=>{p=clamp(p);return p*p*(3-2*p);};
  const cue=(t,start,end)=>ease(progress(t,start,end));
  const stagger=(t,start,end,index,count)=>cue(t,start+(end-start)*.68*index/Math.max(1,count-1),start+(end-start)*.68*index/Math.max(1,count-1)+(end-start)*.32);
  function solveTwoBone(start,target,pole,a,b){
    if(!(a>0&&b>0))throw new Error('Comprimentos de membros inválidos.');
    start=vec(start);target=vec(target);pole=vec(pole);const delta=target.clone().sub(start),requested=delta.length();
    const direction=requested>1e-8?delta.clone().divideScalar(requested):new THREE.Vector3(0,-1,0);
    const distance=clamp(requested,Math.abs(a-b)+1e-6,a+b-1e-6);
    let bend=pole.clone().sub(start);bend.addScaledVector(direction,-bend.dot(direction));
    if(bend.lengthSq()<1e-10){bend=Math.abs(direction.x)<.8?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1);bend.addScaledVector(direction,-bend.dot(direction));}
    bend.normalize();const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
    const joint=start.clone().addScaledVector(direction,along).addScaledVector(bend,height),end=start.clone().addScaledVector(direction,distance);
    return {joint,end,error:end.distanceTo(target),requested};
  }
  const boxBounds=new THREE.Box3(),ray=new THREE.Raycaster();
  function surfaceTop(mesh){mesh.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(mesh).max.y;}
  function registerSurface(id,mesh){if(!id||!mesh||!mesh.isObject3D)throw new Error('Apoio inválido.');surfaces.set(id,mesh);return surfaceTop(mesh);}
  function supportAt(id,x,z){const mesh=surfaces.get(id);if(!mesh)throw new Error('Apoio desconhecido: '+id);mesh.updateWorldMatrix(true,true);boxBounds.setFromObject(mesh);ray.set(new THREE.Vector3(x,boxBounds.max.y+1,z),down);ray.near=0;ray.far=boxBounds.max.y-boxBounds.min.y+2;const hit=ray.intersectObject(mesh,true)[0];return hit?hit.point.clone():null;}
  function placeOnSurface(object,id,x,z){
    object.updateWorldMatrix(true,true);let p=object.getWorldPosition(new THREE.Vector3());p.x=x;p.z=z;
    object.position.copy(object.parent?object.parent.worldToLocal(p):p);object.updateWorldMatrix(true,true);
    const hit=supportAt(id,x,z);if(!hit)throw new Error('O objeto está fora do apoio: '+id);
    const bounds=new THREE.Box3().setFromObject(object);p=object.getWorldPosition(new THREE.Vector3());p.y+=hit.y-bounds.min.y;
    object.position.copy(object.parent?object.parent.worldToLocal(p):p);object.updateWorldMatrix(true,true);return hit;
  }
  function walkFeet(options){
    const d=Math.max(0,options.distance),stride=options.stride||1.12,stance=options.stance||.62,lift=options.lift===undefined?.115:options.lift,width=options.width||.28,limit=options.limit===undefined?Infinity:options.limit;
    const origin=vec(options.origin),forward=vec(options.direction||[0,0,1]);forward.y=0;if(forward.lengthSq()<1e-10)throw new Error('Direção de caminhada inválida.');forward.normalize();const side=new THREE.Vector3().crossVectors(up,forward);
    const feet=[0,.5].map((offset,i)=>{const q=d/stride+offset,cycle=Math.floor(q),phase=q-cycle,anchor=(cycle-offset)*stride+stride*stance*.5,swing=phase>stance?(phase-stance)/(1-stance):0;
      const a=Math.min(anchor,limit),b=Math.min(anchor+stride,limit),along=phase<=stance?a:a+(b-a)*ease(swing),point=origin.clone().addScaledVector(forward,along).addScaledVector(side,(i===0?-1:1)*width*.5);
      let support=point.y;if(options.surface){const hit=supportAt(options.surface,point.x,point.z);if(!hit)throw new Error('Pé fora da superfície de apoio.');support=hit.y;}
      point.y=support+(phase>stance?Math.sin(Math.PI*swing)*lift:0);return {point,planted:phase<=stance||a===b,phase,swing:swing,pitch:phase>stance&&a!==b?-Math.sin(Math.PI*swing)*.22:0};
    });return {left:feet[0],right:feet[1],phase:d/stride*Math.PI*2};
  }
  function createPerson(options={}){
    const root=new THREE.Group(),pelvis=new THREE.Group(),torso=new THREE.Group();root.add(pelvis);pelvis.add(torso);
    root.scale.setScalar(options.scale||1);const skin=new THREE.MeshStandardMaterial({color:options.skin||0xe7b48c,roughness:.78}),shirt=new THREE.MeshStandardMaterial({color:options.shirt||0xf4c34e,roughness:.8}),trousers=new THREE.MeshStandardMaterial({color:options.trousers||0x31586c,roughness:.85}),shoes=new THREE.MeshStandardMaterial({color:0x28343e,roughness:.8}),dark=new THREE.MeshStandardMaterial({color:0x26333f,roughness:.7}),white=new THREE.MeshStandardMaterial({color:0xfaf7ec,roughness:.7});
    function mesh(parent,geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
    const body=mesh(torso,new THREE.CylinderGeometry(.26,.235,.61,12),shirt,0,.31,0);body.scale.z=.74;
    mesh(pelvis,new THREE.SphereGeometry(.23,12,8),trousers,0,-.04,0).scale.set(1,.6,.72);
    const head=new THREE.Group();head.position.set(0,.77,0);torso.add(head);mesh(head,new THREE.SphereGeometry(.25,16,12),skin,0,0,0).scale.set(1,1.08,.94);
    const eyes=[];for(const x of [-.085,.085]){mesh(head,new THREE.SphereGeometry(.052,10,8),white,x,.025,.215).scale.set(.85,1,.4);const eye=mesh(head,new THREE.SphereGeometry(.027,10,8),dark,x,.025,.235);eyes.push(eye);mesh(head,new THREE.SphereGeometry(.013,6,6),white,x-.006,.035,.254);}
    mesh(head,new THREE.SphereGeometry(.045,10,8),skin,0,-.025,.24);
    const smile=mesh(head,new THREE.TorusGeometry(.075,.011,5,16,Math.PI),dark,0,-.07,.225);smile.rotation.z=Math.PI;
    if(options.helmet!==false){const hat=new THREE.MeshStandardMaterial({color:options.helmet||0xf1c13d,roughness:.43});mesh(head,new THREE.SphereGeometry(.277,16,10,0,Math.PI*2,0,Math.PI*.52),hat,0,.07,0);mesh(head,new THREE.CylinderGeometry(.31,.31,.035,16),hat,0,.075,.025);mesh(head,new THREE.BoxGeometry(.055,.085,.39),hat,0,.32,0);}
    const shoulderMarkers=[-1,1].map(side=>{const o=new THREE.Object3D();o.position.set(side*.30,.48,0);torso.add(o);return o;});
    const hipMarkers=[-1,1].map(side=>{const o=new THREE.Object3D();o.position.set(side*.14,0,0);pelvis.add(o);return o;});
    function limb(material,radius){const upper=mesh(root,new THREE.CylinderGeometry(radius,radius*.94,1,10),material,0,0,0),lower=mesh(root,new THREE.CylinderGeometry(radius*.89,radius*.8,1,10),material,0,0,0),joint=mesh(root,new THREE.SphereGeometry(radius*1.08,10,8),material,0,0,0);return {upper,lower,joint};}
    const legs=[limb(trousers,.085),limb(trousers,.085)],arms=[limb(shirt,.065),limb(shirt,.065)],feet=[],hands=[];
    for(let i=0;i<2;i++){const foot=new THREE.Group();mesh(foot,new THREE.BoxGeometry(.205,.12,.33),shoes,0,-.055,.065);const sole=new THREE.Object3D();sole.position.set(0,-.115,0);foot.add(sole);root.add(foot);feet.push({group:foot,sole});hands.push(mesh(root,new THREE.SphereGeometry(.064,12,10),skin,0,0,0));}
    const diagnostics={feet:[0,0],hands:[0,0],legReach:[0,0],armReach:[0,0]};
    function segment(m,a,b){const delta=b.clone().sub(a),length=delta.length();m.position.copy(a).add(b).multiplyScalar(.5);m.scale.y=Math.max(1e-6,length);m.quaternion.setFromUnitVectors(up,delta.lengthSq()>1e-12?delta.normalize():down);}
    function updateLimb(limb,start,target,pole,a,b){const solved=solveTwoBone(start,target,pole,a,b);segment(limb.upper,start,solved.joint);segment(limb.lower,solved.joint,solved.end);limb.joint.position.copy(solved.joint);return solved;}
    function pose(o={}){
      const time=o.time||0,crouch=o.crouch||0;pelvis.position.y=.88-crouch+(o.bob||0);torso.rotation.x=o.lean||0;
      head.rotation.y=o.lookYaw||0;head.rotation.x=o.lookPitch||0;const blink=cue(time,2.5,2.58)*(1-cue(time,2.60,2.69))+cue(time,7.7,7.78)*(1-cue(time,7.80,7.89));eyes.forEach(e=>e.scale.y=1-.91*blink);
      root.updateWorldMatrix(true,true);
      for(let i=0;i<2;i++){
        const footData=i===0?o.leftFoot:o.rightFoot,desired=vec(footData&&footData.point?footData.point:footData||root.localToWorld(new THREE.Vector3((i===0?-1:1)*.14,0,0)));
        const local=root.worldToLocal(desired.clone()),target=local.clone().add(new THREE.Vector3(0,.115,0)),hip=root.worldToLocal(hipMarkers[i].getWorldPosition(new THREE.Vector3()));
        const solved=updateLimb(legs[i],hip,target,new THREE.Vector3(hip.x,.35,hip.z+.7),.46,.45);feet[i].group.position.copy(solved.end);feet[i].group.rotation.x=footData&&footData.pitch||0;root.updateWorldMatrix(true,true);
        diagnostics.legReach[i]=solved.error;diagnostics.feet[i]=feet[i].sole.getWorldPosition(new THREE.Vector3()).distanceTo(desired);
        const shoulder=root.worldToLocal(shoulderMarkers[i].getWorldPosition(new THREE.Vector3())),swing=Math.sin(o.phase||0)*(i===0?1:-1)*(o.swing===undefined?.22:o.swing);
        const handData=i===0?o.leftHand:o.rightHand,handTarget=handData?root.worldToLocal(vec(handData)):new THREE.Vector3((i===0?-1:1)*.40,.94,swing+.08);
        const arm=updateLimb(arms[i],shoulder,handTarget,new THREE.Vector3((i===0?-1:1)*.7,1.05,.35),.34,.33);hands[i].position.copy(arm.end);diagnostics.armReach[i]=arm.error;diagnostics.hands[i]=arm.end.distanceTo(handTarget)*(options.scale||1);
      }
      root.updateWorldMatrix(true,true);return diagnostics;
    }
    pose();return {root,pose,head,feet,hands,diagnostics};
  }
  function aimCamera(camera,target,directions,span,occluders=[]){
    target=vec(target);const candidates=Array.isArray(directions[0])?directions:[directions],distance=span/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5));let chosen=0;
    for(let i=0;i<candidates.length;i++){const p=target.clone().addScaledVector(vec(candidates[i]).normalize(),distance),direction=target.clone().sub(p),len=direction.length();ray.set(p,direction.normalize());ray.near=.01;ray.far=Math.max(.01,len-.06);occluders.forEach(m=>m.updateWorldMatrix(true,true));if(ray.intersectObjects(occluders.filter(m=>m.visible),true).length===0){chosen=i;break;}if(i===candidates.length-1)chosen=0;}
    camera.position.copy(target).addScaledVector(vec(candidates[chosen]).normalize(),distance);camera.lookAt(target);camera.updateMatrixWorld(true);return chosen;
  }
  return Object.freeze({version:1,vec,clamp,progress,ease,cue,stagger,solveTwoBone,surfaceTop,registerSurface,supportAt,placeOnSurface,walkFeet,createPerson,aimCamera});
}
