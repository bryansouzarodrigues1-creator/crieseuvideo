import { z } from 'zod';

export const productionSchema = z.object({
  prompt: z.string().trim().min(8, 'Descreva a cena com pelo menos 8 caracteres.').max(4000),
  style: z.enum(['cinematic', 'animation3d', 'anime', 'cartoon', 'motion']),
  aspectRatio: z.enum(['16:9', '9:16']),
  duration: z.number().int().min(3).max(10),
  resolution: z.enum(['720p', '1080p']),
});
export type ProductionInput = z.infer<typeof productionSchema>;
export const PRODUCTION_STYLES = [
  { id: 'animation3d', label: 'Animação 3D', direction: 'Polished stylized 3D animation, expressive characters, physically grounded movement, rich materials, detailed environments and studio-quality lighting.' },
  { id: 'cartoon', label: 'Cartoon 2D', direction: 'Hand-drawn expressive 2D cartoon animation, strong silhouettes, appealing character design, squash and stretch, clean line work and illustrated backgrounds.' },
  { id: 'anime', label: 'Anime', direction: 'Original cinematic 2D anime animation, detailed illustrated scenery, expressive acting, precise timing and dynamic perspective.' },
  { id: 'cinematic', label: 'Cinema', direction: 'Cinematic photorealistic visual treatment, coherent staging, realistic materials and natural movement.' },
  { id: 'motion', label: 'Motion graphics', direction: 'Professional motion design, precise typography when requested, controlled transitions, strong visual hierarchy and thoughtfully animated objects.' },
] as const;

export function buildVideoRequest(input: ProductionInput) {
  const style = PRODUCTION_STYLES.find((item) => item.id === input.style);
  return {
    model: 'google/gemini-omni-1.1-flash',
    input: `Create a complete ${input.duration}-second original animation. Visual direction: ${style?.direction}\nUser scene brief (follow faithfully, including subjects, actions, camera and exact quoted text):\n${input.prompt}\nConsider micro-detail, expression, anticipation, physical contact and timing. Keep subject identity and spatial continuity consistent. Resolve the action within the clip. Compose for ${input.aspectRatio}. No watermarks. No on-screen text unless explicitly requested. Audio: atmospheric sound and appropriate sound effects; no dialogue unless explicitly requested. Requested dialogue must be in Brazilian Portuguese.`,
    response_format: { type: 'video' as const, resolution: input.resolution, duration: `${input.duration}s`, aspect_ratio: input.aspectRatio },
  };
}

export function isActiveProduction(status: string) {
  return ['creating', 'queued', 'in_progress'].includes(status);
}