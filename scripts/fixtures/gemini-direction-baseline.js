/*CRIESEUVIDEO_DIRECTION_V1
{
  "version": 1,
  "duration": 10.2,
  "timing": "provided",
  "objects": [
    {
      "id": "canteiro",
      "description": "Canteiro de horta com 4 tábuas, terra e mudas verdes",
      "parts": ["tabua1", "tabua2", "tabua3", "tabua4", "terra", "muda1", "muda2", "muda3", "muda4"]
    },
    {
      "id": "cisterna",
      "description": "Sistema de captação com calha e reservatório de água azul",
      "parts": ["tanque", "tampa", "calha", "tubo", "agua"]
    },
    {
      "id": "paineis",
      "description": "Quatro painéis solares azuis montados sobre o telhado laranja",
      "parts": ["painel1", "painel2", "painel3", "painel4"]
    }
  ],
  "shots": [
    {
      "id": "shot_horta",
      "firstWord": 0,
      "quote": "Vamos montar um espaço que produz parte da comida,",
      "subjects": ["canteiro"],
      "focus": "canteiro",
      "camera": "detail",
      "action": "As 4 tábuas se encaixam no chão, a terra preenche o canteiro e as mudas de plantas brotam.",
      "before": "Quintal vazio ao lado da casa com marcas no gramado",
      "after": "Canteiro montado e mudas viçosas crescendo com resultado visível"
    },
    {
      "id": "shot_chuva",
      "firstWord": 9,
      "quote": "aproveita a chuva e ajuda a manter o essencial funcionando.",
      "subjects": ["cisterna"],
      "focus": "cisterna",
      "camera": "detail",
      "action": "O tanque azul se posiciona, a calha se fixa na borda do telhado e a água flui para o reservatório.",
      "before": "Borda da casa vazia",
      "after": "Tanque azul montado e cheio d'água captada do telhado"
    },
    {
      "id": "shot_telhado",
      "firstWord": 19,
      "quote": "Agora olhe o telhado: painéis solares.",
      "subjects": ["paineis"],
      "focus": "paineis",
      "camera": "detail",
      "action": "Quatro painéis fotovoltaicos deslizam e se fixam na superfície do telhado laranja.",
      "before": "Telhado laranja liso sem equipamentos",
      "after": "Telhado laranja equipado com 4 painéis solares brilhantes em pleno funcionamento"
    }
  ]
}
*/

const DIRECTOR_SCORE = {"version":1,"duration":10.2,"timing":"provided","objects":[{"id":"canteiro","description":"Canteiro de horta com 4 tábuas, terra e mudas verdes","parts":["tabua1","tabua2","tabua3","tabua4","terra","muda1","muda2","muda3","muda4"]},{"id":"cisterna","description":"Sistema de captação com calha e reservatório de água azul","parts":["tanque","tampa","calha","tubo","agua"]},{"id":"paineis","description":"Quatro painéis solares azuis montados sobre o telhado laranja","parts":["painel1","painel2","painel3","painel4"]}],"shots":[{"id":"shot_horta","quote":"Vamos montar um espaço que produz parte da comida,","firstWord":0,"subjects":["canteiro"],"focus":"canteiro","camera":"detail","action":"As 4 tábuas se encaixam no chão, a terra preenche o canteiro e as mudas de plantas brotam.","before":"Quintal vazio ao lado da casa com marcas no gramado","after":"Canteiro montado e mudas viçosas crescendo com resultado visível","start":0,"end":3.14},{"id":"shot_chuva","quote":"aproveita a chuva e ajuda a manter o essencial funcionando.","firstWord":9,"subjects":["cisterna"],"focus":"cisterna","camera":"detail","action":"O tanque azul se posiciona, a calha se fixa na borda do telhado e a água flui para o reservatório.","before":"Borda da casa vazia","after":"Tanque azul montado e cheio d'água captada do telhado","start":3.14,"end":7.04},{"id":"shot_telhado","quote":"Agora olhe o telhado: painéis solares.","firstWord":19,"subjects":["paineis"],"focus":"paineis","camera":"detail","action":"Quatro painéis fotovoltaicos deslizam e se fixam na superfície do telhado laranja.","before":"Telhado laranja liso sem equipamentos","after":"Telhado laranja equipado com 4 painéis solares brilhantes em pleno funcionamento","start":7.04,"end":10.2}],"lessonVersion":"spoken-actions-v1"};
function createScene(THREE, canvas, width, height, tools) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

  // Iluminação
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
  sunLight.position.set(12, 18, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 40;
  const d = 12;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  scene.add(sunLight);

  // Terreno / Chão
  const groundGeo = new THREE.PlaneGeometry(50, 50);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x557a2b, roughness: 0.9, metalness: 0.1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Casa persistente
  const houseGroup = new THREE.Group();
  houseGroup.position.set(0, 0, -2);
  scene.add(houseGroup);

  // Paredes da Casa
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5eedc, roughness: 0.7 });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(6, 3.5, 5), wallMat);
  walls.position.y = 1.75;
  walls.castShadow = true;
  walls.receiveShadow = true;
  houseGroup.add(walls);

  // Telhado Laranja (Prisma triangular)
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-3.4, 0);
  roofShape.lineTo(0, 2.0);
  roofShape.lineTo(3.4, 0);
  roofShape.closePath();

  const extrudeSettings = { depth: 5.6, bevelEnabled: false };
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd95d28, roughness: 0.5 }); // Laranja
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 3.5, -2.8);
  roof.castShadow = true;
  roof.receiveShadow = true;
  houseGroup.add(roof);

  // Porta e Janela da Casa
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.6 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1, 2.1, 0.1), doorMat);
  door.position.set(-1.5, 1.05, 2.51);
  houseGroup.add(door);

  const windowMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.2, metalness: 0.8 });
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.1), windowMat);
  win.position.set(1.2, 2.0, 2.51);
  houseGroup.add(win);

  // --- REGISTRO DE SUPERFÍCIES ---
  tools.registerSurface('chao', ground);
  tools.registerSurface('telhado_dir', roof);

  // --- OBJETOS DAS MONTAGENS ---

  // 1. CANTEIRO DA HORTA
  const hortaGroup = new THREE.Group();
  hortaGroup.position.set(-2.5, 0, 2.5);
  scene.add(hortaGroup);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e4723, roughness: 0.8 });
  const earthMat = new THREE.MeshStandardMaterial({ color: 0x3d2612, roughness: 0.95 });
  const plantMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.6 });

  // Tábuas (4 laterais)
  const tLongGeo = new THREE.BoxGeometry(2.4, 0.3, 0.08);
  const tShortGeo = new THREE.BoxGeometry(0.08, 0.3, 1.6);

  const tabua1 = new THREE.Mesh(tLongGeo, woodMat); // Frente
  tabua1.position.set(0, 0.15, 0.8);
  tabua1.castShadow = true;
  hortaGroup.add(tabua1);

  const tabua2 = new THREE.Mesh(tLongGeo, woodMat); // Tras
  tabua2.position.set(0, 0.15, -0.8);
  tabua2.castShadow = true;
  hortaGroup.add(tabua2);

  const tabua3 = new THREE.Mesh(tShortGeo, woodMat); // Esquerda
  tabua3.position.set(-1.2, 0.15, 0);
  tabua3.castShadow = true;
  hortaGroup.add(tabua3);

  const tabua4 = new THREE.Mesh(tShortGeo, woodMat); // Direita
  tabua4.position.set(1.2, 0.15, 0);
  tabua4.castShadow = true;
  hortaGroup.add(tabua4);

  // Terra
  const terra = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.22, 1.52), earthMat);
  terra.position.set(0, 0.11, 0);
  terra.receiveShadow = true;
  hortaGroup.add(terra);

  // Mudas (4 plantas)
  const mudasGroup = new THREE.Group();
  hortaGroup.add(mudasGroup);
  const leafGeo = new THREE.SphereGeometry(0.18, 8, 8);
  leafGeo.scale(1, 1.4, 1);

  const mudas = [];
  const coords = [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]];
  coords.forEach((pos) => {
    const m = new THREE.Mesh(leafGeo, plantMat);
    m.position.set(pos[0], 0.25, pos[1]);
    m.castShadow = true;
    mudasGroup.add(m);
    mudas.push(m);
  });

  // 2. CISTERNA / RESERVATÓRIO DE ÁGUA
  const cisternaGroup = new THREE.Group();
  cisternaGroup.position.set(3.2, 0, 0.5);
  scene.add(cisternaGroup);

  const tankMat = new THREE.MeshStandardMaterial({ color: 0x1d70b8, roughness: 0.3 }); // Tanque azul
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x778899, metalness: 0.8, roughness: 0.3 });
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x33aacc, transmission: 0.7, opacity: 1, transparent: true, roughness: 0.1 });

  // Tanque Azul
  const tanque = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 24), tankMat);
  tanque.position.y = 0.8;
  tanque.castShadow = true;
  tanque.receiveShadow = true;
  cisternaGroup.add(tanque);

  // Tampa
  const tampa = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 24), metalMat);
  tampa.position.y = 1.65;
  tampa.castShadow = true;
  cisternaGroup.add(tampa);

  // Calha no telhado
  const calha = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 5.2), metalMat);
  calha.position.set(3.4, 3.45, -2);
  calha.castShadow = true;
  scene.add(calha);

  // Tubo conector para o tanque
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 12), metalMat);
  tubo.position.set(3.2, 2.4, 0.5);
  tubo.castShadow = true;
  scene.add(tubo);

  // Nível de Água (Efeito de enchimento)
  const agua = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.4, 24), waterMat);
  agua.position.y = 0.75;
  agua.scale.set(1, 0.01, 1); // inicia vazia
  cisternaGroup.add(agua);

  // 3. PAINÉIS SOLARES
  const paineisGroup = new THREE.Group();
  scene.add(paineisGroup);

  const solarPanelMat = new THREE.MeshStandardMaterial({ color: 0x0f2b48, roughness: 0.2, metalness: 0.9 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8, roughness: 0.4 });
  const panelGeo = new THREE.BoxGeometry(1.2, 0.05, 1.8);

  const paineis = [];
  const panelPos = [
    { x: 1.5, z: -3.2 },
    { x: 1.5, z: -1.0 },
    { x: 0.1, z: -3.2 },
    { x: 0.1, z: -1.0 }
  ];

  panelPos.forEach((p) => {
    const pGroup = new THREE.Group();
    const mesh = new THREE.Mesh(panelGeo, solarPanelMat);
    mesh.castShadow = true;
    const border = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.04, 1.84), frameMat);
    border.position.y = -0.01;
    pGroup.add(mesh);
    pGroup.add(border);

    // Alinhamento com a água do telhado (inclinado a 30,49 graus)
    pGroup.rotation.z = -Math.atan2(2.0, 3.4);
    pGroup.position.set(p.x, 3.5 + (3.4 - p.x) * (2.0 / 3.4), p.z);
    paineisGroup.add(pGroup);
    paineis.push(pGroup);
  });

  // --- PREPARAÇÃO DOS CONTROLADORES DE MONTAGEM (ASSEMBLY) ---

  const shots = DIRECTOR_SCORE.shots;

  // Shot 1: Horta (0.0s até ~3.14s)
  const s1 = shots[0];
  const t1_c1 = tools.createAssemblyPart(tabua1, { start: s1.start + 0.1, end: s1.start + 0.5, fromPosition: [-2.5, 3, 3.3] });
  const t1_c2 = tools.createAssemblyPart(tabua2, { start: s1.start + 0.3, end: s1.start + 0.7, fromPosition: [-2.5, 3, 1.7] });
  const t1_c3 = tools.createAssemblyPart(tabua3, { start: s1.start + 0.5, end: s1.start + 0.9, fromPosition: [-3.7, 3, 2.5] });
  const t1_c4 = tools.createAssemblyPart(tabua4, { start: s1.start + 0.7, end: s1.start + 1.1, fromPosition: [-1.3, 3, 2.5] });
  const t1_terra = tools.createAssemblyPart(terra, { start: s1.start + 1.2, end: s1.start + 1.7, fromPosition: [-2.5, 0.11, 2.5] });

  // Shot 2: Cisterna & Água (3.14s até ~7.04s)
  const s2 = shots[1];
  const t2_tanque = tools.createAssemblyPart(tanque, { start: s2.start + 0.1, end: s2.start + 0.7, fromPosition: [5.0, 0.8, 0.5] });
  const t2_tampa = tools.createAssemblyPart(tampa, { start: s2.start + 0.6, end: s2.start + 1.0, fromPosition: [3.2, 4.0, 0.5] });
  const t2_calha = tools.createAssemblyPart(calha, { start: s2.start + 1.0, end: s2.start + 1.5, fromPosition: [3.4, 6.0, -2] });
  const t2_tubo = tools.createAssemblyPart(tubo, { start: s2.start + 1.4, end: s2.start + 1.8, fromPosition: [3.2, 2.4, 3.0] });

  // Shot 3: Painéis Solares (7.04s até 10.2s)
  const s3 = shots[2];
  const pCtrl = paineis.map((p, idx) => {
    return tools.createAssemblyPart(p, {
      start: s3.start + 0.2 + idx * 0.3,
      end: s3.start + 0.7 + idx * 0.3,
      fromPosition: [p.position.x + 1.5, p.position.y + 2.5, p.position.z]
    });
  });

  // Animação inicial de visibilidade da terra
  terra.scale.set(1, 0.001, 1);

  return {
    duration: DIRECTOR_SCORE.duration,
    renderAt(t) {
      // Aplicar montagens por tempo absoluto
      t1_c1.apply(t);
      t1_c2.apply(t);
      t1_c3.apply(t);
      t1_c4.apply(t);
      t1_terra.apply(t);

      // Animação de crescimento da terra e mudas (Shot 1)
      const terraProg = tools.cue(t, s1.start + 1.2, s1.start + 1.7);
      terra.scale.set(1, Math.max(0.001, terraProg), 1);

      mudas.forEach((m, idx) => {
        const mProg = tools.cue(t, s1.start + 1.6 + idx * 0.2, s1.start + 2.2 + idx * 0.2);
        m.scale.setScalar(mProg);
      });

      // Cisterna (Shot 2)
      t2_tanque.apply(t);
      t2_tampa.apply(t);
      t2_calha.apply(t);
      t2_tubo.apply(t);

      // Animação da água enchendo (Shot 2 resultado visível)
      const aguaProg = tools.cue(t, s2.start + 2.0, s2.start + 3.0);
      agua.scale.set(1, Math.max(0.01, aguaProg * 0.9), 1);
      agua.position.y = 0.1 + (aguaProg * 0.9 * 0.7);

      // Painéis (Shot 3)
      pCtrl.forEach(ctrl => ctrl.apply(t));

      // CAMERA CINEMATOGRÁFICA (Troca de cortes exatos pelos planos da partitura)
      if (t < s2.start) {
        // Shot 1: Foco na Horta
        const progress = tools.cue(t, s1.start, s1.start + 2.5);
        camera.position.set(
          -2.5 + Math.sin(progress * 0.2) * 0.5,
          2.2,
          5.8 - progress * 0.3
        );
        camera.lookAt(-2.5, 0.4, 2.5);
      } else if (t < s3.start) {
        // Shot 2: Foco no Tanque/Cisterna e Calha
        const progress = tools.cue(t, s2.start, s2.start + 3.0);
        camera.position.set(
          6.0 - progress * 0.2,
          2.5 + progress * 0.2,
          4.2
        );
        camera.lookAt(3.2, 1.8, 0.0);
      } else {
        // Shot 3: Foco nos Painéis Solares no Telhado
        const progress = tools.cue(t, s3.start, s3.start + 3.0);
        camera.position.set(
          3.5 + Math.cos(progress * 0.2) * 0.4,
          5.5 + progress * 0.2,
          1.8 + progress * 0.4
        );
        camera.lookAt(0.8, 4.0, -2.0);
      }

      renderer.render(scene, camera);
    },
    dispose() {
      scene.clear();
      renderer.dispose();
    }
  };
}