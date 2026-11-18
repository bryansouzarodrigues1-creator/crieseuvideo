import {describe,expect,it} from 'vitest';
import {compileSceneProgram, normalizeSceneProgram} from '../score';
import {SceneProgram3D} from '../stage3d';
import {compileStoryEvents} from './events';
import {compileStoryMotion} from './choreographer';
import {
  sampleStoryProposal,sampleCompiledFilm,sampleSceneGeometry,
  sampleBindings,sampleSources
} from './sample';

const at=(score:ReturnType<typeof compileSceneProgram>, t:number, id:string)=>
  score.sample(t).get(id)!.position;
describe('narrative storyboard -> existing engine -> physical movement',()=>{
  it('produces every motion from semantic story events, not hand-coded prop tracks',()=>{
    const {storyboard,program,diagnostics}=sampleCompiledFilm();
    const score=compileSceneProgram(program,sampleSources);
    expect(storyboard.events).toHaveLength(7);
    expect(program.tracks.filter(x=>x.channel==='position').map(x=>x.node).sort())
      .toEqual(['elevador','saco','trabalhador']);
    expect(program.tracks.some(x=>x.node==='drive-gear'&&x.channel==='rotation')).toBe(true);
    const initial=at(score,0,'saco'),picked=at(score,1.1,'saco'),
      carried=at(score,4,'saco'),placed=at(score,5.1,'saco'),lifted=at(score,12.3,'saco');
    expect(picked[1]).toBeGreaterThan(initial[1]+.8);
    expect(carried[0]).toBeGreaterThan(picked[0]+2);
    expect(placed[1]).toBeCloseTo(.85,3);
    expect(lifted[1]).toBeCloseTo(5.05,3);
    const platform=at(score,12.3,'elevador');
    expect(platform[1]).toBeCloseTo(4.62,3);
    expect(lifted[1]-platform[1]).toBeCloseTo(.43,3);
    const gear=score.sample(12.3).get('drive-gear')!.rotation;
    expect(gear[2]).toBeCloseTo(Math.PI*2*4.6,3);
    expect(diagnostics.events.find(x=>x.id==='subir')?.visibleMechanicalMotion).toBe(true);
  });

  it('runs through the REAL SceneProgram3D interpreter with the same visible cargo identity',()=>{
    const {program}=sampleCompiledFilm();
    const stage=new SceneProgram3D(program,sampleSources);
    try {
      const cargo=stage.nodes.get('saco')!;
      for(const t of [0,.3,.8,1.5,3,5,7.5,10,12.3,14]){
        stage.update(t);
        expect(stage.nodes.get('saco')).toBe(cargo);
        const pos=cargo.position;
        expect([pos.x,pos.y,pos.z].every(Number.isFinite)).toBe(true);
        stage.frame(9/16);
        expect(stage.camera.position.toArray().every(Number.isFinite)).toBe(true);
      }
      expect(cargo.position.y).toBeGreaterThan(5);
    } finally {stage.dispose();}
  });

  it('rejects contradictory Gemini tracks trying to override the storyboard',()=>{
    const base=sampleSceneGeometry(), plan=compileStoryEvents(sampleStoryProposal(),sampleSources);
    const untrusted=normalizeSceneProgram({...base,tracks:[...base.tracks,{
      node:'saco',channel:'position',interpolation:'linear',
      keys:[{sourceId:'s1',phase:0,value:[0,0,0]},{sourceId:'s1',phase:1,value:[99,0,0]}]
    }]},sampleSources);
    expect(()=>compileStoryMotion(plan,untrusted,sampleSources,sampleBindings))
      .toThrow(/governado pelo planejador/);
  });

  it('rejects a visual object mapped to two story identities',()=>{
    const plan=compileStoryEvents(sampleStoryProposal(),sampleSources);
    expect(()=>compileStoryMotion(plan,sampleSceneGeometry(),sampleSources,{
      ...sampleBindings,entityNodes:{...sampleBindings.entityNodes,saco:'elevador'}
    })).toThrow(/MESMA malha/);
  });

  it('rejects visual motor shafts that have not been constructed',()=>{
    const plan=compileStoryEvents(sampleStoryProposal(),sampleSources);
    expect(()=>compileStoryMotion(plan,sampleSceneGeometry(),sampleSources,{
      ...sampleBindings,motorVisuals:{motor:{node:'no-real-gear',revolutions:3}}
    })).toThrow(/Eixo do motor não existe/);
  });

  it('refuses timing that does not fit the original spoken segment',()=>{
    const p:any=sampleStoryProposal();
    // The state sequence is sound, but this event is assigned to a source
    // sentence that ended at t=4. The compiler must reject the mismatch.
    p.events[3].sourceId='s1';
    p.events[3].evidence='plataforma';
    const plan=compileStoryEvents(p,sampleSources);
    expect(()=>compileStoryMotion(plan,sampleSceneGeometry(),sampleSources,sampleBindings))
      .toThrow(/não cabe na frase/);
  });
});
