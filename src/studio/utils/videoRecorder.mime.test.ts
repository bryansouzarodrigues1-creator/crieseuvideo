import {afterEach,describe,expect,it,vi} from 'vitest';
import {getBestSupportedVideoMimeType} from './videoRecorder';

afterEach(()=>vi.unstubAllGlobals());

describe('video container is not misrepresented as MP4',()=>{
  it('records MP4 only when the browser supports an actual MP4 mime type',()=>{
    vi.stubGlobal('MediaRecorder',{isTypeSupported:(mime:string)=>mime==='video/mp4'});
    expect(getBestSupportedVideoMimeType()).toEqual({mimeType:'video/mp4',extension:'mp4'});
  });
  it('uses a .webm extension when only WebM is supported',()=>{
    vi.stubGlobal('MediaRecorder',{isTypeSupported:(mime:string)=>mime==='video/webm'});
    expect(getBestSupportedVideoMimeType()).toEqual({mimeType:'video/webm',extension:'webm'});
  });
  it('fails safely when the browser cannot record either container',()=>{
    vi.stubGlobal('MediaRecorder',{isTypeSupported:()=>false});
    expect(()=>getBestSupportedVideoMimeType()).toThrow(/não suporta gravação/);
  });
});
