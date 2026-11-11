import type { StickmanScene } from '../types/stickman';
import { importedModelStage } from './importedModelStage';
import { getSceneImage } from './sceneImages';

export function renderSceneComposition(ctx: CanvasRenderingContext2D, scene: StickmanScene, progress: number, engine: string, base: () => void): boolean {
  ctx.save();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  let ready = true;
  if (scene.importedModel && engine === '3d_webgl') {
    ready = importedModelStage.render(ctx, scene, progress * scene.duration);
  } else {
    base();
    if (scene.backgroundImage && engine === '2d_canvas') {
      const image = getSceneImage(scene.backgroundImage.url);
      ready = image.complete && image.naturalWidth > 0;
    }
  }
  if (scene.liveTitle?.enabled && scene.liveTitle.text.trim()) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const editorial = scene.liveTitle.style === 'editorial';
    const maxWidth = w * 0.84;
    let size = Math.min(64, w * 0.065);
    const text = scene.liveTitle.text.trim();
    ctx.font = `${editorial ? 'italic 700' : '700'} ${size}px ${editorial ? 'Georgia' : 'sans-serif'}`;
    while (ctx.measureText(text).width > maxWidth && size > 10) {
      size -= 1; ctx.font = `${editorial ? 'italic 700' : '700'} ${size}px ${editorial ? 'Georgia' : 'sans-serif'}`;
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#142a29'; ctx.fillRect(w * 0.06, h * 0.09, w * 0.88, size + 36);
    ctx.fillStyle = '#f7faf8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h * 0.09 + (size + 36) / 2, maxWidth);
  }
  ctx.restore();
  return ready;
}