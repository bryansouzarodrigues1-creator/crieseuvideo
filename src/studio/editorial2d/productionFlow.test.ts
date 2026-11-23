import {describe,expect,it} from 'vitest';
import {storytellingOvos} from './storytellingOvosSpec';
import {storytellingLoja} from './storytellingLojaSpec';
import {validateStory} from './storytelling';
import {cleanElevenPerformanceText,countWords,durationAllowed,estimatedSpeechRange,
  rescaleStoryDuration,resolveAudioMode,splitIntoActs} from './productionFlow';

describe('Cinema 2D — fluxo de narração e duração',()=>{
  it('não confunde arquivo MP3 com voz automaticamente',()=>{
    expect(resolveAudioMode('auto','unclassified',true,'')).toBe('confirm_audio_type');
    expect(resolveAudioMode('auto','music',true,'')).toBe('no_voice');
    expect(resolveAudioMode('auto','voice',true,'')).toBe('narrated');
  });
  it('usa decisões explícitas e detecta narração sem áudio',()=>{
    expect(resolveAudioMode('narrated','unclassified',false,'Oi')).toBe('waiting_for_mp3');
    expect(resolveAudioMode('without_voice','voice',true,'Oi')).toBe('no_voice');
    expect(resolveAudioMode('auto','unclassified',false,'Roteiro escrito')).toBe('waiting_for_mp3');
    expect(resolveAudioMode('auto','unclassified',false,'')).toBe('no_voice');
  });
  it('ajusta cenas para duração real sem esticar áudio',()=>{
    const out=rescaleStoryDuration(storytellingLoja,62.4);
    expect(out.duration).toBe(62.4);
    expect(out.scenes[0].start).toBe(0);
    expect(out.scenes[out.scenes.length-1].end).toBe(62.4);
    expect(validateStory(out)).toEqual([]);
    expect(storytellingLoja.duration).toBe(34);
  });
  it('permite curtos e documentários e impede duração excessiva',()=>{
    expect(durationAllowed(15)).toBe(true);
    expect(durationAllowed(600)).toBe(true);
    expect(durationAllowed(601)).toBe(false);
    expect(()=>rescaleStoryDuration(storytellingOvos,1)).toThrow();
  });
  it('estima palavras somente para planejamento',()=>{
    expect(countWords('Olá, pessoas de todo o Brasil')).toBe(6);
    expect(estimatedSpeechRange('uma duas três quatro')?.minSeconds).toBe(1);
  });
  it('separa tags de performance do texto falado',()=>{
    expect(cleanElevenPerformanceText('[curious] Você sabia?\n[thoughtful] É verdade.')).toBe('Você sabia?\nÉ verdade.');
  });
  it('divide vídeos longos em atos sem buracos',()=>{
    const acts=splitIntoActs(165);
    expect(acts[0].start).toBe(0);
    expect(acts[acts.length-1].end).toBe(165);
    expect(acts.every((act,i)=>i===0||act.start===acts[i-1].end)).toBe(true);
  });
});
