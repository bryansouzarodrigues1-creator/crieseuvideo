/**
 * Stage ONE of a narrative-first 3D workflow.
 *
 * Structured story events, NOT mesh keyframes or executable code. The
 * storyboard is compiled/validated before any model/asset generation.
 * The compiler verifies persistent identity and state transitions;
 * it does not claim to understand narration or render a film.
 *
 * Standalone on PR #39's tested 3D base. Deliberately does not modify
 * director.ts, collision code, database migrations or production routes.
 */
import type { ProgramSource } from '../score';

export type StoryEntityKind = 'actor' | 'prop' | 'mechanism' | 'place';
export type StoryAction =
  | 'focus' | 'move' | 'pick_up' | 'carry' | 'put_down'
  | 'activate' | 'deactivate' | 'operate' | 'change' | 'react';

export interface StoryEntity {
  id: string;
  kind: StoryEntityKind;
  /** The named stage location, NOT a Three.js coordinate. */
  at?: string;
  /** Optional object support, e.g. a sack resting on a moving platform. */
  on?: string;
  /** Optional carrier when the story begins with an object already held. */
  heldBy?: string;
  /** Mechanisms can affect only the named objects they control. */
  controls?: string[];
  active?: boolean;
  mode?: string;
}

export interface StoryEvent {
  id: string;
  sourceId: string;
  /** Original contiguous quote within the source beat; prevents invented narration. */
  evidence: string;
  start: number;
  end: number;
  action: StoryAction;
  /** Persistent entity ID; the same object must survive between events. */
  subject: string;
  actor?: string;
  destination?: string;
  support?: string;
  mechanism?: string;
  outcome?: string;
  dependsOn?: string[];
  /** Why a viewer needs this action, not a camera angle. */
  purpose: string;
}

export interface StoryboardProposal {
  version: 1;
  duration: number;
  entities: StoryEntity[];
  events: StoryEvent[];
}

export interface StoryState {
  at: string | null;
  on: string | null;
  heldBy: string | null;
  active: boolean;
  mode: string;
}
export interface StoryEffect {
  entity: string;
  before: StoryState;
  after: StoryState;
}
export interface CompiledStoryEvent extends StoryEvent {
  effects: StoryEffect[];
}
export interface StoryboardWarning {
  kind: 'long_gap' | 'extended_non_event' | 'unseen_consequence';
  event?: string;
  seconds?: number;
}
export interface CompiledStoryboard {
  version: 1;
  sourceSignature: string;
  duration: number;
  entities: StoryEntity[];
  events: CompiledStoryEvent[];
  finalStates: Record<string, StoryState>;
  warnings: StoryboardWarning[];
  limitations: string;
}
export class StoryboardError extends Error {
  readonly code = 'invalid_storyboard';
}

const invalid = (message: string): never => { throw new StoryboardError(message); };
const own = (x: unknown, where: string): Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x)
    ? x as Record<string, unknown> : invalid(where + ' precisa ser um objeto.');
const keys = (r: Record<string, unknown>, allowed: readonly string[], where: string) => {
  const unexpected = Object.keys(r).find(key => !allowed.includes(key));
  if (unexpected) invalid(where + ' contém campo não suportado: ' + unexpected);
};
const array = (x: unknown, max: number, where: string): unknown[] => {
  if (!Array.isArray(x) || x.length > max) invalid(where + ' excede o limite ou não é uma lista.');
  for (let i = 0; i < x.length; i++) {
    if (!(i in x)) invalid(where + ' contém entrada vazia.');
  }
  return x;
};
const id = (x: unknown, what: string): string =>
  typeof x === 'string' && /^[a-z][a-z0-9_-]{0,39}$/.test(x)
    ? x : invalid(what + ' contém identificador inválido.');
const text = (x: unknown, what: string, min: number, max: number): string =>
  typeof x === 'string' && x.trim().length >= min && x.length <= max
    ? x.trim() : invalid(what + ' precisa de texto válido.');
const time = (x: unknown, what: string): number =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 240
    ? x : invalid(what + ' está fora da duração permitida.');
const optionalId = (x: unknown, what: string): string | undefined =>
  x === undefined ? undefined : id(x, what);
const stateCopy = (s: StoryState): StoryState => ({ ...s });

function parseEntities(input: unknown): StoryEntity[] {
  const entities = array(input, 80, 'entities').map((raw): StoryEntity => {
    const e = own(raw, 'entity');
    keys(e, ['id', 'kind', 'at', 'on', 'heldBy', 'controls', 'active', 'mode'], 'entity');
    if (!['actor', 'prop', 'mechanism', 'place'].includes(String(e.kind)))
      invalid('Tipo de entidade 3D desconhecido.');
    if (e.active !== undefined && typeof e.active !== 'boolean')
      invalid('active precisa ser booleano.');
    const kind = e.kind as StoryEntityKind;
    const controls = e.controls === undefined ? undefined
      : array(e.controls, 32, 'controls').map(x => id(x, 'controls'));
    if (controls && kind !== 'mechanism') invalid('Somente mecanismos controlam outras peças.');
    if (e.active !== undefined && kind !== 'mechanism') invalid('Somente mecanismos podem estar ligados.');
    if (kind === 'place' && (e.at !== undefined || e.on !== undefined || e.heldBy !== undefined))
      invalid('Lugares não ficam em outros lugares nem podem ser segurados.');
    if (kind !== 'place' && e.at === undefined)
      invalid('Toda entidade física precisa de um lugar inicial.');
    if (kind !== 'prop' && (e.on !== undefined || e.heldBy !== undefined))
      invalid('Apenas objetos transportáveis podem ter suporte ou portador.');
    if (e.on !== undefined && e.heldBy !== undefined)
      invalid('Um objeto não pode estar sobre uma superfície e na mão ao mesmo tempo.');
    return {
      id: id(e.id, 'entity.id'), kind,
      ...(e.at === undefined ? {} : { at: id(e.at, 'entity.at') }),
      ...(e.on === undefined ? {} : { on: id(e.on, 'entity.on') }),
      ...(e.heldBy === undefined ? {} : { heldBy: id(e.heldBy, 'entity.heldBy') }),
      ...(controls === undefined ? {} : { controls }),
      ...(e.active === undefined ? {} : { active: e.active as boolean }),
      ...(e.mode === undefined ? {} : { mode: text(e.mode, 'mode', 2, 48) })
    };
  });
  if (!entities.length || new Set(entities.map(e => e.id)).size !== entities.length)
    invalid('O planejamento precisa de entidades com IDs únicos.');
  const byId = new Map(entities.map(e => [e.id, e]));
  for (const e of entities) {
    if (e.kind === 'place') continue;
    if (byId.get(e.at!)?.kind !== 'place') invalid('Localização inicial inexistente para ' + e.id);
    if (e.heldBy) {
      const holder = byId.get(e.heldBy);
      if (holder?.kind !== 'actor' || holder.at !== e.at)
        invalid('O portador inicial deve ser um ator no mesmo lugar do objeto.');
    }
    if (e.on) {
      const support = byId.get(e.on);
      if (!support || !['prop', 'mechanism'].includes(support.kind) || support.at !== e.at || support.id === e.id)
        invalid('Apoio inicial inválido ou em outro lugar.');
      const visited = new Set([e.id]);
      let ancestor: StoryEntity | undefined = support;
      while (ancestor) {
        if (visited.has(ancestor.id)) invalid('Os objetos criaram um ciclo de apoios.');
        visited.add(ancestor.id);
        ancestor = ancestor.on ? byId.get(ancestor.on) : undefined;
      }
    }
    for (const target of e.controls ?? []) {
      if (byId.get(target)?.kind !== 'prop') invalid('Mecanismo controla um objeto que não existe.');
    }
    if (e.controls && new Set(e.controls).size !== e.controls.length)
      invalid('Mecanismo controla o mesmo objeto duas vezes.');
  }
  return entities;
}

const ACTIONS: readonly StoryAction[] = [
  'focus', 'move', 'pick_up', 'carry', 'put_down', 'activate',
  'deactivate', 'operate', 'change', 'react'
];

function parseEvents(input: unknown, sources: ProgramSource[], duration: number): StoryEvent[] {
  const sourceIndex = new Map(sources.map((s, i) => [s.sourceId, i]));
  const out = array(input, 80, 'events').map((raw): StoryEvent => {
    const e = own(raw, 'event');
    keys(e, ['id','sourceId','evidence','start','end','action','subject','actor',
      'destination','support','mechanism','outcome','dependsOn','purpose'], 'event');
    const sourceId = id(e.sourceId, 'sourceId');
    const beat = sources[sourceIndex.get(sourceId) ?? -1];
    if (!beat) invalid('A ação cita trecho de roteiro inexistente.');
    const evidence = text(e.evidence, 'evidence', 3, 250);
    const normalize = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
    if (!normalize(beat!.text).includes(normalize(evidence)))
      invalid('A ação não possui evidência literal na frase de origem.');
    if (!ACTIONS.includes(e.action as StoryAction)) invalid('Ação fora do contrato.');
    const start = time(e.start, 'start'), end = time(e.end, 'end');
    if (end - start < .15 || end > duration + 1e-6) invalid('Ação com duração ou ordem temporal inválida.');
    const dependsOn = e.dependsOn === undefined ? undefined
      : array(e.dependsOn, 16, 'dependsOn').map(x => id(x, 'dependsOn'));
    return {
      id:id(e.id,'event.id'), sourceId, evidence, start, end,
      action:e.action as StoryAction, subject:id(e.subject,'subject'),
      purpose:text(e.purpose,'purpose',8,180),
      ...(e.actor === undefined ? {} : {actor: optionalId(e.actor,'actor')}),
      ...(e.destination === undefined ? {} : {destination: optionalId(e.destination,'destination')}),
      ...(e.support === undefined ? {} : {support: optionalId(e.support,'support')}),
      ...(e.mechanism === undefined ? {} : {mechanism: optionalId(e.mechanism,'mechanism')}),
      ...(e.outcome === undefined ? {} : {outcome:text(e.outcome,'outcome',2,48)}),
      ...(dependsOn === undefined ? {} : {dependsOn})
    };
  });
  if (!out.length || new Set(out.map(e=>e.id)).size !== out.length)
    invalid('A história precisa de acontecimentos com IDs únicos.');
  for (let i=1;i<out.length;i++) {
    if (out[i]!.start < out[i-1]!.start - 1e-6) invalid('Ações precisam seguir ordem cronológica.');
    if ((sourceIndex.get(out[i]!.sourceId) ?? -1) < (sourceIndex.get(out[i-1]!.sourceId) ?? -1))
      invalid('As ações não podem inverter a ordem do roteiro.');
  }
  return out;
}

/**
 * Returns an immutable semantic trace for downstream scene authoring.
 * Uses a trusted model of state changes rather than accepting model-asserted
 * before/after fields. This is NOT a physics engine or an animation player.
 */
export function compileStoryEvents(raw: unknown, sources: ProgramSource[]): CompiledStoryboard {
  if (!Array.isArray(sources) || !sources.length || sources.length > 100 ||
      new Set(sources.map(x => x.sourceId)).size !== sources.length)
    invalid('Roteiro de origem inválido.');
  const root=own(raw, 'storyboard');
  keys(root, ['version','duration','entities','events'], 'storyboard');
  if (root.version !== 1) invalid('Versão do planejador incompatível.');
  const duration=time(root.duration,'duration');
  if (duration < 1) invalid('Vídeo curto demais para planejamento.');
  const entities=parseEntities(root.entities);
  const events=parseEvents(root.events,sources,duration);
  const byId=new Map(entities.map(e=>[e.id,e]));
  const states=new Map<string,StoryState>(entities.map(e=>[
    e.id, { at:e.at ?? null, heldBy:e.heldBy??null, on:e.on??null,
      active:e.active??false, mode:e.mode??'idle' }
  ]));
  const state=(entityId:string):StoryState=>{
    const s=states.get(entityId);
    if (!s) invalid('Entidade ausente na continuidade: '+entityId);
    return s!;
  };
  const kind=(entityId:string,k:StoryEntityKind)=>{
    if(byId.get(entityId)?.kind!==k) invalid('Ação exige '+k+': '+entityId);
  };
  const place=(location:string|undefined):string=>{
    if(!location || byId.get(location)?.kind!=='place') invalid('Destino não é um lugar existente.');
    return location!;
  };
  const actor=(event:StoryEvent):string=>{
    if(!event.actor) invalid('A ação exige um ator que executa o movimento.');
    kind(event.actor!,'actor');
    return event.actor!;
  };
  const assertUnused=(e:StoryEvent,allowed:string[])=>{
    for(const field of ['actor','destination','support','mechanism','outcome'] as const){
      if(e[field]!==undefined && !allowed.includes(field))
        invalid('A ação '+e.id+' contém campo sem sentido: '+field);
    }
  };
  const moveWith=(entityId:string,dest:string)=>{
    state(entityId).at=dest;
    // Cargo on an object travels with it, without creating a new copy.
    for(const e of entities){
      if(state(e.id).on===entityId) moveWith(e.id,dest);
    }
    // Moving actor transports everything actually held by that actor.
    for(const e of entities){
      if(state(e.id).heldBy===entityId) moveWith(e.id,dest);
    }
  };
  const compiled:CompiledStoryEvent[]=[];
  const completed=new Map<string,number>();
  const warnings:StoryboardWarning[]=[];
  let previousEnd=0;
  for(let i=0;i<events.length;i++){
    const event=events[i]!;
    const s=state(event.subject);
    const subject=byId.get(event.subject)!;
    if(!subject) invalid('Ação cita objeto que nunca foi criado.');
    for (const idName of [event.actor,event.destination,event.support,event.mechanism]){
      if(idName && !byId.has(idName)) invalid('Ação cita entidade inexistente: '+idName);
    }
    const participants=[event.subject,event.actor,event.mechanism,event.support].filter((v):v is string=>!!v);
    for(let j=0;j<i;j++){
      const prior=events[j]!;
      if(prior.end <= event.start+1e-6)continue;
      const involved=[prior.subject,prior.actor,prior.mechanism,prior.support];
      if(participants.some(p=>involved.includes(p)))
        invalid('Ações paralelas disputam o mesmo objeto/ator: '+prior.id+' e '+event.id);
    }
    for(const d of event.dependsOn??[]){
      const end=completed.get(d);
      if(end===undefined||end>event.start+1e-6)
        invalid('Dependência causal ausente, futura ou não concluída: '+d);
    }
    if(event.start-previousEnd>3.5)
      warnings.push({kind:'long_gap',seconds:Number((event.start-previousEnd).toFixed(2))});
    previousEnd=Math.max(previousEnd,event.end);
    const before=new Map([...states].map(([id,s])=>[id,stateCopy(s)]));
    switch(event.action){
      case 'focus':
        assertUnused(event,[]);
        break;
      case 'move':{
        assertUnused(event,['destination']);
        if(!['actor','prop'].includes(subject.kind))invalid('Apenas personagem/objeto pode mudar de lugar.');
        if(s.heldBy || s.on)invalid('Objeto apoiado ou segurado não pode se teleportar sozinho.');
        const dest=place(event.destination);
        if(s.at===dest)invalid('Movimento sem mudança de lugar.');
        moveWith(event.subject,dest);
        break;
      }
      case 'pick_up':{
        assertUnused(event,['actor']);
        kind(event.subject,'prop');
        const who=actor(event);
        if(s.heldBy || state(who).at!==s.at)invalid('Não é possível pegar objeto distante ou já segurado.');
        s.heldBy=who;s.on=null;
        break;
      }
      case 'carry':{
        assertUnused(event,['actor','destination']);
        kind(event.subject,'prop');
        const who=actor(event), dest=place(event.destination);
        if(s.heldBy!==who)invalid('Não se pode transportar objeto antes de pegá-lo.');
        if(state(who).at===dest)invalid('O transporte não mudou de local.');
        moveWith(who,dest);
        break;
      }
      case 'put_down':{
        assertUnused(event,['actor','destination','support']);
        kind(event.subject,'prop');
        const who=actor(event),dest=place(event.destination);
        if(s.heldBy!==who||state(who).at!==dest)
          invalid('Objeto precisa estar na mão e no local para ser apoiado.');
        if(event.support){
          const surface=byId.get(event.support)!;
          if(!['prop','mechanism'].includes(surface.kind)||event.support===event.subject)
            invalid('Superfície de apoio não é válida.');
          if(state(surface.id).at!==dest)invalid('Objeto e apoio estão em lugares diferentes.');
          let current:string|null=surface.id;
          while(current){
            if(current===event.subject)invalid('Apoio causa ciclo geométrico.');
            current=state(current).on;
          }
        }
        s.heldBy=null;s.on=event.support??null;s.at=dest;
        break;
      }
      case 'activate':
      case 'deactivate':{
        assertUnused(event,['actor']);
        kind(event.subject,'mechanism');
        if(event.actor && state(actor(event)).at!==s.at)
          invalid('Operador distante do mecanismo.');
        const desired=event.action==='activate';
        if(s.active===desired)invalid('O mecanismo já estava no estado solicitado.');
        s.active=desired;
        break;
      }
      case 'operate':{
        assertUnused(event,['mechanism','destination']);
        kind(event.subject,'prop');
        if(!event.mechanism)invalid('A movimentação precisa do mecanismo responsável.');
        kind(event.mechanism!,'mechanism');
        if(!state(event.mechanism!).active)invalid('Mecanismo desligado não pode movimentar a carga.');
        if(!byId.get(event.mechanism!)!.controls?.includes(event.subject))
          invalid('O mecanismo não controla essa carga.');
        if(s.heldBy)invalid('Uma carga segurada não pode ser operada por uma máquina simultaneamente.');
        const dest=place(event.destination);
        if(s.at===dest)invalid('Operação não tem consequência visível.');
        moveWith(event.subject,dest);
        break;
      }
      case 'change':
      case 'react':{
        assertUnused(event,['outcome']);
        if(event.action==='react')kind(event.subject,'actor');
        if(!event.outcome||s.mode===event.outcome)invalid('Ação não descreve mudança de estado.');
        s.mode=event.outcome!;
        break;
      }
    }
    const effects=[...states].flatMap(([entity,after])=>{
      const prior=before.get(entity)!;
      return prior.at!==after.at || prior.on!==after.on ||
        prior.heldBy!==after.heldBy || prior.active!==after.active ||
        prior.mode!==after.mode
        ? [{entity,before:prior,after:stateCopy(after)}] : [];
    });
    if(!effects.length && event.action!=='focus')
      invalid('Ação não produz efeito verificável: '+event.id);
    if(event.action==='focus' && event.end-event.start>3.5)
      warnings.push({kind:'extended_non_event',event:event.id,seconds:Number((event.end-event.start).toFixed(2))});
    compiled.push({...event,effects});
    completed.set(event.id,event.end);
  }
  if(duration-previousEnd>3.5)
    warnings.push({kind:'unseen_consequence',seconds:Number((duration-previousEnd).toFixed(2))});
  const finalStates=Object.fromEntries([...states].map(([id,s])=>[id,stateCopy(s)]));
  return {
    version:1,
    sourceSignature:JSON.stringify(sources.map(s=>[s.sourceId,s.text])),
    duration,entities,events:compiled,finalStates,warnings,
    limitations:'Verifica referências, estado, posse, ordem e efeitos declarativos. Não interpreta se a ação corresponde semanticamente à narração nem produz automaticamente malhas, física ou MP4.'
  };
}
