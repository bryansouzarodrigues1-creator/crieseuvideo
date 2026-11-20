// Captured Gemini 3.6 Flash API program, reviewed manually. See code3d-gemini36-crane.provenance.json.
function createScene(THREE, canvas, width, height) {
  const DURATION = 10;
  // Review: seed procedural scenery so saved-code replays keep the same world.
  let randomSeed = 104729;
  function random() { randomSeed = (Math.imul(1664525, randomSeed) + 1013904223) >>> 0; return randomSeed / 4294967296; }

  // Renderer setup
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    preserveDrawingBuffer: true
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.FogExp2(0xcce0ff, 0.012);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 150);

  // --- LIGHTING ---
  const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.7);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfffaed, 1.8);
  sunLight.position.set(30, 45, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 100;
  const d = 30;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x88bbff, 0.5);
  fillLight.position.set(-20, 20, -20);
  scene.add(fillLight);

  // --- PROCEDURAL TEXTURES & MATERIALS ---
  function createDirtTexture() {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#7c654e';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      const x = random() * 256;
      const y = random() * 256;
      const r = random() * 2;
      ctx.fillStyle = random() > 0.5 ? '#5c4734' : '#9c836a';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 12);
    return tex;
  }

  function createContainerTexture(colorHex, stripeColorHex) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < 512; i += 32) {
      ctx.fillRect(i, 0, 16, 512);
    }
    ctx.fillStyle = stripeColorHex;
    ctx.fillRect(0, 200, 512, 40);
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  const groundMat = new THREE.MeshStandardMaterial({
    map: createDirtTexture(),
    roughness: 0.9,
    metalness: 0.1
  });

  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf5b041, roughness: 0.3, metalness: 0.2 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.8 });
  const lightMetalMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.3, metalness: 0.9 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.1, transmission: 0.6, transparent: true, opacity: 0.7 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xd9534f, roughness: 0.4 });
  const blueContainerMat = new THREE.MeshStandardMaterial({ map: createContainerTexture('#2e6da4', '#ffffff'), roughness: 0.4, metalness: 0.3 });
  const orangeVestMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 });
  const whiteHelmetMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.6 });
  const jeansMat = new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.8 });
  const cableMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

  // --- ENVIRONMENT / SCENERY ---
  // Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Background Buildings
  const bldgGroup = new THREE.Group();
  scene.add(bldgGroup);
  const bldgMat = new THREE.MeshStandardMaterial({ color: 0x7a8a99, roughness: 0.7 });
  const bldgMat2 = new THREE.MeshStandardMaterial({ color: 0x99aabb, roughness: 0.6 });

  for (let i = 0; i < 15; i++) {
    const h = 15 + random() * 30;
    const w = 6 + random() * 6;
    const d = 6 + random() * 6;
    const bldg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), random() > 0.5 ? bldgMat : bldgMat2);
    const angle = (i / 15) * Math.PI * 1.5 + Math.PI * 0.25;
    const dist = 35 + random() * 15;
    bldg.position.set(Math.cos(angle) * dist, h / 2, Math.sin(angle) * dist);
    bldg.castShadow = true;
    bldg.receiveShadow = true;
    bldgGroup.add(bldg);
  }

  // Construction Details (Fence, Piles, Cones)
  const propGroup = new THREE.Group();
  scene.add(propGroup);

  // Cones
  const coneGeo = new THREE.ConeGeometry(0.3, 0.8, 16);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff4400, roughness: 0.4 });
  for (let i = 0; i < 8; i++) {
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(-6 + i * 1.8, 0.4, 8);
    cone.castShadow = true;
    propGroup.add(cone);
  }

  // Construction Workers (Stylized)
  function createWorker() {
    const worker = new THREE.Group();
    // Legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8);
    const legL = new THREE.Mesh(legGeo, jeansMat);
    legL.position.set(-0.15, 0.4, 0);
    legL.castShadow = true;
    const legR = legL.clone();
    legR.position.x = 0.15;
    worker.add(legL, legR);

    // Torso (Vest)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.25), orangeVestMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    worker.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), skinMat);
    head.position.y = 1.55;
    worker.add(head);

    // Helmet
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), whiteHelmetMat);
    helmet.position.y = 1.6;
    helmet.scale.set(1, 0.7, 1);
    worker.add(helmet);

    return worker;
  }

  const worker1 = createWorker();
  worker1.position.set(-8, 0, 3);
  worker1.rotation.y = 0.5;
  scene.add(worker1);

  const worker2 = createWorker();
  worker2.position.set(4, 0, -5);
  worker2.rotation.y = -1.2;
  scene.add(worker2);

  // --- TRUCK ---
  const truckGroup = new THREE.Group();
  truckGroup.position.set(6, 0, -4);
  truckGroup.rotation.y = -Math.PI * 0.35;
  scene.add(truckGroup);

  // Truck Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.0), redMat);
  cabin.position.set(0, 1.5, 3.2);
  cabin.castShadow = true;
  truckGroup.add(cabin);

  const cabinWindshield = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.1), glassMat);
  cabinWindshield.position.set(0, 1.8, 4.21);
  truckGroup.add(cabinWindshield);

  // Truck Chassis & Bed
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 8.5), darkMetalMat);
  chassis.position.set(0, 0.6, 0);
  chassis.castShadow = true;
  truckGroup.add(chassis);

  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 6.2), darkMetalMat);
  bed.position.set(0, 1.0, -0.8);
  bed.receiveShadow = true;
  truckGroup.add(bed);

  // Truck Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 24);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelPositions = [
    [-1.1, 0.5, 3.2], [1.1, 0.5, 3.2],
    [-1.1, 0.5, -2.0], [1.1, 0.5, -2.0],
    [-1.1, 0.5, -3.2], [1.1, 0.5, -3.2]
  ];
  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeo, darkMetalMat);
    wheel.position.set(...pos);
    wheel.castShadow = true;
    truckGroup.add(wheel);
  });

  // Target spot on truck bed in world coords (calculated for snap target)
  const truckBedTargetWorld = new THREE.Vector3(0, 1.1 + 1.1, -0.8); // 1.1 bed height + half container height (1.1)
  truckGroup.updateMatrixWorld(true);
  truckBedTargetWorld.applyMatrix4(truckGroup.matrixWorld);

  // --- CRANE BUILD ---
  const craneGroup = new THREE.Group();
  craneGroup.position.set(-2, 0, 0);
  scene.add(craneGroup);

  // Crane Base / Tracks
  const baseBase = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.0, 4.5), darkMetalMat);
  baseBase.position.y = 0.5;
  baseBase.castShadow = true;
  craneGroup.add(baseBase);

  // Crane Slewing Body (Rotates)
  const craneSlewBody = new THREE.Group();
  craneSlewBody.position.y = 1.0;
  craneGroup.add(craneSlewBody);

  const cabinCrane = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.0, 2.2), yellowMat);
  cabinCrane.position.set(-1.0, 1.2, 0);
  cabinCrane.castShadow = true;
  craneSlewBody.add(cabinCrane);

  const craneGlass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.0), glassMat);
  craneGlass.position.set(-1.0, 1.5, 0.7);
  craneSlewBody.add(craneGlass);

  const counterWeight = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 1.5), darkMetalMat);
  counterWeight.position.set(1.2, 1.0, 0);
  counterWeight.castShadow = true;
  craneSlewBody.add(counterWeight);

  // Crane Jib / Boom Structure
  const boomGroup = new THREE.Group();
  boomGroup.position.set(0, 1.5, 0);
  craneSlewBody.add(boomGroup);

  // Lattice Boom construction
  const boomLength = 16;
  const boomMat = yellowMat;
  const mainPoles = [];
  for (let i = 0; i < 4; i++) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, boomLength), boomMat);
    pole.rotation.x = Math.PI / 2;
    pole.position.set(
      (i % 2 === 0 ? 0.4 : -0.4),
      (i < 2 ? 0.4 : -0.4),
      boomLength / 2
    );
    pole.castShadow = true;
    boomGroup.add(pole);
  }
  // Cross bracing
  for (let z = 1; z < boomLength; z += 1.2) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.06), boomMat);
    brace.position.set(0, 0.4, z);
    boomGroup.add(brace);
    const brace2 = brace.clone();
    brace2.position.y = -0.4;
    boomGroup.add(brace2);
  }

  // Tilt boom up slightly
  boomGroup.rotation.x = -0.7; 

  // Trolley (moves along boom)
  const trolleyGroup = new THREE.Group();
  boomGroup.add(trolleyGroup);
  const trolleyBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.8), darkMetalMat);
  trolleyBody.position.y = -0.5;
  trolleyGroup.add(trolleyBody);

  // Hook & Cable Block
  const hookGroup = new THREE.Group();
  scene.add(hookGroup); // World level for easy Math / hierarchy transfer

  const hookBlock = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.4), yellowMat);
  hookBlock.castShadow = true;
  hookGroup.add(hookBlock);

  const hookShape = THREE.TorusGeometry;
  const hookMetal = new THREE.Mesh(new hookShape(0.2, 0.06, 8, 16, Math.PI * 1.5), lightMetalMat);
  hookMetal.position.y = -0.5;
  hookMetal.rotation.z = Math.PI;
  hookGroup.add(hookMetal);

  // Rigging Lines (Dynamic Visual Cables)
  const cableGeo = new THREE.BufferGeometry();
  const cablePositions = new Float32Array(4 * 3); // 2 lines, 4 points
  cableGeo.setAttribute('position', new THREE.BufferAttribute(cablePositions, 3));
  const cablesMesh = new THREE.LineSegments(cableGeo, cableMat);
  cablesMesh.frustumCulled = false;
  scene.add(cablesMesh);

  // Spreading Rig Cables to Container
  const rigGeo = new THREE.BufferGeometry();
  const rigPositions = new Float32Array(4 * 2 * 3); // 4 lines to corners
  rigGeo.setAttribute('position', new THREE.BufferAttribute(rigPositions, 3));
  const rigMesh = new THREE.LineSegments(rigGeo, cableMat);
  rigMesh.frustumCulled = false;
  scene.add(rigMesh);

  // --- THE CONTAINER ---
  const containerGroup = new THREE.Group();
  const containerBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 5.0), blueContainerMat);
  containerBody.castShadow = true;
  containerBody.receiveShadow = true;
  containerGroup.add(containerBody);

  // Initial Container Placement (On Ground)
  const startContainerPos = new THREE.Vector3(-7, 1.1, 4);
  const startContainerRotY = Math.PI * 0.2;
  containerGroup.position.copy(startContainerPos);
  containerGroup.rotation.y = startContainerRotY;
  scene.add(containerGroup);

  // --- ANIMATION HELPER FUNCTIONS ---
  function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Frame update logic
  function updateAnimation(t) {
    // Review: derive all targets from the actual hierarchy and truck transform.
    const pLower = smoothstep(0, 1.5, t);
    const pLift = smoothstep(1.5, 4, t);
    const pSlew = smoothstep(4, 7, t);
    const pPlace = smoothstep(7, 9, t);
    const pRelease = smoothstep(9, 10, t);
    const dx0 = startContainerPos.x - craneGroup.position.x;
    const dz0 = startContainerPos.z - craneGroup.position.z;
    const dx1 = truckBedTargetWorld.x - craneGroup.position.x;
    const dz1 = truckBedTargetWorld.z - craneGroup.position.z;
    const startAngle = Math.atan2(dx0, dz0);
    const angleDelta = Math.atan2(Math.sin(Math.atan2(dx1, dz1) - startAngle), Math.cos(Math.atan2(dx1, dz1) - startAngle));
    const tilt = -boomGroup.rotation.x;
    const startZ = Math.hypot(dx0, dz0) / Math.cos(tilt);
    const targetZ = Math.hypot(dx1, dz1) / Math.cos(tilt);
    craneSlewBody.rotation.y = startAngle + angleDelta * pSlew;
    trolleyGroup.position.z = lerp(startZ, targetZ, pSlew);
    const trolleyWorldPos = new THREE.Vector3();
    trolleyGroup.getWorldPosition(trolleyWorldPos);
    const halfHeight = containerBody.geometry.parameters.height / 2;
    const hookOffset = halfHeight + 1.5;
    const pickupY = startContainerPos.y + hookOffset;
    const landingY = truckBedTargetWorld.y + hookOffset;
    const lowestTrolleyY = craneGroup.position.y + craneSlewBody.position.y + boomGroup.position.y + Math.min(startZ, targetZ) * Math.sin(tilt);
    const liftY = lowestTrolleyY - 1.4;
    let hookY = lerp(pickupY + 2.5, pickupY, pLower);
    if (t >= 1.5) hookY = lerp(pickupY, liftY, pLift);
    if (t >= 4) hookY = liftY;
    if (t >= 7) hookY = lerp(liftY, landingY, pPlace);
    if (t >= 9) hookY = landingY + 1.5 * pRelease;
    hookGroup.position.set(trolleyWorldPos.x, hookY, trolleyWorldPos.z);
    hookGroup.rotation.y = lerp(startContainerRotY, truckGroup.rotation.y, pSlew);
    const cablePosAttr = cablesMesh.geometry.attributes.position;
    cablePosAttr.setXYZ(0, trolleyWorldPos.x - .2, trolleyWorldPos.y - .5, trolleyWorldPos.z);
    cablePosAttr.setXYZ(1, hookGroup.position.x - .2, hookY + .3, hookGroup.position.z);
    cablePosAttr.setXYZ(2, trolleyWorldPos.x + .2, trolleyWorldPos.y - .5, trolleyWorldPos.z);
    cablePosAttr.setXYZ(3, hookGroup.position.x + .2, hookY + .3, hookGroup.position.z);
    cablePosAttr.needsUpdate = true;
    if (t < 1.5) {
      containerGroup.position.copy(startContainerPos);
      containerGroup.rotation.y = startContainerRotY;
    } else if (t < 9) {
      containerGroup.position.set(hookGroup.position.x, hookY - hookOffset, hookGroup.position.z);
      containerGroup.rotation.y = hookGroup.rotation.y;
    } else {
      containerGroup.position.copy(truckBedTargetWorld);
      containerGroup.rotation.y = truckGroup.rotation.y;
    }
    rigMesh.visible = t >= 1.5 && t < 9;
    if (rigMesh.visible) {
      const rigPosAttr = rigMesh.geometry.attributes.position;
      const halfWidth = containerBody.geometry.parameters.width / 2 - .1;
      const halfLength = containerBody.geometry.parameters.depth / 2 - .1;
      const corners = [
        new THREE.Vector3(-halfWidth, halfHeight, -halfLength),
        new THREE.Vector3(halfWidth, halfHeight, -halfLength),
        new THREE.Vector3(halfWidth, halfHeight, halfLength),
        new THREE.Vector3(-halfWidth, halfHeight, halfLength)
      ];
      corners.forEach((corner, idx) => {
        corner.applyAxisAngle(new THREE.Vector3(0, 1, 0), containerGroup.rotation.y).add(containerGroup.position);
        rigPosAttr.setXYZ(idx * 2, hookGroup.position.x, hookY - .4, hookGroup.position.z);
        rigPosAttr.setXYZ(idx * 2 + 1, corner.x, corner.y, corner.z);
      });
      rigPosAttr.needsUpdate = true;
    }
    // Review: keep the complete action visible at each intentional camera cut.
    if (t < 2.5) {
      const u = t / 2.5;
      camera.position.set(lerp(-17, -15, u), lerp(12, 11, u), lerp(19, 17, u));
      camera.lookAt(-3, 4, 2);
    } else if (t < 5.5) {
      camera.position.set(containerGroup.position.x + 9, containerGroup.position.y + 6, containerGroup.position.z + 12);
      camera.lookAt(containerGroup.position.x, containerGroup.position.y + .6, containerGroup.position.z);
    } else if (t < 8) {
      camera.position.set(16, 16, 14);
      camera.lookAt((containerGroup.position.x + truckBedTargetWorld.x) / 2, 4.5, (containerGroup.position.z + truckBedTargetWorld.z) / 2);
    } else {
      camera.position.set(truckBedTargetWorld.x - 12, truckBedTargetWorld.y + 8, truckBedTargetWorld.z + 15);
      camera.lookAt(truckBedTargetWorld.x, truckBedTargetWorld.y + .5, truckBedTargetWorld.z);
    }
  }

  return {
    duration: DURATION,
    renderAt(t) {
      const clampedT = Math.max(0, Math.min(DURATION, t));
      updateAnimation(clampedT);
      renderer.render(scene, camera);
    },
    dispose() {
      // Resource cleanup
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
    }
  };
}