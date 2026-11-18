import { describe, expect, it } from 'vitest';
import { compileStoryEvents } from './events';
import type { ProgramSource } from '../score';

const sources: ProgramSource[] = [
  { sourceId: 's1', text: 'O trabalhador pega uma caixa e a leva até a plataforma.' },
  { sourceId: 's2', text: 'Ele coloca a caixa sobre a plataforma e liga o guincho.' },
  { sourceId: 's3', text: 'O guincho levanta a plataforma com a caixa até o andar superior.' }
];
const scenario = () => ({
  version: 1,
  duration: 14,
  entities: [
    { id: 'base', kind: 'place' },
    { id: 'plataforma', kind: 'place' },
    { id: 'andar_superior', kind: 'place' },
    { id: 'trabalhador', kind: 'actor', at: 'base' },
    { id: 'caixa', kind: 'prop', at: 'base' },
    { id: 'elevador', kind: 'prop', at: 'plataforma' },
    { id: 'guincho', kind: 'mechanism', at: 'plataforma', controls: ['elevador'] }
  ],
  events: [
    { id: 'mostrar', action: 'focus', sourceId: 's1',
      evidence: 'O trabalhador pega uma caixa',
      start: 0, end: .6, subject: 'caixa', purpose: 'Mostrar qual caixa será transportada' },
    { id: 'pegar', action: 'pick_up', sourceId: 's1', actor: 'trabalhador',
      evidence: 'pega uma caixa', start: .6, end: 1.6, subject: 'caixa',
      purpose: 'Mostrar o saco saindo do chão para a mão' },
    { id: 'levar', action: 'carry', sourceId: 's1', actor: 'trabalhador',
      evidence: 'a leva até a plataforma', start: 1.6, end: 4, subject: 'caixa',
      destination: 'plataforma', dependsOn: ['pegar'],
      purpose: 'Manter a mesma caixa durante o transporte' },
    { id: 'apoiar', action: 'put_down', sourceId: 's2', actor: 'trabalhador',
      evidence: 'coloca a caixa sobre a plataforma', start: 4, end: 5.4,
      subject: 'caixa', destination: 'plataforma', support: 'elevador',
      purpose: 'Demonstrar a caixa apoiada na base móvel' },
    { id: 'ligar', action: 'activate', sourceId: 's2', actor: 'trabalhador',
      evidence: 'liga o guincho', start: 5.4, end: 6.5, subject: 'guincho',
      purpose: 'Exibir o acionamento do mecanismo que moverá a carga' },
    { id: 'subir', action: 'operate', sourceId: 's3', mechanism: 'guincho',
      evidence: 'O guincho levanta a plataforma', start: 6.5, end: 12,
      subject: 'elevador', destination: 'andar_superior', dependsOn: ['ligar'],
      purpose: 'Mostrar o mesmo conjunto de plataforma e caixa sendo içado' },
    { id: 'resultado', action: 'focus', sourceId: 's3',
      evidence: 'a caixa até o andar superior', start: 12, end: 14, subject: 'caixa',
      purpose: 'Mostrar a caixa alcançando o destino junto com o elevador' }
  ]
});

const changes = (event: ReturnType<typeof compileStoryEvents>['events'][number]) =>
  event.effects.map(effect => effect.entity);

describe('story events: causality before meshes and cameras', () => {
  it('preserves the SAME cargo ID through pickup, carry, place and mechanism-operated lift', () => {
    const plan = compileStoryEvents(scenario(), sources);
    expect(plan.events).toHaveLength(7);
    expect(changes(plan.events[1]!)).toEqual(['caixa']);
    expect(changes(plan.events[2]!)).toEqual(['trabalhador', 'caixa']);
    expect(plan.events[3]!.effects.find(e => e.entity === 'caixa')?.after).toMatchObject({
      at: 'plataforma', heldBy: null, on: 'elevador'
    });
    expect(changes(plan.events[5]!)).toEqual(['caixa', 'elevador']);
    expect(plan.finalStates.caixa).toMatchObject({
      at: 'andar_superior', on: 'elevador', heldBy: null
    });
    expect(plan.finalStates.guincho.active).toBe(true);
    expect(plan.warnings).toEqual([]);
    expect(plan.sourceSignature).toBe(JSON.stringify(sources.map(s => [s.sourceId, s.text])));
  });

  it('rejects a film where cargo moves before someone picks it up', () => {
    const film: any = scenario();
    film.events = [film.events[0], film.events[2]];
    film.events[1].start = .6; film.events[1].end = 2;
    film.events[1].dependsOn = [];
    expect(() => compileStoryEvents(film, sources)).toThrow(/antes de pegá-lo/);
  });

  it('rejects a motor turning without being activated', () => {
    const film: any = scenario();
    film.events.splice(4, 1);
    film.events.find((e: any) => e.id === 'subir').dependsOn = [];
    expect(() => compileStoryEvents(film, sources)).toThrow(/Mecanismo desligado/);
  });

  it('rejects operating an unrelated machine even when it is turned on', () => {
    const film: any = scenario();
    film.entities.find((e: any) => e.id === 'guincho').controls = ['caixa'];
    expect(() => compileStoryEvents(film, sources)).toThrow(/não controla essa carga/);
  });

  it('rejects handing off cargo from an actor who never held it', () => {
    const film: any = scenario();
    film.events.find((e: any) => e.id === 'apoiar').actor = 'desconhecido';
    expect(() => compileStoryEvents(film, sources)).toThrow(/entidade inexistente/);
  });

  it('rejects a fabricated source quote even when the object and movement are valid', () => {
    const film: any = scenario();
    film.events[2].evidence = 'O helicóptero mágico levou a caixa voando';
    expect(() => compileStoryEvents(film, sources)).toThrow(/evidência literal/);
  });

  it('rejects action timelines that invert the order of original narration beats', () => {
    const film: any = scenario();
    film.events[4].sourceId = 's1';
    film.events[4].evidence = 'O trabalhador';
    expect(() => compileStoryEvents(film, sources)).toThrow(/inverter a ordem do roteiro/);
  });

  it('rejects overlapping actions that move the same actor or cargo', () => {
    const film: any = scenario();
    film.events[2].start = 1.3;
    expect(() => compileStoryEvents(film, sources)).toThrow(/Ações paralelas disputam/);
  });

  it('rejects destination teleportation and fake pickup from an unrelated location', () => {
    const film: any = scenario();
    film.entities.find((e: any) => e.id === 'trabalhador').at = 'plataforma';
    expect(() => compileStoryEvents(film, sources)).toThrow(/objeto distante/);
  });

  it('rejects self-support and loops between props', () => {
    const film: any = scenario();
    film.entities.find((e: any) => e.id === 'caixa').on = 'caixa';
    expect(() => compileStoryEvents(film, sources)).toThrow(/Apoio inicial inválido/);
  });

  it('rejects unknown keys, scriptless actors and scene-geometry-injected JSON', () => {
    const film: any = scenario();
    film.events[0].cameraJavascript = 'doEvil()';
    expect(() => compileStoryEvents(film, sources)).toThrow(/campo não suportado/);
  });

  it('flags long static focus or invisible story gaps without pretending to understand visual quality', () => {
    const film: any = scenario();
    film.duration = 22;
    film.events[6].start = 12; film.events[6].end = 17;
    const plan = compileStoryEvents(film, sources);
    expect(plan.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'extended_non_event', event: 'resultado' }),
      expect.objectContaining({ kind: 'unseen_consequence' })
    ]));
  });

  it('prevents submitting the same object twice as different identities', () => {
    const film: any = scenario();
    film.entities.push({id:'caixa',kind:'prop',at:'base'});
    expect(() => compileStoryEvents(film, sources)).toThrow(/IDs únicos/);
  });
});
