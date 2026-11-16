import { describe, expect, it } from 'vitest';
import { locateInvalidSceneNumber } from './gemini-3d-numeric-locator';
import type { SceneProgramCandidate } from '../src/studio/explainer/sceneProgram/candidate';

const inspect = (program: Record<string, unknown>) =>
  locateInvalidSceneNumber({ sourceSignature:'[]',program } satisfies SceneProgramCandidate);

describe('safe exact-path diagnostics for Gemini-produced 3D numbers',()=>{
  it('returns the correct offending timeline key, without model-provided values',()=>{
    const report=inspect({tracks:[{channel:'headRotation',keys:[{phase:.2,value:[0,0,7.5]}]}]});
    expect(report).toEqual({
      path:'tracks[0].keys[0].value[2]',
      expected:`number in [${-2*Math.PI}, ${2*Math.PI}]`,
      received:'out_of_range',
    });
    expect(JSON.stringify(report)).not.toContain('7.5');
  });
  it('detects invalid scale, geometry, camera and phase values',()=>{
    expect(inspect({nodes:[{scale:[-1,1,1]}]})?.path).toBe('nodes[0].scale[0]');
    expect(inspect({nodes:[{geometry:{shape:'cylinder',size:[.3,.3,-1]}}]})?.path)
      .toBe('nodes[0].geometry.size[2]');
    expect(inspect({shots:[{elevation:90}]})?.path).toBe('shots[0].elevation');
    expect(inspect({tracks:[{channel:'position',keys:[{phase:4,value:[0,0,0]}]}]})?.path)
      .toBe('tracks[0].keys[0].phase');
    expect(inspect({motionChecks:[{threshold:0}]})?.path)
      .toBe('motionChecks[0].threshold');
  });
  it('ignores good programs and never exposes arbitrary strings supplied by AI',()=>{
    expect(inspect({nodes:[{geometry:{shape:'box',size:[1,1,1]},position:[0,0,0]}],
       tracks:[{channel:'rotation',keys:[{phase:0,value:[0,0,0]},{phase:1,value:[0,3.2,0]}]}],
       shots:[{azimuth:.6,distance:1.2}]})).toBeNull();
    expect(inspect({nodes:[{id:'key:AQ.HiddenSecretNeverLog12345',
      position:['AQ.HiddenSecretNeverLog12345',0,0]}]})?.path).toBe('nodes[0].position[0]');
  });
});
