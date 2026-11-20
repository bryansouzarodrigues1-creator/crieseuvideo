import {describe,it,expect} from 'vitest';
import {sourceBriefsFromScript,aiWorldPrompt,verifyAiWorldProposal} from './aiWorldDirector';
import {checkSceneScript} from './sceneScript';
import {compileCompactWorld} from './compactWorldDirector';
import {compileSceneProgram} from '../score';
import {COMPLEX_WORLD_QA_REQUEST} from './complexWorldBatchDemo';

describe('AI-native 3D directions cannot silently return a static stock preview',()=>{
  const script='Uma grua ergue uma carga num canteiro de obras completo. O freio fecha e a carga para sobre a plataforma.';
  it('keeps every spoken sentence intact with a distinct shot',()=>{
    const sources=sourceBriefsFromScript(script);
    expect(sources).toHaveLength(2);
    expect(sources.map(s=>s.text).join(' ')).toBe(script);
    expect(sources.map(s=>s.sourceId)).toEqual(['s1','s2']);
    expect(sources.every(s=>s.duration===4)).toBe(true);
    const prompt=aiWorldPrompt(sources);
    expect(prompt).toContain('worldBlueprints');
    expect(prompt).toContain('worldScenery');
    expect(prompt).toContain('roteiro');
    expect(prompt).toContain('SOURCES CANÔNICAS:');
  });
  it('accepts a genuinely assembled and moving world but never calls a provider in tests',()=>{
    const sample=structuredClone(COMPLEX_WORLD_QA_REQUEST) as any;
    sample.clips=[{...sample.clips[0],id:'scene'}];
    const result=verifyAiWorldProposal(sample,sample.clips[0].sources);
    expect(result.program.nodes.length).toBeGreaterThan(12);
    expect(result.program.tracks.length).toBeGreaterThan(1);
    expect(result.audit.sceneryRegions).toBeGreaterThan(0);
  });
  it('rejects a fake response that returns another scene identifier or alters the narration',()=>{
    const sample=structuredClone(COMPLEX_WORLD_QA_REQUEST) as any;
    sample.clips=[{...sample.clips[0],id:'noahs-ark'}];
    expect(()=>verifyAiWorldProposal(sample,sample.clips[0].sources)).toThrow(/identificada como scene/);
    sample.clips[0].id='scene';
    const actual=structuredClone(sample.clips[0].sources);
    actual[0].text='Outra história, sem relação com o pedido.';
    expect(()=>verifyAiWorldProposal(sample,actual)).toThrow(/alterou o roteiro/);
  });
  it('rejects empty or motionless results before display',()=>{
    const sample=structuredClone(COMPLEX_WORLD_QA_REQUEST) as any;
    sample.clips=[{...sample.clips[0],id:'scene'}];
    sample.clips[0].sceneProgram.tracks=[];
    expect(()=>verifyAiWorldProposal(sample,sample.clips[0].sources)).toThrow(/movimentos|estática/);
    sample.clips[0].sceneProgram.tracks=structuredClone(COMPLEX_WORLD_QA_REQUEST.clips[0].sceneProgram.tracks);
    sample.clips[0].worldBlueprints.objects=[sample.clips[0].worldBlueprints.objects[0]];
    expect(()=>verifyAiWorldProposal(sample,sample.clips[0].sources)).toThrow(/incompleto|objeto inexistente/);
  });
  it('accepts one natural descriptive sentence as a single ~8 second shot',()=>{
    const script='Um caminhão vermelho avança lentamente pela estrada e para diante de uma barreira fechada.';
    const sources=sourceBriefsFromScript(script);
    expect(sources).toEqual([{sourceId:'s1',text:script,duration:8}]);
    const preflight=checkSceneScript(script);
    expect(preflight.ok).toBe(true);
    expect(preflight.duration).toBe(8);
    // This is not merely UI acceptance: the actual clip compiler and
    // camera timeline can run with a single original sentence.
    const scene=compileCompactWorld({
      version:1,setting:'city',background:'#A7CCDB',
      entities:[
        {id:'truck',name:'Caminhão vermelho',kind:'vehicle',at:[0,0,1],size:[3,2,2],color:'#D45A40'},
        {id:'barrier',name:'Barreira fechada',kind:'cargo',at:[5,0,1],size:[.7,2,.3],color:'#E3BA50'}
      ],
      actions:[{target:'truck',kind:'drive',delta:[3,0,0]}]
    },sources);
    expect(scene.duration).toBe(8);
    expect(scene.program.shots).toHaveLength(1);
    const stage=compileSceneProgram(scene.program,scene.sources);
    expect(stage.duration).toBe(8);
  });
  it('accepts separate lines without punctuation and matches the browser preflight',()=>{
    const script='A moto está parada diante do portão da oficina\\nO portão sobe e libera a passagem\\nA moto acelera e sai da oficina'.replaceAll('\\n','\n');
    const sources=sourceBriefsFromScript(script);
    expect(sources).toHaveLength(3);
    expect(sources.map(s=>s.sourceId)).toEqual(['s1','s2','s3']);
    expect(sources.map(s=>s.duration)).toEqual([4,4,4]);
    expect(checkSceneScript(script)).toMatchObject({ok:true,count:3,duration:12});
  });
  it('explains invalid prompts before any server/provider request',()=>{
    expect(checkSceneScript('Crie um lovable')).toMatchObject({ok:false,count:0});
    expect(checkSceneScript('Uma viagem longa começa na floresta. X.')).toMatchObject({ok:false});
    const oneLong='Um celular em construção '+ 'componente '.repeat(40);
    expect(checkSceneScript(oneLong).ok).toBe(false);
  });
  it('rejects a vague single-line or oversized request without spending model credits',()=>{
    expect(()=>sourceBriefsFromScript('Uma moto corre.')).toThrow(/Escreva/);
    expect(()=>sourceBriefsFromScript('A'.repeat(800))).toThrow(/longo/);
  });
});
