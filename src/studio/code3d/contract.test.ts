import { describe, expect, it } from 'vitest';
import { CODE3D_MAX_DURATION, CODE3D_MIN_DURATION, code3dPrompt, extractCode, validDuration } from './contract';
import { SANDBOX_ATTRIBUTE, SANDBOX_CSP, buildSandboxSrcdoc, maxPixelDiff, readSandboxMessage, replayCheck } from './sandbox';
import { checkGeneratedCode } from '../server/code3dGemini';

describe('Gemini Code 3D experimental contract (offline)', () => {
  it('accepts a fenced JS function and rejects answers without the entrypoint', () => {
    const fn = 'function createScene(THREE,canvas,width,height){return {duration:10,renderAt(t){},dispose(){}};}';
    expect(extractCode('Here:\n\`\`\`javascript\n' + fn + '\n\`\`\`')).toBe(fn);
    expect(extractCode('Este é um exemplo sem função implementada.')).toBeNull();
    expect(checkGeneratedCode(fn)).toMatchObject({ ok: true });
    expect(checkGeneratedCode('function createScene( ){')).toMatchObject({ ok: false, failure: 'syntax_error' });
    expect(checkGeneratedCode('import x from "evil"; function createScene(){}')).toMatchObject({ ok: false, failure: 'contract_error' });
  });

  it('requires scenes between 8 and 12 seconds and asks for absolute-time replay', () => {
    expect(validDuration(8)).toBe(CODE3D_MIN_DURATION);
    expect(validDuration(12)).toBe(CODE3D_MAX_DURATION);
    expect(validDuration(7.9)).toBeNull();
    expect(validDuration(12.1)).toBeNull();
    expect(code3dPrompt('Uma grua carrega um contêiner', '9:16')).toContain('renderAt(t)');
    expect(code3dPrompt('Uma grua carrega um contêiner', '9:16')).toContain('createScene');
  });

  it('keeps arbitrary model code in an opaque-origin restricted iframe shell', () => {
    const token='a'.repeat(32), nonce='b'.repeat(32);
    const html=buildSandboxSrcdoc({
      token,nonce,parentOrigin:'https://crieseuvideo.lovable.app',
      minDuration:8,maxDuration:12,defaultDuration:10,
    });
    expect(SANDBOX_ATTRIBUTE).toBe('allow-scripts');
    expect(SANDBOX_ATTRIBUTE).not.toContain('allow-same-origin');
    expect(SANDBOX_CSP).toContain("connect-src 'none'");
    expect(SANDBOX_CSP).toContain("form-action 'none'");
    expect(SANDBOX_CSP).toContain("worker-src 'none'");
    expect(html).toContain('<meta http-equiv="Content-Security-Policy"');
    expect(html).not.toContain('GEMINI_API_KEY');
    expect(html).not.toContain('allow-same-origin');
    expect(html).toContain(token);
  });

  it('accepts frame control only from the exact sandbox window, opaque origin and matching token', () => {
    const frame={}; const token='a'.repeat(32);
    const ev={source:frame,origin:'null',data:{type:'ready',token,duration:10,deterministic:true,maxDiff:0}};
    expect(readSandboxMessage(ev,frame,token)).toMatchObject({type:'ready',duration:10});
    expect(readSandboxMessage({...ev,origin:'https://crieseuvideo.lovable.app'},frame,token)).toBeNull();
    expect(readSandboxMessage({...ev,source:{}},frame,token)).toBeNull();
    expect(readSandboxMessage({...ev,data:{...ev.data,token:'bad'}},frame,token)).toBeNull();
    expect(readSandboxMessage({...ev,data:{...ev.data,duration:999}},frame,token)).toBeNull();
  });

  it('checks deterministic replay by seeking away and back to identical timestamps', () => {
    let current=0;
    const frame=(t:number)=>{current=t;};
    const sample=()=>[Math.round(current*10),42,9,255];
    expect(replayCheck(frame,sample,maxPixelDiff,10)).toEqual({deterministic:true,maxDiff:0});
    let offset=0;
    const unstable=(t:number)=>{current=t;offset++;};
    expect(replayCheck(unstable,()=>[Math.round(current*10)+offset],maxPixelDiff,10).deterministic).toBe(false);
  });
});
