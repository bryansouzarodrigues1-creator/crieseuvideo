import type { SceneProgramCandidate } from '../src/studio/explainer/sceneProgram/candidate';

export interface NumericFieldIssue {
  path: string;
  expected: string;
  received: 'non_numeric' | 'not_finite' | 'out_of_range';
}

/** Read-only diagnosis of the raw REJECTED program: never render or trust it.
 * Only output the structural path and the expected range — no model values.
 * Mirrors numeric bounds in sceneProgram/score.ts, without weakening them. */
export function locateInvalidSceneNumber(candidate: SceneProgramCandidate | undefined): NumericFieldIssue | null {
  if (!candidate?.program) return null;
  const p = candidate.program as Record<string, any>;
  let issue: NumericFieldIssue | null = null;
  const scalar = (value: unknown, path: string, min: number, max: number) => {
    if (issue) return;
    const received = typeof value !== 'number' ? 'non_numeric' :
      !Number.isFinite(value) ? 'not_finite' :
      value < min || value > max ? 'out_of_range' : null;
    if (received) issue = { path, expected: `number in [${min}, ${max}]`, received };
  };
  const vec = (value: unknown, path: string, min: number, max: number) => {
    if (!Array.isArray(value)) return;
    value.forEach((v, i) => scalar(v, `${path}[${i}]`, min, max));
  };
  const arr = (value: unknown) => Array.isArray(value) ? value : [];
  arr(p.nodes).forEach((n: any, i) => {
    if (!n || typeof n !== 'object') return;
    for (const [field, min, max] of [
      ['position', -200, 200], ['rotation', -2 * Math.PI, 2 * Math.PI], ['scale', .01, 100],
    ] as const) if (n[field] !== undefined) vec(n[field], `nodes[${i}].${field}`, min, max);
    if (n.geometry && typeof n.geometry === 'object') {
      const g = n.geometry;
      const path = `nodes[${i}].geometry`;
      if (g.shape === 'lathe') {
        arr(g.profile).forEach((pair: any, j) => {
          if (Array.isArray(pair)) {
            scalar(pair[0], `${path}.profile[${j}][0]`, 0, 200);
            scalar(pair[1], `${path}.profile[${j}][1]`, -200, 200);
          }
        });
        if (g.segments !== undefined) scalar(g.segments, path+'.segments', 8, 64);
      } else if (g.shape === 'mesh') {
        arr(g.vertices).forEach((v: any, j) => scalar(v, `${path}.vertices[${j}]`, -200, 200));
        const hi=Math.max(0,arr(g.vertices).length / 3 - 1);
        arr(g.indices).forEach((v: any, j) => scalar(v, `${path}.indices[${j}]`, 0, hi));
        arr(g.colors).forEach((v: any, j) => scalar(v, `${path}.colors[${j}]`, 0, 1));
      } else {
        const min=g.shape==='cylinder'?0:.005;
        arr(g.size).forEach((v: any, j) => scalar(v, `${path}.size[${j}]`, min, 200));
        if (g.shape==='tube') arr(g.points).forEach((v: any,j)=>vec(v,`${path}.points[${j}]`,-200,200));
      }
    }
    if(n.material){
      for (const [name,min,max] of [
        ['roughness',0,1],['metalness',0,1],['opacity',.05,1],
        ['emissiveIntensity',0,3],
      ] as const) if (n.material[name] !== undefined) scalar(n.material[name],`nodes[${i}].material.${name}`,min,max);
    }
    if (n.repeat) {
      const r=n.repeat, path=`nodes[${i}].repeat`;
      if(r.count !== undefined) scalar(r.count,path+'.count',1,800);
      if(r.seed !== undefined) scalar(r.seed,path+'.seed',0,2147483647);
      if(r.step !== undefined) vec(r.step,path+'.step',-200,200);
      if(r.jitter !== undefined) vec(r.jitter,path+'.jitter',0,200);
    }
  });
  arr(p.tracks).forEach((t: any,i)=>{
    const channel=String(t?.channel??'');
    const min=channel==='scale' ? .01 : channel==='face' ? -1 :
      channel==='rotation' ? -200 : /Rotation/.test(channel) ? -2*Math.PI : -200;
    const max=channel==='scale' ? 100 : channel==='face' ? 1 :
      channel==='rotation' ? 200 : /Rotation/.test(channel) ? 2*Math.PI : 200;
    arr(t?.keys).forEach((k:any,j)=>{
      if(k?.phase!==undefined) scalar(k.phase,`tracks[${i}].keys[${j}].phase`,0,1);
      if(k?.value!==undefined) vec(k.value,`tracks[${i}].keys[${j}].value`,min,max);
    });
  });
  arr(p.shots).forEach((s:any,i)=>{
    for(const [name,min,max] of [
      ['azimuth',-2*Math.PI,2*Math.PI],['endAzimuth',-2*Math.PI,2*Math.PI],
      ['elevation',-.35,1.1],['distance',1,2.5],
    ] as const) if(s?.[name]!==undefined) scalar(s[name],`shots[${i}].${name}`,min,max);
  });
  arr(p.contacts).forEach((c:any,i)=>{
    for (const name of ['begin','end']) if(c?.[name]!==undefined) scalar(c[name],`contacts[${i}].${name}`,0,1);
    if(c?.offset!==undefined) vec(c.offset,`contacts[${i}].offset`,-200,200);
  });
  arr(p.motionChecks).forEach((c:any,i)=>{
    for(const name of ['startPhase','endPhase']) if(c?.[name]!==undefined) scalar(c[name],`motionChecks[${i}].${name}`,0,1);
    if(c?.threshold!==undefined) scalar(c.threshold,`motionChecks[${i}].threshold`,.001,100);
  });
  return issue;
}
