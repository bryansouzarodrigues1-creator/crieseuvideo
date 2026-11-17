import {describe,expect,it} from 'vitest';
import {normalizeSceneProgram, type ProgramSource} from './score';
import {auditStoryContinuity} from './storyContinuity';
import {cementLift30sProgram, cementLiftSources} from '../../../../lab/cement-hoist-30s/program';

const sources:ProgramSource[]=[{sourceId:'s1',text:'Um mecanismo recebe uma peça, move e encaixa.',duration:6}];
function fixture(){
  return normalizeSceneProgram({version:1,background:'#B2D4EF',
    nodes:[
      {id:'machine',kind:'group',contextSourceId:'s1'},
      {id:'part',kind:'mesh',parent:'machine',contextSourceId:'s1',
        geometry:{shape:'box',size:[1,.3,.5]}},
      {id:'output',kind:'mesh',contextSourceId:'s1',
        geometry:{shape:'sphere',size:[.5]}}
    ],
    tracks:[
      {node:'part',channel:'position',interpolation:'linear',keys:[
        {sourceId:'s1',phase:0,value:[-1,0,0]},
        {sourceId:'s1',phase:1,value:[1,0,0]}]},
      {node:'output',channel:'scale',interpolation:'linear',keys:[
        {sourceId:'s1',phase:0,value:[1,1,1]},
        {sourceId:'s1',phase:1,value:[1.5,1.5,1.5]}]}
    ],
    shots:[{sourceId:'s1',subjects:['machine'],cuts:[
      {phase:0,subjects:['machine'],azimuth:.25},
      {phase:1/3,subjects:['part'],azimuth:.40},
      {phase:2/3,subjects:['part','output'],azimuth:.32},
    ]}],contacts:[]},sources);
}

describe('editorial continuity independent of basic movement checks',()=>{
  it('finds the existing 30s film visually repetitive and causally disconnected despite motion QA being green',()=>{
    const p=normalizeSceneProgram(cementLift30sProgram(),cementLiftSources);
    const r=auditStoryContinuity(p,cementLiftSources);
    expect(r.cuts).toHaveLength(5);
    expect(r.longCutCount).toBeGreaterThanOrEqual(4);
    expect(r.visualBridgeRatio).toBeLessThan(.6);
    expect(r.findings.some(f=>f.kind==='only_decorative_rotation')).toBe(true);
    expect(r.findings.some(f=>f.kind==='weak_visual_bridge')).toBe(true);
  });
  it('keeps a short evolving scene free of long-cut and missing visual-bridge findings',()=>{
    const r=auditStoryContinuity(fixture(),sources);
    expect(r.longCutCount).toBe(0);
    expect(r.visualBridgeRatio).toBe(1);
    expect(r.findings.some(f=>f.kind==='repeated_framing')).toBe(false);
    expect(r.cuts.some(c=>c.changedPositionalSubjects.includes('part'))).toBe(true);
  });
  it('identifies duplicate successive framing despite continuously moving geometry',()=>{
    const p=fixture();
    p.shots[0]!.cuts![1].subjects=['machine'];
    p.shots[0]!.cuts![1].azimuth=p.shots[0]!.cuts![0].azimuth;
    p.shots[0]!.cuts![1].elevation=p.shots[0]!.cuts![0].elevation;
    const r=auditStoryContinuity(p,sources);
    expect(r.findings.some(f=>f.kind==='repeated_framing'&&f.cut===1)).toBe(true);
  });
});
