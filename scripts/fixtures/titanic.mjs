/** Developer-authored SceneProgram for the "how the Titanic was built, and its problems" explainer.
 * This is what Gemini would have to write; here it is authored by hand so the engine can be judged without any AI call. */
export const SENTENCES = [
  'Em março de 1909, num estaleiro de Belfast, começou a construção do Titanic.',
  'Uma enorme estrutura de aço com gruas cobria o casco, e mais de quinze mil operários trabalhavam ali.',
  'Oito deles morreram durante a obra.',
  'O casco era unido por cerca de três milhões de rebites, muitos deles de ferro.',
  'Problema um: esse ferro tinha escória demais e ficava quebradiço na água gelada do Atlântico Norte.',
  'Problema dois: dezesseis compartimentos, mas as paredes eram baixas e a água passava por cima delas.',
  'Problema três: vinte botes salva-vidas, com lugar para cerca de metade das pessoas a bordo.',
  'Em 31 de maio de 1911, o casco desceu ao rio, levando todos esses problemas junto.',
];
export const SCRIPT = SENTENCES.join(' ');
const ID = SENTENCES.map((_, i) => `s${i + 1}`);

/** Lofted hull: sections along X (bow at +X), U-shaped cross sections, painted red below the waterline, black above. */
function hull({ L = 70, H = 9, B = 4.75, N = 28, K = 8 } = {}) {
  const vertices = [], colors = [], indices = [], rings = [], deck = [];
  const red = [.56, .17, .13], black = [.08, .09, .11], wood = [.72, .58, .36];
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = -L / 2 + L * t;
    const u = Math.max(0, (t - .78) / .22), s = Math.max(0, (.1 - t) / .1);
    const w = B * Math.pow(Math.max(0, 1 - u * u), .55) * (1 - .35 * s * s), top = H + 1.1 * Math.pow(2 * (t - .5), 2), keel = 3 * u * u + .6 * s * s;
    const ring = [];
    for (let j = -K; j <= K; j++) {
      const v = Math.abs(j) / K, z = Math.sign(j) * w * Math.sin(v * Math.PI / 2), y = keel + (top - keel) * (1 - Math.pow(Math.cos(v * Math.PI / 2), 1.6));
      ring.push(vertices.length / 3); vertices.push(x, y, z); colors.push(...(y < 2.5 ? red : black));
    }
    rings.push(ring);
    const l = vertices.length / 3; vertices.push(x, top, -w, x, top, w); colors.push(...wood, ...wood); deck.push([l, l + 1]);
  }
  const quads = [];
  for (let i = 0; i < N; i++) for (let m = 0; m < 2 * K; m++) quads.push([rings[i][m], rings[i][m + 1], rings[i + 1][m], rings[i + 1][m + 1]]);
  for (let i = 0; i < N; i++) quads.push([deck[i][0], deck[i][1], deck[i + 1][0], deck[i + 1][1]]);
  const cap = vertices.length / 3; vertices.push(-L / 2, H * .5, 0); colors.push(...black);
  const tris = quads.flatMap(([a, b, c, d]) => [[a, b, c], [b, d, c]]);
  for (let m = 0; m < 2 * K; m++) tris.push([cap, rings[0][m], rings[0][m + 1]]);
  const centre = [0, H * .45, 0];
  for (const [a, b, c] of tris) { // face every triangle away from the middle of the hull
    const p = [a, b, c].map((k) => vertices.slice(k * 3, k * 3 + 3)), e1 = p[1].map((v, k) => v - p[0][k]), e2 = p[2].map((v, k) => v - p[0][k]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (Math.hypot(...n) < 1e-9) continue;
    const mid = p[0].map((v, k) => (v + p[1][k] + p[2][k]) / 3), out = mid.reduce((s, v, k) => s + (v - centre[k]) * n[k], 0);
    indices.push(...(out >= 0 ? [a, b, c] : [a, c, b]));
  }
  return { shape: 'mesh', vertices: vertices.map((v) => +v.toFixed(3)), indices, colors };
}
const rib = (() => { // one frame of the hull, as a tube from the port deck edge, under the keel, to the starboard edge
  const points = [], K = 7, B = 4.4, H = 9;
  for (let j = -K; j <= K; j++) { const v = Math.abs(j) / K; points.push([0, +(H * (1 - Math.pow(Math.cos(v * Math.PI / 2), 1.6))).toFixed(3), +(Math.sign(j) * B * Math.sin(v * Math.PI / 2)).toFixed(3)]); }
  return points;
})();

const HIDE = -150; // underground: hidden props wait here
export function titanicProgram() {
  const nodes = [], tracks = [];
  const add = (id, kind, ctx, position, more = {}) => { nodes.push({ id, kind, contextSourceId: ctx, position, ...more }); return id; };
  const mesh = (id, ctx, position, geometry, color, more = {}) => add(id, 'mesh', ctx, position, { geometry, color, ...more });
  const group = (id, ctx, position, more = {}) => add(id, 'group', ctx, position, more);
  const track = (node, channel, interpolation, keys) => tracks.push({ node, channel, interpolation, keys: keys.map(([sourceId, phase, value]) => ({ sourceId, phase, value })) });
  /** A prop that exists only during sentences first..last (1-based): it waits underground otherwise. */
  const onlyDuring = (id, home, first, last) => {
    const keys = []; if (first > 1) keys.push([ID[0], 0, [home[0], HIDE, home[2]]]);
    keys.push([ID[first - 1], 0, home]); if (last < ID.length) keys.push([ID[last], 0, [home[0], HIDE, home[2]]]);
    track(id, 'position', 'step', keys);
  };

  // ---------- Yard, river, background ----------
  mesh('chao', 's1', [-44, -.25, 0], { shape: 'box', size: [160, .5, 190] }, '#8D8678');
  mesh('rio', 's1', [136, .03, 0], { shape: 'water', size: [200, 200], wave: .2, segments: 40 }, '#3C6E8F', { material: { opacity: .94 } });
  mesh('rampa', 's1', [-9, .4, 0], { shape: 'box', size: [78, .8, 15], bevel: .1 }, '#7A5C3E');
  mesh('calcos', 's1', [-30, 1.1, 0], { shape: 'box', size: [1, .6, 3], bevel: .05 }, '#4D3B2A', { repeat: { count: 13, step: [5, 0, 0], jitter: [0, 0, 0], seed: 1 } });
  mesh('predios', 's1', [-100, 6.5, -70], { shape: 'box', size: [11, 13, 15], bevel: .3 }, '#A0614A', { repeat: { count: 6, step: [22, 0, 0], jitter: [0, 4, 6], seed: 3 } });
  mesh('chamines', 's1', [-94, 12, -80], { shape: 'cylinder', size: [.7, 1, 24] }, '#7A4B3A', { repeat: { count: 3, step: [44, 0, 0], jitter: [6, 0, 0], seed: 5 } });

  mesh('caixas', 's1', [-26, .6, 27], { shape: 'box', size: [1.6, 1.2, 1.6], bevel: .12 }, '#8B5E3C', { repeat: { count: 30, step: [0, 0, 0], jitter: [72, 0, 14], seed: 2 } });
  mesh('barris', 's1', [-26, .55, 38], { shape: 'cylinder', size: [.5, .5, 1.1] }, '#3E4A5A', { repeat: { count: 26, step: [0, 0, 0], jitter: [72, 0, 10], seed: 6 } });

  // ---------- Gantry with trolleys (sentences 1-2, and in the background after that) ----------
  group('portico', 's2', [0, 0, 0]);
  const steel = '#C9622B';
  for (const side of [-1, 1]) {
    mesh(`pernas${side}`, 's2', [-31.5, 13.5, 11 * side], { shape: 'box', size: [1.1, 27, 1.1], bevel: .1 }, steel, { parent: 'portico', repeat: { count: 6, step: [12.6, 0, 0], jitter: [0, 0, 0], seed: 1 } });
    mesh(`viga${side}`, 's2', [0, 27, 11 * side], { shape: 'box', size: [74, 1.5, 1.5], bevel: .1 }, steel, { parent: 'portico' });
    mesh(`travessa${side}`, 's2', [0, 14, 11 * side], { shape: 'box', size: [74, .8, .8], bevel: .05 }, steel, { parent: 'portico' });
  }
  mesh('vigas_cruz', 's2', [-31.5, 27.5, 0], { shape: 'box', size: [1, 1, 22.5], bevel: .08 }, steel, { parent: 'portico', repeat: { count: 6, step: [12.6, 0, 0], jitter: [0, 0, 0], seed: 1 } });
  for (const [id, x] of [['carro1', -26], ['carro2', 22]]) {
    group(id, 's2', [x, 26, 0]);
    mesh(`${id}_corpo`, 's2', [0, 0, 0], { shape: 'box', size: [3, 1.2, 3.4], bevel: .15 }, '#2F3640', { parent: id });
    group(`${id}_cabo`, 's2', [0, -.6, 0], { parent: id, scale: [1, 8, 1] });
    mesh(`${id}_cabo_m`, 's2', [0, -.5, 0], { shape: 'cylinder', size: [.09, .09, 1] }, '#1B1722', { parent: `${id}_cabo` });
    mesh(`${id}_chapa`, 's2', [0, -8.8, 0], { shape: 'box', size: [7, .35, 3.2], bevel: .05 }, '#7E8892', { parent: id });
  }
  // the first trolley rolls across and lowers its plate towards the hull while the narrator talks
  track('carro1', 'position', 'smooth', [['s1', 0, [-26, 26, 0]], ['s2', 0, [-14, 26, 0]], ['s2', .7, [10, 26, 0]], ['s3', 0, [10, 26, 0]]]);
  track('carro1_cabo', 'scale', 'smooth', [['s1', 0, [1, 8, 1]], ['s2', .35, [1, 8, 1]], ['s2', .9, [1, 14, 1]]]);
  track('carro1_chapa', 'position', 'smooth', [['s1', 0, [0, -8.8, 0]], ['s2', .35, [0, -8.8, 0]], ['s2', .9, [0, -14.8, 0]]]);

  // ---------- Frames of the hull (sentences 1-3), replaced by the plated hull from sentence 4 ----------
  group('estrutura', 's1', [0, 1.4, 0]);
  mesh('quilha', 's1', [0, .3, 0], { shape: 'box', size: [66, .6, .8], bevel: .1 }, '#B9B2A2', { parent: 'estrutura' });
  mesh('costelas', 's1', [-30, 0, 0], { shape: 'tube', size: [.26], points: rib }, '#E9E3D2', { parent: 'estrutura', repeat: { count: 21, step: [3, 0, 0], jitter: [0, 0, 0], seed: 1 } });
  track('costelas', 'scale', 'smooth', [['s1', 0, [1, .03, 1]], ['s1', .95, [1, .5, 1]], ['s2', .8, [1, 1, 1]]]);
  track('estrutura', 'position', 'step', [['s1', 0, [0, 1.4, 0]], ['s4', 0, [0, HIDE, 0]]]);

  group('casco_vis', 's4', [0, 0, 0]);
  mesh('casco', 's4', [0, 1.4, 0], hull(), '#FFFFFF', { parent: 'casco_vis' });
  track('casco_vis', 'position', 'step', [['s1', 0, [0, HIDE, 0]], ['s4', 0, [0, 0, 0]]]);
  // launch (sentence 8): down the slip, nose first, into the river
  track('casco', 'position', 'smooth', [['s4', 0, [0, 1.4, 0]], ['s8', 0, [0, 1.4, 0]], ['s8', .3, [14, 1.4, 0]], ['s8', .55, [30, 1.6, 0]], ['s8', .8, [45, -1.2, 0]], ['s8', 1, [56, -2.4, 0]]]);
  track('casco', 'rotation', 'smooth', [['s4', 0, [0, 0, 0]], ['s8', .4, [0, 0, 0]], ['s8', .8, [0, 0, -.09]], ['s8', 1, [0, 0, -.03]]]);

  // ---------- People ----------
  add('op2', 'actor', 's2', [-37, .8, 5], { color: '#5BA3E0', rotation: [0, .9, 0] });
  track('op2', 'headRotation', 'smooth', [['s1', 0, [-.35, 0, 0]], ['s2', .5, [-.45, .2, 0]], ['s3', 0, [-.45, .2, 0]]]);
  // sentence 3: eight hard hats, one by one
  group('capacetes', 's3', [0, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const id = `capacete${i + 1}`; mesh(id, 's3', [-4.9 + i * 1.4, 0, 19], { shape: 'lathe', profile: [[0, .26], [.1, .24], [.19, .15], [.23, .05], [.32, .04], [.32, 0]], segments: 14 }, '#E8B923', { parent: 'capacetes', scale: [.01, .01, .01] });
    track(id, 'scale', 'smooth', [['s3', .05 + i * .1, [.01, .01, .01]], ['s3', .13 + i * .1, [3.9, 3.9, 3.9]], ['s3', .17 + i * .1, [3, 3, 3]]]);
  }
  add('op3', 'actor', 's3', [0, 0, 16], { color: '#E07B5B', rotation: [0, 0, 0] });
  track('op3', 'headRotation', 'smooth', [['s2', .95, [0, 0, 0]], ['s3', .25, [.45, 0, 0]], ['s4', 0, [.45, 0, 0]]]);

  // ---------- Sentence 4: riveting (a plate on the quay and a worker with a hammer) ----------
  mesh('painel', 's4', [-62, 2.1, 0], { shape: 'box', size: [8, 4, .3], bevel: .04 }, '#5D6872');
  mesh('apoios', 's4', [-65.5, .3, -.4], { shape: 'box', size: [.5, .6, 1.4], bevel: .05 }, '#4D3B2A', { repeat: { count: 2, step: [7, 0, 0], jitter: [0, 0, 0], seed: 1 } });
  for (const [k, y] of [[1, .9], [2, 1.7], [3, 2.5], [4, 3.3]]) mesh(`rebites${k}`, 's4', [-65.6, y, .24], { shape: 'cylinder', size: [.07, .13, .14] }, '#3A3F46', { rotation: [Math.PI / 2, 0, 0], repeat: { count: 14, step: [.5, 0, 0], jitter: [0, 0, 0], seed: 1 } });
  add('op1', 'actor', 's4', [-60.4, 0, .65], { color: '#E8C55A', rotation: [0, Math.PI + .25, 0] });
  group('martelo', 's4', [0, 0, 0], { parent: 'op1', socket: 'rightHand' });
  mesh('martelo_cabo', 's4', [0, 0, .15], { shape: 'cylinder', size: [.03, .03, .5] }, '#6B4A2B', { parent: 'martelo', rotation: [Math.PI / 2, 0, 0] });
  mesh('martelo_cabeca', 's4', [0, 0, .42], { shape: 'box', size: [.1, .1, .2] }, '#2B2F36', { parent: 'martelo' });
  const swing = []; for (let i = 0; i < 5; i++) swing.push(['s4', .1 + i * .18, [-60.4, 1.95, .62]], ['s4', .17 + i * .18, [-60.4, 1.5, .3]]);
  track('op1', 'rightHand', 'smooth', swing);
  track('op1', 'leftHand', 'smooth', [['s4', 0, [-60.2, 1.4, .4]], ['s4', .95, [-60.2, 1.4, .4]]]);

  // ---------- Sentence 5: one rivet, cold water, a crack ----------
  group('junta', 's5', [-62, 0, -14], { scale: [2.2, 2.2, 2.2] });
  mesh('chapa_a', 's5', [-.8, 1.7, -.15], { shape: 'box', size: [3, 3, .3], bevel: .04 }, '#5D6872', { parent: 'junta' });
  mesh('chapa_b', 's5', [.8, 1.7, .15], { shape: 'box', size: [3, 3, .3], bevel: .04 }, '#6B7782', { parent: 'junta' });
  mesh('rebite_g', 's5', [0, 1.7, 0], { shape: 'cylinder', size: [.16, .16, 1] }, '#3A3F46', { parent: 'junta', rotation: [Math.PI / 2, 0, 0] });
  mesh('rebite_cabeca', 's5', [0, 1.7, .5], { shape: 'sphere', size: [.34] }, '#4A5058', { parent: 'junta', scale: [1, 1, .55] });
  mesh('rebite_fim', 's5', [0, 1.7, -.5], { shape: 'sphere', size: [.3] }, '#4A5058', { parent: 'junta', scale: [1, 1, .55] });
  mesh('fissura', 's5', [0, 1.7, .5], { shape: 'box', size: [.07, 1.3, .06] }, '#D13C2B', { parent: 'junta', scale: [1, .01, 1], material: { emissive: '#FF4B2B', emissiveIntensity: .8 } });
  mesh('agua_fria', 's5', [0, 1.5, -1.6], { shape: 'box', size: [7, 3.4, 1.8] }, '#6FB6DC', { parent: 'junta', material: { opacity: .35 } });
  mesh('gelo', 's5', [-6, 1.8, -3], { shape: 'cone', size: [2.4, 3.6] }, '#DDF3FA', { parent: 'junta', rotation: [0, 0, .2], repeat: { count: 5, step: [2.6, 0, 0], jitter: [0, 0, 3], seed: 7 } });
  track('rebite_cabeca', 'position', 'smooth', [['s5', .3, [0, 1.7, .5]], ['s5', .55, [0, 1.7, .5]], ['s5', .8, [.2, 2.9, 1.6]], ['s5', 1, [.3, .6, 2.2]]]);
  track('rebite_cabeca', 'rotation', 'smooth', [['s5', .3, [0, 0, 0]], ['s5', 1, [2.5, 1.5, 3]]]);
  track('fissura', 'scale', 'smooth', [['s5', .4, [1, .01, 1]], ['s5', .62, [1, 1, 1]]]);
  track('gelo', 'position', 'smooth', [['s5', 0, [-6, 1.8, -3]], ['s5', 1, [-5, 1.8, -3]]]);
  onlyDuring('junta', [-62, 0, -14], 5, 5);

  // ---------- Sentence 6: sixteen compartments, walls too low ----------
  group('casco_corte', 's6', [0, 0, 48]);
  mesh('piso', 's6', [0, .2, 0], { shape: 'box', size: [31, .4, 8], bevel: .05 }, '#2C3036', { parent: 'casco_corte' });
  mesh('fundo', 's6', [0, 4.5, -4], { shape: 'box', size: [31, 9, .4], bevel: .05 }, '#2F4A66', { parent: 'casco_corte' });
  mesh('teto', 's6', [0, 8.9, 0], { shape: 'box', size: [31, .3, 8.4] }, '#9FB4C4', { parent: 'casco_corte', material: { opacity: .3 } });
  mesh('anteparas', 's6', [-15, 2.6, 0], { shape: 'box', size: [.35, 5.2, 7.8], bevel: .04 }, '#C9D3DB', { parent: 'casco_corte', repeat: { count: 7, step: [5, 0, 0], jitter: [0, 0, 0], seed: 1 } });
  for (const [id, x, from, to, level] of [['a6', 12.5, .05, .4, 6.4], ['a5', 7.5, .32, .66, 6.0], ['a4', 2.5, .58, .95, 5.4]]) {
    group(id, 's6', [x, .4, 0], { parent: 'casco_corte', scale: [1, .02, 1] });
    mesh(`${id}_m`, 's6', [0, .5, 0], { shape: 'box', size: [4.55, 1, 7.6] }, '#3C8DBC', { parent: id, material: { opacity: .7 } });
    track(id, 'scale', 'smooth', [['s6', 0, [1, .02, 1]], ['s6', from, [1, .02, 1]], ['s6', to, [1, level, 1]]]);
  }
  onlyDuring('casco_corte', [0, 0, 48], 6, 6);

  // ---------- Sentence 7: twenty lifeboats for roughly half of the people ----------
  group('cena_botes', 's7', [0, 0, 48]);
  mesh('conves', 's7', [0, .25, 0], { shape: 'box', size: [36, .5, 14], bevel: .06 }, '#B58E5A', { parent: 'cena_botes' });
  mesh('botes', 's7', [-17.5, 1.3, 5], { shape: 'box', size: [4.2, 1.4, 1.9], bevel: .6 }, '#E0782D', { parent: 'cena_botes', repeat: { count: 20, step: [1.85, 0, 0], jitter: [0, 0, 0], seed: 1 } });
  mesh('salvos', 's7', [-17.1, 1.2, 1], { shape: 'capsule', size: [.5, 1.3] }, '#3FA463', { parent: 'cena_botes', repeat: { count: 18, step: [1.9, 0, 0], jitter: [0, 0, 1.4], seed: 4 } });
  mesh('sem_lugar', 's7', [-17.1, 1.2, -4.2], { shape: 'capsule', size: [.5, 1.3] }, '#6A6E78', { parent: 'cena_botes', repeat: { count: 18, step: [1.9, 0, 0], jitter: [0, 0, 1.4], seed: 9 } });
  onlyDuring('cena_botes', [0, 0, 48], 7, 7);

  // ---------- Sentence 8: crowd on the bank (launch) ----------
  mesh('multidao', 's8', [24, .67, 17], { shape: 'capsule', size: [.22, .9] }, '#3A3A44', { repeat: { count: 70, step: [0, 0, 0], jitter: [22, 0, 8], seed: 11 } });
  mesh('multidao2', 's8', [24, .67, -17], { shape: 'capsule', size: [.22, .9] }, '#5A4A44', { repeat: { count: 70, step: [0, 0, 0], jitter: [22, 0, 8], seed: 12 } });

  const shots = [
    { sourceId: 's1', subjects: ['estrutura'], azimuth: 1.1, endAzimuth: .55, elevation: .32, distance: 1.25 },
    { sourceId: 's2', subjects: ['carro1', 'carro1_chapa'], azimuth: -.5, endAzimuth: -.2, elevation: -.15, distance: 1.1 },
    { sourceId: 's3', subjects: ['capacetes'], azimuth: -.2, endAzimuth: .15, elevation: .18, distance: 1.05 },
    { sourceId: 's4', subjects: ['painel', 'op1'], azimuth: .7, endAzimuth: .4, elevation: .12, distance: 1 },
    { sourceId: 's5', subjects: ['chapa_a', 'chapa_b', 'rebite_cabeca'], azimuth: .45, endAzimuth: .8, elevation: .1, distance: 1.0 },
    { sourceId: 's6', subjects: ['casco_corte'], azimuth: .3, endAzimuth: -.15, elevation: .2, distance: 1.0 },
    { sourceId: 's7', subjects: ['cena_botes'], azimuth: -.45, endAzimuth: 0, elevation: .5, distance: 1.0 },
    { sourceId: 's8', subjects: ['casco'], azimuth: 1, endAzimuth: .55, elevation: .14, distance: 1.05 },
  ];
  return { title: 'titanic', scenes: ID.map((sourceId) => ({ sourceId, visual: 'character', mood: 'neutral', palette: 'teal' })),
    sceneProgram: { version: 1, background: '#9FB4C4', nodes, tracks, shots, contacts: [], motionChecks: [] } };
}
