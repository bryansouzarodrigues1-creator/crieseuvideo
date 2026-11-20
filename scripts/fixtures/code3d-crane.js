// Hand-authored browser regression fixture. This is NOT a Gemini generation.
// It exercises the exact createScene contract, isolated player and export path.
function createScene(THREE, canvas, width, height) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a8cde0');
  scene.fog = new THREE.Fog('#a8cde0', 35, 70);
  const camera = new THREE.PerspectiveCamera(43, width / height, .1, 90);
  scene.add(new THREE.HemisphereLight('#fff8df', '#506472', 2.3));
  const sun = new THREE.DirectionalLight('#fff0d0', 3);
  sun.position.set(8, 16, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
  scene.add(sun);
  const material = (color, metalness = .1) => new THREE.MeshStandardMaterial({ color, roughness: .65, metalness });
  const steel = material('#33465a', .6), yellow = material('#f7b82c', .3);
  const concrete = material('#afb4b3'), orange = material('#e56b3f'), blue = material('#176b91', .4);
  const rubber = material('#162534'), glass = material('#a1e1ee', .3);
  function box(parent, x, y, z, sx, sy, sz, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function beam(parent, a, b, radius, mat) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), direction = to.clone().sub(from);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 6), mat);
    m.position.copy(from.add(to).multiplyScalar(.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    m.castShadow = true; parent.add(m); return m;
  }
  box(scene, 0, -.16, 0, 45, .3, 40, material('#c4b291'));
  box(scene, -2, .01, 4.2, 22, .04, 3.4, material('#626c70'));
  for (let i = -4; i <= 4; i++) box(scene, i * 2.5, .04, 4.2, 1.1, .02, .08, material('#ecdfbd'));
  for (let i = 0; i < 6; i++) {
    const x = -12 + i * 4.4, h = 3 + (i % 3) * 1.7;
    box(scene, x, h / 2, -8, 3.1, h, 3, material(i % 2 ? '#8197a3' : '#95a6ac'));
    for (let row = 1; row < h; row += 1.3) for (let col = -1; col <= 1; col++)
      box(scene, x + col * .8, row, -6.48, .45, .6, .04, glass);
  }
  box(scene, -3, .15, 0, 2.5, .3, 2.5, concrete);
  const tower = new THREE.Group(); tower.position.set(-3, .3, 0); scene.add(tower);
  for (const x of [-.45, .45]) for (const z of [-.45, .45]) box(tower, x, 3.35, z, .14, 6.7, .14, yellow);
  for (let y = 0; y < 6.5; y += 1.1) {
    for (const z of [-.45, .45]) {
      beam(tower, [-.45, y, z], [.45, y + 1.1, z], .045, yellow);
      beam(tower, [.45, y, z], [-.45, y + 1.1, z], .045, yellow);
    }
    box(tower, 0, y, 0, 1, .08, 1, yellow);
  }
  const slew = new THREE.Group(); slew.position.set(-3, 7, 0); scene.add(slew);
  box(slew, 1.8, .15, 0, 7.8, .18, .55, yellow);
  box(slew, 1.8, .75, 0, 7.8, .12, .55, yellow);
  for (let x = -2; x < 5.4; x += .7) {
    for (const z of [-.27, .27]) beam(slew, [x, .15, z], [x + .7, .75, z], .04, yellow);
  }
  box(slew, -1.7, -.15, 0, 1.1, .7, 1, concrete);
  box(slew, -.25, -.45, .65, .85, .85, .7, yellow);
  box(slew, -.22, -.4, 1.01, .6, .5, .035, glass);
  box(slew, 4.2, .03, 0, .45, .28, .8, steel);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1, 6), steel); slew.add(cable);
  const hook = new THREE.Group(); slew.add(hook);
  box(hook, 0, 0, 0, .28, .22, .18, steel);
  const hookRing = new THREE.Mesh(new THREE.TorusGeometry(.13, .035, 6, 12, Math.PI * 1.4), yellow);
  hookRing.position.y = -.18; hook.add(hookRing);
  const slings = new THREE.Group(); hook.add(slings);
  for (const x of [-.8, .8]) for (const z of [-.45, .45]) beam(slings, [0, -.15, 0], [x, -.7, z], .018, steel);
  const cargo = new THREE.Group(); scene.add(cargo);
  box(cargo, 0, 0, 0, 1.9, 1.2, 1.2, blue);
  for (let x = -.85; x < .9; x += .18) for (const z of [-.62, .62]) box(cargo, x, 0, z, .035, 1.1, .025, blue);
  for (const x of [-.96, .96]) box(cargo, x, 0, .62, .045, 1.2, .035, steel);
  const truck = new THREE.Group(); truck.position.set(-3, 0, 4.2); scene.add(truck);
  box(truck, 0, .87, 0, 2.4, .25, 1.6, steel);
  box(truck, 1.85, 1.1, 0, 1.1, 1.45, 1.55, orange);
  box(truck, 1.86, 1.5, .79, .8, .55, .03, glass);
  box(truck, 2.42, 1.45, 0, .03, .6, 1.2, glass);
  for (const x of [-.8, .8, 1.85]) for (const z of [-.83, .83]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .2, 12), rubber);
    wheel.rotation.x = Math.PI / 2; wheel.position.set(x, .4, z); truck.add(wheel);
  }
  for (let i = 0; i < 4; i++) {
    box(scene, 4 + i * .55, .15 + i * .08, -3, .4, .3 + i * .16, .55, concrete);
  }
  const ease = (t, a, b) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
  function renderAt(t) {
    const angle = -Math.PI / 2 * ease(t, 3, 5.1);
    const hookY = 1.9 + 2.6 * ease(t, .6, 2.7) - 1.6 * ease(t, 5.3, 6.8) + 1.8 * ease(t, 7, 8);
    slew.rotation.y = angle;
    hook.position.set(4.2, hookY - 7, 0);
    const length = 7 - hookY;
    cable.position.set(4.2, -length / 2, 0); cable.scale.set(1, length, 1);
    slings.visible = t < 7;
    const cargoY = t < 7 ? hookY - 1.3 : 1.6;
    cargo.position.set(-3 + 4.2 * Math.cos(angle), cargoY, -4.2 * Math.sin(angle));
    cargo.rotation.y = angle;
    const close = ease(t, 4.5, 7.5);
    camera.position.set(16 - close * 4, 11 - close * 2, 22 - close * 4);
    camera.lookAt(-.5 - close, 3.5 - close * .8, 1.5);
    renderer.render(scene, camera);
  }
  return { duration: 8, renderAt, dispose() {
    scene.traverse(o => { o.geometry?.dispose(); if (o.material) for (const m of [o.material].flat()) m.dispose(); });
    renderer.dispose();
  } };
}
