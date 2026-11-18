import {describe,it,expect} from 'vitest';
import {sourceBriefsFromScript,aiWorldPrompt,verifyAiWorldProposal} from './aiWorldDirector';
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
    expect(()=>verifyAiWorldProposal(sample,sample.clips[0].sources)).toThrow(/estática/);
    sample.clips[0].sceneProgram.tracks=structuredClone(COMPLEX_WORLD_QA_REQUEST.clips[0].sceneProgram.tracks);
    sample.clips[0].worldBlueprints.objects=[sample.clips[0].worldBlueprints.objects[0]];
    expect(()=>verifyAiWorldProposal(sample,sample.clips[0].sources)).toThrow(/incompleto/);
  });
  it('rejects a vague single-line or oversized request without spending model credits',()=>{
    expect(()=>sourceBriefsFromScript('Uma moto corre.')).toThrow(/Escreva/);
    expect(()=>sourceBriefsFromScript('A'.repeat(800))).toThrow(/longo/);
  });
});
