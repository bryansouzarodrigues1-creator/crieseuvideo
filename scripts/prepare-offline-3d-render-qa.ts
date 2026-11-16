/**
 * OFFLINE fixture — no Gemini request. Split the mechanical demo into TWO
 * ordered narration beats, reproducing the exact 8s vs 10s issue observed
 * in the real Gemini-generated turbine (two 5s program scenes).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { mechanicalDemoProgram } from '../src/studio/explainer/sceneProgram/mechanicalDemo';
import { normalizePlan, totalDuration } from '../src/studio/explainer/plan';
import { withTargetDuration } from '../src/studio/explainer/duration';

const part1 = 'A jarra desce e se encaixa na base do liquidificador.';
const part2 = 'Depois as lâminas começam a girar.';
const script = part1+' '+part2;
const program = mechanicalDemoProgram();
const key = (sourceId: string, phase: number, value: number[]) => ({sourceId,phase,value});
program.tracks = [
  {node:'jar-assembly',channel:'position',interpolation:'smooth',keys:[
    key('s1',0,[0,2.75,0]),key('s1',.2,[0,2.75,0]),
    key('s1',.8,[0,1.01,0]),key('s1',1,[0,1.01,0]),
    key('s2',1,[0,1.01,0]),
  ]},
  {node:'blade-rotor',channel:'rotation',interpolation:'linear',keys:[
    key('s1',0,[0,0,0]),key('s2',.1,[0,0,0]),
    key('s2',.8,[0,6.1,0]),key('s2',1,[0,6.1,0]),
  ]},
  {node:'jar-assembly',channel:'rotation',interpolation:'smooth',keys:[
    key('s1',0,[0,-.15,0]),key('s1',.8,[0,0,0]),key('s2',1,[0,0,0]),
  ]},
];
program.shots = [
  {sourceId:'s1',subjects:['motor-unit','jar-assembly'],azimuth:.48,endAzimuth:.6,elevation:.17,distance:1.18},
  {sourceId:'s2',subjects:['blade-rotor','jar-assembly'],azimuth:.6,endAzimuth:.3,elevation:.2,distance:1.3},
];
program.motionChecks = [
  {sourceId:'s1',node:'jar-assembly',channel:'position',kind:'change',startPhase:.15,endPhase:.84,threshold:1},
  {sourceId:'s1',node:'blade-rotor',channel:'rotation',kind:'hold',startPhase:0,endPhase:.95,threshold:.025},
  {sourceId:'s2',node:'jar-assembly',channel:'position',kind:'hold',startPhase:0,endPhase:1,threshold:.025},
  {sourceId:'s2',node:'blade-rotor',channel:'rotation',kind:'change',startPhase:.15,endPhase:.8,threshold:4},
];
const plan = withTargetDuration(normalizePlan({
  title:'Montagem 3D em duas cenas — TESTE OFFLINE',
  scenes:[
    {sourceId:'s1',visual:'character',mood:'neutral',palette:'teal'},
    {sourceId:'s2',visual:'character',mood:'neutral',palette:'teal'},
  ],
  sceneProgram:program,
},script,'9:16'),8);
if (totalDuration(plan) !== 8) throw new Error('The 3D program duration regression returned '+totalDuration(plan)+' instead of 8');
const out=path.resolve('tmp/authorized-gemini-3d-trial');
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'program.json'),JSON.stringify({...plan,engine:'3d'},null,2));
await fs.writeFile(path.join(out,'fixture-only.json'),JSON.stringify({
  generatedByGemini:false,offlineTest:true,creditsUsed:0,
  source:'TWO_SCENE_MECHANICAL_TIMING_FIXTURE',durationSeconds:8,
},null,2));
console.log('PASS: offline TWO-scene 3D program at exactly 8s; no model contacted.');
