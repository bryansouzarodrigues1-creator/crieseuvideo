import { describe, expect, it } from 'vitest';
import { compileSceneProgram, type ProgramSource } from '../score';
import { compileDirection, DirectionError } from './direction';
import { DIRECTION_EXAMPLE, checkDirectionAnswer, directionSources, directionToClip, directionModels, directionPrompt, directionResponseSchema, parseDirection, parseDirectionJson } from './aiDirection';

const src: ProgramSource[] = [{ sourceId: 's1', text: 'O cofre abre.', duration: 4 }, { sourceId: 's2', text: 'Uma caixa sai.', duration: 4 }];
const clone = () => JSON.parse(JSON.stringify(DIRECTION_EXAMPLE));
const withVerbs = (verbs: unknown[], extraCast: unknown[] = []) => {
  const d = clone(); d.cast.push(...extraCast); d.scenes[0].verbs = verbs; return d;
};

describe('AI-written direction', () => {
  it('the example embedded in the prompt parses and compiles into a valid program', () => {
    const d = parseDirection(clone(), src);
    const program = compileDirection(d, src);
    compileSceneProgram(program, src);
    // Catalogue defaults were filled in by the validator, not by the model.
    expect(d.scenes[0].verbs[1]).toMatchObject({ do: 'open', part: 'porta', axis: 'y', angle: 2.0 });
    expect(d.scenes[0].verbs[0]).toMatchObject({ do: 'spin', part: 'volante', axis: 'z' });
  });
  it('only offers models that carry catalogue facts', () => {
    const ids = directionModels().map(([id]) => id);
    expect(ids).toContain('armored-truck-v1');
    expect(ids).not.toContain('expressive-robot-v1');
    const schema = directionResponseSchema(['s1', 's2']) as any;
    expect(schema.properties.cast.items.properties.assetId.enum).toEqual(ids);
    expect(schema.properties.scenes.minItems).toBe(2);
    expect(() => directionResponseSchema(['s1', 's3'])).toThrow();
  });
  it('the prompt carries the script, the catalogue facts and the rules', () => {
    const p = directionPrompt(src);
    for (const piece of ['O cofre abre.', 'armored-truck-v1', 'porta_traseira', 'raio 0.42', 'Andar de lado', 'piso interno em y=0.28']) expect(p).toContain(piece);
  });
  it('fills drive wheels and radius from the catalogue, scaled by the cast scale', () => {
    const d = parseDirection(withVerbs([{ do: 'drive', node: 'caminhao', by: [0, 0, 6] }],
      [{ id: 'caminhao', kind: 'model', assetId: 'armored-truck-v1', scale: [.5, .5, .5], position: [-8, 0, 0] }]), src);
    const v = d.scenes[0].verbs[0] as any;
    expect(v.wheels).toEqual(['roda_1', 'roda_2', 'roda_3', 'roda_4', 'roda_5', 'roda_6']);
    expect(v.wheelRadius).toBeCloseTo(.21);
    compileSceneProgram(compileDirection(d, src), src);
  });
  it('fills roll radius and centre from the catalogue', () => {
    const d = parseDirection(withVerbs([{ do: 'roll', node: 'moeda', dx: 3 }], [{ id: 'moeda', kind: 'model', assetId: 'giant-coin-v1', position: [0, 0, 2] }]), src);
    expect(d.scenes[0].verbs[0]).toMatchObject({ radius: .5, centerY: .5, dx: 3 });
  });
  it('treats null as absent, as models like to send it', () => {
    const d = clone(); d.scenes[0].verbs[0].at = null; d.cast[1].parent = null;
    expect(() => parseDirection(d, src)).not.toThrow();
  });
  it('strips a markdown fence but repairs nothing else', () => {
    expect(parseDirectionJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => parseDirectionJson('{"a":1,}')).toThrow(DirectionError);
    expect(() => parseDirectionJson('')).toThrow(DirectionError);
  });

  describe('rejects', () => {
    const bad = (mutate: (d: any) => void, re: RegExp) => { const d = clone(); mutate(d); expect(() => parseDirection(d, src)).toThrow(re); };
    it('unknown fields, URLs and scripts', () => {
      bad((d) => { d.script = 'alert(1)'; }, /não suportado/);
      bad((d) => { d.cast[0].url = 'https://evil'; }, /não suportado/);
      bad((d) => { d.scenes[0].verbs[0].onload = 'x'; }, /não suportado/);
      bad((d) => { d.cast[1].assetId = 'https://evil/x.glb'; }, /catálogo/);
    });
    it('models outside the AI catalogue', () => { bad((d) => { d.cast[1].assetId = 'expressive-robot-v1'; }, /catálogo/); });
    it('wrong counts, order and unknown nodes', () => {
      bad((d) => { d.scenes.pop(); }, /uma cena por frase/);
      bad((d) => { d.scenes.reverse(); }, /ordem/);
      bad((d) => { d.scenes[0].verbs[0].node = 'fantasma'; }, /elenco/);
      bad((d) => { d.scenes[0].shot.subjects = ['fantasma']; }, /elenco/);
      bad((d) => { d.cast.push({ id: 'chao', kind: 'mesh', shape: 'box', size: [1, 1, 1], color: '#000000' }); }, /repete/);
    });
    it('non-finite or out-of-range numbers and bad windows', () => {
      bad((d) => { d.cast[1].position = [1e9, 0, 0]; }, /número/);
      bad((d) => { d.scenes[1].verbs[1].to = [0, 'a', 3]; }, /número/);
      bad((d) => { d.scenes[0].verbs[0].at = [0.5, 0.5]; }, /curta/);
      bad((d) => { d.scenes[0].verbs[0].at = [0, 2]; }, /entre 0 e 1/);
      bad((d) => { d.background = 'red'; }, /#RRGGBB/);
    });
    it('parts that the model does not have and verbs on the wrong kind', () => {
      bad((d) => { d.scenes[0].verbs[1].part = 'asa'; }, /não tem a peça/);
      bad((d) => { d.scenes[0].verbs[1].node = 'chao'; }, /peças móveis/);
      bad((d) => { d.scenes[0].verbs[0].do = 'explode'; }, /desconhecido/);
    });
    it('too many verbs', () => { bad((d) => { d.scenes[0].verbs = Array.from({ length: 25 }, () => ({ do: 'appear', node: 'caixa' })); }, /No máximo/); });
  });

  it('a sideways drive written by the model is rejected by the compiler, not animated', () => {
    const d = parseDirection(withVerbs([{ do: 'drive', node: 'caminhao', by: [6, 0, 0] }],
      [{ id: 'caminhao', kind: 'model', assetId: 'armored-truck-v1', position: [-8, 0, 0] }]), src);
    expect(() => compileDirection(d, src)).toThrow(/de lado/);
  });

  describe('server glue', () => {
    it('assigns ids s1..sN and normalises text', () => {
      expect(directionSources([{ text: '  Olá   mundo, tudo bem  ', duration: 4 }, { text: 'Segunda frase aqui.', duration: 5 }]))
        .toEqual([{ sourceId: 's1', text: 'Olá mundo, tudo bem', duration: 4 }, { sourceId: 's2', text: 'Segunda frase aqui.', duration: 5 }]);
      expect(() => directionSources([])).toThrow(DirectionError);
      expect(() => directionSources(Array.from({ length: 9 }, () => ({ text: 'x'.repeat(20), duration: 3 })))).toThrow(DirectionError);
    });
    it('accepts a valid answer and reports why an invalid one failed, without echoing it', () => {
      expect(checkDirectionAnswer(JSON.stringify(DIRECTION_EXAMPLE), src)).toEqual({ accepted: true });
      expect(checkDirectionAnswer('```json\n' + JSON.stringify(DIRECTION_EXAMPLE) + '\n```', src)).toEqual({ accepted: true });
      expect(checkDirectionAnswer('não é json', src)).toEqual({ accepted: false, reason: 'invalid_json' });
      const bad = clone(); bad.scenes[0].verbs[0].node = 'fantasma';
      expect(checkDirectionAnswer(JSON.stringify(bad), src)).toEqual({ accepted: false, reason: 'invalid_scene' });
    });
    it('builds a playable clip with the sources, duration and one shot per sentence', () => {
      const clip = directionToClip(JSON.stringify(DIRECTION_EXAMPLE), src);
      expect(clip.duration).toBe(8);
      expect(clip.program.shots.map((x) => x.sourceId)).toEqual(['s1', 's2']);
      expect(clip.presentation?.beats).toHaveLength(2);
      compileSceneProgram(clip.program, clip.sources);
    });
  });

  it('first test with the money pack: a model-style direction with NO engine numbers compiles and moves', () => {
    const three: ProgramSource[] = [1, 2, 3].map((i) => ({ sourceId: 's' + i, text: 'frase ' + i, duration: 6 }));
    const d = {
      version: 1, background: '#BFD8E6',
      cast: [
        { id: 'chao', kind: 'mesh', shape: 'box', size: [80, .2, 80], position: [0, -.1, 0], color: '#C9D6DF' },
        { id: 'cofre', kind: 'model', assetId: 'giant-safe-v1' },
        { id: 'saco', kind: 'model', assetId: 'money-bag-v1', position: [0, .28, -.1] },
        { id: 'caminhao', kind: 'model', assetId: 'armored-truck-v1', hidden: true, position: [-6, 0, -30] },
        { id: 'moeda', kind: 'model', assetId: 'giant-coin-v1', hidden: true, position: [3, 0, .5] },
      ],
      scenes: [
        { sourceId: 's1', shot: { subjects: ['cofre', 'saco'], azimuth: .3, elevation: .16, distance: 1.15 }, verbs: [{ do: 'open', node: 'cofre', part: 'porta', at: [.2, .9] }] },
        { sourceId: 's2', shot: { subjects: ['caminhao'], azimuth: .5, elevation: .2, distance: 1.4 }, verbs: [
          { do: 'appear', node: 'caminhao', at: [0, .05] }, { do: 'drive', node: 'caminhao', by: [0, 0, 24], at: [0, 1] }] },
        { sourceId: 's3', shot: { subjects: ['moeda'], azimuth: .2, elevation: .15, distance: 1.1 }, verbs: [
          { do: 'appear', node: 'moeda', at: [0, .2] }, { do: 'roll', node: 'moeda', dx: 3, at: [.2, 1] }] },
      ],
    };
    const program = compileSceneProgram(compileDirection(parseDirection(d, three), three), three);
    const door = program.sample(6).get('cofre')!.parts!.porta[1];
    const z = (t: number) => program.sample(t).get('caminhao')!.position[2];
    const coin = (t: number) => program.sample(t).get('moeda')!.position[0];
    expect(door).toBeCloseTo(2.0);
    expect(z(12)).toBeCloseTo(-6, 0);
    expect(program.sample(11.9).get('caminhao')!.parts!.roda_1[0]).toBeGreaterThan(40);
    expect(coin(18)).toBeCloseTo(6, 0); // origin is the base, so after -6 rad it sits ~0.14 m off the centre, which travelled exactly dx
  });
});
