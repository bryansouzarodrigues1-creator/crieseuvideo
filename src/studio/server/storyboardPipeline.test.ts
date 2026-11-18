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
