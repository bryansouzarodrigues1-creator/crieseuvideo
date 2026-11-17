/**
 * Safe, deterministic clip scheduling for real skinned GLB characters.
 *
 * The browser plays named, pre-authored AnimationClips on the GLB's skeleton.
 * A model only runs ONE chosen clip (never the 24 clips simultaneously).
 * Pure absolute-time seeking: out-of-order MP4 frame rendering stays identical.
 * This does not synthesize human motions or infer when to grab a prop.
 */
import * as THREE from 'three';

export interface RiggedClipCue {
  start: number; // absolute seconds in scene timeline
  clip: string; // must exist in the inspected, approved GLB
  speed?: number; // .25..3
  loop?: boolean;
}
export class RiggedClipError extends Error {}

const EPS = 1e-8;
export function validateRiggedCues(clips: THREE.AnimationClip[], cues: RiggedClipCue[]): RiggedClipCue[] {
  if (!clips.length) throw new RiggedClipError('Modelo 3D sem animações de esqueleto.');
  if (cues.length > 64) throw new RiggedClipError('Mais de 64 ações no personagem.');
  if (!cues.length) throw new RiggedClipError('Selecione pelo menos uma animação real.');
  const names = new Set(clips.map(x => x.name));
  for (let i=0;i<cues.length;i++) {
    const cue=cues[i]!;
    if (!names.has(cue.clip)) throw new RiggedClipError('Clip ausente no GLB: '+cue.clip);
    if (!Number.isFinite(cue.start) || cue.start < 0 || cue.start > 600)
      throw new RiggedClipError('Tempo inválido para clip.');
    if (i === 0 && cue.start !== 0) throw new RiggedClipError('A primeira ação deve começar em 0.');
    if (i && cue.start <= cues[i-1]!.start+EPS) throw new RiggedClipError('Ordem/intervalo de clips inválido.');
    if (cue.speed !== undefined && (!Number.isFinite(cue.speed)||cue.speed<.25||cue.speed>3))
      throw new RiggedClipError('Velocidade da animação fora do limite.');
  }
  return cues.map(x=>({start:x.start,clip:x.clip,speed:x.speed??1,loop:x.loop??true}));
}

export class RiggedClipPlayer {
  readonly mixer: THREE.AnimationMixer;
  readonly clips: string[];
  readonly root: THREE.Object3D;
  private cues: RiggedClipCue[];
  private readonly sources: THREE.AnimationClip[];
  private activeName: string | null = null;
  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[], cues: RiggedClipCue[]) {
    this.root=root;
    this.sources=[...clips];
    this.mixer=new THREE.AnimationMixer(root);
    this.clips=clips.map(c=>c.name);
    this.cues=validateRiggedCues(clips,cues);
    for (const clip of clips) this.mixer.clipAction(clip);
  }
  setCues(cues: RiggedClipCue[]) {
    // No dynamic URL or eval. Only named clips already loaded from this GLB.
    this.cues=validateRiggedCues(this.sources,cues);
    this.activeName=null;
  }
  private availableClips(): THREE.AnimationClip[] { return this.sources; }
  at(time: number): { clip: string; clipTime: number } {
    if (!Number.isFinite(time)) throw new RiggedClipError('Tempo de reprodução inválido.');
    const t=Math.max(0,time);
    let cue=this.cues[0]!;
    for (const next of this.cues) if (t>=next.start-EPS) cue=next; else break;
    const clip=THREE.AnimationClip.findByName(this.availableClips(),cue.clip);
    if (!clip) throw new RiggedClipError('O clip selecionado desapareceu.');
    const elapsed=(t-cue.start)*(cue.speed??1);
    const clipTime=cue.loop===false?Math.min(elapsed,clip.duration):elapsed%clip.duration;
    // stopAllAction removes all other tracks (unlike the previous implementation).
    // reset/replay on every seek avoids order-dependent playback state.
    this.mixer.stopAllAction();
    // Imported GLBs often have separate, sparse clips: Walk animates leg/wrist
    // bones while Interact does not animate every ancestor. A previous clip's
    // residual transforms can distort the next clip by metres. Restore the
    // ORIGINAL skeleton bind pose before each absolute-time evaluation.
    this.root.traverse(object => {
      if (object instanceof THREE.SkinnedMesh) object.skeleton.pose();
    });
    const action=this.mixer.clipAction(clip);
    action.reset().setLoop(cue.loop===false?THREE.LoopOnce:THREE.LoopRepeat, cue.loop===false?1:Infinity);
    action.clampWhenFinished=true;
    action.play();
    this.mixer.setTime(clipTime);
    this.activeName=cue.clip;
    this.root.updateMatrixWorld(true);
    return {clip:cue.clip,clipTime};
  }
  get activeClip() { return this.activeName; }
  socket(part: 'root'|'head'|'leftHand'|'rightHand'|'leftFoot'|'rightFoot'): THREE.Object3D {
    if (part === 'root') return this.root;
    // Quaternius Worker/Casual: wrist bones actually named Wrist.L/Wrist.R.
    // Unsupported sockets fail explicitly; never attach tools to model origin.
    const names: Record<Exclude<typeof part, 'root'>, string[]> = {
      head: ['Head', 'head'],
      leftHand: ['Wrist.L', 'Hand.L', 'Palm.L'],
      rightHand: ['Wrist.R', 'Hand.R', 'Palm.R'],
      leftFoot: ['Foot.L', 'Ankle.L'],
      rightFoot: ['Foot.R', 'Ankle.R'],
    };
    const normalized = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const expected = new Set(names[part].map(normalized));
    let target: THREE.Object3D | undefined;
    this.root.traverse(obj => {
      if (target || !(obj instanceof THREE.Bone)) return;
      const candidate = normalized(obj.name);
      if (expected.has(candidate) ||
          [...expected].some(prefix => candidate.startsWith(prefix) && /^\d+$/.test(candidate.slice(prefix.length))))
        target = obj;
    });
    if (!target)
      throw new RiggedClipError('Esqueleto incompatível: falta articulação '+part);
    return target;
  }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); }
}
