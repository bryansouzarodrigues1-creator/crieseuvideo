import {describe,expect,it} from 'vitest';
import {compileSceneProgram} from '../score';
import {SceneProgram3D} from '../stage3d';
import {coupledAngle,prepareMechanicalDrives} from './mechanicalDrives';
import {buildMechanicalScenario,type MechanicalSetting} from './mechanicalScenarios';
import {compileStoryMotion} from './choreographer';

describe('3D machinery coupled to physical travel instead of arbitrary spin',()=>{
  it('computes wheel rotation by arc length, radius and signed gear ratio',()=>{
    const a:[number,number,number]=[0,0,0];
    expect(coupledAngle(a,[6,0,0],.30,1)).toBeCloseTo(20,5);
    expect(coupledAngle(a,[6,0,0],.30,-2)).toBeCloseTo(-40,5);
    expect(coupledAngle(a,[0,0,0],.30,1)).toBe(0);
    expect(()=>coupledAngle(a,[1,0,0],0,1)).toThrow(/Raio/);
    expect(()=>coupledAngle(a,[1,0,0],.30,0)).toThrow(/Relação/);
  });

  for(const setting of ['workshop','city','harbor'] as MechanicalSetting[]){
    it('compiles the same event mechanics in the distinct '+setting+' scenery, with real geometry',()=>{
      const example=buildMechanicalScenario(setting);
      const score=compileSceneProgram(example.program,example.sources);
      const t=score.duration;
      expect(t).toBe(6);
      expect(example.program.nodes.length).toBeGreaterThan(12);
      const cargoStart=score.sample(0).get('cargo')!.position;
      const cargoEnd=score.sample(5).get('cargo')!.position;
      const before=score.sample(1).get('drum-shaft')!.rotation[2];
      const end=score.sample(5).get('drum-shaft')!.rotation[2];
      const movement=Math.hypot(...cargoEnd.map((v,i)=>v-cargoStart[i]));
      expect(movement).toBeGreaterThanOrEqual(4.9);
      const radius=example.bindings.mechanicalDrives!.machine.radius;
      expect(end-before).toBeCloseTo(movement/radius,3);
      const smallGear=score.sample(5).get('small-gear-shaft')!.rotation[2];
      expect(smallGear).toBeCloseTo(-2*end,3);
      // Production SceneProgram3D directly evaluates these generated curves.
      const stage=new SceneProgram3D(example.program,example.sources);
      try {
        const cargo=stage.nodes.get('cargo')!;
        for(const sampleTime of [0,.5,1.1,3.3,5,6]){
          stage.update(sampleTime);
          expect(stage.nodes.get('cargo')).toBe(cargo);
          expect(stage.nodes.get('drum-shaft')!.rotation.toArray().every(Number.isFinite)).toBe(true);
          stage.frame(9/16);
          expect(stage.camera.position.toArray().every(Number.isFinite)).toBe(true);
        }
      }finally{stage.dispose();}
    });
  }

  it('rejects duplicated, foreign and manually animated gears',()=>{
    const scene=buildMechanicalScenario('workshop');
    const ids=scene.bindings.entityNodes;
    const entities=scene.storyboard.entities;
    const wrong={
      machine:{output:'cargo',radius:.3,parts:[{node:'drum-shaft',axis:'z' as const,ratio:1},
        {node:'drum-shaft',axis:'z' as const,ratio:-2}]}
    };
    expect(()=>prepareMechanicalDrives(wrong,scene.program.nodes,[],entities,ids))
      .toThrow(/duas transmissões/);
    const foreign={
      machine:{output:'cargo',radius:.3,parts:[{node:'tool-cabinet',axis:'z' as const,ratio:1}]}
    };
    expect(()=>prepareMechanicalDrives(foreign,scene.program.nodes,[],entities,ids))
      .toThrow(/não está ligado/);
    expect(()=>prepareMechanicalDrives({
      machine:{output:'cargo',radius:.3,parts:[{node:'drum-shaft',axis:'z',ratio:1}]}
    },scene.program.nodes,[{
      node:'drum-shaft',channel:'rotation',interpolation:'linear',
      keys:[{sourceId:'s1',phase:0,value:[0,0,0]},{sourceId:'s1',phase:1,value:[0,0,1]}]
    }],entities,ids)).toThrow(/contraditória/);
  });

  it('refuses arbitrary motorVisuals when a physical linkage is declared',()=>{
    const scene=buildMechanicalScenario('harbor');
    const bad={...scene.bindings,
      motorVisuals:{machine:{node:'drum-shaft',revolutions:4}}};
    expect(()=>compileStoryMotion(scene.storyboard,{
      ...scene.program,tracks:scene.program.tracks.filter(t=>
        t.node!=='cargo'&&t.node!=='drum-shaft'&&t.node!=='small-gear-shaft')
    },scene.sources,bad)).toThrow(/voltas arbitrárias/);
  });
});
