/** Offline browser encoding: submit every frame, independently of rendering speed. */
import { Output, BufferTarget, Mp4OutputFormat, WebMOutputFormat, CanvasSource, AudioBufferSource,
  Quality, getFirstEncodableVideoCodec, getFirstEncodableAudioCodec } from 'mediabunny';

export interface FrameEncodingInput {
  canvas: HTMLCanvasElement;
  duration: number;
  fps?: number;
  audio?: AudioBuffer | null;
  draw(time: number): void;
  onProgress?(percent: number): void;
  signal?: AbortSignal;
  mp4Only?: boolean;
}
export async function encodeFrames(input: FrameEncodingInput) {
  const { canvas, duration, audio } = input, fps = input.fps ?? 30;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isInteger(fps) || fps <= 0) throw new Error('A duração da exportação é inválida.');
  if (!canvas.width || !canvas.height || canvas.width % 2 || canvas.height % 2) throw new Error('O formato do vídeo precisa de dimensões pares.');
  const width = canvas.width, height = canvas.height, quality = new Quality({ bitrate: width * height > 1e6 ? 5e6 : 3.5e6 });
  const avc = await getFirstEncodableVideoCodec(['avc'], { width, height, frameRate: fps, quality });
  const aac = audio ? await getFirstEncodableAudioCodec(['aac'], { sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels }) : 'aac';
  const mp4 = !!avc && !!aac;
  if (!mp4 && input.mp4Only) return null;
  const videoCodec = mp4 ? avc : await getFirstEncodableVideoCodec(['vp9', 'vp8'], { width, height, frameRate: fps, quality });
  const audioCodec = !audio ? null : mp4 ? aac : await getFirstEncodableAudioCodec(['opus'], { sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels });
  if (!videoCodec || audio && !audioCodec) return null;
  const target = new BufferTarget(), output = new Output({ target, format: mp4 ? new Mp4OutputFormat() : new WebMOutputFormat() });
  const video = new CanvasSource(canvas, { codec: videoCodec, quality, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: fps });
  const sound = audio && audioCodec ? new AudioBufferSource({ codec: audioCodec, quality: new Quality({ bitrate: 128e3 }) }) : null;
  if (sound) output.addAudioTrack(sound);
  const frames = Math.ceil(duration * fps - 1e-8);
  try {
    await output.start();
    if (sound && audio) { await sound.add(audio); sound.close(); }
    for (let n = 0; n < frames; n++) {
      if (input.signal?.aborted) throw new Error('A exportação foi cancelada.');
      if (canvas.width !== width || canvas.height !== height) throw new Error('O formato mudou durante a exportação. Tente novamente.');
      input.draw(n / fps);
      await video.add(n / fps, 1 / fps);
      if (n % 6 === 0 || n === frames - 1) {
        input.onProgress?.(Math.round((n + 1) / frames * 100));
        // Return input control without using wall-clock time as video time.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    video.close(); await output.finalize();
    if (!target.buffer?.byteLength) throw new Error('A exportação não gerou dados.');
    return { blob: new Blob([target.buffer], { type: mp4 ? 'video/mp4' : 'video/webm' }), extension: mp4 ? 'mp4' : 'webm', frames, fps, duration: frames / fps, codec: videoCodec };
  } catch (error) { await output.cancel().catch(() => {}); throw error; }
}
