function createScene(THREE, canvas, width, height) {
  const DURATION = 10;

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
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = Math.random() * 2;
      ctx.fillStyle = Math.random() > 0.5 ? '#5c4734' : '#9c836a';
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
    const h = 15 + Math.random() * 30;
    const w = 6 + Math.random() * 6;
    const d = 6 + Math.random() * 6;
    const bldg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() > 0.5 ? bldgMat : bldgMat2);
    const angle = (i / 15) * Math.PI * 1.5 + Math.PI * 0.25;
    const dist = 35 + Math.random() * 15;
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
  boomGroup.position.set(-0.5, 1.5, 0);
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
  boomGroup.rotation.x = -Math.PI * 0.12; 

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

  const hookShape = new THREE.TorpusGeometry || THREE.TorusGeometry;
  const hookMetal = new THREE.Mesh(new hookShape(0.2, 0.06, 8, 16, Math.PI * 1.5), lightMetalMat);
  hookMetal.position.y = -0.5;
  hookMetal.rotation.z = Math.PI;
  hookGroup.add(hookMetal);

  // Rigging Lines (Dynamic Visual Cables)
  const cableGeo = new THREE.BufferGeometry();
  const cablePositions = new Float32Array(4 * 3); // 2 lines, 4 points
  cableGeo.setAttribute('position', new THREE.BufferAttribute(cablePositions, 3));
  const cablesMesh = new THREE.LineSegments(cableGeo, cableMat);
  scene.add(cablesMesh);

  // Spreading Rig Cables to Container
  const rigGeo = new THREE.BufferGeometry();
  const rigPositions = new Float32Array(4 * 2 * 3); // 4 lines to corners
  rigGeo.setAttribute('position', new THREE.BufferAttribute(rigPositions, 3));
  const rigMesh = new THREE.LineSegments(rigGeo, cableMat);
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
    // TIMELINE PHASES (Total 10s)
    // 0.0 - 1.5s: Lower hook to container on ground
    // 1.5 - 4.0s: Lift container up high
    // 4.0 - 7.0s: Rotate crane boom & move trolley over truck bed
    // 7.0 - 9.0s: Lower container precisely onto truck bed
    // 9.0 - 10.0s: Release hook & slightly raise empty hook (Anticipation / Wrap up)

    const pLower = smoothstep(0.0, 1.5, t);
    const pLift = smoothstep(1.5, 4.0, t);
    const pSlew = smoothstep(4.0, 7.0, t);
    const pPlace = smoothstep(7.0, 9.0, t);
    const pRelease = smoothstep(9.0, 10.0, t);

    // Crane Slewing (Rotation)
    const startAngle = 0;
    const targetAngle = -Math.PI * 0.62;
    const currentSlew = lerp(startAngle, targetAngle, pSlew);
    craneSlewBody.rotation.y = currentSlew;

    // Trolley position along boom (Z axis of boom local space)
    const startTrolleyZ = 8.5;
    const targetTrolleyZ = 11.2;
    const currentTrolleyZ = lerp(startTrolleyZ, targetTrolleyZ, pSlew);
    trolleyGroup.position.z = currentTrolleyZ;

    // Calculate World Position of Trolley
    const trolleyWorldPos = new THREE.Vector3();
    trolleyGroup.getWorldPosition(trolleyWorldPos);

    // Hook Heights
    const hookGroundY = 2.4;  // Hook resting right above container top on ground (1.1*2 + 0.2)
    const hookLiftY = 9.5;    // High height during slew
    const hookDropY = 4.3;    // Height when container touches truck bed

    let hookY = lerp(8.0, hookGroundY, pLower); // start slightly elevated then touch down
    if (t > 1.5) hookY = lerp(hookGroundY, hookLiftY, pLift);
    if (t > 4.0) hookY = hookLiftY;
    if (t > 7.0) hookY = lerp(hookLiftY, hookDropY, pPlace);
    if (t > 9.0) hookY = lerp(hookDropY, hookDropY + 1.5, pRelease);

    // Hook World Position
    hookGroup.position.set(trolleyWorldPos.x, hookY, trolleyWorldPos.z);
    // Smooth hook rotation to align container gradually
    const currentContainerRot = lerp(startContainerRotY, truckGroup.rotation.y, pSlew);
    hookGroup.rotation.y = currentContainerRot;

    // Update Main Cables (Trolley to Hook Block)
    const cablePosAttr = cablesMesh.geometry.attributes.position;
    cablePosAttr.setXYZ(0, trolleyWorldPos.x - 0.2, trolleyWorldPos.y - 0.5, trolleyWorldPos.z);
    cablePosAttr.setXYZ(1, hookGroup.position.x - 0.2, hookGroup.position.y + 0.3, hookGroup.position.z);
    cablePosAttr.setXYZ(2, trolleyWorldPos.x + 0.2, trolleyWorldPos.y - 0.5, trolleyWorldPos.z);
    cablePosAttr.setXYZ(3, hookGroup.position.x + 0.2, hookGroup.position.y + 0.3, hookGroup.position.z);
    cablePosAttr.needsUpdate = true;

    // Container Hierarchy & Attachment State
    // Container is attached to hook from t = 1.5 to t = 9.0
    if (t < 9.0) {
      containerGroup.position.set(hookGroup.position.x, hookGroup.position.y - 1.3, hookGroup.position.z);
      containerGroup.rotation.y = hookGroup.rotation.y;
    } else {
      // Container rests permanently on truck bed after touch down
      containerGroup.position.set(2.9, 2.2, -4.8);
      containerGroup.rotation.y = truckGroup.rotation.y;
    }

    // Update Rigging Spread Cables (Hook to 4 top corners of Container)
    const rigPosAttr = rigMesh.geometry.attributes.position;
    if (t < 9.0) {
      rigMesh.visible = true;
      const corners = [
        new THREE.Vector3(-1.0, 1.1, -2.4),
        new THREE.Vector3(1.0, 1.1, -2.4),
        new THREE.Vector3(1.0, 1.1, 2.4),
        new THREE.Vector3(-1.0, 1.1, 2.4)
      ];
      corners.forEach((c, idx) => {
        c.applyAxisAngle(new THREE.Vector3(0, 1, 0), containerGroup.rotation.y);
        c.add(containerGroup.position);
        rigPosAttr.setXYZ(idx * 2, hookGroup.position.x, hookGroup.position.y - 0.4, hookGroup.position.z);
        rigPosAttr.setXYZ(idx * 2 + 1, c.x, c.y, c.z);
      });
      rigPosAttr.needsUpdate = true;
    } else {
      rigMesh.visible = false; // Detached rig
    }

    // --- CINEMATIC CAMERA SYSTEM (4 SHOTS) ---
    if (t < 2.5) {
      // SHOT 1: Wide Ground Setup - Focus on container lift off
      const ct = t / 2.5;
      const camX = lerp(-12, -10, ct);
      const camY = lerp(3, 2, ct);
      const camZ = lerp(12, 9, ct);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(-5, 2, 3);
    } else if (t < 5.5) {
      // SHOT 2: Low-angle Hero Shot tracking hook & rising container upwards
      const ct = (t - 2.5) / 3.0;
      const camX = lerp(-4, -1, ct);
      const camY = lerp(1.5, 3.5, ct);
      const camZ = lerp(7, 6, ct);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(containerGroup.position.x, containerGroup.position.y + 1.0, containerGroup.position.z);
    } else if (t < 8.0) {
      // SHOT 3: High Crane Angle tracking rotation towards truck
      const ct = (t - 5.5) / 2.5;
      const camX = lerp(8, 6, ct);
      const camY = lerp(14, 10, ct);
      const camZ = lerp(10, 7, ct);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(containerGroup.position.x, containerGroup.position.y, containerGroup.position.z);
    } else {
      // SHOT 4: Ground Close-up of landing on truck bed
      const ct = (t - 8.0) / 2.0;
      const camX = lerp(7, 5.5, ct);
      const camY = lerp(2, 2.5, ct);
      const camZ = lerp(-0.5, -1.0, ct);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(truckGroup.position.x - 0.5, 2.2, truckGroup.position.z - 0.8);
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