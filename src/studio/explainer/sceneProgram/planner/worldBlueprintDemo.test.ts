import {describe,expect,it} from 'vitest';
import {compileSceneProgram} from '../score';
import {SceneProgram3D} from '../stage3d';
import {buildWorldBlueprintPreview} from './worldBlueprintDemo';

describe('World blueprint stage + causal motor in varied settings',()=>{
  for(const setting of ['workshop','city','harbor'] as const){
    it('assembles new multi-part '+setting+' cargo and environment without changing event structure',()=>{
      const result=buildWorldBlueprintPreview(setting);
      expect(result.worldAudit.objects).toHaveLength(2);
      expect(result.worldAudit.totalNodes).toBeGreaterThan(8);
      expect(result.worldAudit.objects[0].id).toBe('cargo');
      expect(result.worldAudit.objects[0].features.length).toBeGreaterThanOrEqual(4);
      expect(result.program.nodes.filter(n=>n.id==='cargo')).toHaveLength(1);
      expect(result.program.nodes.some(n=>n.id.startsWith('cargo-'))).toBe(true);
      expect(result.program.nodes.some(n=>n.id==='drum-shaft')).toBe(true);
      const score=compileSceneProgram(result.program,result.sources);
      const start=score.sample(1).get('cargo')!.position;
      const end=score.sample(5).get('cargo')!.position;
      expect(Math.hypot(...end.map((v,i)=>v-start[i]))).toBeGreaterThanOrEqual(4.9);
      const shaft=score.sample(5).get('drum-shaft')!.rotation[2];
      expect(Math.abs(shaft)).toBeGreaterThan(9);
      const stage=new SceneProgram3D(result.program,result.sources);
      try{
        const cargo=stage.nodes.get('cargo')!;
        for(const t of [0,1,2.5,5,6]){
          stage.update(t);
          expect(stage.nodes.get('cargo')).toBe(cargo);
          expect(stage.nodes.get('cargo')?.position.toArray().every(Number.isFinite)).toBe(true);
          stage.frame(9/16);
          expect(stage.camera.position.toArray().every(Number.isFinite)).toBe(true);
        }
      }finally{stage.dispose();}
    });
  }
});
