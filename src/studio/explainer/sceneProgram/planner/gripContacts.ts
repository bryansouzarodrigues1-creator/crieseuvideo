/**
 * Converts persistent possession events into reversible, bounded IK constraints
 * for the existing SceneProgram3D hand solvers.
 *
 * This is a visual contact constraint, NOT a dynamic parenting system or a
 * promise of believable fingers, weight, or interaction cinematography.
 * Generated contacts follow the SAME cargo root throughout the hold.
 */
import type { ProgramContact, ProgramSource, Vec3 } from '../score';
import type { CompiledStoryboard } from './events';

export interface GripContactPlan {
  contacts: ProgramContact[];
  windows: Array<{ cargo: string; actor: string; from: number; to: number; contactCount: number }>;
}

const fail = (s: string): never => { throw new Error('Coreografia de mãos: ' + s); };
const clamp = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Every source interval gets a separate contact, because SceneProgram3D
 * expresses IK intervals relative to the source line rather than the film.
 * The hand follows an actor-independent cargo target at absolute video time.
 */
export function planGripContacts(
  storyboard: CompiledStoryboard,
  sources: ProgramSource[],
  entityNodes: Record<string, string>,
  options: {
    gripOffsets?: Record<string, { left: Vec3; right: Vec3 }>;
    pickupBlendFraction?: number;
    releaseBlendFraction?: number;
  } = {}
): GripContactPlan {
  if (storyboard.sourceSignature !== JSON.stringify(sources.map(s => [s.sourceId, s.text])))
    return fail('Roteiro não corresponde à sequência de acontecimentos.');
  const pickupBlend = options.pickupBlendFraction ?? .80;
  const releaseBlend = options.releaseBlendFraction ?? .70;
  if (![pickupBlend, releaseBlend].every(v => Number.isFinite(v) && v > 0 && v < 1))
    return fail('Intervalos de alcance inválidos.');
  const spans: Array<{ id: string; start: number; end: number }> = [];
  let elapsed = 0;
  for (const s of sources) {
    const duration = s.duration ?? 3;
    if (!Number.isFinite(duration) || duration <= 0)
      return fail('Duração de frase inválida.');
    spans.push({ id: s.sourceId, start: elapsed, end: elapsed + duration });
    elapsed += duration;
  }
  if (Math.abs(elapsed - storyboard.duration) > .01)
    return fail('Duração do storyboard difere das falas.');
  const defaultOffsets: { left: Vec3; right: Vec3 } = {
    left: [-.18, 0, 0],
    right: [.18, 0, 0]
  };
  const contacts: ProgramContact[] = [];
  const windows: GripContactPlan['windows'] = [];
  for (const [index, event] of storyboard.events.entries()) {
    if (event.action !== 'pick_up') continue;
    if (!event.actor || !entityNodes[event.actor] || !entityNodes[event.subject])
      return fail('A posse deve referenciar personagem e carga 3D existentes.');
    const pickupEffect = event.effects.find(x => x.entity === event.subject);
    if (pickupEffect?.after.heldBy !== event.actor)
      return fail('A ação de pegar não estabeleceu posse real do objeto.');
    const ending = storyboard.events.slice(index + 1).find(other =>
      other.effects.some(x => x.entity === event.subject &&
        x.before.heldBy === event.actor && x.after.heldBy !== event.actor));
    const from = event.start + (event.end - event.start) * pickupBlend;
    const to = ending
      ? ending.start + (ending.end - ending.start) * releaseBlend
      : storyboard.duration;
    if (to <= from + .0001) return fail('O intervalo das mãos terminou antes da posse.');
    const offsets = options.gripOffsets?.[event.subject] ?? defaultOffsets;
    for (const candidate of [offsets.left, offsets.right]) {
      if (!Array.isArray(candidate) || candidate.length !== 3 ||
          candidate.some(x => typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > 3))
        return fail('Offset de agarrar é inválido ou grande demais.');
    }
    const startCount = contacts.length;
    for (const span of spans) {
      const beginAbs = Math.max(from, span.start);
      const endAbs = Math.min(to, span.end);
      if (endAbs <= beginAbs + .0001) continue;
      const begin = clamp((beginAbs - span.start) / (span.end - span.start));
      const end = clamp((endAbs - span.start) / (span.end - span.start));
      for (const [effector, offset] of [
        ['leftHand', offsets.left], ['rightHand', offsets.right]
      ] as const) {
        contacts.push({
          sourceId: span.id,
          actor: entityNodes[event.actor],
          target: entityNodes[event.subject],
          effector,
          offset: [...offset],
          begin,
          end
        });
      }
    }
    windows.push({
      cargo: event.subject, actor: event.actor, from, to,
      contactCount: contacts.length - startCount
    });
  }
  if (contacts.length > 100) return fail('Limite de contatos corporais excedido.');
  return { contacts, windows };
}
