import { describe, expect, it } from 'vitest';
import { SCENE_PROGRAM_GUIDE } from './guide';

describe('freeform 3D generic visual direction', () => {
  it('asks for recognizable objects, action readability and coherent camera framing', () => {
    expect(SCENE_PROGRAM_GUIDE).toContain('SILHUETA');
    expect(SCENE_PROGRAM_GUIDE).toContain('o plano decisivo deve mostrar a peça que se move');
    expect(SCENE_PROGRAM_GUIDE).toContain('mesmo sem áudio, texto ou legendas');
    expect(SCENE_PROGRAM_GUIDE).toContain('além de TODAS as bordas visíveis da câmera');
  });

  it('keeps safety, compact-output and source fidelity constraints intact', () => {
    expect(SCENE_PROGRAM_GUIDE).toContain('não uma lista de objetos ou movimentos prontos');
    expect(SCENE_PROGRAM_GUIDE).toContain('6 a 16 nós visíveis');
    expect(SCENE_PROGRAM_GUIDE).toContain('NÃO crie JavaScript');
    expect(SCENE_PROGRAM_GUIDE).toContain('Uma scene para CADA sourceId');
  });

  it('does not require infinite ground or prohibit intentionally finite platforms', () => {
    expect(SCENE_PROGRAM_GUIDE).toContain('Preserve plataformas realmente finitas');
    expect(SCENE_PROGRAM_GUIDE).toContain('dimensões até 200 metros');
  });
});

describe('rounded edges and engine-provided look', () => {
  it('documents bevel for boxes and the engine-side sky/ground', () => {
    expect(SCENE_PROGRAM_GUIDE).toContain('bevelSegments');
    expect(SCENE_PROGRAM_GUIDE).toContain('continua automaticamente um solo');
  });
});

describe('expressive 3D without generic placeholders or obligatory humans', () => {
  it('prioritizes varied stylized objects over unrealistic humans or single-color balls', () => {
    expect(SCENE_PROGRAM_GUIDE).toContain('DIFERENTES');
    expect(SCENE_PROGRAM_GUIDE).toContain('um tomate NÃO é apenas uma esfera vermelha');
    expect(SCENE_PROGRAM_GUIDE).toContain('sem realismo fotográfico');
    expect(SCENE_PROGRAM_GUIDE).toContain('não uma pessoa genérica mostrando um objeto');
  });
  it('defaults to stable locked framing and requires explicit intent for lateral camera motion', () => {
    expect(SCENE_PROGRAM_GUIDE).toContain('motion:"locked" é o PADRÃO');
    expect(SCENE_PROGRAM_GUIDE).toContain('motion:"orbit" SOMENTE');
    expect(SCENE_PROGRAM_GUIDE).toContain('tomada INTEIRA');
  });
});
