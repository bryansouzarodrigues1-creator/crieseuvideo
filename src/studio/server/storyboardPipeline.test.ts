import {describe,expect,it,vi} from 'vitest';
import {generateStoryboardFirst3D,normalizeStoryMotionBindings} from './storyboardPipeline';
import {sampleStoryProposal,sampleSceneGeometry,sampleSources,sampleBindings} from '../explainer/sceneProgram/planner/sample';
import {compileSceneProgram} from '../explainer/sceneProgram/score';
import {buildMechanicalScenario} from '../explainer/sceneProgram/planner/mechanicalScenarios';

const sceneResponse=()=>({
  sceneProgram:{...sampleSceneGeometry(),tracks:[]},
  bindings:sampleBindings
});
describe('two-stage Gemini-compatible architecture without network or credits',()=>{
  it('accepts both original Gemini 3D objects and Claude procedural scenery in one validated second pass',async()=>{
    const stage=sceneResponse();
    const response={
      ...stage,worldScenery:{version:1,regions:[
        {id:'clouds',sourceId:'s1',shape:'cloud',size:[2.5],
          position:[-4,8,-10],color:'#FFFFFF',seed:5},
        {id:'garden',sourceId:'s1',shape:'rock',size:[1],
          position:[4,0,-3],color:'#8B9998',seed:2}
      ]}
    };
    const fake=vi.fn(async(_prompt:string,pass:'events'|'geometry')=>
      JSON.stringify(pass==='events'?sampleStoryProposal():response));
    const output=await generateStoryboardFirst3D(sampleSources,14,fake);
    expect(fake).toHaveBeenCalledTimes(2);
    expect(output.providerPasses).toBe(2);
    expect(output.sceneryAudit?.environments.map(x=>x.shape)).toEqual(['cloud','rock']);
    expect(output.program.nodes.find(x=>x.id==='clouds')?.geometry?.shape).toBe('mesh');
    expect(output.program.nodes.find(x=>x.id==='garden')?.geometry?.shape).toBe('mesh');
    const score=compileSceneProgram(output.program,sampleSources);
    expect(score.sample(14).get('saco')?.position[1]).toBeCloseTo(5.05,3);
  });

  it('rejects unsafe or non-grounded worldScenery before the motion execution',async()=>{
    const stage=sceneResponse();
    const response={
      ...stage,worldScenery:{version:1,regions:[
        {id:'forest',sourceId:'s1',shape:'tree',size:[2.5],color:'#4E8B51',
          script:'fetch("https://unsafe.test")'}
      ]}
    };
    const fake=vi.fn(async(_prompt:string,pass:'events'|'geometry')=>
      JSON.stringify(pass==='events'?sampleStoryProposal():response));
    await expect(generateStoryboardFirst3D(sampleSources,14,fake))
      .rejects.toThrow(/campo desconhecido/);
  });


  it('turns a freshly designed cement bag into a stable object that the SAME event compiler can pick, carry and lift',async()=>{
    const fromModel=sceneResponse();
    const omit=new Set(['saco','sack-body','sack-green-band']);
    const composed={
      sceneProgram:{...fromModel.sceneProgram,
        nodes:fromModel.sceneProgram.nodes.filter(n=>!omit.has(n.id))},
      bindings:fromModel.bindings,
      worldBlueprints:{version:1,objects:[{
        id:'saco',role:'prop',sourceId:'s1',name:'Saco de cimento com lacre e etiqueta',
        position:[-2.25,.19,.15],features:['corpo','etiqueta','lacre'],
        parts:[
          {id:'corpo',feature:'corpo',color:'#E2DAC7',
            geometry:{shape:'box',size:[.76,.33,.46],bevel:.09}},
          {id:'etiqueta',feature:'etiqueta',color:'#37885C',position:[0,.04,.237],
            geometry:{shape:'box',size:[.30,.25,.012]}},
          {id:'lacre',feature:'lacre',color:'#ECEAE2',position:[0,.17,0],
            geometry:{shape:'box',size:[.58,.035,.24]}}
        ]
      }]}
    };
    const mock=vi.fn(async(_prompt:string,pass:'events'|'geometry')=>
      JSON.stringify(pass==='events'?sampleStoryProposal():composed));
    const result=await generateStoryboardFirst3D(sampleSources,14,mock);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(result.worldAudit?.objects[0].features).toEqual(['corpo','etiqueta','lacre']);
    expect(result.program.nodes.some(n=>n.id==='saco-corpo')).toBe(true);
    expect(result.program.nodes.some(n=>n.id==='saco-etiqueta')).toBe(true);
    expect(result.program.nodes.filter(n=>n.id==='saco')).toHaveLength(1);
    const score=compileSceneProgram(result.program,sampleSources);
    expect(score.sample(14).get('saco')?.position[1]).toBeCloseTo(5.05,3);
    expect(result.diagnostics.gripWindows).toHaveLength(1);
  });

  it('rejects a model-authored world that forgets advertised object parts before producing 3D',async()=>{
    const base=sceneResponse();
    const malformed={
      ...base,worldBlueprints:{version:1,objects:[{
        id:'caixa2',role:'prop',sourceId:'s1',name:'Caixa com rodas',
        features:['corpo','rodas'],
        parts:[{id:'bola',feature:'corpo',color:'#BB0000',
          geometry:{shape:'sphere',size:[1]}}]
      }]}
    };
    const mock=vi.fn(async(_prompt:string,pass:'events'|'geometry')=>
      JSON.stringify(pass==='events'?sampleStoryProposal():malformed));
    await expect(generateStoryboardFirst3D(sampleSources,14,mock))
      .rejects.toThrow(/partes suficientes/);
  });


  it('allows safe mechanisms and distinct environments without changing the story planner',()=>{
    for(const kind of ['workshop','city','harbor'] as const){
      const scene=buildMechanicalScenario(kind);
      const normalized=normalizeStoryMotionBindings(scene.bindings);
      expect(normalized.mechanicalDrives?.machine.parts).toHaveLength(2);
      expect(normalized.mechanicalDrives?.machine.output).toBe('cargo');
    }
  });

  it('rejects invented mechanical axes, ratios and untrusted drive fields',()=>{
    const scene=buildMechanicalScenario('city');
    const malformed:any=structuredClone(scene.bindings);
    malformed.mechanicalDrives.machine.parts[0].axis='north';
    expect(()=>normalizeStoryMotionBindings(malformed)).toThrow(/Eixo/);
    malformed.mechanicalDrives.machine.parts[0].axis='z';
    malformed.mechanicalDrives.machine.parts[0].ratio=999;
    expect(()=>normalizeStoryMotionBindings(malformed)).toThrow(/Relação/);
    malformed.mechanicalDrives.machine.parts[0].ratio=1;
    malformed.mechanicalDrives.machine.script='danger()';
    expect(()=>normalizeStoryMotionBindings(malformed)).toThrow(/campos não permitidos/);
  });
  it('plans events first, then geometry; automatically compiles all root motion',async()=>{
    const order:string[]=[];
    const fake=vi.fn(async(prompt:string,pass:'events'|'geometry')=>{
      order.push(pass);
      expect(prompt).toContain(pass==='events'?'ACONTECIMENTOS': 'Acontecimentos validados');
      return JSON.stringify(pass==='events'?sampleStoryProposal():sceneResponse());
    });
    const r=await generateStoryboardFirst3D(sampleSources,14,fake);
    expect(order).toEqual(['events','geometry']);
    expect(r.providerPasses).toBe(2);
    expect(r.storyboard.events).toHaveLength(7);
    expect(r.program.tracks.some(t=>t.node==='saco'&&t.channel==='position')).toBe(true);
    const score=compileSceneProgram(r.program,sampleSources);
    expect(score.sample(14).get('saco')?.position[1]).toBeCloseTo(5.05,3);
    expect(score.sample(14).get('elevador')?.position[1]).toBeCloseTo(4.62,3);
  });

  it('does not pay for a second AI call if the storyboard invents nonexistent facts',async()=>{
    const fake=vi.fn(async(_:string,pass:'events'|'geometry')=>{
      if(pass==='geometry')throw Error('The second pass must not start');
      const wrong:any=sampleStoryProposal();
      wrong.events[0].evidence='Um dragão levou a caixa embora';
      return JSON.stringify(wrong);
    });
    await expect(generateStoryboardFirst3D(sampleSources,14,fake))
      .rejects.toThrow(/evidência literal/);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it('rejects a geometry-generation response containing competing root movement tracks',async()=>{
    const raw=sceneResponse();
    (raw.sceneProgram.tracks as any[]).push({
      node:'saco',channel:'position',interpolation:'linear',
      keys:[{sourceId:'s1',phase:0,value:[0,0,0]},{sourceId:'s1',phase:1,value:[10,0,0]}]
    });
    const fake=vi.fn(async(_prompt:string,pass:'events'|'geometry')=>
      JSON.stringify(pass==='events'?sampleStoryProposal():raw));
    await expect(generateStoryboardFirst3D(sampleSources,14,fake))
      .rejects.toThrow(/não pode escrever keyframes/);
  });

  it('rejects previously unknown place anchors before 3D execution',()=>{
    expect(()=>normalizeStoryMotionBindings({...sampleBindings,placeAnchors:{
      base:['eval','console.log(1)','0']
    }})).toThrow(/coordenadas inválidas/);
  });

  it('refuses motor visual binding pointing at a remote or script resource',()=>{
    const malformed:any={...sampleBindings,motorVisuals:{motor:{
      node:'drive-gear',axis:'z',revolutions:2,url:'https://example.org/remote.glb'
    }}};
    expect(()=>normalizeStoryMotionBindings(malformed))
      .toThrow(/campos não permitidos/);
  });

  it('rejects incomplete stage without retrying or silently injecting meshes',async()=>{
    const fake=vi.fn(async(_prompt:string,pass:'events'|'geometry')=>
      JSON.stringify(pass==='events'?sampleStoryProposal():{sceneProgram:{version:1,nodes:[]},bindings:sampleBindings}));
    await expect(generateStoryboardFirst3D(sampleSources,14,fake))
      .rejects.toThrow(/geometria e planos completos/);
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it('refuses invalid duration before calling any external AI provider',async()=>{
    const fake=vi.fn(async()=>JSON.stringify(sampleStoryProposal()));
    await expect(generateStoryboardFirst3D(sampleSources,17,fake))
      .rejects.toThrow(/Duração dos trechos difere/);
    expect(fake).not.toHaveBeenCalled();
  });
});
