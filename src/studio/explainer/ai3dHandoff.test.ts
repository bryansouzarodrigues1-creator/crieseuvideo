import {describe,expect,it} from 'vitest';
import {AI3D_HANDOFF_KEY,prepareAi3DHandoff,saveAi3DHandoff,takeAi3DHandoff} from './ai3dHandoff';

function storage(){
  const data=new Map<string,string>();
  return {
    getItem:(k:string)=>data.get(k)??null,
    setItem:(k:string,v:string)=>{data.set(k,v);},
    removeItem:(k:string)=>{data.delete(k);}
  };
}
describe('advanced 3D handoff from main CrieSeuVideo',()=>{
  it('preserves script, aspect, voice preference without a network request',()=>{
    const s=storage();
    const script='O navio atravessa um oceano tempestuoso. O casco encontra uma onda e balança com o peso da carga.';
    const original=prepareAi3DHandoff(script,'16:9',true,'voz-gemini');
    saveAi3DHandoff(s,original);
    expect(takeAi3DHandoff(s)).toEqual(original);
    expect(takeAi3DHandoff(s)).toBeNull();
    expect(original.script).toBe(script);
    expect(original.aspect).toBe('16:9');
    expect(original.wantsNarration).toBe(true);
  });
  it('does not silently pretend a 2-minute script fits in an 8-second sequence',()=>{
    const first='Uma ponte suspensa atravessa o rio durante uma tempestade. ';
    const full=first.repeat(30);
    const req=prepareAi3DHandoff(full,'9:16',false,'voz');
    expect(req.script.length).toBeLessThanOrEqual(750);
    expect(req.fullScriptLength).toBe(full.trim().length);
    expect(req.fullScriptLength).toBeGreaterThan(req.script.length);
  });
  it('rejects malicious or corrupt stored handoffs',()=>{
    const s=storage();
    s.setItem(AI3D_HANDOFF_KEY,'{invalid');
    expect(takeAi3DHandoff(s)).toBeNull();
    s.setItem(AI3D_HANDOFF_KEY,JSON.stringify({script:'x',aspect:'9:16',wantsNarration:true,voice:'a',fullScriptLength:-1}));
    expect(takeAi3DHandoff(s)).toBeNull();
  });
});
