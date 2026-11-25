import {afterEach,describe,expect,it,vi} from 'vitest';
import {ask3DWorldAi} from './ai';
import {gemini3DResponseSchema,parseAi3DScene} from './ai3dSchema';
import {sourceBriefsFromScript} from '../explainer/sceneProgram/planner/sceneScript';
import {compactWorldPrompt,compileCompactWorld} from '../explainer/sceneProgram/planner/compactWorldDirector';
import {compileSceneProgram} from '../explainer/sceneProgram/score';
import {SceneProgram3D} from '../explainer/sceneProgram/stage3d';
import {auditShotVisibilitySequence} from '../explainer/sceneProgram/shotVisibilityAudit';

const SCRIPT=
  'O guindaste recolhe uma caixa no chão da obra e a ergue acima dos obstáculos. '+
  'O carrinho leva a mesma caixa pelo braço do guindaste até a plataforma elevada. '+
  'O cabo desce e deposita a caixa sobre a plataforma, com a carga apoiada no tablado.';
const PLAN={
  version:1,setting:'industrial',background:'#C5DCEB',
  entities:[
    {id:'crane',name:'Guindaste do canteiro',kind:'crane',at:[-2,0,0],size:[7,9,3],color:'#D6A442'},
    {id:'load',name:'Caixa carregada pelo guindaste',kind:'cargo',at:[0,0,0],size:[1.5,1,1],color:'#C9B394'},
    {id:'landing',name:'Plataforma de recebimento',kind:'platform',at:[2.2,0,0],size:[2.4,1,2.8],color:'#8199A2'},
  ],
  actions:[
    {sourceId:'s1',target:'load',kind:'lift',delta:[0,4,0]},
    {sourceId:'s2',target:'load',kind:'move',delta:[2.2,0,0]},
    {sourceId:'s3',target:'load',kind:'lower',delta:[0,-3,0],onto:'landing'},
  ],
} as const;

const oldKey=process.env.GEMINI_API_KEY,oldLovable=process.env.LOVABLE_API_KEY;
afterEach(()=>{
 if(oldKey===undefined)delete process.env.GEMINI_API_KEY;
 else process.env.GEMINI_API_KEY=oldKey;
 if(oldLovable===undefined)delete process.env.LOVABLE_API_KEY;
 else process.env.LOVABLE_API_KEY=oldLovable;
 vi.unstubAllGlobals();
});

describe('Gemini structured planning → production 3D compiler → camera QA',()=>{
 it('accepts the exact platform and onto fields expected by the motor',async()=>{
  const sources=sourceBriefsFromScript(SCRIPT);
  const schema=gemini3DResponseSchema(sources.map(s=>s.sourceId));
  expect(schema.properties.entities.items.properties.kind.enum).toContain('platform');
  expect(schema.properties.actions.items.properties.onto).toEqual({type:'STRING'});
  let responseBody:any;
  let calledUrl='';
  process.env.GEMINI_API_KEY='fake-secret-not-for-real-api';
  delete process.env.LOVABLE_API_KEY;
  const fetchMock=vi.fn(async (url:string,init:RequestInit)=>{
    calledUrl=url;
    responseBody=JSON.parse(String(init.body));
    return Response.json({candidates:[{
      finishReason:'STOP',
      content:{parts:[{text:JSON.stringify(PLAN)}]},
    }]});
  });
  vi.stubGlobal('fetch',fetchMock);
  const valid=(response:string)=>{
    const json=parseAi3DScene(response);
    if(!json)return {accepted:false,reason:'invalid_json' as const};
    try{compileCompactWorld(json,sources);return {accepted:true as const};}
    catch{return {accepted:false,reason:'invalid_scene' as const};}
  };
  const response=await ask3DWorldAi(compactWorldPrompt(sources),'gemini',valid,schema);
  expect(response?.provider).toBe('gemini');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(calledUrl).toContain('generativelanguage.googleapis.com');
  expect(responseBody.generationConfig.responseSchema).toEqual(schema);
  expect(responseBody.generationConfig.responseMimeType).toBe('application/json');
  expect(String(responseBody)).not.toContain('fake-secret-not-for-real-api');

  const clip=compileCompactWorld(parseAi3DScene(response!.text),sources);
  expect(clip.program.nodes.filter(n=>n.id==='load')).toHaveLength(1);
  expect(clip.program.nodes.filter(n=>n.id==='landing')).toHaveLength(1);
  const timeline=compileSceneProgram(clip.program,clip.sources);
  expect(timeline.sample(0).get('load')?.position).toEqual([0,0,0]);
  expect(timeline.sample(12).get('load')?.position).toEqual([2.2,1,0]);
  const stage=new SceneProgram3D(clip.program,clip.sources);
  try{
    const qa=auditShotVisibilitySequence(stage,9/16);
    expect(qa).toHaveLength(9);
    expect(qa.map(q=>q.sourceId)).toEqual(['s1','s1','s1','s2','s2','s2','s3','s3','s3']);
    expect(qa.some(q=>q.subjects.some(s=>s.id==='load'))).toBe(true);
  }finally{stage.dispose();}
 });
});
