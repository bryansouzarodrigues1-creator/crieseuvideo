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
  // Arc-length path and world-space foot anchors. Turning the body never rotates a planted foot.
  function createWalkPath(points){
    if(!Array.isArray(points)||points.length<2)throw new Error('O trajeto precisa de pelo menos dois pontos.');
    const p=points.map(vec);for(let i=0;i<p.length;i++)if(!p[i].toArray().every(Number.isFinite)||(i&&p[i].distanceTo(p[i-1])<1e-5))throw new Error('Pontos de trajeto inválidos.');
    const curve=new THREE.CatmullRomCurve3(p,false,'centripetal');curve.arcLengthDivisions=800;curve.updateArcLengths();const length=curve.getLength();
    function at(distance){const u=clamp(distance/length),point=curve.getPointAt(u),tangent=curve.getTangentAt(u);tangent.y=0;tangent.normalize();return {point,tangent,yaw:Math.atan2(tangent.x,tangent.z)};}
    return Object.freeze({length,at});
  }
  function walkOnPath(o){
    const path=o.path,limit=o.limit===undefined?path.length:Math.min(o.limit,path.length),d=clamp(o.distance,0,limit),half=(o.stride||.86)*.5,width=o.width||.28,lift=o.lift===undefined?.105:o.lift;
    if(!(limit>0&&half>0))throw new Error('Caminhada em trajeto inválida.');
    const last=Math.max(0,Math.ceil(limit/half)-1),step=Math.min(last,Math.floor(d/half)),start=step*half,end=Math.min(limit,(step+1)*half),p=clamp((d-start)/(end-start)),active=step%2===0?1:0;
    function anchor(distance,side){const a=path.at(distance),lateral=new THREE.Vector3(a.tangent.z,0,-a.tangent.x);a.point.addScaledVector(lateral,side*width*.5);if(o.surface){const hit=supportAt(o.surface,a.point.x,a.point.z);if(!hit)throw new Error('Pé fora do apoio.');a.point.y=hit.y;}return a;}
    const feet=[-1,1].map((side,i)=>{
      const a=anchor(i===active?Math.max(0,(step-1)*half):Math.max(0,step*half),side),b=anchor(i===active?end:Math.max(0,step*half),side),q=i===active?ease(p):0;
      const point=a.point.clone().lerp(b.point,q);point.y+=i===active?Math.sin(Math.PI*p)*lift:0;
      const yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*q;
      const foot={point,yaw,planted:i!==active||p===0||p===1,pitch:i===active?-Math.sin(Math.PI*p)*.16:0};
      const settle=clamp(o.settle||0);if(d>=limit-1e-7&&settle>0){const goal=anchor(limit,side),travel=point.distanceTo(goal.point);foot.point.lerp(goal.point,ease(settle));foot.point.y+=Math.sin(Math.PI*settle)*lift*(travel>.01?1:0);foot.yaw+=Math.atan2(Math.sin(goal.yaw-yaw),Math.cos(goal.yaw-yaw))*ease(settle);foot.pitch=0;foot.planted=travel<.01||settle===1;}
      return foot;
    });return {left:feet[0],right:feet[1],phase:d/(half*2)*Math.PI*2,body:path.at(d)};
  }
  function setWorldPose(object,pose){
    const position=vec(pose.position),quaternion=pose.quaternion?pose.quaternion.clone():new THREE.Quaternion();
    if(![...position,...quaternion.toArray()].every(Number.isFinite)||quaternion.lengthSq()<1e-12)throw new Error('Pose do objeto inválida.');
    quaternion.normalize();if(object.parent){object.parent.updateWorldMatrix(true,false);object.position.copy(object.parent.worldToLocal(position));const parentQ=object.parent.getWorldQuaternion(new THREE.Quaternion());object.quaternion.copy(parentQ.invert().multiply(quaternion));}else{object.position.copy(position);object.quaternion.copy(quaternion);}object.updateWorldMatrix(true,true);
  }
  function objectGrips(object,points){object.updateWorldMatrix(true,true);return points.map(p=>object.localToWorld(vec(p)));}
  function graspFrames(object,grips){
    object.updateWorldMatrix(true,true);const normalMatrix=new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
    return grips.map(g=>{const z=vec(g.normal).applyMatrix3(normalMatrix),y=vec(g.fingers).transformDirection(object.matrixWorld);if(z.lengthSq()<1e-10||y.lengthSq()<1e-10)throw new Error('Orientação da pega inválida.');z.normalize();y.addScaledVector(z,-y.dot(z));if(y.lengthSq()<1e-10)throw new Error('Dedos e normal da palma precisam de direções distintas.');y.normalize();const x=new THREE.Vector3().crossVectors(y,z).normalize();return {point:object.localToWorld(vec(g.point)),quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z))};});
  }
  function createPropTransfer(object,o){
    if(!(o.release>o.pickup)||typeof o.heldAt!=='function')throw new Error('Transferência do objeto inválida.');
    const copy=p=>({position:vec(p.position),quaternion:p.quaternion?p.quaternion.clone():new THREE.Quaternion()});
    const source=copy(o.source),initial=copy(o.heldAt(o.pickup));if(source.position.distanceTo(initial.position)>1e-5||1-Math.abs(source.quaternion.dot(initial.quaternion))>1e-5)throw new Error('O objeto deve partir do contato real, sem salto.');
    function poseAt(t){return copy(t<o.pickup?source:o.heldAt(Math.min(t,o.release)));}
    function apply(t){const p=poseAt(t);setWorldPose(object,p);return p;}
    return Object.freeze({poseAt,apply,phase:t=>t<o.pickup?'source':t<o.release?'held':'placed'});
  }
  function createPerson(options={}){
    const root=new THREE.Group(),pelvis=new THREE.Group(),torso=new THREE.Group();root.add(pelvis);pelvis.add(torso);
    root.scale.setScalar(options.scale||1);const skin=new THREE.MeshStandardMaterial({color:options.skin||0xe7b48c,roughness:.78}),shirt=new THREE.MeshStandardMaterial({color:options.shirt||0xf4c34e,roughness:.8}),trousers=new THREE.MeshStandardMaterial({color:options.trousers||0x31586c,roughness:.85}),shoes=new THREE.MeshStandardMaterial({color:0x28343e,roughness:.8}),dark=new THREE.MeshStandardMaterial({color:0x26333f,roughness:.7}),white=new THREE.MeshStandardMaterial({color:0xfaf7ec,roughness:.7});
    function mesh(parent,geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
    const body=mesh(torso,new THREE.CylinderGeometry(.26,.235,.61,12),shirt,0,.31,0);body.scale.z=.74;
    mesh(pelvis,new THREE.SphereGeometry(.23,12,8),trousers,0,-.04,0).scale.set(1,.6,.72);
    const head=new THREE.Group();head.position.set(0,.77,0);torso.add(head);mesh(head,new THREE.SphereGeometry(.25,16,12),skin,0,0,0).scale.set(1,1.08,.94);
    const eyes=[],brows=[];for(const x of [-.085,.085]){const eye=new THREE.Group();eye.position.set(x,.025,.215);head.add(eye);mesh(eye,new THREE.SphereGeometry(.052,10,8),white,0,0,0).scale.set(.85,1,.4);mesh(eye,new THREE.SphereGeometry(.027,10,8),dark,0,0,.020);mesh(eye,new THREE.SphereGeometry(.013,6,6),white,-.006,.010,.039);eyes.push(eye);brows.push(mesh(head,new THREE.BoxGeometry(.089,.018,.018),dark,x,.112,.219));}
    mesh(head,new THREE.SphereGeometry(.045,10,8),skin,0,-.025,.24);
    const smile=mesh(head,new THREE.TorusGeometry(.075,.011,5,16,Math.PI),dark,0,-.07,.225);smile.rotation.z=Math.PI;
    const effortMouth=mesh(head,new THREE.SphereGeometry(.045,10,8),dark,0,-.091,.232);effortMouth.scale.set(1,.46,.25);effortMouth.visible=false;
    if(options.helmet!==false){const hat=new THREE.MeshStandardMaterial({color:options.helmet||0xf1c13d,roughness:.43});mesh(head,new THREE.SphereGeometry(.277,16,10,0,Math.PI*2,0,Math.PI*.52),hat,0,.07,0);mesh(head,new THREE.CylinderGeometry(.31,.31,.035,16),hat,0,.075,.025);mesh(head,new THREE.BoxGeometry(.055,.085,.39),hat,0,.32,0);}
    const shoulderMarkers=[-1,1].map(side=>{const o=new THREE.Object3D();o.position.set(side*.30,.48,0);torso.add(o);return o;});
    const hipMarkers=[-1,1].map(side=>{const o=new THREE.Object3D();o.position.set(side*.14,0,0);pelvis.add(o);return o;});
    function limb(material,radius){const upper=mesh(root,new THREE.CylinderGeometry(radius,radius*.94,1,10),material,0,0,0),lower=mesh(root,new THREE.CylinderGeometry(radius*.89,radius*.8,1,10),material,0,0,0),joint=mesh(root,new THREE.SphereGeometry(radius*1.08,10,8),material,0,0,0);return {upper,lower,joint};}
    const legs=[limb(trousers,.085),limb(trousers,.085)],arms=[limb(shirt,.065),limb(shirt,.065)],feet=[],hands=[],handRigs=[];
    function makeHand(index){
      const group=new THREE.Group();root.add(group);const contact=new THREE.Object3D();group.add(contact);const thumbSide=index===0?1:-1;
      mesh(group,new THREE.SphereGeometry(.028,10,8),skin,0,0,0);const palm=mesh(group,new THREE.BoxGeometry(.09,.082,.03),skin,0,.043,0);
      const round=mesh(group,new THREE.SphereGeometry(1,10,8),skin,0,.073,0);round.scale.set(.046,.022,.016);
      const fingers=[-.033,-.011,.011,.033].map(x=>({x,segments:[0,1,2].map(()=>mesh(group,new THREE.CylinderGeometry(.0105,.0095,1,8),skin,0,0,0)),joints:[0,1,2,3].map(()=>mesh(group,new THREE.SphereGeometry(.0105,8,6),skin,0,0,0))}));
      const thumb={segments:[0,1].map(()=>mesh(group,new THREE.CylinderGeometry(.012,.0105,1,8),skin,0,0,0)),joints:[0,1,2].map(()=>mesh(group,new THREE.SphereGeometry(.012,8,6),skin,0,0,0))};let capsules=[];
      function set(curl){
        curl=clamp(curl);capsules=[];
        for(const f of fingers){let p=new THREE.Vector3(f.x,.084,0),angle=0;f.joints[0].position.copy(p);for(let j=0;j<3;j++){angle+=(j===0?Math.PI/6:Math.PI/3)*curl;const q=p.clone().add(new THREE.Vector3(0,Math.cos(angle)*.034,Math.sin(angle)*.034));segment(f.segments[j],p,q);f.joints[j+1].position.copy(q);capsules.push({name:'finger',from:p.clone(),to:q.clone(),radius:.0105});p=q;}}
        const a=new THREE.Vector3(thumbSide*.045,.022,.002),angle=-2.097-1.162*curl,target=new THREE.Vector3(thumbSide*(.10-.054*curl),.084+.035*Math.cos(angle),.034+.035*Math.sin(angle));
        const solved=solveTwoBone(a,target,new THREE.Vector3(thumbSide*.12,.025,.07),.041,.037),points=[a,solved.joint,solved.end];
        for(let j=0;j<2;j++){segment(thumb.segments[j],points[j],points[j+1]);capsules.push({name:'thumb',from:points[j].clone(),to:points[j+1].clone(),radius:.012});}thumb.joints.forEach((m,j)=>m.position.copy(points[j]));
      }
      function samples(){group.updateWorldMatrix(true,true);const scale=group.getWorldScale(new THREE.Vector3()).x;return [{name:'palm',from:group.localToWorld(new THREE.Vector3(0,.043,0)),to:group.localToWorld(new THREE.Vector3(0,.043,0)),radius:.065*scale},{name:'wrist',from:group.getWorldPosition(new THREE.Vector3()),to:group.getWorldPosition(new THREE.Vector3()),radius:.028*scale},...capsules.map(c=>({...c,from:group.localToWorld(c.from.clone()),to:group.localToWorld(c.to.clone()),radius:c.radius*scale}))];}
      set(0);return {group,contact,set,samples,offset:new THREE.Vector3(0,.084,.034)};
    }
    for(let i=0;i<2;i++){const foot=new THREE.Group();mesh(foot,new THREE.BoxGeometry(.205,.12,.33),shoes,0,-.055,.065);const sole=new THREE.Object3D();sole.position.set(0,-.115,0);foot.add(sole);root.add(foot);feet.push({group:foot,sole});if(options.hands==='articulated'){const rig=makeHand(i);handRigs.push(rig);hands.push(rig.contact);}else{handRigs.push(null);hands.push(mesh(root,new THREE.SphereGeometry(.064,12,10),skin,0,0,0));}}
    const diagnostics={feet:[0,0],hands:[0,0],legReach:[0,0],armReach:[0,0],knees:[],wrists:[],elbows:[],handSamples:[]};
    function segment(m,a,b){const delta=b.clone().sub(a),length=delta.length();m.position.copy(a).add(b).multiplyScalar(.5);m.scale.y=Math.max(1e-6,length);m.quaternion.setFromUnitVectors(up,delta.lengthSq()>1e-12?delta.normalize():down);}
    function updateLimb(limb,start,target,pole,a,b){const solved=solveTwoBone(start,target,pole,a,b);segment(limb.upper,start,solved.joint);segment(limb.lower,solved.joint,solved.end);limb.joint.position.copy(solved.joint);return solved;}
    function pose(o={}){
      const time=o.time||0,crouch=o.crouch||0;pelvis.position.y=.88-crouch+(o.bob||0);torso.rotation.x=o.lean||0;
      head.rotation.y=o.lookYaw||0;head.rotation.x=o.lookPitch||0;const blink=cue(time,2.5,2.58)*(1-cue(time,2.60,2.69))+cue(time,7.7,7.78)*(1-cue(time,7.80,7.89));eyes.forEach(e=>e.scale.y=1-.91*blink);const effort=clamp(o.effort||0);brows.forEach((b,i)=>b.rotation.z=(i===0?-1:1)*effort*.30);smile.visible=effort<.5;effortMouth.visible=effort>=.5;
      root.updateWorldMatrix(true,true);
      for(let i=0;i<2;i++){
        const footData=i===0?o.leftFoot:o.rightFoot,desired=vec(footData&&footData.point?footData.point:footData||root.localToWorld(new THREE.Vector3((i===0?-1:1)*.14,0,0)));
        const pitch=footData&&footData.pitch||0;if(footData&&Number.isFinite(footData.yaw)){const worldQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,footData.yaw,0,'YXZ'));feet[i].group.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldQ));}else feet[i].group.rotation.set(pitch,0,0,'YXZ');
        const local=root.worldToLocal(desired.clone()),soleOffset=new THREE.Vector3(0,-.115,0).applyQuaternion(feet[i].group.quaternion),target=local.clone().sub(soleOffset),hip=root.worldToLocal(hipMarkers[i].getWorldPosition(new THREE.Vector3()));
        const spread=clamp(o.kneeSpread||0,0,1.2),solved=updateLimb(legs[i],hip,target,new THREE.Vector3(hip.x+(i===0?-1:1)*spread,.35,hip.z+.7-spread*.2),.46,.45);feet[i].group.position.copy(solved.end);root.updateWorldMatrix(true,true);
        diagnostics.legReach[i]=solved.error;diagnostics.feet[i]=feet[i].sole.getWorldPosition(new THREE.Vector3()).distanceTo(desired);
        const shoulder=root.worldToLocal(shoulderMarkers[i].getWorldPosition(new THREE.Vector3())),swing=Math.sin(o.phase||0)*(i===0?1:-1)*(o.swing===undefined?.22:o.swing);
        const handData=i===0?o.leftHand:o.rightHand,framed=handData&&!handData.isVector3&&handData.point,handPoint=handData?vec(framed?handData.point:handData):root.localToWorld(new THREE.Vector3((i===0?-1:1)*.40,.94,swing+.08));
        const handTarget=root.worldToLocal(handPoint.clone()),rig=handRigs[i];
        if(rig&&framed){const q=handData.quaternion;if(!q||!q.isQuaternion||q.lengthSq()<1e-10||!q.toArray().every(Number.isFinite))throw new Error('Quaternion da mão inválido.');rig.group.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q.clone().normalize()));rig.contact.position.copy(rig.offset);handTarget.sub(rig.offset.clone().applyQuaternion(rig.group.quaternion));}
        const arm=updateLimb(arms[i],shoulder,handTarget,new THREE.Vector3((i===0?-1:1)*(rig?.45:.7),rig?.98:1.05,rig?.12:.35),.34,.33);
        if(rig){rig.group.position.copy(arm.end);if(!framed){const y=arm.end.clone().sub(arm.joint).normalize(),z=new THREE.Vector3(0,0,1);z.addScaledVector(y,-z.dot(y));if(z.lengthSq()<1e-10)z.set(1,0,0);z.normalize();const x=new THREE.Vector3().crossVectors(y,z);rig.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));rig.contact.position.set(0,0,0);}rig.set(framed?handData.grip||0:0);root.updateWorldMatrix(true,true);diagnostics.hands[i]=hands[i].getWorldPosition(new THREE.Vector3()).distanceTo(handPoint);}else{hands[i].position.copy(arm.end);diagnostics.hands[i]=arm.end.distanceTo(handTarget)*(options.scale||1);}
        diagnostics.armReach[i]=arm.error;diagnostics.wrists[i]=root.localToWorld(arm.end.clone()).toArray();diagnostics.elbows[i]=root.localToWorld(arm.joint.clone()).toArray();
      }
      root.updateWorldMatrix(true,true);diagnostics.knees=legs.map(l=>l.joint.getWorldPosition(new THREE.Vector3()).toArray());diagnostics.handSamples=handRigs.map(r=>r?r.samples().map(c=>({...c,from:c.from.toArray(),to:c.to.toArray()})):[]);return diagnostics;
    }
    pose();return {root,pose,head,feet,hands,diagnostics};
  }
  function aimCamera(camera,target,directions,span,occluders=[],visibilityTargets=[]){
    target=vec(target);const candidates=Array.isArray(directions[0])?directions:[directions],points=[target,...visibilityTargets.map(vec)];
    if(!(span>0)||!candidates.length)throw new Error('Enquadramento inválido.');
    const distance=span/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5));let chosen=0,best=Infinity;
    occluders.forEach(m=>m.updateWorldMatrix(true,true));const solids=occluders.filter(m=>m.visible);
    for(let i=0;i<candidates.length;i++){const direction=vec(candidates[i]);if(direction.lengthSq()<1e-10)throw new Error('Direção de câmera inválida.');const p=target.clone().addScaledVector(direction.normalize(),distance);let blocked=0;
      for(const point of points){const delta=point.clone().sub(p),len=delta.length();ray.set(p,delta.normalize());ray.near=.01;ray.far=Math.max(.01,len-.06);if(ray.intersectObjects(solids,true).length)blocked++;}
      if(blocked<best){best=blocked;chosen=i;}if(blocked===0)break;
    }
    camera.position.copy(target).addScaledVector(vec(candidates[chosen]).normalize(),distance);camera.lookAt(target);camera.updateMatrixWorld(true);camera.userData.targetVisibility={clear:best===0,blocked:best,selected:chosen};return chosen;
  }
  return Object.freeze({version:1,vec,clamp,progress,ease,cue,stagger,solveTwoBone,surfaceTop,registerSurface,supportAt,placeOnSurface,walkFeet,createWalkPath,walkOnPath,setWorldPose,objectGrips,graspFrames,createPropTransfer,createPerson,aimCamera});
}
