import {describe,expect,it,vi} from 'vitest';
import {COMPLEX_WORLD_QA_REQUEST} from '../explainer/sceneProgram/planner/complexWorldBatchDemo';
import {complexWorldBatchPrompt,generateComplexWorldBatchWithProvider} from './complexWorldBatchPipeline';

const briefs=COMPLEX_WORLD_QA_REQUEST.clips.map(c=>({id:c.id,sources:c.sources}));
describe('one-call multi-scene AI adapter (mock only, no Gemini credits)',()=>{
  it('accepts a single full JSON response containing ark, prison and motorcycle independently',async()=>{
    const provider=vi.fn(async (_prompt:string)=>JSON.stringify(COMPLEX_WORLD_QA_REQUEST));
    const {batch,providerPasses}=await generateComplexWorldBatchWithProvider(briefs,provider);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(providerPasses).toBe(1);
    expect(batch.clips.map(c=>c.id)).toEqual(briefs.map(b=>b.id));
    expect(batch.clips.map(c=>c.program.shots.length)).toEqual([2,2,2]);
    const prompt=provider.mock.calls[0][0];
    expect(prompt).toContain('extrude');
    expect(prompt).toContain('CENAS ORIGINAIS:');
    expect(prompt).toContain('uma grande arca'.toLowerCase().slice(5)); // text is preserved verbatim in prompt
  });
  it('rejects changed source text and reordered clips even when geometry validates',async()=>{
    const changed=structuredClone(COMPLEX_WORLD_QA_REQUEST) as any;
    changed.clips[0].sources[0].text='A arca desaparece sem explicação.';
    await expect(generateComplexWorldBatchWithProvider(briefs,async()=>JSON.stringify(changed)))
      .rejects.toThrow(/alterou o roteiro/);
    changed.clips=structuredClone(COMPLEX_WORLD_QA_REQUEST.clips);
    changed.clips.reverse();
    await expect(generateComplexWorldBatchWithProvider(briefs,async()=>JSON.stringify(changed)))
      .rejects.toThrow(/identidade ou a ordem/);
  });
  it('rejects invalid user source data before any model invocation',async()=>{
    const provider=vi.fn(async()=>JSON.stringify(COMPLEX_WORLD_QA_REQUEST));
    const invalid=structuredClone(briefs) as any;
    invalid[0].sources[0].duration=Number.NaN;
    await expect(generateComplexWorldBatchWithProvider(invalid,provider))
      .rejects.toThrow(/Duração inválida/);
    expect(provider).not.toHaveBeenCalled();
  });
  it('rejects oversized outputs without retrying or partially committing scenes',async()=>{
    const provider=vi.fn(async()=>'*'.repeat(480001));
    await expect(generateComplexWorldBatchWithProvider(briefs,provider))
      .rejects.toThrow(/longa ou inválida/);
    expect(provider).toHaveBeenCalledTimes(1);
  });
});
