import {describe,expect,it} from 'vitest';
import {compactWorldPrompt,compileCompactWorld,CompactWorldError} from './compactWorldDirector';
import {sourceBriefsFromScript} from './aiWorldDirector';
import {compileSceneProgram} from '../score';
import {SceneProgram3D} from '../stage3d';

const sources=sourceBriefsFromScript(
  'O guindaste levanta uma caixa de ferramentas em uma obra cheia de estruturas. '+
  'Um operador ativa o tambor e a carga sobe até a plataforma superior.'
);
const crane={
  version:1,setting:'industrial',background:'#C5DCEB',
  entities:[
    {id:'crane',name:'Guindaste de canteiro',kind:'crane',at:[-2,0,0],size:[7,9,3],color:'#D6A442'},
    {id:'load',name:'Caixa transportada pelo cabo',kind:'cargo',at:[1,1,0],size:[1.5,1,1],color:'#C9B394'},
  ],
  action:{target:'load',kind:'lift',delta:[0,3,0]},
};
const vehicle={
  version:1,setting:'city',background:'#C0D9E8',
  entities:[
    {id:'street',name:'Edifício com janelas',kind:'building',at:[-5,0,-7],size:[7,10,4],color:'#8495A2'},
    {id:'motorbike',name:'Motocicleta em movimento',kind:'vehicle',at:[0,0,1],size:[2.8,1.4,1.2],color:'#E97830'},
  ],
  action:{target:'motorbike',kind:'drive',delta:[5,0,0]},
};
const boat={
  version:1,setting:'coast',background:'#A4D1E5',
  entities:[
    {id:'vessel',name:'Navio navegando pelo porto',kind:'boat',at:[0,0,0],size:[11,5,4],color:'#E4E6E3'},
    {id:'dock',name:'Galpão perto do cais',kind:'building',at:[-6,0,-8],size:[7,5,3],color:'#A7ADB0'},
  ],
  action:{target:'vessel',kind:'sail',delta:[0,0,4]},
};
const custom={
  version:1,setting:'forest',background:'#B8DEE8',
  entities:[
    {id:'machine',name:'Aparato inventado para testar água',kind:'custom',at:[-2,0,0],
      size:[3,3,2],color:'#A8B6BB',details:[
        {id:'frame',shape:'box',size:[3,1,2],at:[0,1,0]},
        {id:'tank',shape:'cylinder',size:[.7,.7,1.4],at:[0,2,0],color:'#2F7B99'},
        {id:'dial',shape:'sphere',size:[.30],at:[1,2,0]},
      ]},
    {id:'sample',name:'Peça de teste que se desloca',kind:'cargo',at:[2,0,0],
      size:[1,1,1],color:'#E9A653'},
  ],
  action:{target:'sample',kind:'move',delta:[2,0,0]},
};
describe('compact model-authored 3D worlds (no real AI calls)',()=>{
  it('asks for a small actionable recipe rather than 160 raw nodes',()=>{
    const p=compactWorldPrompt(sources);
    expect(p).toContain('custom');
    expect(p).toContain('câmeras');
    expect(p).toContain('somente JSON pequeno');
    expect(p.length).toBeLessThan(5000);
  });
  it('assembles a crane, urban background, winch, cable and lifted cargo',()=>{
    const clip=compileCompactWorld(crane,sources);
    expect(clip.duration).toBe(8);
    expect(clip.audit.objectCount).toBeGreaterThanOrEqual(4);
    expect(clip.audit.objectParts).toBeGreaterThan(15);
    expect(clip.program.nodes.length).toBeLessThanOrEqual(160);
    expect(clip.program.tracks.map(t=>t.node)).toEqual(
      expect.arrayContaining(['load','crane-winch','crane-cable','crane-hook']));
    const load=clip.program.tracks.find(t=>t.node==='load')!;
    const hook=clip.program.tracks.find(t=>t.node==='crane-hook')!;
    const shift=(t:typeof load)=>t.keys.at(-1)!.value[1]-t.keys[0].value[1];
    expect(shift(hook)).toBeCloseTo(shift(load),3);
    expect(clip.program.shots).toHaveLength(2);
    expect(clip.program.nodes.some(n=>n.id==='load-crate')).toBe(true);
    expect(clip.sources.map(s=>s.text)).toEqual(sources.map(s=>s.text));
  });
  it('assembles a four-wheel road vehicle with wheels rotating in sync with travel',()=>{
    const clip=compileCompactWorld(vehicle,sources);
    expect(clip.audit.objectCount).toBe(4);
    expect(clip.program.tracks.filter(t=>t.channel==='rotation')).toHaveLength(4);
    expect(clip.program.nodes.some(n=>n.id==='motorbike-tirelf')).toBe(true);
    expect(clip.program.nodes.some(n=>n.id==='district_a-glass0')).toBe(true);
    expect(clip.program.nodes.some(n=>n.id==='district_a-glass1')).toBe(true);
    expect(clip.program.nodes.some(n=>n.id==='district_a-band')).toBe(true);
  });
  it('does not turn a motorcycle into a four-wheel toy car',()=>{
    const bike=structuredClone(vehicle) as any;
    bike.entities[1].kind='motorcycle';
    bike.entities[1].name='Motocicleta de duas rodas';
    const clip=compileCompactWorld(bike,sources);
    const ids=new Set(clip.program.nodes.map(n=>n.id));
    expect(ids.has('motorbike-tirerear')).toBe(true);
    expect(ids.has('motorbike-tirefront')).toBe(true);
    expect(ids.has('motorbike-saddle')).toBe(true);
    expect(ids.has('motorbike-tank')).toBe(true);
    expect(ids.has('motorbike-roof')).toBe(false);
    expect(clip.program.tracks.filter(t=>t.channel==='rotation')).toHaveLength(2);
  });
  it('uses animated water in a boat sequence, not a fixed city ground',()=>{
    const clip=compileCompactWorld(boat,sources);
    expect(clip.program.nodes.find(n=>n.id==='sea')?.geometry?.shape).toBe('water');
    expect(clip.program.nodes.find(n=>n.id==='vessel-hull')?.geometry?.shape).toBe('extrude');
    expect(clip.program.tracks.find(t=>t.node==='vessel')?.channel).toBe('position');
  });
  it('can construct a novel object from model-selected primitive parts',()=>{
    const clip=compileCompactWorld(custom,sources);
    expect(clip.program.nodes.some(n=>n.id==='machine-tank')).toBe(true);
    expect(clip.program.nodes.some(n=>n.id==='machine-dial')).toBe(true);
  });

  it('directs an ordered problem → solution with TWO distinct moving objects',()=>{
    const twoSource=sourceBriefsFromScript(
      'Uma motocicleta fica parada porque um portão bloqueia a saída da garagem. '+
      'O portão sobe e depois a motocicleta avança para a rua.'
    );
    const scene={
      version:1,setting:'city',background:'#B4D3E2',
      entities:[
        {id:'garage',name:'Garagem da motocicleta',kind:'building',at:[-4,0,-6],size:[8,5,3],color:'#8C969F'},
        {id:'gate',name:'Portão deslizante',kind:'cargo',at:[1,0,2],size:[2,.8,.3],color:'#B8C9D0'},
        {id:'bike',name:'Moto aguardando saída',kind:'motorcycle',at:[0,0,2],size:[2.8,1.5,1.4],color:'#EA8F48'}
      ],
      actions:[
        {target:'gate',kind:'lift',delta:[0,2,0]},
        {target:'bike',kind:'drive',delta:[4,0,0]}
      ]
    };
    const clip=compileCompactWorld(scene,twoSource);
    const score=compileSceneProgram(clip.program,clip.sources);
    expect(clip.program.shots.map(s=>s.subjects))
      .toEqual(expect.arrayContaining([expect.arrayContaining(['gate']),['bike']]));
    const gateStart=score.sample(0).get('gate')!.position;
    const gateAtFirst=score.sample(3.8).get('gate')!.position;
    const bikeStart=score.sample(0).get('bike')!.position;
    const bikeBefore=score.sample(4).get('bike')!.position;
    const bikeEnd=score.sample(8).get('bike')!.position;
    expect(gateAtFirst[1]-gateStart[1]).toBeGreaterThan(1.5);
    expect(Math.hypot(...bikeBefore.map((v,i)=>v-bikeStart[i]))).toBeLessThan(.001);
    expect(bikeEnd[0]-bikeStart[0]).toBeGreaterThan(3.5);
    expect(clip.program.tracks.filter(t=>t.node.startsWith('bike-wheel'))).toHaveLength(2);
    // Execute the REAL renderer stage, not only the interpreted JSON curve.
    // The gate and bike keep the same 3D object identities across both events.
    const stage=new SceneProgram3D(clip.program,clip.sources);
    try{
      const gateNode=stage.nodes.get('gate');
      const bikeNode=stage.nodes.get('bike');
      for(const t of [0,1,3.5,4,5,6.5,7.99]){
        stage.update(t);
        for(const aspect of [9/16,16/9]){
          stage.frame(aspect);
          expect(stage.camera.position.toArray().every(Number.isFinite)).toBe(true);
        }
        expect(stage.nodes.get('gate')).toBe(gateNode);
        expect(stage.nodes.get('bike')).toBe(bikeNode);
      }
    }finally{stage.dispose();}
  });
  it('rejects overlapping targets and more action events than narrated chapters',()=>{
    const duplicate={...crane,action:undefined,actions:[
      {target:'load',kind:'lift',delta:[0,3,0]},
      {target:'load',kind:'move',delta:[2,0,0]}
    ]};
    expect(()=>compileCompactWorld(duplicate,sources)).toThrow(/mesmo objeto/);
    const extra={...vehicle,action:undefined,actions:[
      {target:'motorbike',kind:'drive',delta:[5,0,0]},
      {target:'street',kind:'rotate',delta:[0,0,1]},
      {target:'street',kind:'lift',delta:[0,2,0]}
    ]};
    expect(()=>compileCompactWorld(extra,sources)).toThrow();
    const both={...vehicle,actions:[{target:'motorbike',kind:'drive',delta:[2,0,0]}]};
    expect(()=>compileCompactWorld(both,sources)).toThrow(/action ou actions/);
  });
  it('rejects scenes with non-existent actions or motionless results',()=>{
    expect(()=>compileCompactWorld({...crane,action:{target:'nobody',kind:'lift',delta:[0,3,0]}},sources))
      .toThrow(/objeto/);
    expect(()=>compileCompactWorld({...crane,action:{target:'load',kind:'lift',delta:[0,.05,0]}},sources))
      .toThrow(/deslocamento/);
  });
  it('rejects executable code, unknown shapes, duplicate IDs and malformed custom geometry',()=>{
    expect(()=>compileCompactWorld({...crane,code:'function foo(){}'},sources)).toThrow(CompactWorldError);
    expect(()=>compileCompactWorld({...crane,entities:[crane.entities[0],crane.entities[0]]},sources)).toThrow(/identificador/);
    const e=custom.entities[0] as any;
    const corrupted=JSON.parse(JSON.stringify(custom));
    corrupted.entities[0].details[0].shape='html_script';
    expect(()=>compileCompactWorld(corrupted,sources)).toThrow(/geometria/);
  });
});
