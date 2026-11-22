/** Maximum export length is 60 s for Code2D; expect slower processing on mobile.\n * Exporting a realtime captureStream gives unpredictable frame counts on slow
 * mobile GPUs. Render SceneProgram3D at fixed timeline coordinates and feed every
 * frame into a WebCodecs-based muxer. No API calls or external rendering service. */
export interface Encoded3DClip {
  blob: Blob;
  filenameExtension: 'mp4' | 'webm';
  frames: number;
  fps: number;
}
export interface FixedFrameExport {
  canvas: HTMLCanvasElement;
  durationSeconds: number;
  fps: number;
  /** May be async (e.g. frames rendered inside the sandboxed code-3D iframe). */
  renderFrame: (time: number) => void | Promise<void>;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  /** Optional imported narration, encoded into the same MP4/WebM timeline. */
  audioBuffer?: AudioBuffer;
}

export async function encodeFixedFrame3DClip({
  canvas,durationSeconds,fps,renderFrame,onProgress,signal,audioBuffer,
}:FixedFrameExport):Promise<Encoded3DClip>{
  if(typeof VideoEncoder==='undefined'){
    throw new Error('Seu navegador não possui WebCodecs para gerar MP4 com quadros fixos.');
  }
  if(!Number.isFinite(durationSeconds)||durationSeconds<=0||durationSeconds>60||
    !Number.isInteger(fps)||fps<12||fps>60){
    throw new Error('Parâmetros de renderização inválidos.');
  }
  if(audioBuffer && (!Number.isFinite(audioBuffer.duration) ||
    Math.abs(audioBuffer.duration-durationSeconds)>1/fps+.01)){
    throw new Error('A duração da narração deve coincidir com a duração exportada.');
  }
  const {Output,Mp4OutputFormat,WebMOutputFormat,BufferTarget,
    CanvasSource,AudioBufferSource,Quality,
    getFirstEncodableVideoCodec,getFirstEncodableAudioCodec}=await import('mediabunny');
  const mp4=new Mp4OutputFormat();
  const request={width:canvas.width,height:canvas.height};
  const avc=await getFirstEncodableVideoCodec(['avc'],request);
  const webm=new WebMOutputFormat();
  const audioOptions=audioBuffer ? {
    sampleRate:audioBuffer.sampleRate,numberOfChannels:audioBuffer.numberOfChannels
  } : undefined;
  const aac=audioBuffer?await getFirstEncodableAudioCodec(['aac'],audioOptions):null;
  const mp4Ready=!!avc&&(!audioBuffer||!!aac);
  const codec=mp4Ready?avc:await getFirstEncodableVideoCodec(['vp9','vp8'],request);
  if(!codec)throw new Error('Este dispositivo não possui um codificador de vídeo compatível.');
  const audioCodec=audioBuffer?(mp4Ready?aac:await getFirstEncodableAudioCodec(['opus'],audioOptions)):null;
  if(audioBuffer&&!audioCodec)throw new Error('Este dispositivo não consegue codificar a narração em AAC ou Opus.');
  const output=new Output({format:mp4Ready?mp4:webm,target:new BufferTarget()});
  const source=new CanvasSource(canvas,{
    codec,quality:new Quality({bitrate:4_500_000}),
    latencyMode:'quality'
  });
  output.addVideoTrack(source,{frameRate:fps});
  const audioSource=audioBuffer&&audioCodec
    ? new AudioBufferSource({codec:audioCodec,quality:new Quality({bitrate:128_000})})
    : null;
  if(audioSource)output.addAudioTrack(audioSource);
  let started=false;
  try{
    await output.start();started=true;
    const frames=Math.round(durationSeconds*fps);
    for(let i=0;i<frames;i++){
      if(signal?.aborted)throw new Error('Exportação cancelada.');
      const time=i/fps;
      await renderFrame(time);
      await source.add(time,1/fps,{keyFrame:i%fps===0});
      if(i%6===0 || i===frames-1)onProgress?.(Math.round((i+1)*100/frames));
      // Yield EVERY frame: WebCodecs can otherwise monopolize the UI thread on Android.
      // Frame timestamps remain fixed even when encoding needs more wall-clock time.
      await new Promise<void>(resolve=>setTimeout(resolve,0));
      if(signal?.aborted)throw new Error('Exportação cancelada.');
    }
    source.close();
    if(audioSource&&audioBuffer){
      if(signal?.aborted)throw new Error('Exportação cancelada.');
      await audioSource.add(audioBuffer);
      audioSource.close();
    }
    await output.finalize();
    const buffer=output.target.buffer;
    if(!buffer?.byteLength)throw new Error('O codificador não devolveu dados.');
    return {
      blob:new Blob([buffer],{type:mp4Ready?'video/mp4':'video/webm'}),
      filenameExtension:mp4Ready?'mp4':'webm',frames,fps,
    };
  }catch(e){
    if(started)await output.cancel().catch(()=>{});
    throw e;
  }
}
