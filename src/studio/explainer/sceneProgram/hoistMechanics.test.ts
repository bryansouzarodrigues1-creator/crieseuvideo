import { describe,expect,it } from 'vitest';
import { Vector3 } from 'three';
import { normalizeSceneProgram, type ProgramSource } from './score';
import { SceneProgram3D } from './stage3d';
import { auditSceneCutActivity } from './cutActivity';
const sources:ProgramSource[]=[{sourceId:'s1',text:'O cabo levanta uma plataforma e uma câmera revela o motor.',duration:6}];
const k=(phase:number,value:number[])=>({sourceId:'s1',phase,value});
const raw=()=>({
  version:1,background:'#E4E7EF',
  nodes:[
    {id:'top',kind:'group',contextSourceId:'s1',position:[0,4,0]},
    {id:'top-wheel',kind:'mesh',parent:'top',contextSourceId:'s1',
      color:'#777777',geometry:{shape:'cylinder',size:[.25,.25,.12]}},
    {id:'load',kind:'group',contextSourceId:'s1',position:[0,.5,0]},
    {id:'load-bed',kind:'mesh',parent:'load',contextSourceId:'s1',
      color:'#A77B4B',geometry:{shape:'box',size:[1,.3,.8]}},
    {id:'strand',kind:'mesh',contextSourceId:'s1',position:[0,2,0],
      color:'#FFFFFF',geometry:{shape:'cylinder',size:[.04,.04,1]}},
    {id:'motor',kind:'group',contextSourceId:'s1',position:[3,0,0]},
    {id:'motor-body',kind:'mesh',parent:'motor',contextSourceId:'s1',color:'#4286D5',geometry:{shape:'box',size:[1,1,1]}}
  ],
  tracks:[
    {node:'load',channel:'position',interpolation:'linear',
     keys:[k(0,[0,.5,0]),k(1,[0,2.5,0])]},
    {node:'motor',channel:'rotation',interpolation:'linear',
     keys:[k(0,[0,0,0]),k(.55,[0,0,0]),k(1,[0,3,0])]},
  ],
  shots:[{sourceId:'s1',subjects:['load','top'],cuts:[
    {phase:0,subjects:['load','top'],hide:['motor']},
    {phase:.5,subjects:['motor'],hide:['strand']}
  ]}],
  cables:[{node:'strand',from:'top',to:'load'}],contacts:[]
});
describe('real 3D winch mechanics reusable for nonhuman machinery',()=>{
  it('keeps a cylinder connected at both world endpoints while the load moves',()=>{
    const p=normalizeSceneProgram(raw(),sources),stage=new SceneProgram3D(p,sources);
    try{
      for(const t of [0,.75,2.1,4.3,6,1.4]){
        stage.update(t);
        const center=stage.nodes.get('strand')!.getWorldPosition(new Vector3());
        const to=stage.nodes.get('load')!.getWorldPosition(new Vector3());
        const from=stage.nodes.get('top')!.getWorldPosition(new Vector3());
        expect(center.distanceTo(from.clone().add(to).multiplyScalar(.5))).toBeLessThan(1e-4);
        const errors=stage.diagnostics().cableEndErrors;
        expect(errors).toHaveLength(1);
        expect(errors[0]!.errorMeters).toBeLessThan(1e-4);
      }
    }finally{stage.dispose();}
  });
  it('only hides a motor in designated camera cut and restores it after backward seeking',()=>{
    const stage=new SceneProgram3D(normalizeSceneProgram(raw(),sources),sources);
    try{
      stage.update(1);stage.frame(9/16);expect(stage.nodes.get('motor')?.visible).toBe(false);
      stage.update(4);stage.frame(9/16);expect(stage.nodes.get('motor')?.visible).toBe(true);
      expect(stage.nodes.get('strand')?.visible).toBe(false);
      stage.update(1);stage.frame(9/16);expect(stage.nodes.get('motor')?.visible).toBe(false);
      expect(stage.nodes.get('strand')?.visible).toBe(true);
    }finally{stage.dispose();}
  });
  it('rejects hiding an ancestor of a camera focus and malformed cables',()=>{
    const p=raw();p.shots[0].cuts[1].hide=['motor'];
    expect(()=>normalizeSceneProgram(p,sources)).toThrow(/Não oculte/);
    const invalid=raw();invalid.cables[0].node='motor-body';
    expect(()=>normalizeSceneProgram(invalid,sources)).toThrow(/cilindro/);
  });
  it('detects invisible/off-screen motion as a frozen shot rather than treating it as acting',()=>{
    const p=normalizeSceneProgram(raw(),sources);
    // In the second camera cut the motor rotates; in the first the load moves.
    const a=auditSceneCutActivity(p,sources,{maxStillSeconds:1.5});
    expect(a.frozenCuts).toEqual([]);
    const broken=raw();broken.tracks[1].keys=[
      k(0,[0,0,0]),k(.55,[0,0,0]),k(1,[0,0,0])];
    const b=auditSceneCutActivity(normalizeSceneProgram(broken,sources),sources,{maxStillSeconds:1.5});
    expect(b.frozenCuts.some(f=>f.cutIndex===1&&f.seconds>=2)).toBe(true);
  });
});
