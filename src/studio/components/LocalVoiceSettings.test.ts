import {describe,expect,it} from 'vitest';
import {localPortugueseVoices} from './LocalVoiceSettings';

const voice=(lang:string,localService:boolean,voiceURI:string):SpeechSynthesisVoice=>({
  lang,localService,voiceURI,name:voiceURI,default:false,
});

describe('zero cloud speech preview',()=>{
  it('only permits local Brazilian Portuguese voices, never remote or mismatched language',()=>{
    const local=voice('pt-BR',true,'br');
    const underscore=voice('pt_BR',true,'br2');
    expect(localPortugueseVoices([
      local,voice('pt-BR',false,'remote'),voice('pt-PT',true,'pt'),voice('en-US',true,'en'),underscore
    ])).toEqual([local,underscore]);
  });
  it('does not silently select another voice if no local voice is installed',()=>{
    expect(localPortugueseVoices([voice('pt-BR',false,'remote')])).toEqual([]);
  });
});
