import { describe, expect, it } from 'vitest';
import { buildVideoRequest, productionSchema, isActiveProduction } from './production';

describe('open visual creation', () => {
  it('preserves non-human subjects instead of replacing them with a stickman preset', () => {
    const input = productionSchema.parse({ prompt: 'Uma raposa de papel voa entre planetas de vidro.', style: 'cartoon', aspectRatio: '9:16', duration: 6, resolution: '720p' });
    const request = buildVideoRequest(input);
    expect(request.input).toContain(input.prompt);
    expect(request.input).toContain('2D cartoon');
    expect(request.response_format.aspect_ratio).toBe('9:16');
    expect(request.model).toBe('google/gemini-omni-1.1-flash');
  });
  it('supports a different 3D visual direction with the same open brief', () => {
    const request = buildVideoRequest({ prompt: 'Um robô planta uma floresta.', style: 'animation3d', aspectRatio: '16:9', duration: 8, resolution: '1080p' });
    expect(request.input).toContain('stylized 3D');
    expect(request.response_format.duration).toBe('8s');
  });
  it('does not treat failed jobs as active work', () => {
    expect(isActiveProduction('failed')).toBe(false);
    expect(isActiveProduction('in_progress')).toBe(true);
  });
});