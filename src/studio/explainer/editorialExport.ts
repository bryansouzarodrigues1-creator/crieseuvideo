import type {ExplainerPlan} from './plan';
import {totalDuration} from './plan';
import {drawExplainerFrame} from './render';
import {audioCues,exportDuration,mixdown,EXPORT_FPS} from './exportTimeline';
import {encodeFixedFrame3DClip} from '../utils/deterministic3dExport';
export const EDITORIAL_MAX_SECONDS=120;
export function editorialExportStatus(plan:ExplainerPlan,track:AudioBuffer|null){
 if(!plan.scenes.length)return 'Crie as cenas antes de exportar.';
 if(plan.track&&!track)return 'A narração não está carregada. Importe o áudio novamente antes de exportar.';
 if(track&&(!plan.track||Math.abs(track.duration-plan.track)>.02))return 'A narração e a linha do tempo não correspondem. Reimporte o áudio.';
 if(!Number.isFinite(totalDuration(plan))||totalDuration(plan)<=0||exportDuration(plan,track?[{buffer:track,at:0}]:[])>EDITORIAL_MAX_SECONDS)return 'A exportação editorial aceita até 120 segundos, incluindo a cauda. Divida vídeos mais longos.';
 return null;
}
export async function exportEditorialVideo({plan,track,canvas,fps=EXPORT_FPS,onProgress,signal}:{plan:ExplainerPlan;track:AudioBuffer|null;canvas:HTMLCanvasElement;fps?:number;onProgress?:(p:number)=>void;signal?:AbortSignal}){
 if(plan.engine!=='2d'&&plan.engine!=='2.5d')throw Error('Use o exportador editorial apenas em 2D/2.5D.');
 const issue=editorialExportStatus(plan,track);if(issue)throw Error(issue);
 const context=canvas.getContext('2d');if(!context)throw Error('Canvas indisponível.');
 if(typeof VideoEncoder==='undefined')throw Error('Seu navegador não oferece WebCodecs. Use um navegador compatível; não exportaremos sem voz.');
 const cues=audioCues({plan,track,voiceKey:'local',buffers:new Map()});
 const duration=exportDuration(plan,cues);
 const mix=cues.length?await mixdown(cues,duration,track?.sampleRate??48000):undefined;
 return encodeFixedFrame3DClip({canvas,durationSeconds:duration,fps,renderFrame:t=>drawExplainerFrame(context,plan,Math.min(t,totalDuration(plan))),audioBuffer:mix,onProgress,signal,maxDurationSeconds:120});
}
