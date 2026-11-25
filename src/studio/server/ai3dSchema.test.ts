import {describe,expect,it} from 'vitest';
import {gemini3DResponseSchema,parseAi3DScene} from './ai3dSchema';
import {compileCompactWorld} from '../explainer/sceneProgram/planner/compactWorldDirector';
import {sourceBriefsFromScript} from '../explainer/sceneProgram/planner/sceneScript';

const valid={
  version:1,setting:'city',background:'#C8D9E4',
  entities:[
    {id:'garage',name:'Garagem onde a moto espera',kind:'building',at:[-4,0,-6],size:[8,5,3],color:'#8797A6'},
    {id:'gate',name:'Portão de metal que bloqueia a saída',kind:'gate',at:[2,0,2],size:[3,2.2,.3],color:'#B4C1C9'},
    {id:'bike',name:'Motocicleta pronta para sair',kind:'motorcycle',at:[0,0,2],size:[2.8,1.5,1.4],color:'#EA8548'},
  ],
  actions:[
    {sourceId:'s2',target:'gate',kind:'lift',delta:[0,2.7,0]},
    {sourceId:'s3',target:'bike',kind:'drive',delta:[4,0,0]},
  ],
};
const sources=sourceBriefsFromScript(
  'Uma motocicleta está presa porque um portão fechado impede a saída. '+
  'O portão de metal sobe e libera a passagem. '+
  'A motocicleta acelera e sai da garagem para a rua.'
);

describe('LLM JSON contract for actual 3D motor',()=>{
  it('uses ONLY source IDs in the request being generated',()=>{
    const single=gemini3DResponseSchema(['s1']);
    expect(single.properties.actions.items.properties.sourceId.enum).toEqual(['s1']);
    const three=gemini3DResponseSchema(sources.map(s=>s.sourceId));
    expect(three.properties.actions.items.properties.sourceId.enum).toEqual(['s1','s2','s3']);
    expect(JSON.stringify(three)).not.toMatch(/minItems|maxItems/);
    expect(three.properties.entities.items.properties.kind.enum).toContain('gate');
    expect(()=>gemini3DResponseSchema(['s2','s2'])).toThrow(/IDs/);
  });
  it('accepts genuine 3D scene JSON with ordered portão → moto actions',()=>{
    const parsed=parseAi3DScene(JSON.stringify(valid));
    expect(parsed).not.toBeNull();
    const clip=compileCompactWorld(parsed,sources);
    expect(clip.sources).toHaveLength(3);
    expect(clip.program.shots).toHaveLength(3);
    expect(clip.program.tracks.some(t=>t.node==='gate')).toBe(true);
    expect(clip.program.tracks.some(t=>t.node==='bike')).toBe(true);
  });
  it('keeps array and vector limits in the strict compiler',()=>{
    expect(()=>compileCompactWorld({...valid,entities:[]},sources)).toThrow();
    expect(()=>compileCompactWorld({...valid,entities:valid.entities.map((e,i)=>i===0?{...e,at:[0,0]}:e)},sources)).toThrow();
    expect(()=>compileCompactWorld({...valid,actions:[...valid.actions,...valid.actions]},sources)).toThrow();
  });
  it('unwraps only explicit single-key scene/plan JSON envelopes',()=>{
    for(const key of ['scene','plan','world']){
      const wrapper=JSON.stringify({[key]:valid});
      const parsed=parseAi3DScene(wrapper);
      expect(parsed).toEqual(valid);
      expect(compileCompactWorld(parsed,sources).duration).toBe(12);
    }
    expect(parseAi3DScene('  ```json\n'+JSON.stringify(valid)+'\n``` ')).toEqual(valid);
  });
  it('never guesses, executes or sanitizes an invalid/unsafe response',()=>{
    expect(parseAi3DScene('Não consigo fazer esse vídeo.')).toBeNull();
    expect(parseAi3DScene('{\"version\":1,')).toBeNull();
    expect(parseAi3DScene('{"scene":{},"secret":"x"}')).toEqual({scene:{},secret:'x'});
    expect(()=>compileCompactWorld(parseAi3DScene('{"scene":{},"secret":"x"}'),sources))
      .toThrow(/campo não suportado/);
    const unsafe={...valid,code:'eval()',actions:valid.actions};
    expect(()=>compileCompactWorld(parseAi3DScene(JSON.stringify(unsafe)),sources))
      .toThrow(/campo não suportado/);
    expect(parseAi3DScene('[]')).toBeNull();
  });
});
